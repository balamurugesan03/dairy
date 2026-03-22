/**
 * purchaseReturnController.js  —  Debit Note (Purchase Return)
 * ─────────────────────────────────────────────────────────────────────────────
 * Accounting on Save:
 *
 *  Credit Purchase Return (paymentMode = 'Credit'):
 *    Dr  Supplier A/c               grandTotal
 *    Cr  Purchase Returns A/c       taxableAmount + roundOff
 *    Cr  CGST / SGST / IGST Input   (reverse ITC)
 *    → Supplier ledger updated  |  Day Book: YES  |  Cash Book: NO
 *
 *  Cash Purchase Return (paymentMode = Cash / Bank / UPI):
 *    Dr  Cash / Bank A/c            receivedAmount  ← Receipt → Cash Book
 *    Dr  Supplier A/c               balance          (if partial)
 *    Cr  Purchase Returns A/c       taxableAmount + roundOff
 *    Cr  CGST / SGST / IGST Input
 *    → Day Book: YES  |  Cash Book: YES (Receipt)
 */

import PurchaseReturn           from '../models/PurchaseReturn.js';
import BusinessItem             from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import { getNextSequence }      from '../models/Counter.js';
import {
  createPurchaseReturnVoucher,
  reverseAndDeleteReturnVoucher
} from '../utils/returnAccountingHelper.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateReturnNumber = async (companyId) => {
  const now = new Date();
  const yy  = now.getFullYear().toString().slice(-2);
  const mm  = (now.getMonth() + 1).toString().padStart(2, '0');
  const seq = await getNextSequence(`dn-${yy}${mm}-${companyId || 'global'}`, 0);
  return `DN${yy}${mm}-${seq.toString().padStart(4, '0')}`;
};

const calcItems = (items, supplierState) => {
  let totalQty = 0, grossAmount = 0, itemDiscount = 0;
  let taxableAmount = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  const processedItems = items.map(item => {
    const qty             = parseFloat(item.quantity)        || 0;
    const rate            = parseFloat(item.rate)            || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const gstPercent      = parseFloat(item.gstPercent)      || 0;

    const amount         = qty * rate;
    const discountAmount = (amount * discountPercent) / 100;
    const taxable        = amount - discountAmount;
    const isInterState   = supplierState && supplierState !== 'Tamil Nadu';

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = (taxable * gstPercent) / 100;
    } else {
      cgst = (taxable * gstPercent) / 200;
      sgst = (taxable * gstPercent) / 200;
    }

    totalQty      += qty;
    grossAmount   += amount;
    itemDiscount  += discountAmount;
    taxableAmount += taxable;
    totalCgst += cgst; totalSgst += sgst; totalIgst += igst;

    return {
      itemId: item.itemId,
      itemCode: item.itemCode || '', itemName: item.itemName || '',
      hsnCode: item.hsnCode || '', quantity: qty, unit: item.unit || '',
      rate, discountPercent, discountAmount,
      taxableAmount: taxable, gstPercent,
      cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
      totalAmount: parseFloat((taxable + cgst + sgst + igst).toFixed(2))
    };
  });

  const totalGst  = totalCgst + totalSgst + totalIgst;
  const netAmount = taxableAmount + totalGst;
  return { processedItems, totals: { totalQty, grossAmount, itemDiscount, taxableAmount, totalCgst, totalSgst, totalIgst, totalGst, netAmount } };
};

const applyStockOut = async (items, returnDoc, returnDate, supplierName, companyId) => {
  for (const item of items) {
    const bi = await BusinessItem.findById(item.itemId);
    if (!bi) continue;
    bi.currentBalance -= item.quantity;
    await bi.save();
    await new BusinessStockTransaction({
      itemId: item.itemId, transactionType: 'Stock Out',
      quantity: item.quantity, rate: item.rate, balanceAfter: bi.currentBalance,
      referenceType: 'Return', referenceId: returnDoc._id,
      date: returnDate || new Date(), supplierName: supplierName || '',
      notes: `Purchase Return — ${returnDoc.returnNumber}`, companyId
    }).save();
  }
};

const reverseStockOut = async (items) => {
  for (const item of items) {
    const bi = await BusinessItem.findById(item.itemId);
    if (bi) { bi.currentBalance += item.quantity; await bi.save(); }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export const createPurchaseReturn = async (req, res) => {
  try {
    const {
      returnDate, supplierId, supplierName, supplierPhone,
      supplierAddress, supplierGstin, supplierState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items, roundOff, paymentMode, receivedAmount, notes
    } = req.body;

    const companyId = req.companyId;

    if (!items?.length)
      return res.status(400).json({ message: 'At least one item is required' });

    const enriched = [];
    for (const item of items) {
      const bi = await BusinessItem.findById(item.itemId);
      if (!bi) return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      const qty = parseFloat(item.quantity) || 0;
      if (qty > bi.currentBalance)
        return res.status(400).json({ message: `Insufficient stock for "${bi.itemName}". Available: ${bi.currentBalance}` });
      enriched.push({
        ...item,
        itemCode: bi.itemCode, itemName: bi.itemName,
        hsnCode: item.hsnCode || bi.hsnCode || '',
        unit:    item.unit    || bi.unit    || '',
        rate:    parseFloat(item.rate) || bi.purchasePrice || 0,
        gstPercent: parseFloat(item.gstPercent) ?? bi.gstPercent ?? 0
      });
    }

    const { processedItems, totals } = calcItems(enriched, supplierState);
    const { taxableAmount, totalCgst, totalSgst, totalIgst, totalGst } = totals;

    const ro         = parseFloat(roundOff) || (Math.round(totals.netAmount) - totals.netAmount);
    const grandTotal = parseFloat((totals.netAmount + ro).toFixed(2));
    const received   = parseFloat(receivedAmount) || 0;
    const balance    = parseFloat((grandTotal - received).toFixed(2));

    const paymentStatus =
      received >= grandTotal ? 'Received' :
      received > 0           ? 'Partial'  : 'Pending';

    const returnNumber = await generateReturnNumber(companyId);

    const purchaseReturn = await new PurchaseReturn({
      returnNumber, returnDate: returnDate || new Date(),
      supplierId: supplierId || null, supplierName, supplierPhone,
      supplierAddress, supplierGstin, supplierState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items: processedItems,
      totalQty: totals.totalQty, grossAmount: totals.grossAmount,
      itemDiscount: totals.itemDiscount,
      taxableAmount, totalCgst, totalSgst, totalIgst, totalGst,
      roundOff: ro, grandTotal,
      paymentMode: paymentMode || 'Cash',
      paymentStatus, receivedAmount: received, balanceAmount: balance,
      notes, businessType: 'Private Firm', companyId
    }).save();

    // ── Accounting Voucher ────────────────────────────────────────────────────
    await createPurchaseReturnVoucher({
      purchaseReturn, returnNumber,
      returnDate: returnDate || new Date(),
      supplierName, paymentMode: paymentMode || 'Cash',
      taxableAmount, totalCgst, totalSgst, totalIgst,
      roundOff: ro, grandTotal, receivedAmount: received, balanceAmount: balance,
      companyId
    });

    // ── Stock Out ─────────────────────────────────────────────────────────────
    await applyStockOut(processedItems, purchaseReturn, returnDate, supplierName, companyId);

    return res.status(201).json({ success: true, data: purchaseReturn });
  } catch (error) {
    console.error('[createPurchaseReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const updatePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!purchaseReturn) return res.status(404).json({ message: 'Purchase return not found' });

    await reverseAndDeleteReturnVoucher('PurchaseReturn', purchaseReturn._id);
    await reverseStockOut(purchaseReturn.items);
    await BusinessStockTransaction.deleteMany({ referenceType: 'Return', referenceId: purchaseReturn._id });

    const {
      returnDate, supplierId, supplierName, supplierPhone,
      supplierAddress, supplierGstin, supplierState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items, roundOff, paymentMode, receivedAmount, notes
    } = req.body;

    const companyId = req.companyId;

    const enriched = [];
    for (const item of items) {
      const bi = await BusinessItem.findById(item.itemId);
      if (!bi) continue;
      const qty = parseFloat(item.quantity) || 0;
      if (qty > bi.currentBalance)
        return res.status(400).json({ message: `Insufficient stock for "${bi.itemName}". Available: ${bi.currentBalance}` });
      enriched.push({
        ...item,
        itemCode: bi.itemCode, itemName: bi.itemName,
        hsnCode: item.hsnCode || bi.hsnCode || '',
        unit:    item.unit    || bi.unit    || '',
        rate:    parseFloat(item.rate) || bi.purchasePrice || 0,
        gstPercent: parseFloat(item.gstPercent) ?? bi.gstPercent ?? 0
      });
    }

    const { processedItems, totals } = calcItems(enriched, supplierState);
    const { taxableAmount, totalCgst, totalSgst, totalIgst, totalGst } = totals;

    const ro         = parseFloat(roundOff) || (Math.round(totals.netAmount) - totals.netAmount);
    const grandTotal = parseFloat((totals.netAmount + ro).toFixed(2));
    const received   = parseFloat(receivedAmount) || 0;
    const balance    = parseFloat((grandTotal - received).toFixed(2));

    const paymentStatus =
      received >= grandTotal ? 'Received' :
      received > 0           ? 'Partial'  : 'Pending';

    Object.assign(purchaseReturn, {
      returnDate: returnDate || purchaseReturn.returnDate,
      supplierId: supplierId || null, supplierName, supplierPhone,
      supplierAddress, supplierGstin, supplierState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items: processedItems,
      totalQty: totals.totalQty, grossAmount: totals.grossAmount,
      itemDiscount: totals.itemDiscount,
      taxableAmount, totalCgst, totalSgst, totalIgst, totalGst,
      roundOff: ro, grandTotal,
      paymentMode: paymentMode || 'Cash',
      paymentStatus, receivedAmount: received, balanceAmount: balance, notes
    });
    await purchaseReturn.save();

    await createPurchaseReturnVoucher({
      purchaseReturn,
      returnNumber: purchaseReturn.returnNumber,
      returnDate: returnDate || purchaseReturn.returnDate,
      supplierName, paymentMode: paymentMode || 'Cash',
      taxableAmount, totalCgst, totalSgst, totalIgst,
      roundOff: ro, grandTotal, receivedAmount: received, balanceAmount: balance,
      companyId
    });

    await applyStockOut(processedItems, purchaseReturn, returnDate, supplierName, companyId);

    return res.json({ success: true, data: purchaseReturn });
  } catch (error) {
    console.error('[updatePurchaseReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export const deletePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!purchaseReturn) return res.status(404).json({ message: 'Purchase return not found' });

    await reverseAndDeleteReturnVoucher('PurchaseReturn', purchaseReturn._id);
    await reverseStockOut(purchaseReturn.items);
    await BusinessStockTransaction.deleteMany({ referenceId: purchaseReturn._id });
    await PurchaseReturn.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'Purchase return deleted successfully' });
  } catch (error) {
    console.error('[deletePurchaseReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export const getAllPurchaseReturns = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, paymentStatus, status, startDate, endDate, supplierId } = req.query;
    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { returnNumber:       { $regex: search, $options: 'i' } },
        { supplierName:       { $regex: search, $options: 'i' } },
        { supplierPhone:      { $regex: search, $options: 'i' } },
        { originalInvoiceRef: { $regex: search, $options: 'i' } }
      ];
    }
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (status)        query.status        = status;
    if (supplierId)    query.supplierId     = supplierId;
    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate)   query.returnDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [returns, total] = await Promise.all([
      PurchaseReturn.find(query)
        .populate('supplierId', 'name phone')
        .sort({ returnDate: -1, createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      PurchaseReturn.countDocuments(query)
    ]);

    return res.json({
      success: true, data: returns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getPurchaseReturnById = async (req, res) => {
  try {
    const doc = await PurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('supplierId', 'name phone address gstin')
      .populate('items.itemId', 'itemName itemCode hsnCode unit');
    if (!doc) return res.status(404).json({ message: 'Purchase return not found' });
    return res.json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getPurchaseReturnSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { companyId: req.companyId, status: 'Active' };
    if (startDate || endDate) {
      match.returnDate = {};
      if (startDate) match.returnDate.$gte = new Date(startDate);
      if (endDate)   match.returnDate.$lte = new Date(endDate);
    }
    const [summary] = await PurchaseReturn.aggregate([
      { $match: match },
      { $group: { _id: null, totalReturns: { $sum: 1 }, totalAmount: { $sum: '$grandTotal' }, totalReceived: { $sum: '$receivedAmount' }, totalPending: { $sum: '$balanceAmount' } } }
    ]);
    return res.json({ success: true, data: summary || { totalReturns: 0, totalAmount: 0, totalReceived: 0, totalPending: 0 } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default { createPurchaseReturn, getAllPurchaseReturns, getPurchaseReturnById, updatePurchaseReturn, deletePurchaseReturn, getPurchaseReturnSummary };

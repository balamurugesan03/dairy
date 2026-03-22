/**
 * salesReturnController.js  —  Credit Note (Sales Return)
 * ─────────────────────────────────────────────────────────────────────────────
 * Accounting on Save:
 *
 *  Credit Sale Return (paymentMode = 'Credit'):
 *    Dr  Sales Returns A/c          taxableAmount + roundOff
 *    Dr  CGST / SGST / IGST Output  (reverse output tax)
 *    Cr  Customer A/c               grandTotal
 *    → Customer ledger updated  |  Day Book: YES  |  Cash Book: NO
 *
 *  Cash Sale Return (paymentMode = Cash / Bank / UPI):
 *    Dr  Sales Returns A/c          taxableAmount + roundOff
 *    Dr  CGST / SGST / IGST Output
 *    Cr  Cash / Bank A/c            paidAmount      ← Payment → Cash Book
 *    Cr  Customer A/c               balance          (if partial)
 *    → Day Book: YES  |  Cash Book: YES (Payment)
 */

import SalesReturn           from '../models/SalesReturn.js';
import BusinessItem          from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import { getNextSequence }   from '../models/Counter.js';
import {
  createSalesReturnVoucher,
  reverseAndDeleteReturnVoucher
} from '../utils/returnAccountingHelper.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateReturnNumber = async (companyId) => {
  const now = new Date();
  const yy  = now.getFullYear().toString().slice(-2);
  const mm  = (now.getMonth() + 1).toString().padStart(2, '0');
  const seq = await getNextSequence(`cn-${yy}${mm}-${companyId || 'global'}`, 0);
  return `CN${yy}${mm}-${seq.toString().padStart(4, '0')}`;
};

/** Calculate per-item amounts, returns { processedItems, totals } */
const calcItems = (items, customerState) => {
  let totalQty = 0, grossAmount = 0, itemDiscount = 0;
  let taxableAmount = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  const processedItems = items.map(item => {
    const qty             = parseFloat(item.quantity)       || 0;
    const rate            = parseFloat(item.rate)           || 0;
    const discountPercent = parseFloat(item.discountPercent)|| 0;
    const gstPercent      = parseFloat(item.gstPercent)     || 0;

    const amount         = qty * rate;
    const discountAmount = (amount * discountPercent) / 100;
    const taxable        = amount - discountAmount;
    const isInterState   = customerState && customerState !== 'Tamil Nadu';

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
    totalCgst     += cgst;
    totalSgst     += sgst;
    totalIgst     += igst;

    return {
      itemId: item.itemId,
      itemCode: item.itemCode || '',
      itemName: item.itemName || '',
      hsnCode:  item.hsnCode  || '',
      quantity: qty, unit: item.unit || '',
      rate, discountPercent, discountAmount,
      taxableAmount: taxable, gstPercent,
      cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
      totalAmount: parseFloat((taxable + cgst + sgst + igst).toFixed(2))
    };
  });

  const totalGst  = totalCgst + totalSgst + totalIgst;
  const netAmount = taxableAmount + totalGst;

  return {
    processedItems,
    totals: { totalQty, grossAmount, itemDiscount, taxableAmount, totalCgst, totalSgst, totalIgst, totalGst, netAmount }
  };
};

/** Update stock in for each item (sales return: customer gives back goods) */
const applyStockIn = async (items, returnDoc, returnDate, customerName, companyId) => {
  for (const item of items) {
    const bi = await BusinessItem.findById(item.itemId);
    if (!bi) continue;
    bi.currentBalance += item.quantity;
    await bi.save();
    await new BusinessStockTransaction({
      itemId: item.itemId,
      transactionType: 'Stock In',
      quantity:     item.quantity,
      rate:         item.rate,
      balanceAfter: bi.currentBalance,
      referenceType: 'Sales Return',
      referenceId:   returnDoc._id,
      date:          returnDate || new Date(),
      customerName:  customerName || '',
      notes:        `Sales Return — ${returnDoc.returnNumber}`,
      companyId
    }).save();
  }
};

/** Reverse stock in (used on update/delete) */
const reverseStockIn = async (items) => {
  for (const item of items) {
    const bi = await BusinessItem.findById(item.itemId);
    if (bi) { bi.currentBalance -= item.quantity; await bi.save(); }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export const createSalesReturn = async (req, res) => {
  try {
    const {
      returnDate, customerId, customerName, customerPhone,
      customerAddress, customerGstin, customerState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items, roundOff, paymentMode, paidAmount, notes
    } = req.body;

    const companyId = req.companyId;

    if (!items?.length)
      return res.status(400).json({ message: 'At least one item is required' });

    // Enrich items with item master data
    const enriched = [];
    for (const item of items) {
      const bi = await BusinessItem.findById(item.itemId);
      if (!bi) return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      enriched.push({
        ...item,
        itemCode: bi.itemCode,
        itemName: bi.itemName,
        hsnCode:  item.hsnCode || bi.hsnCode || '',
        unit:     item.unit    || bi.unit    || '',
        rate:     parseFloat(item.rate) || bi.salesRate || bi.sellingPrice || 0,
        gstPercent: parseFloat(item.gstPercent) ?? bi.gstPercent ?? 0
      });
    }

    const { processedItems, totals } = calcItems(enriched, customerState);
    const { taxableAmount, totalCgst, totalSgst, totalIgst, totalGst } = totals;

    const ro         = parseFloat(roundOff) || (Math.round(totals.netAmount) - totals.netAmount);
    const grandTotal = parseFloat((totals.netAmount + ro).toFixed(2));
    const paid       = parseFloat(paidAmount) || 0;
    const balance    = parseFloat((grandTotal - paid).toFixed(2));

    const paymentStatus =
      paid >= grandTotal ? 'Paid' :
      paid > 0           ? 'Partial' : 'Pending';

    const returnNumber = await generateReturnNumber(companyId);

    const salesReturn = await new SalesReturn({
      returnNumber, returnDate: returnDate || new Date(),
      customerId: customerId || null, customerName, customerPhone,
      customerAddress, customerGstin, customerState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items:        processedItems,
      totalQty:     totals.totalQty,
      grossAmount:  totals.grossAmount,
      itemDiscount: totals.itemDiscount,
      taxableAmount, totalCgst, totalSgst, totalIgst, totalGst,
      roundOff: ro, grandTotal,
      paymentMode:   paymentMode || 'Cash',
      paymentStatus, paidAmount: paid, balanceAmount: balance,
      notes, businessType: 'Private Firm', companyId
    }).save();

    // ── Accounting Voucher ────────────────────────────────────────────────────
    await createSalesReturnVoucher({
      salesReturn, returnNumber,
      returnDate: returnDate || new Date(),
      customerName, paymentMode: paymentMode || 'Cash',
      taxableAmount, totalCgst, totalSgst, totalIgst,
      roundOff: ro, grandTotal, paidAmount: paid, balanceAmount: balance,
      companyId
    });

    // ── Stock In ──────────────────────────────────────────────────────────────
    await applyStockIn(processedItems, salesReturn, returnDate, customerName, companyId);

    return res.status(201).json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('[createSalesReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const updateSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesReturn) return res.status(404).json({ message: 'Sales return not found' });

    // Reverse old accounting + stock
    await reverseAndDeleteReturnVoucher('SalesReturn', salesReturn._id);
    await reverseStockIn(salesReturn.items);
    await BusinessStockTransaction.deleteMany({ referenceType: 'Sales Return', referenceId: salesReturn._id });

    const {
      returnDate, customerId, customerName, customerPhone,
      customerAddress, customerGstin, customerState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items, roundOff, paymentMode, paidAmount, notes
    } = req.body;

    const companyId = req.companyId;

    const enriched = [];
    for (const item of items) {
      const bi = await BusinessItem.findById(item.itemId);
      if (!bi) continue;
      enriched.push({
        ...item,
        itemCode: bi.itemCode, itemName: bi.itemName,
        hsnCode:  item.hsnCode || bi.hsnCode || '',
        unit:     item.unit    || bi.unit    || '',
        rate:     parseFloat(item.rate) || bi.salesRate || bi.sellingPrice || 0,
        gstPercent: parseFloat(item.gstPercent) ?? bi.gstPercent ?? 0
      });
    }

    const { processedItems, totals } = calcItems(enriched, customerState);
    const { taxableAmount, totalCgst, totalSgst, totalIgst, totalGst } = totals;

    const ro         = parseFloat(roundOff) || (Math.round(totals.netAmount) - totals.netAmount);
    const grandTotal = parseFloat((totals.netAmount + ro).toFixed(2));
    const paid       = parseFloat(paidAmount) || 0;
    const balance    = parseFloat((grandTotal - paid).toFixed(2));

    const paymentStatus =
      paid >= grandTotal ? 'Paid' :
      paid > 0           ? 'Partial' : 'Pending';

    Object.assign(salesReturn, {
      returnDate: returnDate || salesReturn.returnDate,
      customerId: customerId || null, customerName, customerPhone,
      customerAddress, customerGstin, customerState,
      originalInvoiceRef, originalInvoiceDate, reason,
      items: processedItems,
      totalQty: totals.totalQty, grossAmount: totals.grossAmount,
      itemDiscount: totals.itemDiscount,
      taxableAmount, totalCgst, totalSgst, totalIgst, totalGst,
      roundOff: ro, grandTotal,
      paymentMode: paymentMode || 'Cash',
      paymentStatus, paidAmount: paid, balanceAmount: balance, notes
    });
    await salesReturn.save();

    await createSalesReturnVoucher({
      salesReturn,
      returnNumber: salesReturn.returnNumber,
      returnDate: returnDate || salesReturn.returnDate,
      customerName, paymentMode: paymentMode || 'Cash',
      taxableAmount, totalCgst, totalSgst, totalIgst,
      roundOff: ro, grandTotal, paidAmount: paid, balanceAmount: balance,
      companyId
    });

    await applyStockIn(processedItems, salesReturn, returnDate, customerName, companyId);

    return res.json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('[updateSalesReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export const deleteSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesReturn) return res.status(404).json({ message: 'Sales return not found' });

    await reverseAndDeleteReturnVoucher('SalesReturn', salesReturn._id);
    await reverseStockIn(salesReturn.items);
    await BusinessStockTransaction.deleteMany({ referenceId: salesReturn._id });
    await SalesReturn.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'Sales return deleted successfully' });
  } catch (error) {
    console.error('[deleteSalesReturn]', error);
    return res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export const getAllSalesReturns = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, paymentStatus, status, startDate, endDate, customerId } = req.query;
    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { returnNumber:       { $regex: search, $options: 'i' } },
        { customerName:       { $regex: search, $options: 'i' } },
        { customerPhone:      { $regex: search, $options: 'i' } },
        { originalInvoiceRef: { $regex: search, $options: 'i' } }
      ];
    }
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (status)        query.status        = status;
    if (customerId)    query.customerId     = customerId;
    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate)   query.returnDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [returns, total] = await Promise.all([
      SalesReturn.find(query)
        .populate('customerId', 'customerName phone')
        .sort({ returnDate: -1, createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      SalesReturn.countDocuments(query)
    ]);

    return res.json({
      success: true, data: returns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('[getAllSalesReturns]', error);
    return res.status(500).json({ message: error.message });
  }
};

export const getSalesReturnById = async (req, res) => {
  try {
    const doc = await SalesReturn.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('customerId', 'customerName phone address gstNumber')
      .populate('items.itemId', 'itemName itemCode hsnCode unit');
    if (!doc) return res.status(404).json({ message: 'Sales return not found' });
    return res.json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSalesReturnSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { companyId: req.companyId, status: 'Active' };
    if (startDate || endDate) {
      match.returnDate = {};
      if (startDate) match.returnDate.$gte = new Date(startDate);
      if (endDate)   match.returnDate.$lte = new Date(endDate);
    }
    const [summary] = await SalesReturn.aggregate([
      { $match: match },
      { $group: { _id: null, totalReturns: { $sum: 1 }, totalAmount: { $sum: '$grandTotal' }, totalPaid: { $sum: '$paidAmount' }, totalPending: { $sum: '$balanceAmount' } } }
    ]);
    return res.json({ success: true, data: summary || { totalReturns: 0, totalAmount: 0, totalPaid: 0, totalPending: 0 } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default { createSalesReturn, getAllSalesReturns, getSalesReturnById, updateSalesReturn, deleteSalesReturn, getSalesReturnSummary };

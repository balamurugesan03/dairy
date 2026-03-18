import DairyPurchaseReturn from '../models/DairyPurchaseReturn.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import Counter, { getNextSequence } from '../models/Counter.js';

// Generate Dairy Debit Note Number (DDN2602-0001)
const generateReturnNumber = async (companyId) => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `DDN${year}${month}`;
  const counterKey = `ddn-${year}${month}-${companyId || 'global'}`;

  let seedValue = 0;
  const existingCounter = await Counter.findById(counterKey).lean();
  if (!existingCounter) {
    const lastReturn = await DairyPurchaseReturn.findOne({
      companyId,
      returnNumber: { $regex: `^${prefix}` }
    }).sort({ returnNumber: -1 }).lean();
    if (lastReturn) {
      const lastSeq = parseInt(lastReturn.returnNumber.slice(-4));
      if (!isNaN(lastSeq)) seedValue = lastSeq;
    }
  }

  const seq = await getNextSequence(counterKey, seedValue);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
};

// Create Dairy Purchase Return (Debit Note)
export const createDairyPurchaseReturn = async (req, res) => {
  try {
    const {
      returnDate,
      supplierId,
      supplierName,
      supplierPhone,
      supplierAddress,
      supplierGstin,
      supplierState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      items,
      roundOff,
      paymentMode,
      receivedAmount,
      notes
    } = req.body;

    const companyId = req.companyId;
    const returnNumber = await generateReturnNumber(companyId);

    // Calculate totals
    let totalQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedItems = [];

    for (const item of items) {
      const dairyItem = await Item.findById(item.itemId);
      if (!dairyItem) {
        return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      }

      // Check stock - purchase return sends stock OUT
      const qty = parseFloat(item.quantity) || 0;
      if (qty > dairyItem.currentBalance) {
        return res.status(400).json({
          message: `Insufficient stock for ${dairyItem.itemName}. Available: ${dairyItem.currentBalance}`
        });
      }

      const rate = parseFloat(item.rate) || dairyItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || dairyItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      // GST: CGST+SGST for Tamil Nadu (same state), IGST for inter-state
      const isInterState = supplierState && supplierState !== 'Tamil Nadu';
      let cgst = 0, sgst = 0, igst = 0;

      if (isInterState) {
        igst = (taxable * gstPercent) / 100;
      } else {
        cgst = (taxable * gstPercent) / 200;
        sgst = (taxable * gstPercent) / 200;
      }

      const totalAmount = taxable + cgst + sgst + igst;

      processedItems.push({
        itemId: item.itemId,
        itemCode: dairyItem.itemCode,
        itemName: dairyItem.itemName,
        hsnCode: dairyItem.hsnCode || item.hsnCode,
        quantity: qty,
        unit: dairyItem.unit || dairyItem.measurement || item.unit,
        rate,
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        gstPercent,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount
      });

      totalQty += qty;
      grossAmount += amount;
      itemDiscount += discountAmount;
      taxableAmount += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
    }

    const totalGst = totalCgst + totalSgst + totalIgst;
    const netAmount = taxableAmount + totalGst;
    const finalRoundOff = parseFloat(roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + finalRoundOff;

    const received = parseFloat(receivedAmount) || 0;
    const balance = grandTotal - received;

    let paymentStatus = 'Pending';
    if (received >= grandTotal) {
      paymentStatus = 'Received';
    } else if (received > 0) {
      paymentStatus = 'Partial';
    }

    const returnData = {
      returnNumber,
      returnDate: returnDate || new Date(),
      supplierId: supplierId || null,
      supplierName,
      supplierPhone,
      supplierAddress,
      supplierGstin,
      supplierState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      items: processedItems,
      totalQty,
      grossAmount,
      itemDiscount,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOff: finalRoundOff,
      grandTotal,
      paymentMode: paymentMode || 'Cash',
      paymentStatus,
      receivedAmount: received,
      balanceAmount: balance,
      notes,
      businessType: 'Dairy Cooperative',
      companyId
    };

    const purchaseReturn = new DairyPurchaseReturn(returnData);
    await purchaseReturn.save();

    // Update stock - purchase return reduces stock (Stock Out)
    for (const item of processedItems) {
      const dairyItem = await Item.findById(item.itemId);
      dairyItem.currentBalance -= item.quantity;
      await dairyItem.save();

      const stockTransaction = new StockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock Out',
        quantity: item.quantity,
        rate: item.rate,
        balanceAfter: dairyItem.currentBalance,
        referenceType: 'Return',
        referenceId: purchaseReturn._id,
        date: returnDate || new Date(),
        supplierName: supplierName || '',
        notes: `Purchase Return - ${returnNumber} to ${supplierName || 'Unknown'}`,
        companyId
      });
      await stockTransaction.save();
    }

    res.status(201).json({ success: true, data: purchaseReturn });
  } catch (error) {
    console.error('Create dairy purchase return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Dairy Purchase Returns
export const getAllDairyPurchaseReturns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      paymentStatus,
      status,
      startDate,
      endDate,
      supplierId
    } = req.query;

    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        { supplierPhone: { $regex: search, $options: 'i' } },
        { originalInvoiceRef: { $regex: search, $options: 'i' } }
      ];
    }

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (status) query.status = status;
    if (supplierId) query.supplierId = supplierId;

    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate) query.returnDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [returns, total] = await Promise.all([
      DairyPurchaseReturn.find(query)
        .populate('supplierId', 'supplierName phone')
        .sort({ returnDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DairyPurchaseReturn.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: returns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all dairy purchase returns error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Dairy Purchase Return by ID
export const getDairyPurchaseReturnById = async (req, res) => {
  try {
    const purchaseReturn = await DairyPurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('supplierId', 'supplierName phone address gstNumber')
      .populate('items.itemId', 'itemName itemCode hsnCode unit measurement');

    if (!purchaseReturn) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    res.json({ success: true, data: purchaseReturn });
  } catch (error) {
    console.error('Get dairy purchase return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update Dairy Purchase Return
export const updateDairyPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await DairyPurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!purchaseReturn) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    // Reverse old stock transactions
    for (const item of purchaseReturn.items) {
      const dairyItem = await Item.findById(item.itemId);
      if (dairyItem) {
        dairyItem.currentBalance += item.quantity; // reverse the stock out
        await dairyItem.save();
      }
    }
    await StockTransaction.deleteMany({
      referenceType: 'Return',
      referenceId: purchaseReturn._id
    });

    // Process new items
    const {
      items,
      returnDate,
      supplierId,
      supplierName,
      supplierPhone,
      supplierAddress,
      supplierGstin,
      supplierState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      roundOff,
      paymentMode,
      receivedAmount,
      notes
    } = req.body;

    let totalQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedItems = [];

    for (const item of items) {
      const dairyItem = await Item.findById(item.itemId);
      if (!dairyItem) continue;

      const qty = parseFloat(item.quantity) || 0;

      if (qty > dairyItem.currentBalance) {
        return res.status(400).json({
          message: `Insufficient stock for ${dairyItem.itemName}. Available: ${dairyItem.currentBalance}`
        });
      }

      const rate = parseFloat(item.rate) || dairyItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || dairyItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      const isInterState = supplierState && supplierState !== 'Tamil Nadu';
      let cgst = 0, sgst = 0, igst = 0;

      if (isInterState) {
        igst = (taxable * gstPercent) / 100;
      } else {
        cgst = (taxable * gstPercent) / 200;
        sgst = (taxable * gstPercent) / 200;
      }

      const totalAmount = taxable + cgst + sgst + igst;

      processedItems.push({
        itemId: item.itemId,
        itemCode: dairyItem.itemCode,
        itemName: dairyItem.itemName,
        hsnCode: dairyItem.hsnCode,
        quantity: qty,
        unit: dairyItem.unit || dairyItem.measurement,
        rate,
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        gstPercent,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount
      });

      totalQty += qty;
      grossAmount += amount;
      itemDiscount += discountAmount;
      taxableAmount += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      // Update stock (stock out)
      dairyItem.currentBalance -= qty;
      await dairyItem.save();

      const stockTransaction = new StockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock Out',
        quantity: qty,
        rate,
        balanceAfter: dairyItem.currentBalance,
        referenceType: 'Return',
        referenceId: purchaseReturn._id,
        date: returnDate || purchaseReturn.returnDate,
        supplierName: supplierName || '',
        notes: `Purchase Return - ${purchaseReturn.returnNumber} (Updated)`,
        companyId: req.companyId
      });
      await stockTransaction.save();
    }

    const totalGst = totalCgst + totalSgst + totalIgst;
    const netAmount = taxableAmount + totalGst;
    const finalRoundOff = parseFloat(roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + finalRoundOff;

    const received = parseFloat(receivedAmount) || 0;
    const balance = grandTotal - received;

    let paymentStatus = 'Pending';
    if (received >= grandTotal) {
      paymentStatus = 'Received';
    } else if (received > 0) {
      paymentStatus = 'Partial';
    }

    Object.assign(purchaseReturn, {
      returnDate: returnDate || purchaseReturn.returnDate,
      supplierId: supplierId || null,
      supplierName,
      supplierPhone,
      supplierAddress,
      supplierGstin,
      supplierState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      items: processedItems,
      totalQty,
      grossAmount,
      itemDiscount,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOff: finalRoundOff,
      grandTotal,
      paymentMode: paymentMode || 'Cash',
      paymentStatus,
      receivedAmount: received,
      balanceAmount: balance,
      notes
    });

    await purchaseReturn.save();
    res.json({ success: true, data: purchaseReturn });
  } catch (error) {
    console.error('Update dairy purchase return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete Dairy Purchase Return
export const deleteDairyPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await DairyPurchaseReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!purchaseReturn) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    // Reverse stock for each item
    for (const item of purchaseReturn.items) {
      const dairyItem = await Item.findById(item.itemId);
      if (dairyItem) {
        dairyItem.currentBalance += item.quantity; // reverse the stock out
        await dairyItem.save();
      }
    }

    // Delete stock transactions
    await StockTransaction.deleteMany({
      referenceId: purchaseReturn._id
    });

    await DairyPurchaseReturn.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Purchase return deleted successfully' });
  } catch (error) {
    console.error('Delete dairy purchase return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Dairy Purchase Return Summary
export const getDairyPurchaseReturnSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchQuery = Object.keys(dateFilter).length > 0
      ? { returnDate: dateFilter, status: 'Active' }
      : { status: 'Active' };

    const [summary] = await DairyPurchaseReturn.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalReceived: { $sum: '$receivedAmount' },
          totalPending: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: summary || {
        totalReturns: 0,
        totalAmount: 0,
        totalReceived: 0,
        totalPending: 0
      }
    });
  } catch (error) {
    console.error('Get dairy purchase return summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  createDairyPurchaseReturn,
  getAllDairyPurchaseReturns,
  getDairyPurchaseReturnById,
  updateDairyPurchaseReturn,
  deleteDairyPurchaseReturn,
  getDairyPurchaseReturnSummary
};

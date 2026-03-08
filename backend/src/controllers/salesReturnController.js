import SalesReturn from '../models/SalesReturn.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';

// Generate Credit Note Number (CN2602-0001)
const generateReturnNumber = async () => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `CN${year}${month}`;

  const lastReturn = await SalesReturn.findOne({
    returnNumber: { $regex: `^${prefix}` }
  }).sort({ returnNumber: -1 });

  let sequence = 1;
  if (lastReturn) {
    const lastSequence = parseInt(lastReturn.returnNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

// Create Sales Return (Credit Note)
export const createSalesReturn = async (req, res) => {
  try {
    const {
      returnDate,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      items,
      roundOff,
      paymentMode,
      paidAmount,
      notes
    } = req.body;

    const returnNumber = await generateReturnNumber();

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
      const businessItem = await BusinessItem.findById(item.itemId);
      if (!businessItem) {
        return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      }

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || businessItem.sellingPrice || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || businessItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      // GST: CGST+SGST for Tamil Nadu (same state), IGST for inter-state
      const isInterState = customerState && customerState !== 'Tamil Nadu';
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
        itemCode: businessItem.itemCode,
        itemName: businessItem.itemName,
        hsnCode: businessItem.hsnCode || item.hsnCode,
        quantity: qty,
        unit: businessItem.unit || item.unit,
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

    const paid = parseFloat(paidAmount) || 0;
    const balance = grandTotal - paid;

    let paymentStatus = 'Pending';
    if (paid >= grandTotal) {
      paymentStatus = 'Paid';
    } else if (paid > 0) {
      paymentStatus = 'Partial';
    }

    const salesReturn = new SalesReturn({
      returnNumber,
      returnDate: returnDate || new Date(),
      customerId: customerId || null,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
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
      paidAmount: paid,
      balanceAmount: balance,
      notes,
      businessType: 'Private Firm'
    });

    await salesReturn.save();

    // Update stock - sales return adds stock back (Stock In)
    for (const item of processedItems) {
      const businessItem = await BusinessItem.findById(item.itemId);
      businessItem.currentBalance += item.quantity;
      await businessItem.save();

      const stockTransaction = new BusinessStockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: item.quantity,
        rate: item.rate,
        balanceAfter: businessItem.currentBalance,
        referenceType: 'Sales Return',
        referenceId: salesReturn._id,
        date: returnDate || new Date(),
        customerName: customerName || '',
        notes: `Sales Return - ${returnNumber} from ${customerName || 'Unknown'}`
      });
      await stockTransaction.save();
    }

    res.status(201).json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('Create sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Sales Returns
export const getAllSalesReturns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      paymentStatus,
      status,
      startDate,
      endDate,
      customerId
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { originalInvoiceRef: { $regex: search, $options: 'i' } }
      ];
    }

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (status) query.status = status;
    if (customerId) query.customerId = customerId;

    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate) query.returnDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [returns, total] = await Promise.all([
      SalesReturn.find(query)
        .populate('customerId', 'customerName phone')
        .sort({ returnDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SalesReturn.countDocuments(query)
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
    console.error('Get all sales returns error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Sales Return by ID
export const getSalesReturnById = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findById(req.params.id)
      .populate('customerId', 'customerName phone address gstNumber')
      .populate('items.itemId', 'itemName itemCode hsnCode unit');

    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    res.json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('Get sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update Sales Return
export const updateSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findById(req.params.id);
    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    // Reverse old stock transactions (remove the stock that was added back)
    for (const item of salesReturn.items) {
      const businessItem = await BusinessItem.findById(item.itemId);
      if (businessItem) {
        businessItem.currentBalance -= item.quantity; // reverse the stock in
        await businessItem.save();
      }
    }
    await BusinessStockTransaction.deleteMany({
      referenceType: 'Sales Return',
      referenceId: salesReturn._id
    });

    // Process new items
    const {
      items,
      returnDate,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
      originalInvoiceRef,
      originalInvoiceDate,
      reason,
      roundOff,
      paymentMode,
      paidAmount,
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
      const businessItem = await BusinessItem.findById(item.itemId);
      if (!businessItem) continue;

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || businessItem.sellingPrice || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || businessItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      const isInterState = customerState && customerState !== 'Tamil Nadu';
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
        itemCode: businessItem.itemCode,
        itemName: businessItem.itemName,
        hsnCode: businessItem.hsnCode,
        quantity: qty,
        unit: businessItem.unit,
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

      // Update stock (stock in)
      businessItem.currentBalance += qty;
      await businessItem.save();

      const stockTransaction = new BusinessStockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: qty,
        rate,
        balanceAfter: businessItem.currentBalance,
        referenceType: 'Sales Return',
        referenceId: salesReturn._id,
        date: returnDate || salesReturn.returnDate,
        customerName: customerName || '',
        notes: `Sales Return - ${salesReturn.returnNumber} (Updated)`
      });
      await stockTransaction.save();
    }

    const totalGst = totalCgst + totalSgst + totalIgst;
    const netAmount = taxableAmount + totalGst;
    const finalRoundOff = parseFloat(roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + finalRoundOff;

    const paid = parseFloat(paidAmount) || 0;
    const balance = grandTotal - paid;

    let paymentStatus = 'Pending';
    if (paid >= grandTotal) {
      paymentStatus = 'Paid';
    } else if (paid > 0) {
      paymentStatus = 'Partial';
    }

    Object.assign(salesReturn, {
      returnDate: returnDate || salesReturn.returnDate,
      customerId: customerId || null,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
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
      paidAmount: paid,
      balanceAmount: balance,
      notes
    });

    await salesReturn.save();
    res.json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('Update sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete Sales Return
export const deleteSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findById(req.params.id);
    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    // Reverse stock for each item (remove the stock that was added back)
    for (const item of salesReturn.items) {
      const businessItem = await BusinessItem.findById(item.itemId);
      if (businessItem) {
        businessItem.currentBalance -= item.quantity; // reverse the stock in
        await businessItem.save();
      }
    }

    // Delete stock transactions
    await BusinessStockTransaction.deleteMany({
      referenceId: salesReturn._id
    });

    await SalesReturn.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sales return deleted successfully' });
  } catch (error) {
    console.error('Delete sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Sales Return Summary
export const getSalesReturnSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchQuery = Object.keys(dateFilter).length > 0
      ? { returnDate: dateFilter, status: 'Active' }
      : { status: 'Active' };

    const [summary] = await SalesReturn.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalPending: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: summary || {
        totalReturns: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalPending: 0
      }
    });
  } catch (error) {
    console.error('Get sales return summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  createSalesReturn,
  getAllSalesReturns,
  getSalesReturnById,
  updateSalesReturn,
  deleteSalesReturn,
  getSalesReturnSummary
};

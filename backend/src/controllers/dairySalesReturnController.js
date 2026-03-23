import DairySalesReturn from '../models/DairySalesReturn.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import Farmer from '../models/Farmer.js';
import Customer from '../models/Customer.js';
import { getNextSequence } from '../models/Counter.js';

// Generate Dairy Credit Note Number (DCN2603-0001) — atomic, conflict-free
const generateReturnNumber = async (companyId) => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const seq = await getNextSequence(`dcn-${yy}${mm}-${companyId || 'global'}`, 0);
  return `DCN${yy}${mm}-${seq.toString().padStart(4, '0')}`;
};

// Create Dairy Sales Return (Credit Note)
export const createDairySalesReturn = async (req, res) => {
  try {
    const {
      returnDate,
      customerType,
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

    const companyId = req.companyId;
    const returnNumber = await generateReturnNumber(companyId);

    // Set customerModel based on customerType
    let customerModel = null;
    let resolvedCustomerName = customerName;
    let resolvedCustomerPhone = customerPhone;

    if (customerType === 'Farmer' && customerId) {
      customerModel = 'Farmer';
      const farmer = await Farmer.findById(customerId);
      if (farmer) {
        resolvedCustomerName = resolvedCustomerName || farmer.personalDetails?.name;
        resolvedCustomerPhone = resolvedCustomerPhone || farmer.personalDetails?.phone;
      }
    } else if (customerType === 'Customer' && customerId) {
      customerModel = 'Customer';
      const customer = await Customer.findById(customerId);
      if (customer) {
        resolvedCustomerName = resolvedCustomerName || customer.name;
        resolvedCustomerPhone = resolvedCustomerPhone || customer.phone;
      }
    }

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

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || dairyItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || dairyItem.gstPercent || 0;

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

    const paid = parseFloat(paidAmount) || 0;
    const balance = grandTotal - paid;

    let paymentStatus = 'Pending';
    if (paid >= grandTotal) {
      paymentStatus = 'Paid';
    } else if (paid > 0) {
      paymentStatus = 'Partial';
    }

    const returnData = {
      returnNumber,
      returnDate: returnDate || new Date(),
      customerType: customerType || 'Other',
      customerId: customerId || null,
      customerModel,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
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
      businessType: 'Dairy Cooperative',
      companyId
    };

    const salesReturn = new DairySalesReturn(returnData);
    await salesReturn.save();

    // Update stock - sales return adds stock back (Stock In)
    for (const item of processedItems) {
      const dairyItem = await Item.findById(item.itemId);
      dairyItem.currentBalance += item.quantity;
      await dairyItem.save();

      const stockTransaction = new StockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: item.quantity,
        rate: item.rate,
        balanceAfter: dairyItem.currentBalance,
        referenceType: 'Return',
        referenceId: salesReturn._id,
        date: returnDate || new Date(),
        notes: `Sales Return - ${returnNumber} from ${resolvedCustomerName || 'Unknown'}`,
        companyId
      });
      await stockTransaction.save();
    }

    res.status(201).json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('Create dairy sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Dairy Sales Returns
export const getAllDairySalesReturns = async (req, res) => {
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

    const query = { companyId: req.companyId };

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
      DairySalesReturn.find(query)
        .sort({ returnDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DairySalesReturn.countDocuments(query)
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
    console.error('Get all dairy sales returns error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Dairy Sales Return by ID
export const getDairySalesReturnById = async (req, res) => {
  try {
    const salesReturn = await DairySalesReturn.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('customerId')
      .populate('items.itemId', 'itemName itemCode hsnCode unit measurement');

    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    res.json({ success: true, data: salesReturn });
  } catch (error) {
    console.error('Get dairy sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update Dairy Sales Return
export const updateDairySalesReturn = async (req, res) => {
  try {
    const salesReturn = await DairySalesReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    // Reverse old stock transactions (remove the stock that was added back)
    for (const item of salesReturn.items) {
      const dairyItem = await Item.findById(item.itemId);
      if (dairyItem) {
        dairyItem.currentBalance -= item.quantity; // reverse the stock in
        await dairyItem.save();
      }
    }
    await StockTransaction.deleteMany({
      referenceType: 'Return',
      referenceId: salesReturn._id
    });

    // Process new items
    const {
      items,
      returnDate,
      customerType,
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
      const dairyItem = await Item.findById(item.itemId);
      if (!dairyItem) continue;

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || dairyItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || dairyItem.gstPercent || 0;

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

      // Update stock (stock in)
      dairyItem.currentBalance += qty;
      await dairyItem.save();

      const stockTransaction = new StockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: qty,
        rate,
        balanceAfter: dairyItem.currentBalance,
        referenceType: 'Return',
        referenceId: salesReturn._id,
        date: returnDate || salesReturn.returnDate,
        notes: `Sales Return - ${salesReturn.returnNumber} (Updated)`,
        companyId: req.companyId
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

    // Set customerModel
    let customerModel = salesReturn.customerModel;
    if (customerType === 'Farmer') customerModel = 'Farmer';
    else if (customerType === 'Customer') customerModel = 'Customer';

    Object.assign(salesReturn, {
      returnDate: returnDate || salesReturn.returnDate,
      customerType: customerType || salesReturn.customerType,
      customerId: customerId || null,
      customerModel,
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
    console.error('Update dairy sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete Dairy Sales Return
export const deleteDairySalesReturn = async (req, res) => {
  try {
    const salesReturn = await DairySalesReturn.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesReturn) {
      return res.status(404).json({ message: 'Sales return not found' });
    }

    // Reverse stock for each item (remove the stock that was added back)
    for (const item of salesReturn.items) {
      const dairyItem = await Item.findById(item.itemId);
      if (dairyItem) {
        dairyItem.currentBalance -= item.quantity; // reverse the stock in
        await dairyItem.save();
      }
    }

    // Delete stock transactions
    await StockTransaction.deleteMany({
      referenceId: salesReturn._id
    });

    await DairySalesReturn.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sales return deleted successfully' });
  } catch (error) {
    console.error('Delete dairy sales return error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Dairy Sales Return Summary
export const getDairySalesReturnSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchQuery = Object.keys(dateFilter).length > 0
      ? { returnDate: dateFilter, status: 'Active' }
      : { status: 'Active' };

    const [summary] = await DairySalesReturn.aggregate([
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
    console.error('Get dairy sales return summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  createDairySalesReturn,
  getAllDairySalesReturns,
  getDairySalesReturnById,
  updateDairySalesReturn,
  deleteDairySalesReturn,
  getDairySalesReturnSummary
};

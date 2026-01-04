import Sales from '../models/Sales.js';
import Farmer from '../models/Farmer.js';
import Customer from '../models/Customer.js';
import mongoose from 'mongoose';
import { createBulkStockTransactions, reverseStockTransaction } from '../utils/stockHelper.js';
import { createSalesVoucher } from '../utils/accountingHelper.js';

// Generate bill number
const generateBillNumber = async () => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const lastBill = await Sales.findOne()
    .sort({ createdAt: -1 })
    .limit(1);

  let sequence = 1;
  if (lastBill && lastBill.billNumber.startsWith(`BILL${year}${month}`)) {
    const lastSeq = parseInt(lastBill.billNumber.slice(-4));
    sequence = lastSeq + 1;
  }

  return `BILL${year}${month}${sequence.toString().padStart(4, '0')}`;
};

// Create new sale
export const createSale = async (req, res) => {
  try {
    const saleData = req.body;

    // Generate bill number
    saleData.billNumber = await generateBillNumber();

    // Set customerModel based on customerType
    if (saleData.customerType === 'Farmer') {
      saleData.customerModel = 'Farmer';
      // Get old balance if customer is a farmer
      if (saleData.customerId) {
        const farmer = await Farmer.findById(saleData.customerId).populate('ledgerId');
        if (farmer && farmer.ledgerId) {
          saleData.oldBalance = farmer.ledgerId.currentBalance;
          saleData.customerName = farmer.personalDetails.name;
          saleData.customerPhone = farmer.personalDetails.phone;
        }
      }
    } else if (saleData.customerType === 'Customer') {
      saleData.customerModel = 'Customer';
      // Get old balance if customer is a registered customer
      if (saleData.customerId) {
        const customer = await Customer.findById(saleData.customerId);
        if (customer) {
          saleData.oldBalance = customer.openingBalance || 0;
          saleData.customerName = customer.name;
          saleData.customerPhone = customer.phone;
        }
      }
    }

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;

    saleData.items.forEach(item => {
      item.amount = item.quantity * item.rate;
      item.gstAmount = item.gstAmount || 0;
      subtotal += item.amount;
      totalGst += item.gstAmount;
    });

    saleData.subtotal = subtotal;
    saleData.totalGst = totalGst;
    saleData.grandTotal = subtotal + totalGst;
    saleData.totalDue = (saleData.oldBalance || 0) + saleData.grandTotal;
    saleData.balanceAmount = saleData.totalDue - (saleData.paidAmount || 0);

    // Determine payment status
    if (saleData.balanceAmount === 0) {
      saleData.status = 'Paid';
    } else if (saleData.paidAmount > 0) {
      saleData.status = 'Partial';
    } else {
      saleData.status = 'Pending';
    }

    // Create sale record
    const sale = new Sales(saleData);
    await sale.save();

    // Create stock transactions (deduct stock)
    await createBulkStockTransactions(
      saleData.items,
      'Sale',
      sale._id
    );

    // Create accounting voucher
    const voucher = await createSalesVoucher(sale);
    sale.ledgerEntries = [voucher._id];
    await sale.save();

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating sale'
    });
  }
};

// Get all sales
export const getAllSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sales = await Sales.find(query)
      .sort({ billDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'farmerId farmerNumber personalDetails customerId name phone')
      .populate('collectionCenterId', 'centerName centerType')
      .populate('subsidyId', 'subsidyName subsidyType');

    const total = await Sales.countDocuments(query);

    res.status(200).json({
      success: true,
      data: sales,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales'
    });
  }
};

// Get sale by ID
export const getSaleById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate('customerId')
      .populate('items.itemId')
      .populate('ledgerEntries')
      .populate('collectionCenterId')
      .populate('subsidyId');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sale'
    });
  }
};

// Update sale
export const updateSale = async (req, res) => {
  try {
    const existingSale = await Sales.findById(req.params.id);

    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Reverse old stock transactions
    await reverseStockTransaction('Sale', existingSale._id);

    // Update sale with new data
    const updatedSaleData = { ...req.body };

    // Recalculate totals
    let subtotal = 0;
    let totalGst = 0;

    updatedSaleData.items.forEach(item => {
      item.amount = item.quantity * item.rate;
      subtotal += item.amount;
      totalGst += item.gstAmount || 0;
    });

    updatedSaleData.subtotal = subtotal;
    updatedSaleData.totalGst = totalGst;
    updatedSaleData.grandTotal = subtotal + totalGst;

    Object.assign(existingSale, updatedSaleData);
    await existingSale.save();

    // Create new stock transactions
    await createBulkStockTransactions(
      updatedSaleData.items,
      'Sale',
      existingSale._id
    );

    res.status(200).json({
      success: true,
      message: 'Sale updated successfully',
      data: existingSale
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating sale'
    });
  }
};

// Delete sale
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Reverse stock transactions
    await reverseStockTransaction('Sale', sale._id);

    // Delete the sale
    await Sales.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting sale'
    });
  }
};

// Get customer purchase history
export const getCustomerHistory = async (req, res) => {
  try {
    const sales = await Sales.find({ customerId: req.params.customerId })
      .sort({ billDate: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: sales
    });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customer history'
    });
  }
};

export default {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getCustomerHistory
};

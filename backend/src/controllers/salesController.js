import Sales from '../models/Sales.js';
import Farmer from '../models/Farmer.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import mongoose from 'mongoose';
import { createBulkStockTransactions } from '../utils/stockHelper.js';
import { createSalesVoucher, reverseLedgerBalances } from '../utils/accountingHelper.js';
import Voucher from '../models/Voucher.js';
import Counter, { generateCode, getNextSequence } from '../models/Counter.js';
import PaymentRegister from '../models/PaymentRegister.js';

// Create new sale
export const createSale = async (req, res) => {
  try {
    const saleData = req.body;

    const companyId = req.companyId;

    // Block if date falls within a saved payment cycle
    if (saleData.billDate) {
      const saleDateTime = new Date(saleData.billDate);
      const conflict = await PaymentRegister.findOne({
        companyId,
        status: { $in: ['Saved', 'Printed'] },
        fromDate: { $lte: saleDateTime },
        toDate: { $gte: saleDateTime }
      });
      if (conflict) {
        const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return res.status(400).json({
          success: false,
          message: `Sales blocked: date falls within payment cycle (${fmt(conflict.fromDate)} – ${fmt(conflict.toDate)})`
        });
      }
    }

    // Generate sequential bill number (01, 02, 03 …)
    const seq = await getNextSequence(`dairy-sale-${companyId}`, 0);
    saleData.billNumber = seq.toString().padStart(2, '0');
    saleData.companyId = companyId;

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
    let totalSubsidy = 0;

    saleData.items.forEach(item => {
      item.amount = item.quantity * item.rate;
      item.gstAmount = item.gstAmount || 0;
      item.subsidyAmount = item.subsidyAmount || 0;
      subtotal += item.amount;
      totalGst += item.gstAmount;
      totalSubsidy += item.subsidyAmount;
    });

    const discount = parseFloat(saleData.discount) || 0;

    saleData.subtotal = subtotal;
    saleData.totalGst = totalGst;
    saleData.totalSubsidy = totalSubsidy;
    saleData.grandTotal = subtotal - discount + totalGst - totalSubsidy + (parseFloat(saleData.roundOff) || 0);
    saleData.totalDue = (saleData.oldBalance || 0) + saleData.grandTotal;
    const rawBalance = saleData.totalDue - (saleData.paidAmount || 0);
    saleData.balanceAmount = Math.max(0, rawBalance);

    // Determine payment status
    if (rawBalance <= 0) {
      saleData.status = 'Paid';
    } else if (saleData.paidAmount > 0) {
      saleData.status = 'Partial';
    } else {
      saleData.status = 'Pending';
    }

    // Create sale record — retry up to 5 times on duplicate billNumber (race condition)
    let sale;
    let attempts = 0;
    while (attempts < 5) {
      try {
        sale = new Sales(saleData);
        await sale.save();
        break; // success
      } catch (saveErr) {
        if (saveErr.code === 11000 && saveErr.keyPattern?.billNumber && attempts < 4) {
          // Regenerate bill number and retry
          attempts++;
          const retrySeq = await getNextSequence(`dairy-sale-${companyId}`, 0);
          saleData.billNumber = retrySeq.toString().padStart(2, '0');
          continue;
        }
        throw saveErr; // non-duplicate or max retries reached
      }
    }

    // Create stock transactions (deduct stock)
    try {
      await createBulkStockTransactions(
        sale.items,
        'Sale',
        sale._id,
        null,
        companyId
      );
    } catch (stockError) {
      console.error('Error creating stock transactions:', stockError);
    }

    // Create accounting voucher (non-blocking)
    try {
      const voucher = await createSalesVoucher(sale);
      if (voucher) {
        sale.ledgerEntries = [voucher._id];
        await sale.save();
      }
    } catch (voucherError) {
      console.error('Error creating sales voucher:', voucherError);
    }

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

    const query = { companyId: req.companyId };

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
    const sale = await Sales.findOne({ _id: req.params.id, companyId: req.companyId })
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
    const existingSale = await Sales.findOne({ _id: req.params.id, companyId: req.companyId });

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
    let totalSubsidy = 0;

    updatedSaleData.items.forEach(item => {
      item.amount = item.quantity * item.rate;
      item.gstAmount = item.gstAmount || 0;
      item.subsidyAmount = item.subsidyAmount || 0;
      subtotal += item.amount;
      totalGst += item.gstAmount;
      totalSubsidy += item.subsidyAmount;
    });

    const discount = parseFloat(updatedSaleData.discount) || 0;

    updatedSaleData.subtotal = subtotal;
    updatedSaleData.totalGst = totalGst;
    updatedSaleData.totalSubsidy = totalSubsidy;
    updatedSaleData.grandTotal = subtotal - discount + totalGst - totalSubsidy + (parseFloat(updatedSaleData.roundOff) || 0);

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
    const sale = await Sales.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Restore stock for each sold item and delete stock transactions
    const stockTxns = await StockTransaction.find({
      referenceType: 'Sale',
      referenceId: sale._id,
      companyId: req.companyId
    });

    for (const txn of stockTxns) {
      const item = await Item.findById(txn.itemId);
      if (!item) continue;
      // Sale created Stock Out — restore by adding back quantity
      if (txn.transactionType === 'Stock Out') {
        item.currentBalance = Math.max(0, item.currentBalance + txn.quantity);
        await item.save();
      }
    }
    await StockTransaction.deleteMany({ referenceType: 'Sale', referenceId: sale._id, companyId: req.companyId });

    // Reverse ledger balances and delete voucher
    if (sale.ledgerEntries && sale.ledgerEntries.length > 0) {
      const voucherId = sale.ledgerEntries[0];
      const voucher = await Voucher.findById(voucherId);
      if (voucher) {
        await reverseLedgerBalances(voucher.entries, null, req.companyId);
        await Voucher.findByIdAndDelete(voucherId);
      }
    }

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
    const sales = await Sales.find({ customerId: req.params.customerId, companyId: req.companyId })
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

// GET /sales/next-bill-number — preview next bill number without incrementing
export const getNextSaleBillNumber = async (req, res) => {
  try {
    const key = `dairy-sale-${req.companyId}`;
    const counter = await Counter.findById(key);
    const nextNum = ((counter?.seq || 0) + 1).toString().padStart(2, '0');
    res.json({ success: true, data: { billNumber: nextNum } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getCustomerHistory,
  getNextSaleBillNumber
};

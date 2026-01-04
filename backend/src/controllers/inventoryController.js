import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import Ledger from '../models/Ledger.js';
import Supplier from '../models/Supplier.js';
import {
  createStockTransaction,
  getItemStockHistory,
  getStockReport
} from '../utils/stockHelper.js';
import { createPurchaseVoucher } from '../utils/accountingHelper.js';

// Create new item
export const createItem = async (req, res) => {
  try {
    const itemData = req.body;

    // Check for duplicate itemCode
    const existingItem = await Item.findOne({ itemCode: itemData.itemCode });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item Code already exists'
      });
    }

    // Set currentBalance same as openingBalance initially
    itemData.currentBalance = itemData.openingBalance || 0;

    // Auto-create purchase ledger for this item
    const purchaseLedger = new Ledger({
      ledgerName: `${itemData.itemName} Purchase A/c`,
      ledgerType: 'Purchases A/c',
      linkedEntity: {
        entityType: 'None'
      },
      openingBalance: 0,
      openingBalanceType: 'Dr',
      currentBalance: 0,
      balanceType: 'Dr',
      parentGroup: 'Purchase Accounts',
      status: 'Active'
    });
    await purchaseLedger.save();

    // Link the purchase ledger to the item
    itemData.purchaseLedger = purchaseLedger._id;

    const item = new Item(itemData);
    await item.save();

    // Create opening stock transaction if opening balance > 0
    if (itemData.openingBalance > 0) {
      await createStockTransaction({
        itemId: item._id,
        transactionType: 'Stock In',
        quantity: itemData.openingBalance,
        rate: itemData.salesRate || 0,
        referenceType: 'Opening',
        notes: 'Opening Stock'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating item'
    });
  }
};

// Get all items
export const getAllItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      category = ''
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { itemCode: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const items = await Item.find(query)
      .populate('purchaseLedger', 'ledgerName ledgerType')
      .populate('salesLedger', 'ledgerName ledgerType')
      .populate('supplier', 'supplierId name phone')
      .sort({ itemName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments(query);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching items'
    });
  }
};

// Get item by ID
export const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('purchaseLedger', 'ledgerName ledgerType')
      .populate('salesLedger', 'ledgerName ledgerType')
      .populate('supplier', 'supplierId name phone');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching item'
    });
  }
};

// Update item
export const updateItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating item'
    });
  }
};

// Delete item
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Delete all related stock transactions
    await StockTransaction.deleteMany({ itemId: req.params.id });

    // Permanently delete the item
    await Item.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting item'
    });
  }
};

// Stock In
export const stockIn = async (req, res) => {
  try {
    const {
      items, // Array of items
      purchaseDate,
      invoiceDate,
      invoiceNumber,
      issueCentre,
      subsidyId,
      subsidyAmount,
      referenceType,
      notes,
      // New fields for accounting
      supplierId,
      paymentMode, // 'Cash' or 'Adjustment'
      paidAmount
    } = req.body;

    // Validate that items array exists and is not empty
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid itemId and quantity'
        });
      }
    }

    // Fetch supplier details if provided
    let supplierName = '';
    if (supplierId) {
      const supplier = await Supplier.findById(supplierId);
      if (supplier) {
        supplierName = supplier.name;
      }
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.rate || 0);
    }

    const transactions = [];
    let voucher = null;

    // Create transaction for each item
    for (const item of items) {
      const transaction = await createStockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: parseFloat(item.quantity),
        freeQty: parseFloat(item.freeQty) || 0,
        rate: parseFloat(item.rate) || 0,
        referenceType: referenceType || 'Purchase',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        invoiceNumber: invoiceNumber || null,
        issueCentre: issueCentre || null,
        subsidyId: subsidyId || null,
        subsidyAmount: parseFloat(subsidyAmount) || 0,
        supplierId: supplierId || null,
        supplierName: supplierName,
        paymentMode: paymentMode || 'N/A',
        paidAmount: parseFloat(paidAmount) || 0,
        totalAmount: totalAmount,
        notes: notes || null
      });
      transactions.push(transaction);
    }

    // Create accounting voucher if supplier and payment mode are provided
    if (supplierId && paymentMode && paymentMode !== 'N/A') {
      try {
        voucher = await createPurchaseVoucher({
          items: items.map(item => ({
            itemId: item.itemId,
            quantity: parseFloat(item.quantity),
            rate: parseFloat(item.rate) || 0
          })),
          supplierId,
          supplierName,
          paymentMode,
          paidAmount: parseFloat(paidAmount) || 0,
          totalAmount,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          invoiceNumber,
          referenceId: transactions[0]._id // Link to first transaction
        });

        // Update transactions with voucher reference
        for (const transaction of transactions) {
          transaction.voucherId = voucher._id;
          await transaction.save();
        }
      } catch (voucherError) {
        console.error('Error creating voucher:', voucherError);
        // Continue even if voucher creation fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      data: {
        transactions,
        voucher: voucher ? {
          _id: voucher._id,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType
        } : null
      }
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding stock'
    });
  }
};

// Stock Out
export const stockOut = async (req, res) => {
  try {
    const { itemId, quantity, rate, notes } = req.body;

    if (!itemId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and valid quantity are required'
      });
    }

    const transaction = await createStockTransaction({
      itemId,
      transactionType: 'Stock Out',
      quantity,
      rate: rate || 0,
      referenceType: 'Adjustment',
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Stock reduced successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error reducing stock:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error reducing stock'
    });
  }
};

// Get stock transactions
export const getStockTransactions = async (req, res) => {
  try {
    const { itemId, startDate, endDate } = req.query;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
    }

    const transactions = await getItemStockHistory(itemId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching transactions'
    });
  }
};

// Get stock balance report
export const getStockBalance = async (req, res) => {
  try {
    const { category, status } = req.query;

    const report = await getStockReport(category, status || 'Active');

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching stock report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching stock report'
    });
  }
};

export default {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  stockIn,
  stockOut,
  getStockTransactions,
  getStockBalance
};

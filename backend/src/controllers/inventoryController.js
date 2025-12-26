import Item from '../models/Item.js';
import {
  createStockTransaction,
  getItemStockHistory,
  getStockReport
} from '../utils/stockHelper.js';

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

    const item = new Item(itemData);
    await item.save();

    // Create opening stock transaction if opening balance > 0
    if (itemData.openingBalance > 0) {
      await createStockTransaction({
        itemId: item._id,
        transactionType: 'Stock In',
        quantity: itemData.openingBalance,
        rate: itemData.purchaseRate || 0,
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
    const item = await Item.findById(req.params.id);

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

    item.status = 'Inactive';
    await item.save();

    res.status(200).json({
      success: true,
      message: 'Item deactivated successfully'
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
    const { itemId, quantity, rate, notes } = req.body;

    if (!itemId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and valid quantity are required'
      });
    }

    const transaction = await createStockTransaction({
      itemId,
      transactionType: 'Stock In',
      quantity,
      rate: rate || 0,
      referenceType: 'Purchase',
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      data: transaction
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

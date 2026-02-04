import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import Ledger from '../models/Ledger.js';
import Supplier from '../models/Supplier.js';
import { createPurchaseVoucher } from '../utils/accountingHelper.js';

// Helper function to generate next business item code
const generateBusinessItemCode = async () => {
  try {
    const lastItem = await BusinessItem.findOne({
      itemCode: { $regex: /^BITEM-\d+$/ }
    }).sort({ itemCode: -1 });

    let nextNumber = 1;
    if (lastItem && lastItem.itemCode) {
      const match = lastItem.itemCode.match(/^BITEM-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const formattedNumber = nextNumber.toString().padStart(4, '0');
    return `BITEM-${formattedNumber}`;
  } catch (error) {
    console.error('Error generating business item code:', error);
    throw error;
  }
};

// Helper function to find or create category-based ledger
const findOrCreateCategoryLedger = async (category, ledgerType) => {
  const isPurchase = ledgerType === 'purchase';
  const ledgerName = `Business ${category} ${isPurchase ? 'Purchase' : 'Sales'}`;

  let ledger = await Ledger.findOne({ ledgerName, status: 'Active' });

  if (!ledger) {
    ledger = new Ledger({
      ledgerName,
      ledgerType: isPurchase ? 'Purchases A/c' : 'Sales A/c',
      linkedEntity: {
        entityType: 'None'
      },
      openingBalance: 0,
      openingBalanceType: isPurchase ? 'Dr' : 'Cr',
      currentBalance: 0,
      balanceType: isPurchase ? 'Dr' : 'Cr',
      parentGroup: isPurchase ? 'Purchase Accounts' : 'Sales Accounts',
      status: 'Active'
    });
    await ledger.save();
  }

  return ledger;
};

// Helper function to create business stock transaction
const createBusinessStockTransaction = async (data) => {
  const item = await BusinessItem.findById(data.itemId);
  if (!item) {
    throw new Error('Business item not found');
  }

  let balanceAfter;
  if (data.transactionType === 'Stock In') {
    balanceAfter = item.currentBalance + parseFloat(data.quantity);
  } else {
    if (item.currentBalance < parseFloat(data.quantity)) {
      throw new Error(`Insufficient stock. Available: ${item.currentBalance}`);
    }
    balanceAfter = item.currentBalance - parseFloat(data.quantity);
  }

  const transaction = new BusinessStockTransaction({
    ...data,
    balanceAfter
  });
  await transaction.save();

  // Update item balance
  item.currentBalance = balanceAfter;
  await item.save();

  return transaction;
};

// Create new business item
export const createBusinessItem = async (req, res) => {
  try {
    const itemData = req.body;

    if (!itemData.itemCode) {
      itemData.itemCode = await generateBusinessItemCode();
    } else {
      const existingItem = await BusinessItem.findOne({ itemCode: itemData.itemCode });
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: 'Item Code already exists'
        });
      }
    }

    itemData.currentBalance = itemData.openingBalance || 0;

    if (itemData.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(itemData.category, 'purchase');
      const salesLedger = await findOrCreateCategoryLedger(itemData.category, 'sales');
      itemData.purchaseLedger = purchaseLedger._id;
      itemData.salesLedger = salesLedger._id;
    }

    const item = new BusinessItem(itemData);
    await item.save();

    if (itemData.openingBalance > 0) {
      await createBusinessStockTransaction({
        itemId: item._id,
        transactionType: 'Stock In',
        quantity: itemData.openingBalance,
        rate: itemData.purchasePrice || 0,
        referenceType: 'Opening',
        notes: 'Opening Stock'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Business item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating business item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating business item'
    });
  }
};

// Get all business items
export const getAllBusinessItems = async (req, res) => {
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
        { itemName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const items = await BusinessItem.find(query)
      .populate('purchaseLedger', 'ledgerName ledgerType')
      .populate('salesLedger', 'ledgerName ledgerType')
      .populate('supplier', 'supplierId name phone')
      .sort({ itemName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessItem.countDocuments(query);

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
    console.error('Error fetching business items:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching business items'
    });
  }
};

// Get business item by ID
export const getBusinessItemById = async (req, res) => {
  try {
    const item = await BusinessItem.findById(req.params.id)
      .populate('purchaseLedger', 'ledgerName ledgerType')
      .populate('salesLedger', 'ledgerName ledgerType')
      .populate('supplier', 'supplierId name phone');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching business item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching business item'
    });
  }
};

// Update business item
export const updateBusinessItem = async (req, res) => {
  try {
    const existingItem = await BusinessItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    const updateData = { ...req.body };

    if (updateData.category && updateData.category !== existingItem.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(updateData.category, 'purchase');
      const salesLedger = await findOrCreateCategoryLedger(updateData.category, 'sales');
      updateData.purchaseLedger = purchaseLedger._id;
      updateData.salesLedger = salesLedger._id;
    }

    const item = await BusinessItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Business item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating business item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating business item'
    });
  }
};

// Delete business item
export const deleteBusinessItem = async (req, res) => {
  try {
    const item = await BusinessItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    await BusinessStockTransaction.deleteMany({ itemId: req.params.id });
    await BusinessItem.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Business item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting business item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting business item'
    });
  }
};

// Business Stock In
export const businessStockIn = async (req, res) => {
  try {
    const {
      items,
      purchaseDate,
      invoiceDate,
      invoiceNumber,
      referenceType,
      notes,
      supplierId,
      paymentMode,
      paidAmount,
      ledgerEntries,
      grossTotal,
      discount,
      gstAmount,
      netTotal
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid itemId and quantity'
        });
      }
    }

    let supplierName = '';
    if (supplierId) {
      const supplier = await Supplier.findById(supplierId);
      if (supplier) {
        supplierName = supplier.name;
      }
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.rate || 0);
    }

    const calculatedGrossTotal = grossTotal || totalAmount;
    const calculatedDiscount = discount || 0;
    const calculatedGstAmount = gstAmount || 0;
    const calculatedNetTotal = netTotal || (calculatedGrossTotal - calculatedDiscount + calculatedGstAmount);

    const transactions = [];
    let voucher = null;

    for (const item of items) {
      const transaction = await createBusinessStockTransaction({
        itemId: item.itemId,
        transactionType: 'Stock In',
        quantity: parseFloat(item.quantity),
        freeQty: parseFloat(item.freeQty) || 0,
        rate: parseFloat(item.rate) || 0,
        referenceType: referenceType || 'Purchase',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        invoiceNumber: invoiceNumber || null,
        supplierId: supplierId || null,
        supplierName: supplierName,
        paymentMode: paymentMode || 'Credit',
        paidAmount: parseFloat(paidAmount) || 0,
        totalAmount: totalAmount,
        grossTotal: calculatedGrossTotal,
        discount: calculatedDiscount,
        gstAmount: calculatedGstAmount,
        netTotal: calculatedNetTotal,
        notes: notes || null
      });
      transactions.push(transaction);

      // Update item prices if provided
      if (item.salesRate !== undefined && item.salesRate > 0) {
        await BusinessItem.findByIdAndUpdate(item.itemId, {
          salesRate: parseFloat(item.salesRate)
        });
      }
      if (item.purchasePrice !== undefined && item.purchasePrice > 0) {
        await BusinessItem.findByIdAndUpdate(item.itemId, {
          purchasePrice: parseFloat(item.purchasePrice)
        });
      }
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
          referenceId: transactions[0]._id,
          ledgerEntries: ledgerEntries || []
        });

        for (const transaction of transactions) {
          transaction.voucherId = voucher._id;
          if (ledgerEntries && ledgerEntries.length > 0) {
            transaction.ledgerEntries = ledgerEntries.map(entry => ({
              ledgerId: entry.ledgerId,
              amount: parseFloat(entry.amount || 0),
              narration: entry.narration || ''
            }));
          }
          await transaction.save();
        }
      } catch (voucherError) {
        console.error('Error creating voucher:', voucherError);
      }
    }

    if ((!voucher) && ledgerEntries && ledgerEntries.length > 0) {
      for (const transaction of transactions) {
        transaction.ledgerEntries = ledgerEntries.map(entry => ({
          ledgerId: entry.ledgerId,
          amount: parseFloat(entry.amount || 0),
          narration: entry.narration || ''
        }));
        await transaction.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Business stock added successfully',
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
    console.error('Error adding business stock:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding business stock'
    });
  }
};

// Business Stock Out
export const businessStockOut = async (req, res) => {
  try {
    const { itemId, quantity, rate, notes, referenceType } = req.body;

    if (!itemId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and valid quantity are required'
      });
    }

    const transaction = await createBusinessStockTransaction({
      itemId,
      transactionType: 'Stock Out',
      quantity,
      rate: rate || 0,
      referenceType: referenceType || 'Adjustment',
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Business stock reduced successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error reducing business stock:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error reducing business stock'
    });
  }
};

// Get business stock transactions
export const getBusinessStockTransactions = async (req, res) => {
  try {
    const { itemId, startDate, endDate, transactionType, referenceType } = req.query;

    const query = {};

    if (itemId) {
      query.itemId = itemId;
    }

    if (transactionType) {
      query.transactionType = transactionType === 'in' ? 'Stock In' : 'Stock Out';
    }

    if (referenceType) {
      query.referenceType = referenceType;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.date.$lte = endDateTime;
      }
    }

    const transactions = await BusinessStockTransaction.find(query)
      .populate('itemId', 'itemCode itemName measurement category')
      .populate('supplierId', 'supplierId name')
      .populate('voucherId', 'voucherNumber voucherType')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType')
      .sort({ date: -1, createdAt: -1 })
      .limit(1000);

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching business transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching business transactions'
    });
  }
};

// Get business stock transaction by ID
export const getBusinessStockTransactionById = async (req, res) => {
  try {
    const transaction = await BusinessStockTransaction.findById(req.params.id)
      .populate('itemId', 'itemCode itemName measurement category')
      .populate('supplierId', 'supplierId name phone')
      .populate('voucherId', 'voucherNumber voucherType')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType currentBalance balanceType');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Business stock transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching business stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching business stock transaction'
    });
  }
};

// Update business stock transaction
export const updateBusinessStockTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await BusinessStockTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Business stock transaction not found'
      });
    }

    if (updateData.quantity !== undefined && updateData.quantity !== transaction.quantity) {
      const quantityDiff = parseFloat(updateData.quantity) - transaction.quantity;
      const item = await BusinessItem.findById(transaction.itemId);

      if (item) {
        if (transaction.transactionType === 'Stock In') {
          item.currentBalance += quantityDiff;
        } else {
          item.currentBalance -= quantityDiff;
        }
        await item.save();
      }
    }

    if (updateData.ledgerEntries && Array.isArray(updateData.ledgerEntries)) {
      updateData.ledgerEntries = updateData.ledgerEntries.map(entry => ({
        ledgerId: entry.ledgerId,
        amount: parseFloat(entry.amount || 0),
        narration: entry.narration || ''
      }));
    }

    const updatedTransaction = await BusinessStockTransaction.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('itemId', 'itemCode itemName measurement')
      .populate('supplierId', 'supplierId name')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType');

    res.status(200).json({
      success: true,
      message: 'Business stock transaction updated successfully',
      data: updatedTransaction
    });
  } catch (error) {
    console.error('Error updating business stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating business stock transaction'
    });
  }
};

// Delete business stock transaction
export const deleteBusinessStockTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await BusinessStockTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Business stock transaction not found'
      });
    }

    const item = await BusinessItem.findById(transaction.itemId);
    if (item) {
      if (transaction.transactionType === 'Stock In') {
        item.currentBalance -= transaction.quantity;
      } else {
        item.currentBalance += transaction.quantity;
      }
      await item.save();
    }

    await BusinessStockTransaction.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Business stock transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting business stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting business stock transaction'
    });
  }
};

// Get business stock balance report
export const getBusinessStockBalance = async (req, res) => {
  try {
    const { category, status } = req.query;

    const query = { status: status || 'Active' };
    if (category) {
      query.category = category;
    }

    const items = await BusinessItem.find(query)
      .populate('supplier', 'supplierId name')
      .sort({ itemName: 1 });

    const report = items.map(item => ({
      _id: item._id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      measurement: item.measurement,
      openingBalance: item.openingBalance,
      currentBalance: item.currentBalance,
      purchasePrice: item.purchasePrice,
      salesRate: item.salesRate,
      mrp: item.mrp,
      lowStockAlert: item.lowStockAlert,
      stockValue: item.currentBalance * (item.purchasePrice || 0),
      isLowStock: item.lowStockAlert > 0 && item.currentBalance <= item.lowStockAlert
    }));

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching business stock report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching business stock report'
    });
  }
};

// Update opening balance for a business item
export const updateBusinessOpeningBalance = async (req, res) => {
  try {
    const { id } = req.params;
    let { openingBalance, rate } = req.body;

    openingBalance = parseFloat(openingBalance);
    if (isNaN(openingBalance) || openingBalance < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid opening balance is required'
      });
    }

    rate = parseFloat(rate) || 0;

    const item = await BusinessItem.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    const difference = openingBalance - (item.openingBalance || 0);

    item.openingBalance = openingBalance;
    item.currentBalance = (item.currentBalance || 0) + difference;
    await item.save();

    if (difference !== 0) {
      await createBusinessStockTransaction({
        itemId: id,
        transactionType: difference > 0 ? 'Stock In' : 'Stock Out',
        quantity: Math.abs(difference),
        rate: rate || item.purchasePrice || 0,
        referenceType: 'Adjustment',
        notes: 'Opening balance adjusted'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Opening balance updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating business opening balance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating business opening balance'
    });
  }
};

// Update sales price for a business item
export const updateBusinessSalesPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { salesRate, wholesalePrice, retailPrice, mrp } = req.body;

    const item = await BusinessItem.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    if (salesRate !== undefined) item.salesRate = parseFloat(salesRate);
    if (wholesalePrice !== undefined) item.wholesalePrice = parseFloat(wholesalePrice);
    if (retailPrice !== undefined) item.retailPrice = parseFloat(retailPrice);
    if (mrp !== undefined) item.mrp = parseFloat(mrp);

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Prices updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating business prices:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating business prices'
    });
  }
};

export default {
  createBusinessItem,
  getAllBusinessItems,
  getBusinessItemById,
  updateBusinessItem,
  deleteBusinessItem,
  businessStockIn,
  businessStockOut,
  getBusinessStockTransactions,
  getBusinessStockTransactionById,
  updateBusinessStockTransaction,
  deleteBusinessStockTransaction,
  getBusinessStockBalance,
  updateBusinessOpeningBalance,
  updateBusinessSalesPrice
};

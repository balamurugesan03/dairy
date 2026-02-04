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

// Helper function to generate next item code
const generateItemCode = async () => {
  try {
    // Find the last item by sorting itemCode in descending order
    const lastItem = await Item.findOne({
      itemCode: { $regex: /^ITEM-\d+$/ }
    }).sort({ itemCode: -1 });

    let nextNumber = 1;
    if (lastItem && lastItem.itemCode) {
      // Extract the number from the last item code (e.g., "ITEM-0005" -> 5)
      const match = lastItem.itemCode.match(/^ITEM-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format the number with leading zeros (e.g., 1 -> "0001")
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    return `ITEM-${formattedNumber}`;
  } catch (error) {
    console.error('Error generating item code:', error);
    throw error;
  }
};

// Helper function to find or create category-based ledger
const findOrCreateCategoryLedger = async (category, ledgerType) => {
  const isPurchase = ledgerType === 'purchase';
  const ledgerName = `${category} ${isPurchase ? 'Purchase Ledger' : 'Sales Ledger'}`;

  // Try to find existing ledger
  let ledger = await Ledger.findOne({ ledgerName, status: 'Active' });

  if (!ledger) {
    // Create new ledger
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

// Create new item
export const createItem = async (req, res) => {
  try {
    const itemData = req.body;

    // Auto-generate item code if not provided
    if (!itemData.itemCode) {
      itemData.itemCode = await generateItemCode();
    } else {
      // Check for duplicate itemCode if manually provided
      const existingItem = await Item.findOne({ itemCode: itemData.itemCode });
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: 'Item Code already exists'
        });
      }
    }

    // Set currentBalance same as openingBalance initially
    itemData.currentBalance = itemData.openingBalance || 0;

    // Auto-create/find category-based purchase and sales ledgers
    if (itemData.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(itemData.category, 'purchase');
      const salesLedger = await findOrCreateCategoryLedger(itemData.category, 'sales');

      itemData.purchaseLedger = purchaseLedger._id;
      itemData.salesLedger = salesLedger._id;
    }

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
    const existingItem = await Item.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    const updateData = { ...req.body };

    // If category changed, update ledgers
    if (updateData.category && updateData.category !== existingItem.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(updateData.category, 'purchase');
      const salesLedger = await findOrCreateCategoryLedger(updateData.category, 'sales');

      updateData.purchaseLedger = purchaseLedger._id;
      updateData.salesLedger = salesLedger._id;
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

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
      paymentMode, // 'Credit', 'Cash', 'Adjustment' or 'N/A'
      paidAmount,
      // Multiple ledger entries for payment allocation
      ledgerEntries, // Array of { ledgerId, amount, narration }
      subsidies, // Array of { subsidyId, productId, amount }
      // Bill summary fields
      grossTotal,
      subsidyAmount: totalSubsidyAmount,
      ledgerDeduction,
      netTotal
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

    // Calculate total quantity for ledger deduction calculation
    const totalQuantity = items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);

    // Calculate bill summary values
    const calculatedGrossTotal = grossTotal || totalAmount;
    const calculatedSubsidyAmount = totalSubsidyAmount || (subsidies ? subsidies.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) : 0);
    // Ledger deduction = amount * quantity
    const calculatedLedgerDeduction = ledgerDeduction || (ledgerEntries ? ledgerEntries.reduce((sum, e) => sum + (parseFloat(e.amount || 0) * totalQuantity), 0) : 0);
    const calculatedNetTotal = netTotal || (calculatedGrossTotal - calculatedLedgerDeduction);

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
        supplierId: supplierId || null,
        supplierName: supplierName,
        paymentMode: paymentMode || 'Credit',
        paidAmount: parseFloat(paidAmount) || 0,
        totalAmount: totalAmount,
        // Bill summary fields
        grossTotal: calculatedGrossTotal,
        subsidyAmount: calculatedSubsidyAmount,
        ledgerDeduction: calculatedLedgerDeduction,
        netTotal: calculatedNetTotal,
        notes: notes || null
      });
      transactions.push(transaction);

      // Update item's salesRate if provided
      if (item.salesRate !== undefined && item.salesRate > 0) {
        await Item.findByIdAndUpdate(item.itemId, {
          salesRate: parseFloat(item.salesRate)
        });
      }
    }

    // Calculate total from ledger entries if provided (amount * quantity)
    const totalLedgerAmount = ledgerEntries && Array.isArray(ledgerEntries)
      ? ledgerEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount || 0) * totalQuantity), 0)
      : 0;

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
          referenceId: transactions[0]._id, // Link to first transaction
          ledgerEntries: ledgerEntries || [] // Pass ledger entries for voucher creation
        });

        // Update transactions with voucher reference and ledger entries
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
        // Continue even if voucher creation fails
      }
    }

    // If ledger entries provided but no voucher (N/A payment mode), still store them
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
      message: 'Stock added successfully',
      data: {
        transactions,
        voucher: voucher ? {
          _id: voucher._id,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType
        } : null,
        ledgerEntries: ledgerEntries || [],
        totalLedgerAmount
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
    const { itemId, startDate, endDate, transactionType, referenceType } = req.query;

    // If itemId is provided, use the specific item history function
    if (itemId) {
      const transactions = await getItemStockHistory(itemId, startDate, endDate);
      return res.status(200).json({
        success: true,
        data: transactions
      });
    }

    // Otherwise, get all transactions with filters
    const query = {};

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
        // Set end date to end of day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.date.$lte = endDateTime;
      }
    }

    const transactions = await StockTransaction.find(query)
      .populate('itemId', 'itemCode itemName measurement')
      .populate('issueCentre', 'centerName centerType')
      .populate('subsidyId', 'subsidyName subsidyType')
      .populate('supplierId', 'supplierId name')
      .populate('voucherId', 'voucherNumber voucherType')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType')
      .sort({ date: -1, createdAt: -1 })
      .limit(1000); // Limit to prevent too many results

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

// Update opening balance for an item
export const updateOpeningBalance = async (req, res) => {
  try {
    const { id } = req.params;
    let { openingBalance, rate } = req.body;

    // Parse and validate openingBalance
    openingBalance = parseFloat(openingBalance);
    if (isNaN(openingBalance) || openingBalance < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid opening balance is required (must be a non-negative number)'
      });
    }

    // Parse rate with fallback to 0
    rate = parseFloat(rate) || 0;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Calculate the difference to adjust current balance
    const difference = openingBalance - (item.openingBalance || 0);

    // Update item balances
    item.openingBalance = openingBalance;
    item.currentBalance = (item.currentBalance || 0) + difference;
    await item.save();

    // Create a stock transaction for the adjustment
    if (difference !== 0) {
      await createStockTransaction({
        itemId: id,
        transactionType: difference > 0 ? 'Stock In' : 'Stock Out',
        quantity: Math.abs(difference),
        rate: rate || item.salesRate || 0,
        referenceType: 'Opening Balance Adjustment',
        notes: 'Opening balance adjusted'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Opening balance updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating opening balance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating opening balance'
    });
  }
};

// Get stock transaction by ID
export const getStockTransactionById = async (req, res) => {
  try {
    const transaction = await StockTransaction.findById(req.params.id)
      .populate('itemId', 'itemCode itemName measurement category')
      .populate('issueCentre', 'centerName centerType')
      .populate('subsidyId', 'subsidyName subsidyType')
      .populate('supplierId', 'supplierId name phone')
      .populate('voucherId', 'voucherNumber voucherType')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType currentBalance balanceType')
      .populate('subsidies.subsidyId', 'subsidyName subsidyType')
      .populate('subsidies.productId', 'itemCode itemName');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Stock transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching stock transaction'
    });
  }
};

// Update stock transaction
export const updateStockTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await StockTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Stock transaction not found'
      });
    }

    // If quantity changed, update item's current balance
    if (updateData.quantity !== undefined && updateData.quantity !== transaction.quantity) {
      const quantityDiff = parseFloat(updateData.quantity) - transaction.quantity;
      const item = await Item.findById(transaction.itemId);

      if (item) {
        if (transaction.transactionType === 'Stock In') {
          item.currentBalance += quantityDiff;
        } else {
          item.currentBalance -= quantityDiff;
        }
        await item.save();
      }
    }

    // Process ledger entries if provided
    if (updateData.ledgerEntries && Array.isArray(updateData.ledgerEntries)) {
      updateData.ledgerEntries = updateData.ledgerEntries.map(entry => ({
        ledgerId: entry.ledgerId,
        amount: parseFloat(entry.amount || 0),
        narration: entry.narration || ''
      }));
    }

    // Process subsidies if provided
    if (updateData.subsidies && Array.isArray(updateData.subsidies)) {
      updateData.subsidies = updateData.subsidies.map(subsidy => ({
        subsidyId: subsidy.subsidyId,
        productId: subsidy.productId,
        amount: parseFloat(subsidy.amount || 0)
      }));
    }

    // Process bill summary fields if provided
    if (updateData.grossTotal !== undefined) {
      updateData.grossTotal = parseFloat(updateData.grossTotal || 0);
    }
    if (updateData.subsidyAmount !== undefined) {
      updateData.subsidyAmount = parseFloat(updateData.subsidyAmount || 0);
    }
    if (updateData.ledgerDeduction !== undefined) {
      updateData.ledgerDeduction = parseFloat(updateData.ledgerDeduction || 0);
    }
    if (updateData.netTotal !== undefined) {
      updateData.netTotal = parseFloat(updateData.netTotal || 0);
    }

    // Update item's salesRate if provided
    if (updateData.salesRate !== undefined && updateData.salesRate > 0) {
      await Item.findByIdAndUpdate(transaction.itemId, {
        salesRate: parseFloat(updateData.salesRate)
      });
    }

    const updatedTransaction = await StockTransaction.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('itemId', 'itemCode itemName measurement')
      .populate('issueCentre', 'centerName centerType')
      .populate('subsidyId', 'subsidyName subsidyType')
      .populate('supplierId', 'supplierId name')
      .populate('ledgerEntries.ledgerId', 'ledgerName ledgerType');

    res.status(200).json({
      success: true,
      message: 'Stock transaction updated successfully',
      data: updatedTransaction
    });
  } catch (error) {
    console.error('Error updating stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating stock transaction'
    });
  }
};

// Delete stock transaction
export const deleteStockTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await StockTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Stock transaction not found'
      });
    }

    // Update item's current balance
    const item = await Item.findById(transaction.itemId);
    if (item) {
      if (transaction.transactionType === 'Stock In') {
        item.currentBalance -= transaction.quantity;
      } else {
        item.currentBalance += transaction.quantity;
      }
      await item.save();
    }

    await StockTransaction.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Stock transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stock transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting stock transaction'
    });
  }
};

// Update sales price for an item
export const updateSalesPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { salesRate } = req.body;

    if (salesRate === undefined || salesRate < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid sales price is required'
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    item.salesRate = parseFloat(salesRate);
    await item.save();

    res.status(200).json({
      success: true,
      message: 'Sales price updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating sales price:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating sales price'
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
  getStockTransactionById,
  updateStockTransaction,
  deleteStockTransaction,
  getStockBalance,
  updateOpeningBalance,
  updateSalesPrice
};

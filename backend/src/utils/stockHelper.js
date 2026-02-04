import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';

// Create stock transaction and update item balance
export const createStockTransaction = async (transactionData, session = null) => {
  const {
    itemId,
    inventoryType,
    transactionType,
    quantity,
    freeQty,
    rate,
    referenceType,
    referenceId,
    purchaseDate,
    invoiceDate,
    invoiceNumber,
    issueCentre,
    subsidyId,
    // Supplier and payment fields
    supplierId,
    supplierName,
    paymentMode,
    paidAmount,
    totalAmount,
    // Bill summary fields
    grossTotal,
    subsidyAmount,
    ledgerDeduction,
    netTotal,
    notes
  } = transactionData;

  // Get current item
  const item = await Item.findById(itemId);
  if (!item) {
    throw new Error('Item not found');
  }

  // Calculate new balance (including free quantity for Stock In)
  let newBalance;
  if (transactionType === 'Stock In') {
    const totalQuantity = quantity + (freeQty || 0);
    newBalance = item.currentBalance + totalQuantity;
  } else if (transactionType === 'Stock Out') {
    if (item.currentBalance < quantity) {
      throw new Error(`Insufficient stock. Available: ${item.currentBalance}, Required: ${quantity}`);
    }
    newBalance = item.currentBalance - quantity;
  } else {
    throw new Error('Invalid transaction type');
  }

  // Create stock transaction record
  const transaction = new StockTransaction({
    itemId,
    inventoryType: inventoryType || item.inventoryType || 'Dairy',
    transactionType,
    quantity,
    freeQty: freeQty || 0,
    rate: rate || 0,
    referenceType,
    referenceId,
    balanceAfter: newBalance,
    date: new Date(),
    purchaseDate: purchaseDate || null,
    invoiceDate: invoiceDate || null,
    invoiceNumber: invoiceNumber || null,
    issueCentre: issueCentre || null,
    subsidyId: subsidyId || null,
    // Supplier and payment fields
    supplierId: supplierId || null,
    supplierName: supplierName || '',
    paymentMode: paymentMode || 'Credit',
    paidAmount: paidAmount || 0,
    totalAmount: totalAmount || 0,
    // Bill summary fields
    grossTotal: grossTotal || 0,
    subsidyAmount: subsidyAmount || 0,
    ledgerDeduction: ledgerDeduction || 0,
    netTotal: netTotal || 0,
    notes
  });

  if (session) {
    await transaction.save({ session });
  } else {
    await transaction.save();
  }

  // Update item balance
  item.currentBalance = newBalance;
  if (session) {
    await item.save({ session });
  } else {
    await item.save();
  }

  return transaction;
};

// Create multiple stock transactions (for sales with multiple items)
export const createBulkStockTransactions = async (items, referenceType, referenceId, session = null) => {
  const transactions = [];

  for (const itemData of items) {
    const transaction = await createStockTransaction({
      itemId: itemData.itemId,
      transactionType: 'Stock Out',
      quantity: itemData.quantity,
      rate: itemData.rate,
      referenceType,
      referenceId,
      notes: `${referenceType} - Item: ${itemData.itemName}`
    }, session);

    transactions.push(transaction);
  }

  return transactions;
};

// Reverse stock transaction (for bill deletion or editing)
export const reverseStockTransaction = async (referenceType, referenceId, session = null) => {
  // Find all transactions for this reference
  const transactions = await StockTransaction.find({
    referenceType,
    referenceId
  });

  for (const transaction of transactions) {
    const item = await Item.findById(transaction.itemId);
    if (!item) continue;

    // Reverse the transaction
    const reverseType = transaction.transactionType === 'Stock In' ? 'Stock Out' : 'Stock In';
    const newBalance = reverseType === 'Stock In'
      ? item.currentBalance + transaction.quantity
      : item.currentBalance - transaction.quantity;

    if (newBalance < 0) {
      throw new Error(`Cannot reverse transaction: would result in negative stock for item ${item.itemName}`);
    }

    // Create reverse transaction
    const reverseTransaction = new StockTransaction({
      itemId: transaction.itemId,
      transactionType: reverseType,
      quantity: transaction.quantity,
      rate: transaction.rate,
      referenceType: 'Adjustment',
      referenceId: transaction._id,
      balanceAfter: newBalance,
      date: new Date(),
      notes: `Reversal of ${transaction.referenceType}`
    });

    if (session) {
      await reverseTransaction.save({ session });
    } else {
      await reverseTransaction.save();
    }

    // Update item balance
    item.currentBalance = newBalance;
    if (session) {
      await item.save({ session });
    } else {
      await item.save();
    }
  }

  return transactions.length;
};

// Get stock history for an item
export const getItemStockHistory = async (itemId, startDate = null, endDate = null) => {
  const query = { itemId };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const transactions = await StockTransaction.find(query)
    .sort({ date: -1 })
    .populate('itemId', 'itemName itemCode');

  return transactions;
};

// Get current stock report for all items
export const getStockReport = async (category = null, status = 'Active', inventoryType = null) => {
  const query = { status };
  if (category) {
    query.category = category;
  }
  if (inventoryType) {
    query.inventoryType = inventoryType;
  }

  const items = await Item.find(query)
    .sort({ itemName: 1 })
    .select('itemCode itemName category unit currentBalance purchaseRate salesRate inventoryType');

  return items.map(item => ({
    itemCode: item.itemCode,
    itemName: item.itemName,
    category: item.category,
    unit: item.unit,
    currentBalance: item.currentBalance,
    purchaseRate: item.purchaseRate,
    salesRate: item.salesRate,
    inventoryType: item.inventoryType,
    stockValue: item.currentBalance * item.purchaseRate
  }));
};

export default {
  createStockTransaction,
  createBulkStockTransactions,
  reverseStockTransaction,
  getItemStockHistory,
  getStockReport
};

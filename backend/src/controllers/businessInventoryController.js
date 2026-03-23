import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import BusinessLedger from '../models/BusinessLedger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessSupplier from '../models/BusinessSupplier.js';
import { generateCode } from '../models/Counter.js';
import { generateBusinessVoucherNumber, applyLedgerBalanceChange } from './businessAccountingController.js';

// Helper — find or create a category-based ledger in BusinessLedger (not Ledger/dairy)
const findOrCreateCategoryLedger = async (category, ledgerType, companyId) => {
  const isPurchase = ledgerType === 'purchase';
  const ledgerName = `Business ${category} ${isPurchase ? 'Purchase' : 'Sales'}`;

  let ledger = await BusinessLedger.findOne({ name: ledgerName, status: 'Active', companyId });

  if (!ledger) {
    ledger = new BusinessLedger({
      name: ledgerName,
      group: isPurchase ? 'Purchase Accounts' : 'Sales Accounts',
      type: isPurchase ? 'Expense' : 'Income',
      openingBalance: 0,
      openingBalanceType: isPurchase ? 'Debit' : 'Credit',
      currentBalance: 0,
      status: 'Active',
      businessType: 'Private Firm',
      companyId
    });
    await ledger.save();
  }

  return ledger;
};

// Helper — get or create a BusinessLedger by name/group/type
const getOrCreateLedger = async (name, group, type, companyId) => {
  let ledger = await BusinessLedger.findOne({ name, companyId, status: 'Active' });
  if (!ledger) {
    ledger = new BusinessLedger({ name, group, type, companyId, businessType: 'Private Firm' });
    await ledger.save();
  }
  return ledger;
};

// Helper function to create business stock transaction
const createBusinessStockTransaction = async (data, companyId = null) => {
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
    balanceAfter,
    ...(companyId && { companyId })
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
    const companyId = req.companyId;
    const itemData = { ...req.body, companyId };

    if (!itemData.itemCode) {
      itemData.itemCode = await generateCode('BITEM', companyId, { monthly: false });
    } else {
      const existingItem = await BusinessItem.findOne({ itemCode: itemData.itemCode, companyId });
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: 'Item Code already exists'
        });
      }
    }

    // Start currentBalance at 0; the opening stock transaction below will set it correctly
    itemData.currentBalance = 0;

    // Strip empty-string ObjectId fields to avoid cast errors
    if (!itemData.supplier) itemData.supplier = undefined;
    if (!itemData.purchaseLedger) itemData.purchaseLedger = undefined;
    if (!itemData.salesLedger) itemData.salesLedger = undefined;

    if (itemData.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(itemData.category, 'purchase', companyId);
      const salesLedger = await findOrCreateCategoryLedger(itemData.category, 'sales', companyId);
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
      }, companyId);
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

    const query = { companyId: req.companyId };

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
    const item = await BusinessItem.findOne({ _id: req.params.id, companyId: req.companyId })
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
    const existingItem = await BusinessItem.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    const updateData = { ...req.body };

    if (updateData.category && updateData.category !== existingItem.category) {
      const purchaseLedger = await findOrCreateCategoryLedger(updateData.category, 'purchase', req.companyId);
      const salesLedger = await findOrCreateCategoryLedger(updateData.category, 'sales', req.companyId);
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
    const item = await BusinessItem.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    await BusinessStockTransaction.deleteMany({ itemId: req.params.id, companyId: req.companyId });
    await BusinessItem.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

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
      const supplier = await BusinessSupplier.findById(supplierId);
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
        date: purchaseDate ? new Date(purchaseDate) : new Date(),
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
      }, req.companyId);
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

    // Create BusinessVoucher for purchase — flows into R&D report
    if (paymentMode && paymentMode !== 'N/A' && calculatedNetTotal > 0) {
      try {
        const voucherEntries = [];
        const paid = parseFloat(paidAmount) || 0;
        const balance = calculatedNetTotal - paid;

        // Dr. Business Purchase Ledger(s) — grouped by category (BusinessLedger)
        const purchaseLedgerMap = new Map();
        for (const item of items) {
          const bItem = await BusinessItem.findById(item.itemId);
          if (!bItem) continue;
          const itemAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
          const catLedger = await findOrCreateCategoryLedger(bItem.category || 'General', 'purchase', companyId);
          const key = catLedger._id.toString();
          if (!purchaseLedgerMap.has(key)) {
            purchaseLedgerMap.set(key, { ledgerId: catLedger._id, ledgerName: catLedger.name, amount: 0 });
          }
          purchaseLedgerMap.get(key).amount += itemAmount;
        }
        for (const e of purchaseLedgerMap.values()) {
          if (e.amount > 0) voucherEntries.push({ ledgerId: e.ledgerId, ledgerName: e.ledgerName, type: 'debit', amount: e.amount });
        }

        // Cr. Cash or Bank (BusinessLedger) for amount paid — auto-create if not exists
        const pmCash = paymentMode === 'Cash' || paymentMode === 'UPI';
        const pmBank = paymentMode === 'Bank' || paymentMode === 'Cheque';
        if ((pmCash || pmBank) && paid > 0) {
          const payLedger = pmCash
            ? await getOrCreateLedger('Cash in Hand', 'Cash-in-Hand', 'Asset', companyId)
            : await getOrCreateLedger('Bank Account', 'Bank Accounts', 'Asset', companyId);
          voucherEntries.push({ ledgerId: payLedger._id, ledgerName: payLedger.name, type: 'credit', amount: paid });
        }

        // Cr. Supplier BusinessLedger for credit balance
        if (balance > 0) {
          const sName = supplierName || 'Sundry Creditors';
          let supplierBL = await BusinessLedger.findOne({ name: sName, group: 'Sundry Creditors', companyId });
          if (!supplierBL) {
            supplierBL = new BusinessLedger({
              name: sName, group: 'Sundry Creditors', type: 'Liability',
              openingBalance: 0, openingBalanceType: 'Credit', currentBalance: 0,
              status: 'Active', businessType: 'Private Firm', companyId
            });
            await supplierBL.save();
          }
          voucherEntries.push({ ledgerId: supplierBL._id, ledgerName: supplierBL.name, type: 'credit', amount: balance });
        }

        const totalDebit  = voucherEntries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
        const totalCredit = voucherEntries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);

        if (voucherEntries.length >= 2 && Math.abs(totalDebit - totalCredit) <= 0.01) {
          const voucherType = pmCash || pmBank ? 'Payment' : 'Journal';
          const pmMode = pmCash ? 'Cash' : pmBank ? (paymentMode === 'Cheque' ? 'Cheque' : 'Bank') : 'Bank';
          const voucherNumber = await generateBusinessVoucherNumber('Purchase', companyId);

          const bVoucher = new BusinessVoucher({
            voucherNumber,
            voucherType,
            date: purchaseDate ? new Date(purchaseDate) : new Date(),
            entries: voucherEntries,
            totalDebit,
            totalCredit,
            paymentMode: pmMode,
            narration: `Business Purchase${invoiceNumber ? ' - Inv ' + invoiceNumber : ''}${supplierName ? ' from ' + supplierName : ''}`,
            referenceType: 'BusinessPurchase',
            referenceId: transactions[0]._id,
            referenceNumber: invoiceNumber || '',
            status: 'Posted',
            businessType: 'Private Firm',
            companyId
          });
          await bVoucher.save();

          // Update BusinessLedger balances
          for (const entry of voucherEntries) {
            const ledger = await BusinessLedger.findById(entry.ledgerId);
            if (!ledger) continue;
            applyLedgerBalanceChange(ledger, entry.type, entry.amount);
            await ledger.save();
          }

          // Link voucher to stock transactions
          for (const transaction of transactions) {
            transaction.voucherId = bVoucher._id;
            await transaction.save();
          }
        }
      } catch (voucherError) {
        console.error('Error creating business purchase voucher:', voucherError);
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
    }, req.companyId);

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

    const query = { companyId: req.companyId };

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
    const transaction = await BusinessStockTransaction.findOne({ _id: req.params.id, companyId: req.companyId })
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

    const transaction = await BusinessStockTransaction.findOne({ _id: id, companyId: req.companyId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Business stock transaction not found'
      });
    }

    if (updateData.quantity !== undefined && updateData.quantity !== transaction.quantity) {
      const quantityDiff = parseFloat(updateData.quantity) - transaction.quantity;
      const item = await BusinessItem.findOne({ _id: transaction.itemId, companyId: req.companyId });

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

    const updatedTransaction = await BusinessStockTransaction.findOneAndUpdate(
      { _id: id, companyId: req.companyId },
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

    const transaction = await BusinessStockTransaction.findOne({ _id: id, companyId: req.companyId });
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

    const query = { status: status || 'Active', companyId: req.companyId };
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

    const item = await BusinessItem.findOne({ _id: id, companyId: req.companyId });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Business item not found'
      });
    }

    const difference = openingBalance - (item.openingBalance || 0);

    // Only update openingBalance here; currentBalance is handled by createBusinessStockTransaction below
    item.openingBalance = openingBalance;
    await item.save();

    if (difference !== 0) {
      await createBusinessStockTransaction({
        itemId: id,
        transactionType: difference > 0 ? 'Stock In' : 'Stock Out',
        quantity: Math.abs(difference),
        rate: rate || item.purchasePrice || 0,
        referenceType: 'Adjustment',
        notes: 'Opening balance adjusted'
      }, req.companyId);
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

    const item = await BusinessItem.findOne({ _id: id, companyId: req.companyId });
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

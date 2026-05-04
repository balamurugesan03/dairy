import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessLedger from '../models/BusinessLedger.js';
import Sales from '../models/Sales.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import FarmerPayment from '../models/FarmerPayment.js';
import MilkCollection from '../models/MilkCollection.js';
import MilkSales from '../models/MilkSales.js';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import Farmer from '../models/Farmer.js';
import Subsidy from '../models/Subsidy.js';
import { getDateRange } from '../utils/dateFilters.js';

// Helper function to get financial year string (e.g., "2024-25")
const getFinancialYear = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 3) { // April (3) to December (11)
    return `${year}-${(year + 1).toString().slice(2)}`;
  } else { // January (0) to March (2)
    return `${year - 1}-${year.toString().slice(2)}`;
  }
};

// Receipts & Disbursement Report
export const getReceiptsDisbursementReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { companyId: req.companyId };
    if (startDate || endDate) {
      query.voucherDate = {};
      if (startDate) query.voucherDate.$gte = new Date(startDate);
      if (endDate) query.voucherDate.$lte = new Date(endDate);
    }

    // Get all vouchers in date range
    const vouchers = await Voucher.find(query)
      .sort({ voucherDate: 1 })
      .populate('entries.ledgerId');

    // Categorize receipts and payments
    const receipts = [];
    const payments = [];

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.debitAmount > 0 && entry.ledgerId.ledgerType === 'Cash') {
          receipts.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            particulars: entry.ledgerName,
            amount: entry.debitAmount
          });
        } else if (entry.creditAmount > 0 && entry.ledgerId.ledgerType === 'Cash') {
          payments.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            particulars: entry.ledgerName,
            amount: entry.creditAmount
          });
        }
      });
    });

    const totalReceipts = receipts.reduce((sum, r) => sum + r.amount, 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        receipts,
        payments,
        totalReceipts,
        totalPayments,
        netCashFlow: totalReceipts - totalPayments
      }
    });
  } catch (error) {
    console.error('Error generating R&D report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Trading Account
export const getTradingAccount = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); return new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1); })();
    const end   = endDate   ? new Date(endDate)   : new Date();
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    const financialYear = getFinancialYear(start);

    // ── Opening Stock (Item model) ──────────────────────────────────
    const items = await Item.find({ status: 'Active', companyId });
    const openingStockTotal = items.reduce((s, it) => s + (it.openingBalance || 0) * (it.costPrice || it.salesRate || 0), 0);

    // ── Closing Stock (Item model current balance) ──────────────────
    const closingStockGrouped = {};
    let closingStockTotal = 0;
    items.forEach(it => {
      const val = (it.currentBalance || 0) * (it.costPrice || it.salesRate || 0);
      const cat = it.category || 'Others';
      closingStockGrouped[cat] = (closingStockGrouped[cat] || 0) + val;
      closingStockTotal += val;
    });
    const closingStockItems = Object.entries(closingStockGrouped).map(([category, amount]) => ({ category, amount }));

    // ── Milk Purchase (MilkCollection aggregate) ────────────────────
    const [milkPurchaseAgg] = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, farmers: { $addToSet: '$farmer' }, qty: { $sum: '$qty' } } }
    ]);
    const milkPurchaseTotal = milkPurchaseAgg?.total || 0;
    const milkFarmerCount   = milkPurchaseAgg?.farmers?.length || 0;
    const milkPurchaseQty   = milkPurchaseAgg?.qty || 0;

    // ── Other Purchases (Purchases A/c ledger debit entries) ────────
    const purchaseLedgers = await Ledger.find({ ledgerType: 'Purchases A/c', status: 'Active', companyId });
    const purchaseLedgerIds = purchaseLedgers.map(l => l._id.toString());
    const purchaseVouchers = await Voucher.find({
      companyId, voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: purchaseLedgers.map(l => l._id) }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const purchaseGrouped = {};
    purchaseVouchers.forEach(v => v.entries.forEach(e => {
      if (purchaseLedgerIds.includes(e.ledgerId?._id?.toString()) && e.debitAmount > 0)
        purchaseGrouped[e.ledgerId.ledgerName] = (purchaseGrouped[e.ledgerId.ledgerName] || 0) + e.debitAmount;
    }));
    const purchaseItems = Object.entries(purchaseGrouped).map(([ledgerName, amount]) => ({ ledgerName, amount }));
    const purchaseTotal = purchaseItems.reduce((s, x) => s + x.amount, 0);

    // ── Trade / Establishment Expenses (debit entries) ──────────────
    const expTypes = ['Trade Expenses', 'Establishment Charges', 'Miscellaneous Expenses'];
    const expLedgers = await Ledger.find({ ledgerType: { $in: expTypes }, status: 'Active', companyId });
    const expLedgerIds = expLedgers.map(l => l._id.toString());
    const expVouchers = await Voucher.find({
      companyId, voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: expLedgers.map(l => l._id) }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const expGrouped = {};
    expVouchers.forEach(v => v.entries.forEach(e => {
      if (expLedgerIds.includes(e.ledgerId?._id?.toString()) && e.debitAmount > 0)
        expGrouped[e.ledgerId.ledgerName] = (expGrouped[e.ledgerId.ledgerName] || 0) + e.debitAmount;
    }));
    const expenseItems = Object.entries(expGrouped).map(([ledgerName, amount]) => ({ ledgerName, amount }));
    const expenseTotal = expenseItems.reduce((s, x) => s + x.amount, 0);

    // ── Milk Sales (MilkSales aggregate) ────────────────────────────
    const [milkSalesAgg] = await MilkSales.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, qty: { $sum: '$qty' } } }
    ]);
    const milkSalesTotal = milkSalesAgg?.total || 0;

    // ── Union Sales Slips (credited to society) ─────────────────────
    const [unionAgg] = await UnionSalesSlip.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).catch(() => [null]);
    const unionSalesTotal = unionAgg?.total || 0;

    // ── Other Sales (Sales A/c ledger credit entries) ───────────────
    const salesLedgers = await Ledger.find({ ledgerType: 'Sales A/c', status: 'Active', companyId });
    const salesLedgerIds = salesLedgers.map(l => l._id.toString());
    const salesVouchers = await Voucher.find({
      companyId, voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: salesLedgers.map(l => l._id) }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const salesGrouped = {};
    salesVouchers.forEach(v => v.entries.forEach(e => {
      if (salesLedgerIds.includes(e.ledgerId?._id?.toString()) && e.creditAmount > 0)
        salesGrouped[e.ledgerId.ledgerName] = (salesGrouped[e.ledgerId.ledgerName] || 0) + e.creditAmount;
    }));
    const salesItems = Object.entries(salesGrouped).map(([ledgerName, amount]) => ({ ledgerName, amount }));
    const salesTotal = salesItems.reduce((s, x) => s + x.amount, 0);

    // ── Trade Income (Trade Income ledger credit entries) ────────────
    const incLedgers = await Ledger.find({ ledgerType: 'Trade Income', status: 'Active', companyId });
    const incLedgerIds = incLedgers.map(l => l._id.toString());
    const incVouchers = await Voucher.find({
      companyId, voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: incLedgers.map(l => l._id) }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const incGrouped = {};
    incVouchers.forEach(v => v.entries.forEach(e => {
      if (incLedgerIds.includes(e.ledgerId?._id?.toString()) && e.creditAmount > 0)
        incGrouped[e.ledgerId.ledgerName] = (incGrouped[e.ledgerId.ledgerName] || 0) + e.creditAmount;
    }));
    const incomeItems = Object.entries(incGrouped).map(([ledgerName, amount]) => ({ ledgerName, amount }));
    const incomeTotal = incomeItems.reduce((s, x) => s + x.amount, 0);

    // ── Totals & Gross Profit/Loss ──────────────────────────────────
    const totalDebitItems  = openingStockTotal + milkPurchaseTotal + purchaseTotal + expenseTotal;
    const totalCreditItems = milkSalesTotal + unionSalesTotal + salesTotal + incomeTotal + closingStockTotal;

    const grossProfit = totalCreditItems > totalDebitItems ? totalCreditItems - totalDebitItems : 0;
    const grossLoss   = totalDebitItems  > totalCreditItems ? totalDebitItems  - totalCreditItems : 0;

    res.status(200).json({
      success: true,
      data: {
        period: { startDate: start, endDate: end, financialYear },
        debitSide: {
          openingStock: { total: openingStockTotal },
          milkPurchase: {
            total: milkPurchaseTotal,
            farmerCount: milkFarmerCount,
            qty: milkPurchaseQty
          },
          purchases: { items: purchaseItems, total: purchaseTotal },
          tradeExpenses: { items: expenseItems, total: expenseTotal },
          grossProfit
        },
        creditSide: {
          milkSales: { total: milkSalesTotal },
          unionSales: { total: unionSalesTotal },
          sales: { items: salesItems, total: salesTotal },
          tradeIncome: { items: incomeItems, total: incomeTotal },
          closingStock: { items: closingStockItems, total: closingStockTotal },
          grossLoss
        },
        totals: {
          debitTotal:  totalDebitItems  + grossProfit,
          creditTotal: totalCreditItems + grossLoss
        }
      }
    });
  } catch (error) {
    console.error('Error generating trading account:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating trading account' });
  }
};

// Profit & Loss Statement
export const getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); return new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1); })();
    const end   = endDate   ? new Date(endDate)   : new Date();
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    // Income ledger types for dairy cooperative
    const incomeTypes = ['Income', 'Miscellaneous Income', 'Other Revenue', 'Grants & Aid', 'Subsidies'];
    // Expense ledger types for dairy cooperative
    const expenseTypes = ['Expense', 'Establishment Charges', 'Miscellaneous Expenses'];

    const [incLedgers, expLedgers] = await Promise.all([
      Ledger.find({ ledgerType: { $in: incomeTypes }, status: 'Active', companyId }),
      Ledger.find({ ledgerType: { $in: expenseTypes }, status: 'Active', companyId })
    ]);

    const allLedgerIds = [...incLedgers, ...expLedgers].map(l => l._id);
    const incLedgerIds = new Set(incLedgers.map(l => l._id.toString()));
    const expLedgerIds = new Set(expLedgers.map(l => l._id.toString()));

    // Fetch voucher entries in date range
    const vouchers = await Voucher.find({
      companyId,
      voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: allLedgerIds }
    });

    // Sum income (credit entries) and expenses (debit entries) from vouchers
    const incGrouped = {};
    const expGrouped = {};

    vouchers.forEach(v => {
      v.entries.forEach(e => {
        const lid = e.ledgerId?.toString();
        if (incLedgerIds.has(lid) && e.creditAmount > 0) {
          incGrouped[lid] = incGrouped[lid] || { name: '', amount: 0 };
          incGrouped[lid].amount += e.creditAmount;
        }
        if (expLedgerIds.has(lid) && e.debitAmount > 0) {
          expGrouped[lid] = expGrouped[lid] || { name: '', amount: 0 };
          expGrouped[lid].amount += e.debitAmount;
        }
      });
    });

    // Attach ledger names
    [...incLedgers, ...expLedgers].forEach(l => {
      const lid = l._id.toString();
      if (incGrouped[lid]) incGrouped[lid].name = l.ledgerName;
      if (expGrouped[lid]) expGrouped[lid].name = l.ledgerName;
    });

    // Also include subsidy amounts from Subsidy model
    const [subsidyAgg] = await Subsidy.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalSubsidy' } } }
    ]).catch(() => [null]);
    if (subsidyAgg?.total > 0) {
      incGrouped['_subsidy'] = { name: 'Subsidy Received', amount: subsidyAgg.total };
    }

    const income  = Object.values(incGrouped).filter(x => x.amount > 0);
    const expenses = Object.values(expGrouped).filter(x => x.amount > 0);

    const totalIncome  = income.reduce((s, x) => s + x.amount, 0);
    const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
    const netProfit    = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      data: {
        income,
        totalIncome,
        expenses,
        totalExpense,
        netProfit
      }
    });
  } catch (error) {
    console.error('Error generating P&L:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating report' });
  }
};

// Balance Sheet
export const getBalanceSheet = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); return new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1); })();
    const end   = endDate   ? new Date(endDate)   : new Date();
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    // ── Asset ledger types ──────────────────────────────────────────
    const assetTypes = [
      'Asset', 'Cash', 'Bank', 'Other Receivable',
      'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
      'Investment A/c', 'Other Investment', 'Government Securities'
    ];
    // Party ledgers with Dr balance are also assets (e.g. customers owe us)
    const assetLedgers = await Ledger.find({ ledgerType: { $in: assetTypes }, status: 'Active', companyId });

    // Party (Dr balance) → receivables
    const partyDrLedgers = await Ledger.find({
      ledgerType: { $in: ['Party', 'Accounts Due From (Sundry Debtors)'] },
      balanceType: 'Dr',
      currentBalance: { $gt: 0 },
      status: 'Active', companyId
    });

    // ── Liability ledger types ──────────────────────────────────────
    const liabilityTypes = [
      'Liability', 'Other Payable', 'Other Liabilities',
      'Accounts Due To (Sundry Creditors)', 'Deposit A/c'
    ];
    const liabilityLedgers = await Ledger.find({ ledgerType: { $in: liabilityTypes }, status: 'Active', companyId });

    // Party (Cr balance) → payables
    const partyCrLedgers = await Ledger.find({
      ledgerType: 'Party',
      balanceType: 'Cr',
      currentBalance: { $gt: 0 },
      status: 'Active', companyId
    });

    // ── Capital ledger types ────────────────────────────────────────
    const capitalTypes = ['Capital', 'Share Capital', 'Education Fund', 'Contingency Fund', 'Profit & Loss A/c'];
    const capitalLedgers = await Ledger.find({ ledgerType: { $in: capitalTypes }, status: 'Active', companyId });

    // ── Closing Stock (Item model) ──────────────────────────────────
    const items = await Item.find({ status: 'Active', companyId });
    const closingStock = items.reduce((s, it) => s + (it.currentBalance || 0) * (it.costPrice || it.salesRate || 0), 0);

    // ── Net Profit from P&L (income - expenses from vouchers in range) ─
    const incTypes = ['Income', 'Miscellaneous Income', 'Other Revenue', 'Grants & Aid', 'Subsidies'];
    const expTypes = ['Expense', 'Establishment Charges', 'Miscellaneous Expenses'];
    const [incLedgers, expLedgers] = await Promise.all([
      Ledger.find({ ledgerType: { $in: incTypes }, status: 'Active', companyId }),
      Ledger.find({ ledgerType: { $in: expTypes }, status: 'Active', companyId })
    ]);
    const incIds = new Set(incLedgers.map(l => l._id.toString()));
    const expIds = new Set(expLedgers.map(l => l._id.toString()));
    const plVouchers = await Voucher.find({
      companyId,
      voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: [...incLedgers, ...expLedgers].map(l => l._id) }
    });
    let totalPLIncome = 0, totalPLExpense = 0;
    plVouchers.forEach(v => v.entries.forEach(e => {
      const lid = e.ledgerId?.toString();
      if (incIds.has(lid)) totalPLIncome  += e.creditAmount || 0;
      if (expIds.has(lid)) totalPLExpense += e.debitAmount  || 0;
    }));
    // Also milk purchase/sales from dairy flow
    const [mkpAgg] = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const [mksAgg] = await MilkSales.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const milkMargin = (mksAgg?.total || 0) - (mkpAgg?.total || 0);
    const netProfit = totalPLIncome - totalPLExpense + milkMargin;

    // ── Build asset/liability/capital item arrays ──────────────────
    const toItems = (ledgers) => ledgers.map(l => ({ name: l.ledgerName, amount: Math.abs(l.currentBalance), type: l.ledgerType }));

    const assetItems = [
      ...toItems(assetLedgers),
      ...toItems(partyDrLedgers),
      ...(closingStock > 0 ? [{ name: 'Closing Stock (Inventory)', amount: closingStock, type: 'Stock' }] : [])
    ].filter(x => x.amount > 0);

    const liabilityItems = [
      ...toItems(liabilityLedgers),
      ...toItems(partyCrLedgers)
    ].filter(x => x.amount > 0);

    const capitalItems = toItems(capitalLedgers).filter(x => x.amount > 0);

    const totalAssets      = assetItems.reduce((s, x) => s + x.amount, 0);
    const totalLiabilities = liabilityItems.reduce((s, x) => s + x.amount, 0);
    const totalCapital     = capitalItems.reduce((s, x) => s + x.amount, 0);
    const totalLiabilitiesAndCapital = totalLiabilities + totalCapital + netProfit;
    const difference = totalAssets - totalLiabilitiesAndCapital;

    res.status(200).json({
      success: true,
      data: {
        fromDate: start,
        toDate: end,
        assets: assetItems,
        totalAssets,
        liabilities: liabilityItems,
        totalLiabilities,
        capital: capitalItems,
        totalCapital,
        netProfit,
        totalLiabilitiesAndCapital,
        difference,
        isTallied: Math.abs(difference) < 1
      }
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating report' });
  }
};

// Sales Report
export const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, customerId } = req.query;

    const query = { companyId: req.companyId };
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }
    if (customerId) query.customerId = customerId;

    const sales = await Sales.find(query)
      .sort({ billDate: -1 })
      .populate('customerId', 'farmerId farmerNumber personalDetails');

    const summary = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, s) => sum + s.grandTotal, 0),
      totalPaid: sales.reduce((sum, s) => sum + s.paidAmount, 0),
      totalPending: sales.reduce((sum, s) => sum + s.balanceAmount, 0)
    };

    res.status(200).json({
      success: true,
      data: { sales, summary }
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Stock Report
export const getStockReport = async (req, res) => {
  try {
    const items = await Item.find({ status: 'Active', companyId: req.companyId }).sort({ itemName: 1 });

    const report = items.map(item => ({
      _id: item._id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      currentBalance: item.currentBalance,
      purchaseRate: item.purchaseRate,
      salesRate: item.salesRate,
      stockValue: item.currentBalance * item.purchaseRate
    }));

    const totalStockValue = report.reduce((sum, r) => sum + r.stockValue, 0);

    res.status(200).json({
      success: true,
      data: { items: report, totalStockValue }
    });
  } catch (error) {
    console.error('Error generating stock report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Subsidy Report — subsidy-wise purchase transactions
export const getSubsidyReport = async (req, res) => {
  try {
    const { startDate, endDate, subsidyId } = req.query;

    const query = {
      companyId: req.companyId,
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      'subsidies.0': { $exists: true }
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) { query.date.$gte = new Date(startDate); }
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.date.$lte = e; }
    }

    if (subsidyId) query['subsidies.subsidyId'] = subsidyId;

    const transactions = await StockTransaction.find(query)
      .populate('itemId', 'itemName unit measurement')
      .populate('supplierId', 'name supplierId')
      .populate('subsidies.subsidyId', 'subsidyName subsidyType')
      .sort({ date: -1 });

    // Flatten to one row per subsidy entry
    const rows = [];
    for (const txn of transactions) {
      for (const sub of txn.subsidies || []) {
        if (subsidyId && sub.subsidyId?._id?.toString() !== subsidyId) continue;
        rows.push({
          date: txn.date,
          invoiceNo: txn.invoiceNumber || '-',
          supplier: txn.supplierName || txn.supplierId?.name || '-',
          product: txn.itemId?.itemName || '-',
          unit: txn.itemId?.measurement || txn.itemId?.unit || '-',
          qty: txn.quantity || 0,
          rate: txn.rate || 0,
          subsidyName: sub.subsidyId?.subsidyName || 'Unknown',
          subsidyType: sub.subsidyId?.subsidyType || '-',
          subsidyAmount: sub.amount || 0
        });
      }
    }

    // Group rows by subsidy name
    const groupMap = {};
    for (const row of rows) {
      const key = row.subsidyName;
      if (!groupMap[key]) {
        groupMap[key] = { subsidyName: key, subsidyType: row.subsidyType, totalAmount: 0, count: 0, rows: [] };
      }
      groupMap[key].totalAmount += row.subsidyAmount;
      groupMap[key].count++;
      groupMap[key].rows.push(row);
    }

    const groups = Object.values(groupMap).sort((a, b) => a.subsidyName.localeCompare(b.subsidyName));

    const summary = {
      totalGroups: groups.length,
      totalTransactions: rows.length,
      totalSubsidyAmount: rows.reduce((s, r) => s + r.subsidyAmount, 0)
    };

    res.status(200).json({
      success: true,
      data: { groups, rows, summary }
    });
  } catch (error) {
    console.error('Error generating subsidy report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Inventory Purchase Register
export const getInventoryPurchaseRegister = async (req, res) => {
  try {
    const { startDate, endDate, itemId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      companyId: req.companyId,
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: start, $lte: end }
    };
    if (itemId) query.itemId = itemId;

    const transactions = await StockTransaction.find(query)
      .populate('itemId', 'itemName unit')
      .sort({ date: 1 });

    const rows = transactions.map(t => ({
      date: t.date,
      invoiceNo: t.invoiceNumber || '-',
      invoiceDate: t.invoiceDate || null,
      supplier: t.supplierName || '-',
      purchAmount: t.totalAmount || parseFloat((t.quantity * t.rate).toFixed(2)),
      earnings: t.subsidyAmount || 0,
      recovery: t.ledgerDeduction || 0,
      product: t.itemId?.itemName || '-',
      unit: t.itemId?.unit || '-',
      qty: t.quantity || 0,
      freeQty: t.freeQty || 0,
      rate: t.rate || 0
    }));

    const grandTotals = rows.reduce((acc, r) => {
      const totalQty = r.qty + r.freeQty;
      return {
        purchAmount: acc.purchAmount + r.purchAmount,
        earnings: acc.earnings + r.earnings,
        recovery: acc.recovery + r.recovery,
        netAmount: acc.netAmount + (r.purchAmount - r.earnings - r.recovery),
        qty: acc.qty + r.qty,
        freeQty: acc.freeQty + r.freeQty,
        totalQty: acc.totalQty + totalQty,
        amount: acc.amount + (totalQty * r.rate)
      };
    }, { purchAmount: 0, earnings: 0, recovery: 0, netAmount: 0, qty: 0, freeQty: 0, totalQty: 0, amount: 0 });

    res.status(200).json({
      success: true,
      data: { rows, grandTotals, startDate: start, endDate: end }
    });
  } catch (error) {
    console.error('Error generating inventory purchase register:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating report' });
  }
};

// Sales Register (Dairy)
export const getSalesRegister = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await Sales.find({
      companyId: req.companyId,
      billDate: { $gte: start, $lte: end }
    })
      .populate('collectionCenterId', 'centerName')
      .sort({ billDate: 1, billNumber: 1 });

    const rows = sales.map(s => ({
      billDate: s.billDate,
      billNumber: s.billNumber,
      customerType: s.customerType || 'Other',
      customerName: s.customerName || '-',
      customerPhone: s.customerPhone || '-',
      collectionCenter: s.collectionCenterId?.centerName || '-',
      itemCount: s.items?.length || 0,
      items: (s.items || []).map(i => ({
        itemName: i.itemName,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount,
        gstAmount: i.gstAmount || 0,
        subsidyAmount: i.subsidyAmount || 0
      })),
      subtotal: s.subtotal || 0,
      totalGst: s.totalGst || 0,
      totalSubsidy: s.totalSubsidy || 0,
      promotionDiscount: s.promotionDiscount || 0,
      grandTotal: s.grandTotal || 0,
      oldBalance: s.oldBalance || 0,
      totalDue: s.totalDue || 0,
      paymentMode: s.paymentMode || 'Cash',
      paidAmount: s.paidAmount || 0,
      balanceAmount: s.balanceAmount || 0,
      status: s.status || 'Pending'
    }));

    const sum = (key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);
    const summary = {
      count: rows.length,
      subtotal: sum('subtotal'),
      totalGst: sum('totalGst'),
      totalSubsidy: sum('totalSubsidy'),
      grandTotal: sum('grandTotal'),
      paidAmount: sum('paidAmount'),
      balanceAmount: sum('balanceAmount'),
      paidCount: rows.filter(r => r.status === 'Paid').length,
      partialCount: rows.filter(r => r.status === 'Partial').length,
      pendingCount: rows.filter(r => r.status === 'Pending').length
    };

    res.status(200).json({
      success: true,
      data: { rows, summary, startDate: start, endDate: end }
    });
  } catch (error) {
    console.error('Error generating sales register:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating report' });
  }
};

// Stock Register Report (Item-wise / Day-wise / Month-wise)
export const getStockRegister = async (req, res) => {
  try {
    const { startDate, endDate, mode = 'item' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const financialYear = getFinancialYear(start);

    // Fetch all active items
    const items = await Item.find({ status: 'Active', companyId: req.companyId })
      .select('itemCode itemName category measurement unit salesRate openingBalance currentBalance')
      .sort({ itemName: 1 });

    // Build a map of initial opening balances
    const initialOB = {};
    items.forEach(item => { initialOB[item._id.toString()] = item.openingBalance || 0; });

    // Calculate OB at start of the period from pre-period transactions
    const preTxns = await StockTransaction.find({ companyId: req.companyId, date: { $lt: start } })
      .select('itemId transactionType quantity');
    const obMap = { ...initialOB };
    preTxns.forEach(txn => {
      const id = txn.itemId?.toString();
      if (!id || obMap[id] === undefined) return;
      if (txn.transactionType === 'Stock In') obMap[id] += txn.quantity;
      else if (txn.transactionType === 'Stock Out') obMap[id] -= txn.quantity;
    });

    // Fetch transactions within the period
    const transactions = await StockTransaction.find({ companyId: req.companyId, date: { $gte: start, $lte: end } })
      .populate('itemId', 'itemCode itemName measurement unit salesRate')
      .sort({ date: 1 });

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const applyTxn = (group, txn) => {
      if (txn.transactionType === 'Stock In') {
        if (txn.referenceType === 'Return') group.salesReturn += txn.quantity;
        else group.purchase += txn.quantity;
      } else if (txn.transactionType === 'Stock Out') {
        if (txn.referenceType === 'Return') group.purchaseReturn += txn.quantity;
        else group.sales += txn.quantity;
      }
    };

    const buildRow = (group, ob, extra = {}) => {
      const total = ob + group.purchase + group.salesReturn;
      const closing = total - group.sales - group.purchaseReturn;
      const rate = group.rate || 0;
      return {
        ...extra,
        itemName: group.itemName,
        unit: group.unit || group.measurement || 'Nos',
        rate: parseFloat(rate).toFixed(2),
        ob: parseFloat(ob).toFixed(3),
        purchase: parseFloat(group.purchase).toFixed(3),
        salesReturn: parseFloat(group.salesReturn).toFixed(3),
        total: parseFloat(total).toFixed(3),
        sales: parseFloat(group.sales).toFixed(3),
        purchaseReturn: parseFloat(group.purchaseReturn).toFixed(3),
        closingStock: parseFloat(closing).toFixed(3),
        stockValue: parseFloat(closing * rate).toFixed(2)
      };
    };

    let reportData = [];

    if (mode === 'item') {
      // Consolidated per item for the date range
      const groups = {};
      transactions.forEach(txn => {
        if (!txn.itemId) return;
        const id = txn.itemId._id.toString();
        if (!groups[id]) {
          groups[id] = {
            itemId: id,
            itemName: txn.itemId.itemName,
            unit: txn.itemId.unit,
            measurement: txn.itemId.measurement,
            rate: txn.itemId.salesRate,
            purchase: 0, salesReturn: 0, sales: 0, purchaseReturn: 0
          };
        }
        applyTxn(groups[id], txn);
      });

      // Include all items that have ob or transactions
      items.forEach(item => {
        const id = item._id.toString();
        const ob = obMap[id] || 0;
        const g = groups[id];
        if (!g && ob === 0) return; // skip if no ob and no transactions
        const group = g || {
          itemName: item.itemName,
          unit: item.unit,
          measurement: item.measurement,
          rate: item.salesRate,
          purchase: 0, salesReturn: 0, sales: 0, purchaseReturn: 0
        };
        reportData.push(buildRow(group, ob));
      });
      reportData.sort((a, b) => a.itemName.localeCompare(b.itemName));

    } else if (mode === 'day') {
      const dayGroups = {};
      transactions.forEach(txn => {
        if (!txn.itemId) return;
        const dateKey = txn.date.toISOString().split('T')[0];
        const id = txn.itemId._id.toString();
        const key = `${dateKey}__${id}`;
        if (!dayGroups[key]) {
          dayGroups[key] = {
            date: txn.date,
            dateKey,
            itemId: id,
            itemName: txn.itemId.itemName,
            unit: txn.itemId.unit,
            measurement: txn.itemId.measurement,
            rate: txn.itemId.salesRate,
            purchase: 0, salesReturn: 0, sales: 0, purchaseReturn: 0
          };
        }
        applyTxn(dayGroups[key], txn);
      });

      // Sort by date then item
      const sorted = Object.values(dayGroups).sort((a, b) => {
        const d = a.dateKey.localeCompare(b.dateKey);
        return d !== 0 ? d : a.itemName.localeCompare(b.itemName);
      });

      // Track rolling balance per item, starting from OB at period start
      const runningOB = { ...obMap };
      sorted.forEach(g => {
        const ob = runningOB[g.itemId] || 0;
        const row = buildRow(g, ob, { date: g.date });
        reportData.push(row);
        runningOB[g.itemId] = parseFloat(row.closingStock);
      });

    } else if (mode === 'month') {
      const monthGroups = {};
      transactions.forEach(txn => {
        if (!txn.itemId) return;
        const d = new Date(txn.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const id = txn.itemId._id.toString();
        const key = `${monthKey}__${id}`;
        if (!monthGroups[key]) {
          monthGroups[key] = {
            monthKey,
            monthLabel: `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`,
            itemId: id,
            itemName: txn.itemId.itemName,
            unit: txn.itemId.unit,
            measurement: txn.itemId.measurement,
            rate: txn.itemId.salesRate,
            purchase: 0, salesReturn: 0, sales: 0, purchaseReturn: 0
          };
        }
        applyTxn(monthGroups[key], txn);
      });

      const sorted = Object.values(monthGroups).sort((a, b) => {
        const m = a.monthKey.localeCompare(b.monthKey);
        return m !== 0 ? m : a.itemName.localeCompare(b.itemName);
      });

      const runningOB = { ...obMap };
      sorted.forEach(g => {
        const ob = runningOB[g.itemId] || 0;
        const row = buildRow(g, ob, { month: g.monthLabel });
        reportData.push(row);
        runningOB[g.itemId] = parseFloat(row.closingStock);
      });
    }

    const sumField = (key) => reportData.reduce((s, r) => s + parseFloat(r[key] || 0), 0);
    const grandTotal = {
      ob: sumField('ob').toFixed(3),
      purchase: sumField('purchase').toFixed(3),
      salesReturn: sumField('salesReturn').toFixed(3),
      total: sumField('total').toFixed(3),
      sales: sumField('sales').toFixed(3),
      purchaseReturn: sumField('purchaseReturn').toFixed(3),
      closingStock: sumField('closingStock').toFixed(3),
      stockValue: sumField('stockValue').toFixed(2)
    };

    res.status(200).json({
      success: true,
      data: { financialYear, startDate: start, endDate: end, mode, rows: reportData, grandTotal }
    });
  } catch (error) {
    console.error('Error generating stock register:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating stock register' });
  }
};

// ── Milk Bill Abstract Report ──────────────────────────────────────────
// Deduction-column mapping (key → deduction type names from FarmerPayment)
const DEDUCTION_COLS = [
  { key: 'floodRelief',    types: ['Flood Relief Fund', 'Flood Relief', 'Welfare Recovery'] },
  { key: 'licPremium',     types: ['LIC GI Premium', 'LIC', 'Insurance'] },
  { key: 'milkValueAdv',   types: ['Milk Value Addl. Price Advance', 'Milk Value Advance', 'CF Advance', 'Loan Advance', 'Cash Advance'] },
  { key: 'milmaFeeds',     types: ['Milma Feeds', 'Cattle Feed', 'Feed'] },
  { key: 'mineralMixture', types: ['Mineral Mixture'] },
  { key: 'mdi',            types: ['MDI', 'Medicine'] },
  { key: 'roundingDiff',   types: ['Rounding Difference', 'Rounding Difference Payment'] },
  { key: 'shareInMilma',   types: ['Share in Milma', 'Share', 'Society Fee'] },
  { key: 'silageFactory',  types: ['Silage Factory', 'Silage'] },
  { key: 'unionBank',      types: ['Union Bank A/c', 'Union Bank', 'Loan EMI', 'Transport'] },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const emptyDed = () => Object.fromEntries(DEDUCTION_COLS.map(c => [c.key, 0]));

export const getMilkBillAbstractReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);

    const companyFilter = req.userCompany ? { companyId: req.userCompany } : {};

    // ── 1. Primary source: MilkCollection (actual daily milk purchases from farmers)
    const collections = await MilkCollection.find({
      ...companyFilter,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1, farmerNumber: 1 });

    // ── 2. Secondary source: FarmerPayment deductions for same period (if any)
    const payments = await FarmerPayment.find({
      ...companyFilter,
      paymentDate: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' }
    }).populate('farmerId', 'farmerNumber');

    // Build a deduction map: farmerNumber + monthKey → deduction breakdown
    const dedByFarmerMonth = {};
    payments.forEach(p => {
      const farmerNum = p.farmerId?.farmerNumber || '';
      if (!farmerNum) return;
      const pd = new Date(p.paymentDate);
      const mk = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
      const mapKey = `${farmerNum}__${mk}`;
      if (!dedByFarmerMonth[mapKey]) dedByFarmerMonth[mapKey] = emptyDed();
      (p.deductions || []).forEach(ded => {
        const col = DEDUCTION_COLS.find(c =>
          c.types.some(t => t.toLowerCase() === (ded.type || '').toLowerCase())
        );
        if (col) dedByFarmerMonth[mapKey][col.key] += ded.amount || 0;
      });
    });

    // ── 3. Group collections by month
    const monthMap = {};

    collections.forEach(c => {
      const d = new Date(c.date);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ml = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

      if (!monthMap[mk]) {
        monthMap[mk] = {
          monthKey: mk, monthLabel: ml,
          rows: [], totals: emptyDed(),
          totalQty: 0, totalAmount: 0, totalPayment: 0
        };
      }

      const dedMapKey = `${c.farmerNumber}__${mk}`;
      const dedMap = dedByFarmerMonth[dedMapKey] || emptyDed();
      const totalDed = DEDUCTION_COLS.reduce((s, col) => s + (dedMap[col.key] || 0), 0);
      const netPayable = (c.amount || 0) - totalDed;

      const row = {
        date: c.date,
        shift: c.shift,
        farmerNumber: c.farmerNumber || '-',
        farmerName: c.farmerName || '-',
        qty: c.qty || 0,
        fat: c.fat || 0,
        snf: c.snf || 0,
        rate: c.rate || 0,
        incentive: c.incentive || 0,
        amount: c.amount || 0,   // milk value (qty × rate + incentive)
        deductions: dedMap,
        totalDeduction: totalDed,
        netPayable
      };

      monthMap[mk].rows.push(row);
      monthMap[mk].totalQty    += row.qty;
      monthMap[mk].totalAmount += row.amount;
      monthMap[mk].totalPayment += row.netPayable;
      DEDUCTION_COLS.forEach(col => { monthMap[mk].totals[col.key] += dedMap[col.key] || 0; });
    });

    const months = Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const grandTotals = {
      qty:     months.reduce((s, m) => s + m.totalQty, 0),
      amount:  months.reduce((s, m) => s + m.totalAmount, 0),
      payment: months.reduce((s, m) => s + m.totalPayment, 0),
      deductions: Object.fromEntries(
        DEDUCTION_COLS.map(c => [c.key, months.reduce((s, m) => s + m.totals[c.key], 0)])
      )
    };

    res.status(200).json({ success: true, data: { months, grandTotals, startDate: start, endDate: end } });
  } catch (error) {
    console.error('Error generating milk bill abstract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Dairy Abstract Report ──────────────────────────────────────────────────
export const getDairyAbstractReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);

    const companyFilter = req.userCompany ? { companyId: req.userCompany } : {};

    // ── 1. Milk Purchase (MilkCollection) grouped by month
    const purchaseAgg = await MilkCollection.aggregate([
      { $match: { ...companyFilter, date: { $gte: start, $lte: end } } },
      { $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        qty:    { $sum: '$qty' },
        amount: { $sum: '$amount' },
        days:   { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // ── 2. Local Sales (saleMode=LOCAL) grouped by month
    const localAgg = await MilkSales.aggregate([
      { $match: { ...companyFilter, date: { $gte: start, $lte: end }, saleMode: 'LOCAL' } },
      { $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        qty:    { $sum: '$litre' },
        amount: { $sum: '$amount' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // ── 3. Credit Sales with Customer category lookup, grouped by month + category
    const creditAgg = await MilkSales.aggregate([
      { $match: { ...companyFilter, date: { $gte: start, $lte: end }, saleMode: 'CREDIT' } },
      { $lookup: { from: 'customers', localField: 'creditorId', foreignField: '_id', as: 'creditor' } },
      { $addFields: { creditorCategory: { $ifNull: [{ $arrayElemAt: ['$creditor.category', 0] }, 'Others'] } } },
      { $group: {
        _id: {
          year: { $year: '$date' }, month: { $month: '$date' },
          category: '$creditorCategory'
        },
        qty:    { $sum: '$litre' },
        amount: { $sum: '$amount' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // ── 4. Union Sales (UnionSalesSlip) grouped by month
    const unionAgg = await UnionSalesSlip.aggregate([
      { $match: { ...companyFilter, date: { $gte: start, $lte: end } } },
      { $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        sendQty:  { $sum: '$qty' },
        spoilage: { $sum: { $add: ['$unionSpoilage', '$transportationSpoilage'] } },
        amount:   { $sum: '$amount' },
        rateSum:  { $sum: { $multiply: ['$qty', '$rate'] } }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // ── Build month map
    const SCHOOL_CATS = new Set(['School', 'Anganwadi']);
    const SAMPLE_CATS = new Set(['Sample']);
    const monthMap = {};

    const getM = (year, month) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          year, month, key,
          collectionDays: 0,
          purchase:    { qty: 0, amount: 0 },
          localSales:  { qty: 0, amount: 0 },
          creditSales: { qty: 0, amount: 0 },
          schoolSales: { qty: 0, amount: 0 },
          sampleSales: { qty: 0, amount: 0 },
          union:       { sendQty: 0, spoilage: 0, amount: 0, rateSum: 0 }
        };
      }
      return monthMap[key];
    };

    for (const p of purchaseAgg) {
      const m = getM(p._id.year, p._id.month);
      m.purchase.qty    = p.qty;
      m.purchase.amount = p.amount;
      m.collectionDays  = p.days.length;
    }

    for (const s of localAgg) {
      const m = getM(s._id.year, s._id.month);
      m.localSales.qty    += s.qty;
      m.localSales.amount += s.amount;
    }

    for (const s of creditAgg) {
      const m = getM(s._id.year, s._id.month);
      if (SCHOOL_CATS.has(s._id.category)) {
        m.schoolSales.qty    += s.qty;
        m.schoolSales.amount += s.amount;
      } else if (SAMPLE_CATS.has(s._id.category)) {
        m.sampleSales.qty    += s.qty;
        m.sampleSales.amount += s.amount;
      } else {
        m.creditSales.qty    += s.qty;
        m.creditSales.amount += s.amount;
      }
    }

    for (const u of unionAgg) {
      const m = getM(u._id.year, u._id.month);
      m.union.sendQty  = u.sendQty;
      m.union.spoilage = u.spoilage;
      m.union.amount   = u.amount;
      m.union.rateSum  = u.rateSum;
    }

    // ── Derive values per month
    const months = Object.values(monthMap)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      .map(m => {
        const unionReceived = Math.max(0, m.union.sendQty - m.union.spoilage);
        const unionShortage = m.union.sendQty > unionReceived ? m.union.sendQty - unionReceived : 0;
        const unionExcess   = unionReceived > m.union.sendQty ? unionReceived - m.union.sendQty : 0;

        const totalSalesQty    = m.localSales.qty + m.creditSales.qty + m.schoolSales.qty + m.sampleSales.qty + unionReceived;
        const totalSalesAmount = m.localSales.amount + m.creditSales.amount + m.schoolSales.amount + m.sampleSales.amount + m.union.amount;

        const handledQty      = totalSalesQty;
        const diff            = m.purchase.qty - handledQty;
        const purchShortage   = diff > 0 ? diff : 0;
        const purchExcess     = diff < 0 ? Math.abs(diff) : 0;
        const profit          = totalSalesAmount - m.purchase.amount;

        const avg = (amt, qty) => qty > 0 ? amt / qty : 0;

        return {
          year: m.year, month: m.month, key: m.key,
          collectionDays: m.collectionDays,
          purchase: {
            qty: m.purchase.qty,
            avgRate: avg(m.purchase.amount, m.purchase.qty),
            value: m.purchase.amount,
            shortage: purchShortage,
            excess:   purchExcess,
            handledQty
          },
          localSales:  { qty: m.localSales.qty,  avgRate: avg(m.localSales.amount,  m.localSales.qty),  value: m.localSales.amount },
          creditSales: { qty: m.creditSales.qty, avgRate: avg(m.creditSales.amount, m.creditSales.qty), value: m.creditSales.amount },
          schoolSales: { qty: m.schoolSales.qty, avgRate: avg(m.schoolSales.amount, m.schoolSales.qty), value: m.schoolSales.amount },
          sampleSales: { qty: m.sampleSales.qty, avgRate: avg(m.sampleSales.amount, m.sampleSales.qty), value: m.sampleSales.amount },
          union: {
            sendQty:     m.union.sendQty,
            receivedQty: unionReceived,
            avgRate:     avg(m.union.rateSum, m.union.sendQty),
            value:       m.union.amount,
            spoilage:    m.union.spoilage,
            excess:      unionExcess,
            shortage:    unionShortage
          },
          salesTotal: { qty: totalSalesQty, avgRate: avg(totalSalesAmount, totalSalesQty), value: totalSalesAmount },
          profit,
          bmc: 0,
          prodUnit: 0
        };
      });

    // ── Grand totals
    const gt = {
      collectionDays: 0,
      purchase:    { qty: 0, value: 0, shortage: 0, excess: 0, handledQty: 0 },
      localSales:  { qty: 0, value: 0 },
      creditSales: { qty: 0, value: 0 },
      schoolSales: { qty: 0, value: 0 },
      sampleSales: { qty: 0, value: 0 },
      union:       { sendQty: 0, receivedQty: 0, value: 0, spoilage: 0, excess: 0, shortage: 0 },
      salesTotal:  { qty: 0, value: 0 },
      profit: 0
    };

    for (const m of months) {
      gt.collectionDays     += m.collectionDays;
      gt.purchase.qty       += m.purchase.qty;
      gt.purchase.value     += m.purchase.value;
      gt.purchase.shortage  += m.purchase.shortage;
      gt.purchase.excess    += m.purchase.excess;
      gt.purchase.handledQty+= m.purchase.handledQty;
      gt.localSales.qty     += m.localSales.qty;
      gt.localSales.value   += m.localSales.value;
      gt.creditSales.qty    += m.creditSales.qty;
      gt.creditSales.value  += m.creditSales.value;
      gt.schoolSales.qty    += m.schoolSales.qty;
      gt.schoolSales.value  += m.schoolSales.value;
      gt.sampleSales.qty    += m.sampleSales.qty;
      gt.sampleSales.value  += m.sampleSales.value;
      gt.union.sendQty      += m.union.sendQty;
      gt.union.receivedQty  += m.union.receivedQty;
      gt.union.value        += m.union.value;
      gt.union.spoilage     += m.union.spoilage;
      gt.union.excess       += m.union.excess;
      gt.union.shortage     += m.union.shortage;
      gt.salesTotal.qty     += m.salesTotal.qty;
      gt.salesTotal.value   += m.salesTotal.value;
      gt.profit             += m.profit;
    }

    const avg = (amt, qty) => qty > 0 ? amt / qty : 0;
    gt.purchase.avgRate    = avg(gt.purchase.value,    gt.purchase.qty);
    gt.localSales.avgRate  = avg(gt.localSales.value,  gt.localSales.qty);
    gt.creditSales.avgRate = avg(gt.creditSales.value, gt.creditSales.qty);
    gt.schoolSales.avgRate = avg(gt.schoolSales.value, gt.schoolSales.qty);
    gt.sampleSales.avgRate = avg(gt.sampleSales.value, gt.sampleSales.qty);
    gt.union.avgRate       = avg(gt.union.value,       gt.union.sendQty);
    gt.salesTotal.avgRate  = avg(gt.salesTotal.value,  gt.salesTotal.qty);

    const summary = {
      collectionDays:      gt.collectionDays,
      avgPurchaseRate:     gt.purchase.avgRate,
      totalShortage:       gt.purchase.shortage,
      avgProductionPerDay: gt.collectionDays > 0 ? gt.purchase.qty / gt.collectionDays : 0,
      avgShortagePerDay:   gt.collectionDays > 0 ? gt.purchase.shortage / gt.collectionDays : 0,
      totalHandledQty:     gt.purchase.handledQty
    };

    res.status(200).json({ success: true, data: { months, grandTotal: gt, summary, startDate: start, endDate: end } });
  } catch (error) {
    console.error('Error generating dairy abstract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Dairy Register Report (Date-wise with AM/PM/Total rows) ────────────────
export const getDairyRegisterReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);
    const companyId = req.companyId;

    const SCHOOL_CATS = new Set(['School', 'Anganwadi']);

    // ── 1. MilkCollection with farmer membership lookup
    const collectionAgg = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $lookup: { from: 'farmers', localField: 'farmer', foreignField: '_id', as: 'farmerDoc' } },
      { $addFields: {
        isMember:  { $ifNull: [{ $arrayElemAt: ['$farmerDoc.isMembership', 0] }, false] },
        dateStr:   { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
      }},
      { $group: {
        _id: { dateStr: '$dateStr', shift: '$shift', isMember: '$isMember' },
        farmerIds: { $addToSet: '$farmer' },
        qty:       { $sum: '$qty' },
        amount:    { $sum: '$amount' }
      }},
      { $sort: { '_id.dateStr': 1, '_id.shift': 1 } }
    ]);

    // ── 2. MilkSales with customer category lookup
    const salesAgg = await MilkSales.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $lookup: { from: 'customers', localField: 'creditorId', foreignField: '_id', as: 'creditor' } },
      { $addFields: {
        creditorCategory: { $ifNull: [{ $arrayElemAt: ['$creditor.category', 0] }, 'Others'] },
        dateStr:          { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
      }},
      { $group: {
        _id: { dateStr: '$dateStr', session: '$session', saleMode: '$saleMode', category: '$creditorCategory' },
        qty:    { $sum: '$litre' },
        amount: { $sum: '$amount' }
      }},
      { $sort: { '_id.dateStr': 1, '_id.session': 1 } }
    ]);

    // ── 3. UnionSalesSlip
    const unionAgg = await UnionSalesSlip.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end } } },
      { $group: {
        _id: { dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, shift: '$time' },
        sendQty:  { $sum: '$qty' },
        amount:   { $sum: '$amount' },
        spoilage: { $sum: { $add: ['$unionSpoilage', '$transportationSpoilage'] } }
      }},
      { $sort: { '_id.dateStr': 1, '_id.shift': 1 } }
    ]);

    // ── Build slot map: dateStr → shift → raw buckets
    const slotMap = {};

    const getSlot = (dateStr, shift) => {
      if (!slotMap[dateStr]) slotMap[dateStr] = {};
      if (!slotMap[dateStr][shift]) {
        slotMap[dateStr][shift] = {
          memberNos: 0, memberQty: 0, memberAmt: 0,
          nonMemberNos: 0, nonMemberQty: 0, nonMemberAmt: 0,
          localQty: 0, localAmt: 0,
          creditQty: 0, creditAmt: 0,
          schoolQty: 0, schoolAmt: 0,
          sampleQty: 0, sampleAmt: 0,
          unionSendQty: 0, unionAmt: 0, unionSpoilage: 0
        };
      }
      return slotMap[dateStr][shift];
    };

    // Fill collection data
    for (const c of collectionAgg) {
      const s = getSlot(c._id.dateStr, c._id.shift);
      if (c._id.isMember) {
        s.memberNos   += c.farmerIds.length;
        s.memberQty   += c.qty;
        s.memberAmt   += c.amount;
      } else {
        s.nonMemberNos  += c.farmerIds.length;
        s.nonMemberQty  += c.qty;
        s.nonMemberAmt  += c.amount;
      }
    }

    // Fill sales data  (session AM/PM → shift)
    for (const s of salesAgg) {
      const slot = getSlot(s._id.dateStr, s._id.session);
      if (s._id.saleMode === 'LOCAL') {
        slot.localQty  += s.qty;
        slot.localAmt  += s.amount;
      } else if (s._id.saleMode === 'SAMPLE') {
        // Sample/production-unit sales — must check saleMode before category
        // because sample records have no creditorId (category defaults to 'Others')
        slot.sampleQty += s.qty;
        slot.sampleAmt += s.amount;
      } else if (SCHOOL_CATS.has(s._id.category)) {
        // CREDIT sales to school / anganwadi customers
        slot.schoolQty += s.qty;
        slot.schoolAmt += s.amount;
      } else {
        // All other CREDIT sales
        slot.creditQty += s.qty;
        slot.creditAmt += s.amount;
      }
    }

    // Fill union data
    for (const u of unionAgg) {
      const slot = getSlot(u._id.dateStr, u._id.shift);
      slot.unionSendQty  += u.sendQty;
      slot.unionAmt      += u.amount;
      slot.unionSpoilage += u.spoilage;
    }

    // ── Derive row values from a raw slot
    const deriveRow = (raw) => {
      // Milk Purchase
      const procQty     = raw.memberQty + raw.nonMemberQty;
      const handQty     = procQty;                                  // Hand.Qty = Proc.Qty (same source)
      const purchaseAmt = raw.memberAmt + raw.nonMemberAmt;
      const totalNos    = raw.memberNos + raw.nonMemberNos;
      const shortage    = 0;                                        // procQty == handQty always
      const excess      = 0;

      // Send = Proc Qty − (Local + Sample + Credit + School)
      const localDistQty = raw.localQty + raw.sampleQty + raw.creditQty + raw.schoolQty;
      const unionSendQty = Math.max(0, procQty - localDistQty);    // calculated send to Milma

      // Milma / Union Sales data from Union Sales Slip
      const milmaQtyLtr  = raw.unionSendQty;                       // actual qty received by Milma
      const unionAmt     = raw.unionAmt;
      const unionSpoilage= raw.unionSpoilage;

      // Milma shortage/excess: Send vs Milma received
      const unionExcess   = milmaQtyLtr > unionSendQty ? milmaQtyLtr - unionSendQty : 0;
      const unionShortage = unionSendQty > milmaQtyLtr ? unionSendQty - milmaQtyLtr : 0;

      // Total Sales Section
      const milmaTotalQty = procQty;                               // Total Qty = Proc Qty
      const milmaTotalAmt = raw.localAmt + raw.sampleAmt + raw.creditAmt + raw.schoolAmt + unionAmt;

      const profit = milmaTotalAmt - purchaseAmt;

      return {
        memberNos:    raw.memberNos,
        memberQty:    raw.memberQty,
        memberAmt:    raw.memberAmt,
        nonMemberNos: raw.nonMemberNos,
        nonMemberQty: raw.nonMemberQty,
        nonMemberAmt: raw.nonMemberAmt,
        totalNos,
        procQty,
        handQty,
        purchaseAmt,
        shortage,
        excess,
        localQty:     raw.localQty,
        localAmt:     raw.localAmt,
        creditQty:    raw.creditQty,
        creditAmt:    raw.creditAmt,
        schoolQty:    raw.schoolQty,
        schoolAmt:    raw.schoolAmt,
        sampleQty:    raw.sampleQty,
        sampleAmt:    raw.sampleAmt,
        unionSendQty,                                              // calculated: Proc − local dist
        milmaQtyLtr,                                               // from union sales slip
        unionAmt,
        unionSpoilage,
        unionExcess,
        unionShortage,
        milmaTotalQty,
        milmaTotalAmt,
        profit,
      };
    };

    // ── Merge two raw slots (for daily Total)
    const mergeRaw = (a, b) => ({
      memberNos:      a.memberNos      + b.memberNos,
      memberQty:      a.memberQty      + b.memberQty,
      memberAmt:      a.memberAmt      + b.memberAmt,
      nonMemberNos:   a.nonMemberNos   + b.nonMemberNos,
      nonMemberQty:   a.nonMemberQty   + b.nonMemberQty,
      nonMemberAmt:   a.nonMemberAmt   + b.nonMemberAmt,
      localQty:       a.localQty       + b.localQty,
      localAmt:       a.localAmt       + b.localAmt,
      creditQty:      a.creditQty      + b.creditQty,
      creditAmt:      a.creditAmt      + b.creditAmt,
      schoolQty:      a.schoolQty      + b.schoolQty,
      schoolAmt:      a.schoolAmt      + b.schoolAmt,
      sampleQty:      a.sampleQty      + b.sampleQty,
      sampleAmt:      a.sampleAmt      + b.sampleAmt,
      unionSendQty:   a.unionSendQty   + b.unionSendQty,
      unionAmt:       a.unionAmt       + b.unionAmt,
      unionSpoilage:  a.unionSpoilage  + b.unionSpoilage
    });

    const EMPTY_RAW = {
      memberNos: 0, memberQty: 0, memberAmt: 0,
      nonMemberNos: 0, nonMemberQty: 0, nonMemberAmt: 0,
      localQty: 0, localAmt: 0, creditQty: 0, creditAmt: 0,
      schoolQty: 0, schoolAmt: 0, sampleQty: 0, sampleAmt: 0,
      unionSendQty: 0, unionAmt: 0, unionSpoilage: 0
    };

    // ── Build days array
    const allDates = [...new Set(Object.keys(slotMap))].sort();
    const days = allDates.map(dateStr => {
      const amRaw    = slotMap[dateStr]?.AM || { ...EMPTY_RAW };
      const pmRaw    = slotMap[dateStr]?.PM || { ...EMPTY_RAW };
      const totalRaw = mergeRaw(amRaw, pmRaw);
      return {
        dateStr,
        am:    deriveRow(amRaw),
        pm:    deriveRow(pmRaw),
        total: deriveRow(totalRaw)
      };
    });

    // ── Grand total (sum of all daily totals)
    const gtRaw = days.reduce((acc, d) => {
      const totalRaw = mergeRaw(
        slotMap[d.dateStr]?.AM || { ...EMPTY_RAW },
        slotMap[d.dateStr]?.PM || { ...EMPTY_RAW }
      );
      return mergeRaw(acc, totalRaw);
    }, { ...EMPTY_RAW });

    res.status(200).json({
      success: true,
      data: { days, grandTotal: deriveRow(gtRaw), startDate: start, endDate: end }
    });
  } catch (error) {
    console.error('Error generating dairy register:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Cooperative Society Receipt & Disbursement Report (Business/Private Firm) ─
export const getCooperativeRDReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // ── Date boundaries ──────────────────────────────────────────────────
    const start = startDate ? new Date(startDate) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCHours(23, 59, 59, 999);

    // ── Section mapping by BusinessLedger.group ──────────────────────────
    const SECTION_MAP = [
      { name: 'Advance due by Society', subtitle: '(LIABILITY)',
        groups: ['Sundry Creditors', 'Current Liabilities', 'Provisions', 'Duties & Taxes'] },
      { name: 'Advance due to Society', subtitle: '(ASSET)',
        groups: ['Sundry Debtors', 'Current Assets', 'Fixed Assets', 'Loans & Advances'] },
      { name: 'Bank Accounts',          subtitle: '(ASSET)',   groups: ['Bank Accounts'] },
      { name: 'Cash in Hand',           subtitle: '(ASSET)',   groups: ['Cash-in-Hand'] },
      { name: 'Deposits & Investments', subtitle: '',          groups: ['Investments'] },
      { name: 'Contingencies',          subtitle: '(EXPENSE)', groups: ['Direct Expenses', 'Indirect Expenses'] },
      { name: 'Income & Sales',         subtitle: '',          groups: ['Sales Accounts', 'Purchase Accounts', 'Direct Incomes', 'Indirect Incomes'] },
      { name: 'Capital & Reserves',     subtitle: '',          groups: ['Capital Account', 'Reserves & Surplus'] },
      { name: 'Stock',                  subtitle: '',          groups: ['Stock-in-Hand'] },
      { name: 'Suspense & Others',      subtitle: '',          groups: ['Suspense Account'] }
    ];

    const groupToSection = {};
    SECTION_MAP.forEach((sec, idx) => sec.groups.forEach(g => { groupToSection[g] = idx; }));

    // ── Cash ledger (BusinessLedger) & Opening Balance ───────────────────
    let cashLedger = await BusinessLedger.findOne({ group: 'Cash-in-Hand', status: 'Active', companyId: req.companyId });
    if (!cashLedger) {
      cashLedger = await BusinessLedger.findOne({ group: 'Cash-in-Hand', companyId: req.companyId });
    }
    if (!cashLedger) {
      cashLedger = new BusinessLedger({
        name: 'Cash in Hand',
        group: 'Cash-in-Hand',
        type: 'Asset',
        nature: 'Asset',
        openingBalance: 0,
        openingBalanceType: 'Debit',
        currentBalance: 0,
        status: 'Active',
        companyId: req.companyId
      });
      await cashLedger.save();
    }

    // Compute opening balance from BusinessLedger openingBalance + BusinessVoucher entries before start
    // BusinessLedger.openingBalanceType is 'Debit'/'Credit'
    let openingBalance = cashLedger.openingBalance || 0;
    if ((cashLedger.openingBalanceType || 'Debit') === 'Credit') openingBalance = -openingBalance;

    // Sum all BusinessVoucher entries for the cash ledger before startDate
    const cashVouchersBefore = await BusinessVoucher.find({
      companyId: req.companyId,
      status: { $ne: 'Cancelled' },
      date: { $lt: start },
      'entries.ledgerId': cashLedger._id
    }).select('entries');
    cashVouchersBefore.forEach(v => {
      v.entries.forEach(e => {
        if (e.ledgerId && e.ledgerId.toString() === cashLedger._id.toString()) {
          if (e.type === 'debit')  openingBalance += (e.amount || 0);
          else                     openingBalance -= (e.amount || 0);
        }
      });
    });

    // ── Helper: accumulate BusinessVouchers into ledger map ─────────────
    // BusinessVoucher entries use type ('debit'/'credit') + amount
    const accumulate = (vouchers, target) => {
      vouchers.forEach(voucher => {
        const isCash = voucher.paymentMode === 'Cash';
        voucher.entries.forEach(entry => {
          if (!entry.ledgerId) return;
          const ledger = entry.ledgerId;
          const id = ledger._id.toString();
          if (!target[id]) {
            target[id] = {
              ledgerName: ledger.name || entry.ledgerName || '',
              group:      ledger.group || 'Other',
              receiptCash: 0, receiptAdj: 0,
              paymentCash: 0, paymentAdj: 0
            };
          }
          const amt = entry.amount || 0;
          if (entry.type === 'debit') {
            if (isCash) target[id].receiptCash += amt; else target[id].receiptAdj += amt;
          } else {
            if (isCash) target[id].paymentCash += amt; else target[id].paymentAdj += amt;
          }
        });
      });
    };

    // ── Query 1: Upto (before startDate) — BusinessVoucher ───────────────
    const uptoMap = {};
    const uptoVouchers = await BusinessVoucher.find({
      companyId: req.companyId,
      status: { $ne: 'Cancelled' },
      date: { $lt: start }
    }).populate('entries.ledgerId', 'name group type');
    accumulate(uptoVouchers, uptoMap);

    // ── Query 2: During period — BusinessVoucher ─────────────────────────
    const duringMap = {};
    const duringVouchers = await BusinessVoucher.find({
      companyId: req.companyId,
      status: { $ne: 'Cancelled' },
      date: { $gte: start, $lte: end }
    }).populate('entries.ledgerId', 'name group type');
    accumulate(duringVouchers, duringMap);

    // ── Build sections ───────────────────────────────────────────────────
    const allIds = new Set([...Object.keys(uptoMap), ...Object.keys(duringMap)]);

    const buildSections = () => {
      const sectionData = SECTION_MAP.map(sec => ({
        name: sec.name, subtitle: sec.subtitle, items: [],
        totUptoR: 0, totDuringR: 0, totEomR: 0,
        totUptoP: 0, totDuringP: 0, totEomP: 0,
        totalReceiptAdj: 0, totalReceiptCash: 0, totalReceiptTotal: 0,
        totalPaymentAdj: 0, totalPaymentCash: 0, totalPaymentTotal: 0,
      }));
      const others = {
        name: 'Other Accounts', subtitle: '', items: [],
        totUptoR: 0, totDuringR: 0, totEomR: 0,
        totUptoP: 0, totDuringP: 0, totEomP: 0,
        totalReceiptAdj: 0, totalReceiptCash: 0, totalReceiptTotal: 0,
        totalPaymentAdj: 0, totalPaymentCash: 0, totalPaymentTotal: 0,
      };

      allIds.forEach(id => {
        const u = uptoMap[id]   || { ledgerName: duringMap[id]?.ledgerName || '', group: duringMap[id]?.group || 'Other', receiptCash: 0, receiptAdj: 0, paymentCash: 0, paymentAdj: 0 };
        const d = duringMap[id] || { ledgerName: uptoMap[id]?.ledgerName   || '', group: uptoMap[id]?.group   || 'Other', receiptCash: 0, receiptAdj: 0, paymentCash: 0, paymentAdj: 0 };

        const ledgerName = d.ledgerName || u.ledgerName;
        const group      = d.group || u.group;

        const uptoR   = u.receiptCash + u.receiptAdj;
        const uptoP   = u.paymentCash + u.paymentAdj;
        const duringR = d.receiptCash + d.receiptAdj;
        const duringP = d.paymentCash + d.paymentAdj;
        const eomR    = uptoR + duringR;
        const eomP    = uptoP + duringP;

        if (uptoR === 0 && uptoP === 0 && duringR === 0 && duringP === 0) return;

        const idx = groupToSection[group];
        const target = idx !== undefined ? sectionData[idx] : others;

        target.items.push({
          ledgerName,
          receiptAdj: d.receiptAdj, receiptCash: d.receiptCash, receiptTotal: duringR,
          paymentAdj: d.paymentAdj, paymentCash: d.paymentCash, paymentTotal: duringP,
          uptoR, duringR, eomR,
          uptoP, duringP, eomP
        });

        target.totUptoR   += uptoR;   target.totDuringR += duringR; target.totEomR += eomR;
        target.totUptoP   += uptoP;   target.totDuringP += duringP; target.totEomP += eomP;
        target.totalReceiptAdj   += d.receiptAdj;
        target.totalReceiptCash  += d.receiptCash;
        target.totalReceiptTotal += duringR;
        target.totalPaymentAdj   += d.paymentAdj;
        target.totalPaymentCash  += d.paymentCash;
        target.totalPaymentTotal += duringP;
      });

      if (others.items.length > 0) sectionData.push(others);
      return sectionData.filter(s => s.items.length > 0);
    };

    const activeSections = buildSections();

    // ── Grand totals ─────────────────────────────────────────────────────
    const grandTotalReceiptAdj   = activeSections.reduce((a, s) => a + s.totalReceiptAdj,   0);
    const grandTotalReceiptCash  = activeSections.reduce((a, s) => a + s.totalReceiptCash,  0);
    const grandTotalReceiptTotal = activeSections.reduce((a, s) => a + s.totalReceiptTotal, 0);
    const grandTotalPaymentAdj   = activeSections.reduce((a, s) => a + s.totalPaymentAdj,   0);
    const grandTotalPaymentCash  = activeSections.reduce((a, s) => a + s.totalPaymentCash,  0);
    const grandTotalPaymentTotal = activeSections.reduce((a, s) => a + s.totalPaymentTotal, 0);

    const grandUptoR   = activeSections.reduce((a, s) => a + s.totUptoR,   0);
    const grandDuringR = activeSections.reduce((a, s) => a + s.totDuringR, 0);
    const grandEomR    = activeSections.reduce((a, s) => a + s.totEomR,    0);
    const grandUptoP   = activeSections.reduce((a, s) => a + s.totUptoP,   0);
    const grandDuringP = activeSections.reduce((a, s) => a + s.totDuringP, 0);
    const grandEomP    = activeSections.reduce((a, s) => a + s.totEomP,    0);

    // ── Closing Balance = Opening + Receipts − Payments ──────────────────
    const closingBalance = openingBalance + grandTotalReceiptTotal - grandTotalPaymentTotal;

    res.json({
      success: true,
      data: {
        openingBalance,
        closingBalance,
        sections: activeSections,
        grandTotalReceiptAdj, grandTotalReceiptCash, grandTotalReceiptTotal,
        grandTotalPaymentAdj, grandTotalPaymentCash, grandTotalPaymentTotal,
        grandUptoR, grandDuringR, grandEomR,
        grandUptoP, grandDuringP, grandEomP,
        period: { startDate: startDate || null, endDate: endDate || null }
      }
    });
  } catch (error) {
    console.error('Error in Cooperative R&D report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── MIS Report ────────────────────────────────────────────────────────────────
export const getMISReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end   = endDate   ? new Date(endDate)   : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const dateFilter = { $gte: start, $lte: end };
    const base = { companyId };

    // ── 1. Milk Purchase by Member Type ────────────────────────────────────
    const collections = await MilkCollection.find({ ...base, date: dateFilter })
      .populate('farmer', 'isMembership personalDetails.gender personalDetails.caste');

    const purchase = {
      members:    { qty: 0, amount: 0, fatSum: 0, snfSum: 0, rateSum: 0, cnt: 0 },
      nonMembers: { qty: 0, amount: 0, fatSum: 0, snfSum: 0, rateSum: 0, cnt: 0 },
    };
    const activeFarmerSet = new Set();

    collections.forEach(c => {
      const isMember = c.farmer?.isMembership === true;
      const grp = isMember ? purchase.members : purchase.nonMembers;
      const qty = c.qty || 0;
      grp.qty    += qty;
      grp.amount += c.amount || 0;
      grp.fatSum += (c.fat || 0) * qty;
      grp.snfSum += (c.snf || 0) * qty;
      grp.rateSum += (c.rate || 0);
      grp.cnt    += 1;
      activeFarmerSet.add(String(c.farmer?._id || c.farmerNumber));
    });

    const mkPurchaseRow = (g) => ({
      qty:     +g.qty.toFixed(2),
      value:   +g.amount.toFixed(2),
      avgRate: g.qty > 0 ? +(g.amount / g.qty).toFixed(2) : 0,
      avgFat:  g.qty > 0 ? +(g.fatSum  / g.qty).toFixed(2) : 0,
      avgSNF:  g.qty > 0 ? +(g.snfSum  / g.qty).toFixed(2) : 0,
    });
    const totalPurch = {
      qty:     purchase.members.qty    + purchase.nonMembers.qty,
      amount:  purchase.members.amount + purchase.nonMembers.amount,
      fatSum:  purchase.members.fatSum + purchase.nonMembers.fatSum,
      snfSum:  purchase.members.snfSum + purchase.nonMembers.snfSum,
    };
    const milkPurchase = {
      members:    mkPurchaseRow(purchase.members),
      nonMembers: mkPurchaseRow(purchase.nonMembers),
      total: {
        qty:     +totalPurch.qty.toFixed(2),
        value:   +totalPurch.amount.toFixed(2),
        avgRate: totalPurch.qty > 0 ? +(totalPurch.amount / totalPurch.qty).toFixed(2) : 0,
        avgFat:  totalPurch.qty > 0 ? +(totalPurch.fatSum  / totalPurch.qty).toFixed(2) : 0,
        avgSNF:  totalPurch.qty > 0 ? +(totalPurch.snfSum  / totalPurch.qty).toFixed(2) : 0,
      }
    };

    // ── 2. Disposals / Sales ─────────────────────────────────────────────────
    const salesDocs = await MilkSales.find({ ...base, date: dateFilter });
    let localQty = 0, localAmt = 0, creditQty = 0, creditAmt = 0, sampleQty = 0, sampleAmt = 0;
    salesDocs.forEach(s => {
      const q = s.litre || 0, a = s.amount || 0;
      if (s.saleMode === 'LOCAL')  { localQty  += q; localAmt  += a; }
      if (s.saleMode === 'CREDIT') { creditQty += q; creditAmt += a; }
      if (s.saleMode === 'SAMPLE') { sampleQty += q; sampleAmt += a; }
    });
    const totalSalesLitre  = localQty + creditQty + sampleQty;
    const totalSalesAmount = localAmt + creditAmt + sampleAmt;

    // Union Sales Slips
    const unionSlips = await UnionSalesSlip.find({ ...base, date: dateFilter });
    let unionQty = 0, unionAmt = 0, unionFatSum = 0, unionSnfSum = 0, unionSpoilage = 0;
    unionSlips.forEach(u => {
      const q = u.qty || 0;
      unionQty     += q;
      unionAmt     += u.amount || 0;
      unionFatSum  += (u.fat || 0) * q;
      unionSnfSum  += (u.snf || 0) * q;
      unionSpoilage += (u.unionSpoilage || 0) + (u.transportationSpoilage || 0);
    });

    // Current stock as "Stock" row under disposals
    const allItems = await Item.find({ ...base, status: 'Active' });
    const stockQty   = allItems.reduce((s, it) => s + (it.currentBalance || 0), 0);
    const stockValue  = allItems.reduce((s, it) => s + ((it.currentBalance || 0) * (it.salesRate || it.purchasePrice || 0)), 0);
    const totalItems  = allItems.length;

    const grandSalesPct = totalSalesLitre > 0 ? 100 : 0;
    const disposals = {
      localSales:  { qty: +localQty.toFixed(2),  value: +localAmt.toFixed(2),  pct: totalSalesLitre > 0 ? +((localQty  / totalSalesLitre) * 100).toFixed(1) : 0 },
      otherSales:  { qty: +creditQty.toFixed(2), value: +creditAmt.toFixed(2), pct: totalSalesLitre > 0 ? +((creditQty / totalSalesLitre) * 100).toFixed(1) : 0 },
      products:    { qty: +sampleQty.toFixed(2), value: +sampleAmt.toFixed(2), pct: totalSalesLitre > 0 ? +((sampleQty / totalSalesLitre) * 100).toFixed(1) : 0 },
      byProduct:   { qty: 0, value: 0, pct: 0 },
      stock:       { qty: +stockQty.toFixed(2),  value: +stockValue.toFixed(2), pct: 0 },
      total:       { qty: +totalSalesLitre.toFixed(2), value: +totalSalesAmount.toFixed(2), pct: 100 },
      unionDetails: {
        receivedQty: +unionQty.toFixed(2),
        amount:      +unionAmt.toFixed(2),
        avgRate:     unionQty > 0 ? +(unionAmt / unionQty).toFixed(2) : 0,
        avgFat:      unionQty > 0 ? +(unionFatSum / unionQty).toFixed(2) : 0,
        avgSNF:      unionQty > 0 ? +(unionSnfSum / unionQty).toFixed(2) : 0,
        spoilage:    +unionSpoilage.toFixed(2),
      }
    };

    // ── 3 & 4. Milk Pouring Members — count & qty by category ───────────────
    const casteMap = (caste) => {
      if (!caste) return 'General';
      const c = caste.toLowerCase();
      if (c.includes('obc') || c.includes('bc')) return 'OBC';
      if (c.includes('sc') || c.includes('st') || c.includes('scheduled')) return 'SC/ST';
      return 'General';
    };

    // Collect distinct farmers who poured in this period
    const memberFarmerMap    = {}; // farmerId -> { gender, casteCategory }
    const nonMemberFarmerMap = {};
    const memberQtyMap    = {}; // farmerId -> { qty, gender, casteCategory }
    const nonMemberQtyMap = {};

    collections.forEach(c => {
      const fId = String(c.farmer?._id || c.farmerNumber);
      const isMember = c.farmer?.isMembership === true;
      const gender   = c.farmer?.personalDetails?.gender || 'Male';
      const category = casteMap(c.farmer?.personalDetails?.caste);
      const qty      = c.qty || 0;

      if (isMember) {
        memberFarmerMap[fId] = { gender, category };
        memberQtyMap[fId]    = { gender, category, qty: (memberQtyMap[fId]?.qty || 0) + qty };
      } else {
        nonMemberFarmerMap[fId] = { gender, category };
        nonMemberQtyMap[fId]    = { gender, category, qty: (nonMemberQtyMap[fId]?.qty || 0) + qty };
      }
    });

    const buildCountTable = (map) => {
      const t = { OBC: { Male: 0, Female: 0 }, General: { Male: 0, Female: 0 }, 'SC/ST': { Male: 0, Female: 0 } };
      Object.values(map).forEach(({ gender, category }) => {
        const g = gender === 'Female' ? 'Female' : 'Male';
        if (t[category]) t[category][g]++;
      });
      return {
        OBC:     { male: t.OBC.Male,     female: t.OBC.Female,     total: t.OBC.Male     + t.OBC.Female },
        General: { male: t.General.Male, female: t.General.Female, total: t.General.Male + t.General.Female },
        'SC/ST': { male: t['SC/ST'].Male, female: t['SC/ST'].Female, total: t['SC/ST'].Male + t['SC/ST'].Female },
        total:   {
          male:   t.OBC.Male   + t.General.Male   + t['SC/ST'].Male,
          female: t.OBC.Female + t.General.Female + t['SC/ST'].Female,
          total:  Object.values(t).reduce((s, v) => s + v.Male + v.Female, 0)
        }
      };
    };

    const buildQtyTable = (map) => {
      const t = { OBC: { Male: 0, Female: 0 }, General: { Male: 0, Female: 0 }, 'SC/ST': { Male: 0, Female: 0 } };
      Object.values(map).forEach(({ gender, category, qty }) => {
        const g = gender === 'Female' ? 'Female' : 'Male';
        if (t[category]) t[category][g] += qty;
      });
      return {
        OBC:     { male: +t.OBC.Male.toFixed(2),     female: +t.OBC.Female.toFixed(2),     total: +(t.OBC.Male     + t.OBC.Female).toFixed(2) },
        General: { male: +t.General.Male.toFixed(2), female: +t.General.Female.toFixed(2), total: +(t.General.Male + t.General.Female).toFixed(2) },
        'SC/ST': { male: +t['SC/ST'].Male.toFixed(2), female: +t['SC/ST'].Female.toFixed(2), total: +(t['SC/ST'].Male + t['SC/ST'].Female).toFixed(2) },
        total: {
          male:   +(Object.values(t).reduce((s, v) => s + v.Male,   0)).toFixed(2),
          female: +(Object.values(t).reduce((s, v) => s + v.Female, 0)).toFixed(2),
          total:  +(Object.values(t).reduce((s, v) => s + v.Male + v.Female, 0)).toFixed(2),
        }
      };
    };

    const milkPouringCount = {
      members:    buildCountTable(memberFarmerMap),
      nonMembers: buildCountTable(nonMemberFarmerMap),
    };
    const milkPouringQty = {
      members:    buildQtyTable(memberQtyMap),
      nonMembers: buildQtyTable(nonMemberQtyMap),
    };

    // ── 5. Welfare Fund Contribution ────────────────────────────────────────
    const WF_RATE_LOCAL  = 0.10;
    const WF_RATE_UNION  = 0.05;
    const WF_RATE_MEMBER = 2.00;
    const activeMembers  = Object.keys(memberFarmerMap).length;
    const welfareLocalAmt  = +(localAmt  * WF_RATE_LOCAL).toFixed(2);
    const welfareUnionAmt  = +(unionAmt  * WF_RATE_UNION).toFixed(2);
    const welfareMemberAmt = +(activeMembers * WF_RATE_MEMBER).toFixed(2);
    const welfareFund = {
      localSales:     { value: +localAmt.toFixed(2),    wfRate: WF_RATE_LOCAL,  amount: welfareLocalAmt },
      unionSales:     { value: +unionAmt.toFixed(2),    wfRate: WF_RATE_UNION,  amount: welfareUnionAmt },
      memberCount:    { value: activeMembers,            wfRate: WF_RATE_MEMBER, amount: welfareMemberAmt },
      total:          { amount: +(welfareLocalAmt + welfareUnionAmt + welfareMemberAmt).toFixed(2) }
    };

    // ── 6. Cattle / Feed Stock ──────────────────────────────────────────────
    const cattleItems = await Item.find({ ...base });
    const purchaseTxns = await StockTransaction.find({ ...base, date: dateFilter, transactionType: 'Stock In',  referenceType: 'Purchase' }).populate('itemId', 'itemName');
    const salesTxns    = await StockTransaction.find({ ...base, date: dateFilter, transactionType: 'Stock Out', referenceType: 'Sale' }).populate('itemId', 'itemName');

    let openingStockQty = 0, openingStockValue = 0;
    let purchaseQty = 0, purchaseAmount = 0;
    let salesQty    = 0, salesAmount    = 0;

    cattleItems.forEach(it => {
      const purchQty = purchaseTxns.filter(t => String(t.itemId?._id) === String(it._id)).reduce((s, t) => s + (t.quantity || 0), 0);
      const saleQty  = salesTxns.filter(t => String(t.itemId?._id) === String(it._id)).reduce((s, t) => s + (t.quantity || 0), 0);
      const closeQty = it.currentBalance || 0;
      const openQty  = closeQty + saleQty - purchQty;
      const cp       = it.costPrice || it.purchasePrice || 0;
      openingStockQty   += Math.max(openQty, 0);
      openingStockValue += Math.max(openQty, 0) * cp;
    });

    purchaseTxns.forEach(t => { purchaseQty += t.quantity || 0; purchaseAmount += (t.quantity || 0) * (t.rate || 0); });
    salesTxns.forEach(t    => { salesQty    += t.quantity || 0; salesAmount    += (t.quantity || 0) * (t.rate || 0); });

    const cattleFeedStock = {
      openingQty:    +openingStockQty.toFixed(2),
      openingValue:  +openingStockValue.toFixed(2),
      purchaseQty:   +purchaseQty.toFixed(2),
      purchaseAmount:+purchaseAmount.toFixed(2),
      salesQty:      +salesQty.toFixed(2),
      salesAmount:   +salesAmount.toFixed(2),
      closingQty:    +(allItems.reduce((s, it) => s + (it.currentBalance || 0), 0)).toFixed(2),
      closingValue:  +stockValue.toFixed(2),
    };

    // ── 7. Financial Details (Trading A/C) ──────────────────────────────────
    const tradingAc = {
      debit: {
        openingStock: +openingStockValue.toFixed(2),
        purchases:    +totalPurch.amount.toFixed(2),
        grossProfit:  0,
      },
      credit: {
        closingStock: +stockValue.toFixed(2),
        totalSales:   +totalSalesAmount.toFixed(2),
        totalIncome:  0,
        grossLoss:    0,
      }
    };
    const debitTotal  = tradingAc.debit.openingStock + tradingAc.debit.purchases;
    const creditTotal = tradingAc.credit.closingStock + tradingAc.credit.totalSales;
    if (creditTotal >= debitTotal) tradingAc.debit.grossProfit  = +(creditTotal - debitTotal).toFixed(2);
    else                           tradingAc.credit.grossLoss   = +(debitTotal  - creditTotal).toFixed(2);
    tradingAc.credit.totalIncome = +(tradingAc.credit.totalSales + tradingAc.credit.closingStock).toFixed(2);

    // ── 8. Profit & Loss A/C ────────────────────────────────────────────────
    const vouchers = await Voucher.find({ ...base, voucherDate: dateFilter })
      .populate('entries.ledgerId', 'ledgerName ledgerGroup ledgerType');

    let totalReceipts = 0, totalPayments = 0, contingencies = 0, miscIncome = 0;
    vouchers.forEach(v => {
      (v.entries || []).forEach(e => {
        const ltype = e.ledgerId?.ledgerType || '';
        const lgrp  = e.ledgerId?.ledgerGroup || '';
        if (e.ledgerId && (ltype === 'Cash' || ltype === 'Bank') && e.debitAmount  > 0) totalReceipts  += e.debitAmount;
        if (e.ledgerId && (ltype === 'Cash' || ltype === 'Bank') && e.creditAmount > 0) totalPayments  += e.creditAmount;
        if (e.ledgerId && lgrp === 'Indirect Expenses' && e.debitAmount > 0) contingencies += e.debitAmount;
        if (e.ledgerId && lgrp === 'Indirect Income'   && e.creditAmount > 0) miscIncome    += e.creditAmount;
      });
    });

    const grossProfit = tradingAc.debit.grossProfit;
    const netProfit   = +(grossProfit + miscIncome - contingencies).toFixed(2);

    const profitLoss = {
      contingencies: +contingencies.toFixed(2),
      grossProfit:   +grossProfit.toFixed(2),
      miscIncome:    +miscIncome.toFixed(2),
      netProfit,
      totalReceipts: +totalReceipts.toFixed(2),
      totalPayments: +totalPayments.toFixed(2),
    };

    // Farmer totals for summary
    const totalFarmers = await Farmer.countDocuments({ ...base });
    const activeFarmers = activeFarmerSet.size;

    // Payment summary
    const paymentDocs = await FarmerPayment.find({ ...base, paymentDate: dateFilter, status: { $ne: 'Cancelled' } });
    let totalGross = 0, totalDeductions = 0, totalNetPayable = 0, totalPaid = 0;
    const paidFarmerSet = new Set();
    paymentDocs.forEach(p => {
      totalGross      += p.grossAmount    || 0;
      totalDeductions += p.totalDeduction || 0;
      totalNetPayable += p.netPayable     || 0;
      totalPaid       += p.paidAmount     || 0;
      if ((p.paidAmount || 0) > 0) paidFarmerSet.add(String(p.farmerId));
    });

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        milkPurchase,
        disposals,
        milkPouringCount,
        milkPouringQty,
        welfareFund,
        cattleFeedStock,
        tradingAc,
        profitLoss,
        // legacy keys kept for backward compat
        milkProcurement: {
          totalQty:   milkPurchase.total.qty,
          morningQty: 0,
          eveningQty: 0,
          avgFat:     milkPurchase.total.avgFat,
          avgSNF:     milkPurchase.total.avgSNF,
          avgRate:    milkPurchase.total.avgRate,
          totalAmount:milkPurchase.total.value,
          activeFarmers,
        },
        milkSales: {
          totalLitre:  disposals.total.qty,
          totalAmount: disposals.total.value,
          bySaleMode: {
            LOCAL:  { litre: disposals.localSales.qty,  amount: disposals.localSales.value },
            CREDIT: { litre: disposals.otherSales.qty,  amount: disposals.otherSales.value },
            SAMPLE: { litre: disposals.products.qty,    amount: disposals.products.value },
          }
        },
        farmerSummary:   { totalRegistered: totalFarmers, activeSuppliers: activeFarmers, farmersPaid: paidFarmerSet.size },
        paymentSummary:  { grossAmount: +totalGross.toFixed(2), totalDeductions: +totalDeductions.toFixed(2), netPayable: +totalNetPayable.toFixed(2), paidAmount: +totalPaid.toFixed(2), pendingAmount: +(totalNetPayable - totalPaid).toFixed(2) },
        financialSummary:{ totalReceipts: +totalReceipts.toFixed(2), totalPayments: +totalPayments.toFixed(2), netCash: +(totalReceipts - totalPayments).toFixed(2) },
        stockSummary:    { totalItems, totalStockValue: +stockValue.toFixed(2) },
        ratios:          { netRevenue: +(totalSalesAmount - totalPurch.amount).toFixed(2), procurementPct: totalSalesAmount > 0 ? +((totalPurch.amount / totalSalesAmount) * 100).toFixed(2) : 0, paymentPct: totalPurch.amount > 0 ? +((totalNetPayable / totalPurch.amount) * 100).toFixed(2) : 0 }
      }
    });
  } catch (err) {
    console.error('MIS Report error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to generate MIS report' });
  }
};

export default {
  getReceiptsDisbursementReport,
  getTradingAccount,
  getProfitLoss,
  getBalanceSheet,
  getSalesReport,
  getStockReport,
  getSubsidyReport,
  getStockRegister,
  getInventoryPurchaseRegister,
  getSalesRegister,
  getMilkBillAbstractReport,
  getDairyAbstractReport,
  getDairyRegisterReport,
  getCooperativeRDReport,
  getMISReport
};

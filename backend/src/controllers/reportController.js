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
    const { startDate, endDate, filterType, customStart, customEnd } = req.query;

    // Get date range (default to financial year)
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      dateFilter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
    } else {
      // Default to current financial year
      dateFilter = getDateRange('financialYear');
    }

    const financialYear = getFinancialYear(dateFilter.startDate);

    // Calculate Opening Stock
    const items = await Item.find({ status: 'Active', companyId: req.companyId });
    const openingStockTotal = items.reduce((sum, item) => {
      return sum + (item.openingBalance || 0) * (item.salesRate || 0);
    }, 0);

    // Calculate Closing Stock (grouped by category)
    const closingStockGrouped = {};
    let closingStockTotal = 0;

    items.forEach(item => {
      const value = (item.currentBalance || 0) * (item.salesRate || 0);
      const category = item.category || 'Others';

      if (!closingStockGrouped[category]) {
        closingStockGrouped[category] = 0;
      }
      closingStockGrouped[category] += value;
      closingStockTotal += value;
    });

    const closingStockItems = Object.entries(closingStockGrouped).map(([category, amount]) => ({
      category,
      amount
    }));

    // Get Purchases (all ledgers with type "Purchases A/c")
    const purchaseLedgers = await Ledger.find({
      ledgerType: 'Purchases A/c',
      status: 'Active',
      companyId: req.companyId
    });

    const purchaseLedgerIds = purchaseLedgers.map(l => l._id);
    const purchaseVouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: purchaseLedgerIds }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const purchaseGrouped = {};
    purchaseVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const ledgerIdStr = entry.ledgerId?._id?.toString();
        if (purchaseLedgerIds.some(id => id.toString() === ledgerIdStr) && entry.creditAmount > 0) {
          const ledgerName = entry.ledgerId.ledgerName;
          if (!purchaseGrouped[ledgerName]) {
            purchaseGrouped[ledgerName] = 0;
          }
          purchaseGrouped[ledgerName] += entry.creditAmount;
        }
      });
    });

    const purchaseItems = Object.entries(purchaseGrouped).map(([ledgerName, amount]) => ({
      ledgerName,
      amount
    }));
    const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.amount, 0);

    // Get Trade Expenses (all ledgers with type "Trade Expenses")
    const expenseLedgers = await Ledger.find({
      ledgerType: 'Trade Expenses',
      status: 'Active',
      companyId: req.companyId
    });

    const expenseLedgerIds = expenseLedgers.map(l => l._id);
    const expenseVouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: expenseLedgerIds }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const expenseGrouped = {};
    expenseVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const ledgerIdStr = entry.ledgerId?._id?.toString();
        if (expenseLedgerIds.some(id => id.toString() === ledgerIdStr) && entry.debitAmount > 0) {
          const ledgerName = entry.ledgerId.ledgerName;
          if (!expenseGrouped[ledgerName]) {
            expenseGrouped[ledgerName] = 0;
          }
          expenseGrouped[ledgerName] += entry.debitAmount;
        }
      });
    });

    const expenseItems = Object.entries(expenseGrouped).map(([ledgerName, amount]) => ({
      ledgerName,
      amount
    }));
    const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);

    // Get Sales (all ledgers with type "Sales A/c")
    const salesLedgers = await Ledger.find({
      ledgerType: 'Sales A/c',
      status: 'Active',
      companyId: req.companyId
    });

    const salesLedgerIds = salesLedgers.map(l => l._id);
    const salesVouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: salesLedgerIds }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const salesGrouped = {};
    salesVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const ledgerIdStr = entry.ledgerId?._id?.toString();
        if (salesLedgerIds.some(id => id.toString() === ledgerIdStr) && entry.creditAmount > 0) {
          const ledgerName = entry.ledgerId.ledgerName;
          if (!salesGrouped[ledgerName]) {
            salesGrouped[ledgerName] = 0;
          }
          salesGrouped[ledgerName] += entry.creditAmount;
        }
      });
    });

    const salesItems = Object.entries(salesGrouped).map(([ledgerName, amount]) => ({
      ledgerName,
      amount
    }));
    const salesTotal = salesItems.reduce((sum, item) => sum + item.amount, 0);

    // Get Trade Income (all ledgers with type "Trade Income")
    const incomeLedgers = await Ledger.find({
      ledgerType: 'Trade Income',
      status: 'Active',
      companyId: req.companyId
    });

    const incomeLedgerIds = incomeLedgers.map(l => l._id);
    const incomeVouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: incomeLedgerIds }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    const incomeGrouped = {};
    incomeVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const ledgerIdStr = entry.ledgerId?._id?.toString();
        if (incomeLedgerIds.some(id => id.toString() === ledgerIdStr) && entry.creditAmount > 0) {
          const ledgerName = entry.ledgerId.ledgerName;
          if (!incomeGrouped[ledgerName]) {
            incomeGrouped[ledgerName] = 0;
          }
          incomeGrouped[ledgerName] += entry.creditAmount;
        }
      });
    });

    const incomeItems = Object.entries(incomeGrouped).map(([ledgerName, amount]) => ({
      ledgerName,
      amount
    }));
    const incomeTotal = incomeItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate totals
    const debitTotal = openingStockTotal + purchaseTotal + expenseTotal;
    const creditTotal = salesTotal + incomeTotal + closingStockTotal;

    // Calculate Gross Profit or Loss
    let grossProfit = 0;
    let grossLoss = 0;

    if (creditTotal > debitTotal) {
      grossProfit = creditTotal - debitTotal;
    } else if (debitTotal > creditTotal) {
      grossLoss = debitTotal - creditTotal;
    }

    // Prepare response
    res.status(200).json({
      success: true,
      data: {
        period: {
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          financialYear
        },
        debitSide: {
          openingStock: {
            total: openingStockTotal
          },
          purchases: {
            items: purchaseItems,
            total: purchaseTotal
          },
          tradeExpenses: {
            items: expenseItems,
            total: expenseTotal
          },
          grossProfit
        },
        creditSide: {
          sales: {
            items: salesItems,
            total: salesTotal
          },
          tradeIncome: {
            items: incomeItems,
            total: incomeTotal
          },
          closingStock: {
            items: closingStockItems,
            total: closingStockTotal
          },
          grossLoss
        },
        totals: {
          debitTotal: debitTotal + grossProfit,
          creditTotal: creditTotal + grossLoss
        }
      }
    });
  } catch (error) {
    console.error('Error generating trading account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating trading account'
    });
  }
};

// Profit & Loss Statement
export const getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get income ledgers
    const incomeLedgers = await Ledger.find({ ledgerType: 'Income', companyId: req.companyId });
    const incomeIds = incomeLedgers.map(l => l._id);

    // Get expense ledgers
    const expenseLedgers = await Ledger.find({ ledgerType: 'Expense', companyId: req.companyId });
    const expenseIds = expenseLedgers.map(l => l._id);

    // Calculate total income
    const totalIncome = incomeLedgers.reduce((sum, l) => sum + l.currentBalance, 0);

    // Calculate total expenses
    const totalExpense = expenseLedgers.reduce((sum, l) => sum + l.currentBalance, 0);

    const netProfit = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      data: {
        income: incomeLedgers.map(l => ({ name: l.ledgerName, amount: l.currentBalance })),
        totalIncome,
        expenses: expenseLedgers.map(l => ({ name: l.ledgerName, amount: l.currentBalance })),
        totalExpense,
        netProfit
      }
    });
  } catch (error) {
    console.error('Error generating P&L:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Balance Sheet
export const getBalanceSheet = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Default: financial year start → today
    const now = new Date();
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

    const start = fromDate ? new Date(fromDate) : fyStart;
    const end   = toDate   ? new Date(toDate)   : now;
    end.setHours(23, 59, 59, 999);

    // Assets, Liabilities, Capital — snapshot from running ledger balance
    const [assets, liabilities, capital, incomeLedgers, expenseLedgers] = await Promise.all([
      Ledger.find({ ledgerType: 'Asset',     status: 'Active', companyId: req.companyId }),
      Ledger.find({ ledgerType: 'Liability', status: 'Active', companyId: req.companyId }),
      Ledger.find({ ledgerType: 'Capital',   status: 'Active', companyId: req.companyId }),
      Ledger.find({ ledgerType: 'Income',    status: 'Active', companyId: req.companyId }),
      Ledger.find({ ledgerType: 'Expense',   status: 'Active', companyId: req.companyId }),
    ]);

    const totalAssets      = assets.reduce((s, l)      => s + Math.abs(l.currentBalance), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + Math.abs(l.currentBalance), 0);
    const totalCapital     = capital.reduce((s, l)     => s + Math.abs(l.currentBalance), 0);

    // Net Profit — from voucher entries within the selected date range
    const incomeLedgerIds  = incomeLedgers.map(l => l._id);
    const expenseLedgerIds = expenseLedgers.map(l => l._id);

    const plVouchers = await Voucher.find({
      companyId:   req.companyId,
      voucherDate: { $gte: start, $lte: end },
      'entries.ledgerId': { $in: [...incomeLedgerIds, ...expenseLedgerIds] }
    });

    let totalIncome = 0, totalExpense = 0;
    plVouchers.forEach(v => {
      v.entries.forEach(e => {
        const lid = e.ledgerId?.toString();
        if (incomeLedgerIds.some(id => id.toString() === lid))  totalIncome  += e.creditAmount || 0;
        if (expenseLedgerIds.some(id => id.toString() === lid)) totalExpense += e.debitAmount  || 0;
      });
    });

    const netProfit = totalIncome - totalExpense;
    const totalLiabilitiesAndCapital = totalLiabilities + totalCapital + netProfit;
    const difference = totalAssets - totalLiabilitiesAndCapital;

    res.status(200).json({
      success: true,
      data: {
        fromDate: start,
        toDate:   end,
        assets:      assets.map(l =>      ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
        totalAssets,
        liabilities: liabilities.map(l => ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
        totalLiabilities,
        capital:     capital.map(l =>     ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
        totalCapital,
        netProfit,
        totalLiabilitiesAndCapital,
        difference,
        isTallied: Math.abs(difference) < 0.01
      }
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
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

// Subsidy Report
export const getSubsidyReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { companyId: req.companyId };
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    const payments = await FarmerPayment.find(query)
      .populate('farmerId', 'farmerId farmerNumber personalDetails identityDetails')
      .sort({ paymentDate: -1 });

    const subsidies = payments.map(p => ({
      farmerNumber: p.farmerId?.farmerNumber || '-',
      farmerName: p.farmerId?.personalDetails?.name || '-',
      aadhaar: p.farmerId?.identityDetails?.aadhaar || '-',
      ksheerasreeId: p.farmerId?.identityDetails?.ksheerasreeId || '-',
      paymentDate: p.paymentDate,
      milkAmount: p.milkAmount || 0,
      subsidyAmount: p.subsidyAmount || 0,
      netPayable: p.netPayable || 0
    }));

    const summary = {
      totalFarmers: subsidies.length,
      totalMilkAmount: subsidies.reduce((s, r) => s + r.milkAmount, 0),
      totalSubsidy: subsidies.reduce((s, r) => s + r.subsidyAmount, 0),
      totalNetPayable: subsidies.reduce((s, r) => s + r.netPayable, 0)
    };

    res.status(200).json({
      success: true,
      data: { subsidies, summary }
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
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await StockTransaction.find({
      companyId: req.companyId,
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: start, $lte: end }
    })
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
    const companyFilter = req.userCompany ? { companyId: req.userCompany } : {};

    const SCHOOL_CATS = new Set(['School', 'Anganwadi']);

    // ── 1. MilkCollection with farmer membership lookup
    const collectionAgg = await MilkCollection.aggregate([
      { $match: { ...companyFilter, date: { $gte: start, $lte: end } } },
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
      { $match: { ...companyFilter, date: { $gte: start, $lte: end } } },
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
      { $match: { ...companyFilter, date: { $gte: start, $lte: end } } },
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
      } else if (SCHOOL_CATS.has(s._id.category)) {
        slot.schoolQty += s.qty;
        slot.schoolAmt += s.amount;
      } else if (s._id.category === 'Sample') {
        slot.sampleQty += s.qty;
        slot.sampleAmt += s.amount;
      } else {
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
      const procQty      = raw.memberQty + raw.nonMemberQty;
      const purchaseAmt  = raw.memberAmt + raw.nonMemberAmt;
      const totalNos     = raw.memberNos + raw.nonMemberNos;

      const unionReceived = Math.max(0, raw.unionSendQty - raw.unionSpoilage);
      const unionExcess   = unionReceived > raw.unionSendQty ? unionReceived - raw.unionSendQty : 0;
      const unionShortage = raw.unionSendQty > unionReceived ? raw.unionSendQty - unionReceived : 0;
      const unionTotalQty = unionReceived;

      const milmaTotalQty = raw.localQty + raw.creditQty + raw.schoolQty + raw.sampleQty + unionTotalQty;
      const milmaTotalAmt = raw.localAmt + raw.creditAmt + raw.schoolAmt + raw.sampleAmt + raw.unionAmt;

      const handQty   = milmaTotalQty;
      const shortage  = procQty > handQty ? procQty - handQty : 0;
      const excess    = handQty > procQty ? handQty - procQty : 0;
      const profit    = milmaTotalAmt - purchaseAmt;

      return {
        memberNos:      raw.memberNos,
        memberQty:      raw.memberQty,
        memberAmt:      raw.memberAmt,
        nonMemberNos:   raw.nonMemberNos,
        nonMemberQty:   raw.nonMemberQty,
        nonMemberAmt:   raw.nonMemberAmt,
        totalNos,
        procQty,
        handQty,
        purchaseAmt,
        shortage,
        excess,
        localQty:      raw.localQty,
        localAmt:      raw.localAmt,
        creditQty:     raw.creditQty,
        creditAmt:     raw.creditAmt,
        schoolQty:     raw.schoolQty,
        schoolAmt:     raw.schoolAmt,
        sampleQty:     raw.sampleQty,
        sampleAmt:     raw.sampleAmt,
        unionSendQty:  raw.unionSendQty,
        unionAmt:      raw.unionAmt,
        unionSpoilage: raw.unionSpoilage,
        unionExcess,
        unionShortage,
        unionTotalQty,
        milmaTotalQty,
        milmaTotalAmt,
        profit
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

// ── Private Firm Receipt & Disbursement Report ────────────────────────────
export const getCooperativeRDReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

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

    // Helper: accumulate vouchers into a ledger map
    const accumulate = (vouchers, target) => {
      vouchers.forEach(voucher => {
        const isCash = voucher.paymentMode === 'Cash';
        voucher.entries.forEach(entry => {
          if (!entry.ledgerId) return;
          const id = entry.ledgerId._id.toString();
          if (!target[id]) {
            target[id] = {
              ledgerName: entry.ledgerId.name || entry.ledgerName,
              group:      entry.ledgerId.group || 'Other',
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

    // ── Query 1: Upto Month (all before startDate) ──────────────────────
    const uptoMap = {};
    if (startDate) {
      const uptoVouchers = await BusinessVoucher.find({
        companyId: req.companyId,
        status: { $ne: 'Cancelled' },
        date:   { $lt: new Date(startDate) }
      }).populate('entries.ledgerId', 'name group type');
      accumulate(uptoVouchers, uptoMap);
    }

    // ── Query 2: During the Month (startDate to endDate) ────────────────
    const duringMap = {};
    const duringQuery = { companyId: req.companyId, status: { $ne: 'Cancelled' } };
    if (startDate || endDate) {
      duringQuery.date = {};
      if (startDate) duringQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        duringQuery.date.$lte = end;
      }
    }
    const duringVouchers = await BusinessVoucher.find(duringQuery)
      .populate('entries.ledgerId', 'name group type');
    accumulate(duringVouchers, duringMap);

    // ── Merge all known ledger IDs ──────────────────────────────────────
    const allIds = new Set([...Object.keys(uptoMap), ...Object.keys(duringMap)]);

    const buildSections = () => {
      const sectionData = SECTION_MAP.map(sec => ({
        name: sec.name, subtitle: sec.subtitle, items: [],
        totUptoR: 0, totDuringR: 0, totEomR: 0,
        totUptoP: 0, totDuringP: 0, totEomP: 0,
        totUptoReceiptAdj: 0, totUptoReceiptCash: 0,
        totDuringReceiptAdj: 0, totDuringReceiptCash: 0,
        totUptoPayAdj: 0, totUptoPayCash: 0,
        totDuringPayAdj: 0, totDuringPayCash: 0
      }));
      const others = {
        name: 'Other Accounts', subtitle: '', items: [],
        totUptoR: 0, totDuringR: 0, totEomR: 0,
        totUptoP: 0, totDuringP: 0, totEomP: 0,
        totUptoReceiptAdj: 0, totUptoReceiptCash: 0,
        totDuringReceiptAdj: 0, totDuringReceiptCash: 0,
        totUptoPayAdj: 0, totUptoPayCash: 0,
        totDuringPayAdj: 0, totDuringPayCash: 0
      };

      allIds.forEach(id => {
        const u = uptoMap[id]   || { ledgerName: duringMap[id]?.ledgerName || '', group: duringMap[id]?.group || 'Other', receiptCash: 0, receiptAdj: 0, paymentCash: 0, paymentAdj: 0 };
        const d = duringMap[id] || { ledgerName: uptoMap[id]?.ledgerName   || '', group: uptoMap[id]?.group   || 'Other', receiptCash: 0, receiptAdj: 0, paymentCash: 0, paymentAdj: 0 };

        const ledgerName = u.ledgerName || d.ledgerName;
        const group      = u.group || d.group;

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
          // 2-col (adj/cash split) — during period only
          receiptAdj:  d.receiptAdj,  receiptCash: d.receiptCash,
          receiptTotal: duringR,
          paymentAdj:  d.paymentAdj,  paymentCash: d.paymentCash,
          paymentTotal: duringP,
          // 3-col (upto/during/eom)
          uptoR, duringR, eomR,
          uptoP, duringP, eomP
        });

        target.totUptoR   += uptoR;   target.totDuringR += duringR; target.totEomR += eomR;
        target.totUptoP   += uptoP;   target.totDuringP += duringP; target.totEomP += eomP;
        target.totUptoReceiptAdj    += u.receiptAdj;
        target.totUptoReceiptCash   += u.receiptCash;
        target.totDuringReceiptAdj  += d.receiptAdj;
        target.totDuringReceiptCash += d.receiptCash;
        target.totUptoPayAdj    += u.paymentAdj;
        target.totUptoPayCash   += u.paymentCash;
        target.totDuringPayAdj  += d.paymentAdj;
        target.totDuringPayCash += d.paymentCash;

        // compute totals for 2-col view
        target.totalReceiptAdj  = (target.totalReceiptAdj  || 0) + d.receiptAdj;
        target.totalReceiptCash = (target.totalReceiptCash || 0) + d.receiptCash;
        target.totalReceiptTotal= (target.totalReceiptTotal|| 0) + duringR;
        target.totalPaymentAdj  = (target.totalPaymentAdj  || 0) + d.paymentAdj;
        target.totalPaymentCash = (target.totalPaymentCash || 0) + d.paymentCash;
        target.totalPaymentTotal= (target.totalPaymentTotal|| 0) + duringP;
      });

      if (others.items.length > 0) sectionData.push(others);
      return sectionData.filter(s => s.items.length > 0);
    };

    const activeSections = buildSections();

    // Grand totals — 2-col view (during period)
    const grandTotalReceiptAdj   = activeSections.reduce((a, s) => a + (s.totalReceiptAdj  || 0), 0);
    const grandTotalReceiptCash  = activeSections.reduce((a, s) => a + (s.totalReceiptCash || 0), 0);
    const grandTotalReceiptTotal = activeSections.reduce((a, s) => a + (s.totalReceiptTotal|| 0), 0);
    const grandTotalPaymentAdj   = activeSections.reduce((a, s) => a + (s.totalPaymentAdj  || 0), 0);
    const grandTotalPaymentCash  = activeSections.reduce((a, s) => a + (s.totalPaymentCash || 0), 0);
    const grandTotalPaymentTotal = activeSections.reduce((a, s) => a + (s.totalPaymentTotal|| 0), 0);

    // Grand totals — 3-col view
    const grandUptoR   = activeSections.reduce((a, s) => a + s.totUptoR,   0);
    const grandDuringR = activeSections.reduce((a, s) => a + s.totDuringR, 0);
    const grandEomR    = activeSections.reduce((a, s) => a + s.totEomR,    0);
    const grandUptoP   = activeSections.reduce((a, s) => a + s.totUptoP,   0);
    const grandDuringP = activeSections.reduce((a, s) => a + s.totDuringP, 0);
    const grandEomP    = activeSections.reduce((a, s) => a + s.totEomP,    0);

    res.json({
      success: true,
      data: {
        sections: activeSections,
        // 2-col totals
        grandTotalReceiptAdj, grandTotalReceiptCash, grandTotalReceiptTotal,
        grandTotalPaymentAdj, grandTotalPaymentCash, grandTotalPaymentTotal,
        // 3-col totals
        grandUptoR, grandDuringR, grandEomR,
        grandUptoP, grandDuringP, grandEomP,
        period: { startDate: startDate || null, endDate: endDate || null }
      }
    });
  } catch (error) {
    console.error('Error in R&D report:', error);
    res.status(500).json({ success: false, message: error.message });
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
  getCooperativeRDReport
};

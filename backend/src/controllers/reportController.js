import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Sales from '../models/Sales.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import FarmerPayment from '../models/FarmerPayment.js';
import MilkCollection from '../models/MilkCollection.js';
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

    const query = {};
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
    const items = await Item.find({ status: 'Active' });
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
      status: 'Active'
    });

    const purchaseLedgerIds = purchaseLedgers.map(l => l._id);
    const purchaseVouchers = await Voucher.find({
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
      status: 'Active'
    });

    const expenseLedgerIds = expenseLedgers.map(l => l._id);
    const expenseVouchers = await Voucher.find({
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
      status: 'Active'
    });

    const salesLedgerIds = salesLedgers.map(l => l._id);
    const salesVouchers = await Voucher.find({
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
      status: 'Active'
    });

    const incomeLedgerIds = incomeLedgers.map(l => l._id);
    const incomeVouchers = await Voucher.find({
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
    const incomeLedgers = await Ledger.find({ ledgerType: 'Income' });
    const incomeIds = incomeLedgers.map(l => l._id);

    // Get expense ledgers
    const expenseLedgers = await Ledger.find({ ledgerType: 'Expense' });
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
    // Get asset ledgers
    const assets = await Ledger.find({ ledgerType: 'Asset', status: 'Active' });
    const totalAssets = assets.reduce((sum, l) => sum + Math.abs(l.currentBalance), 0);

    // Get liability ledgers
    const liabilities = await Ledger.find({ ledgerType: 'Liability', status: 'Active' });
    const totalLiabilities = liabilities.reduce((sum, l) => sum + Math.abs(l.currentBalance), 0);

    // Get capital ledgers
    const capital = await Ledger.find({ ledgerType: 'Capital', status: 'Active' });
    const totalCapital = capital.reduce((sum, l) => sum + Math.abs(l.currentBalance), 0);

    // Calculate net profit from P&L
    const incomeLedgers = await Ledger.find({ ledgerType: 'Income' });
    const expenseLedgers = await Ledger.find({ ledgerType: 'Expense' });
    const netProfit = incomeLedgers.reduce((sum, l) => sum + l.currentBalance, 0) -
                      expenseLedgers.reduce((sum, l) => sum + l.currentBalance, 0);

    const totalLiabilitiesAndCapital = totalLiabilities + totalCapital + netProfit;
    const difference = totalAssets - totalLiabilitiesAndCapital;

    res.status(200).json({
      success: true,
      data: {
        assets: assets.map(l => ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
        totalAssets,
        liabilities: liabilities.map(l => ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
        totalLiabilities,
        capital: capital.map(l => ({ name: l.ledgerName, amount: Math.abs(l.currentBalance) })),
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

    const query = {};
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
    const items = await Item.find({ status: 'Active' }).sort({ itemName: 1 });

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

    const query = {};
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
    const items = await Item.find({ status: 'Active' })
      .select('itemCode itemName category measurement unit salesRate openingBalance currentBalance')
      .sort({ itemName: 1 });

    // Build a map of initial opening balances
    const initialOB = {};
    items.forEach(item => { initialOB[item._id.toString()] = item.openingBalance || 0; });

    // Calculate OB at start of the period from pre-period transactions
    const preTxns = await StockTransaction.find({ date: { $lt: start } })
      .select('itemId transactionType quantity');
    const obMap = { ...initialOB };
    preTxns.forEach(txn => {
      const id = txn.itemId?.toString();
      if (!id || obMap[id] === undefined) return;
      if (txn.transactionType === 'Stock In') obMap[id] += txn.quantity;
      else if (txn.transactionType === 'Stock Out') obMap[id] -= txn.quantity;
    });

    // Fetch transactions within the period
    const transactions = await StockTransaction.find({ date: { $gte: start, $lte: end } })
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
  getMilkBillAbstractReport
};

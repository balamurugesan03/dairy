import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Sales from '../models/Sales.js';
import Item from '../models/Item.js';
import FarmerPayment from '../models/FarmerPayment.js';
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

    const report = payments.map(p => ({
      farmerNumber: p.farmerId?.farmerNumber,
      farmerName: p.farmerId?.personalDetails.name,
      aadhaar: p.farmerId?.identityDetails.aadhaar,
      ksheerasreeId: p.farmerId?.identityDetails.ksheerasreeId,
      paymentDate: p.paymentDate,
      milkAmount: p.milkAmount,
      netPayable: p.netPayable
    }));

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating subsidy report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
    });
  }
};

// Stock Register Report (Day-wise, Month-wise, From-To Date)
export const getStockRegister = async (req, res) => {
  try {
    const { startDate, endDate, mode = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const financialYear = getFinancialYear(start);

    // Get all active items
    const items = await Item.find({ status: 'Active' })
      .select('itemCode itemName category unit salesRate openingBalance currentBalance')
      .sort({ itemName: 1 });

    // Import StockTransaction model
    const StockTransaction = (await import('../models/StockTransaction.js')).default;

    // Get all stock transactions in the date range
    const transactions = await StockTransaction.find({
      date: { $gte: start, $lte: end }
    })
      .populate('itemId', 'itemCode itemName unit salesRate')
      .sort({ date: 1 });

    // Group transactions based on mode
    let reportData = [];

    if (mode === 'day') {
      // Day-wise grouping
      const dayGroups = {};

      // Group transactions by date and item
      transactions.forEach(trans => {
        if (!trans.itemId) return;

        const dateKey = trans.date.toISOString().split('T')[0];
        const itemId = trans.itemId._id.toString();
        const key = `${dateKey}_${itemId}`;

        if (!dayGroups[key]) {
          dayGroups[key] = {
            date: trans.date,
            itemId: trans.itemId._id,
            itemName: trans.itemId.itemName,
            unit: trans.itemId.unit,
            rate: trans.itemId.salesRate,
            purchase: 0,
            salesReturn: 0,
            sales: 0,
            purchaseReturn: 0
          };
        }

        if (trans.transactionType === 'Stock In') {
          if (trans.referenceType === 'Return') {
            dayGroups[key].salesReturn += trans.quantity;
          } else {
            dayGroups[key].purchase += trans.quantity;
          }
        } else if (trans.transactionType === 'Stock Out') {
          if (trans.referenceType === 'Return') {
            dayGroups[key].purchaseReturn += trans.quantity;
          } else {
            dayGroups[key].sales += trans.quantity;
          }
        }
      });

      // Calculate opening balance for each day-item combination
      const sortedGroups = Object.values(dayGroups).sort((a, b) => {
        const dateCompare = a.date - b.date;
        if (dateCompare !== 0) return dateCompare;
        return a.itemName.localeCompare(b.itemName);
      });

      // Track opening balance per item
      const itemBalances = {};

      // Initialize with opening balances from items
      items.forEach(item => {
        itemBalances[item._id.toString()] = item.openingBalance || 0;
      });

      // Calculate balances for each row
      sortedGroups.forEach(group => {
        const itemId = group.itemId.toString();
        const ob = itemBalances[itemId] || 0;
        const total = ob + group.purchase + group.salesReturn;
        const closingStock = total - group.sales - group.purchaseReturn;

        reportData.push({
          date: group.date,
          itemName: `${group.itemName} @ ${parseFloat(group.rate || 0).toFixed(2)} (${group.unit || 'OTHERS'})`,
          ob: parseFloat(ob).toFixed(2),
          purchase: parseFloat(group.purchase).toFixed(2),
          salesReturn: parseFloat(group.salesReturn).toFixed(2),
          total: parseFloat(total).toFixed(2),
          sales: parseFloat(group.sales).toFixed(2),
          purchaseReturn: parseFloat(group.purchaseReturn).toFixed(2),
          closingStock: parseFloat(closingStock).toFixed(2),
          stockValue: parseFloat(closingStock * (group.rate || 0)).toFixed(2)
        });

        // Update balance for next day
        itemBalances[itemId] = closingStock;
      });

    } else if (mode === 'month') {
      // Month-wise grouping
      const monthGroups = {};

      transactions.forEach(trans => {
        if (!trans.itemId) return;

        const date = new Date(trans.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const itemId = trans.itemId._id.toString();
        const key = `${monthKey}_${itemId}`;

        if (!monthGroups[key]) {
          monthGroups[key] = {
            month: monthKey,
            date: date,
            itemId: trans.itemId._id,
            itemName: trans.itemId.itemName,
            unit: trans.itemId.unit,
            rate: trans.itemId.salesRate,
            purchase: 0,
            salesReturn: 0,
            sales: 0,
            purchaseReturn: 0
          };
        }

        if (trans.transactionType === 'Stock In') {
          if (trans.referenceType === 'Return') {
            monthGroups[key].salesReturn += trans.quantity;
          } else {
            monthGroups[key].purchase += trans.quantity;
          }
        } else if (trans.transactionType === 'Stock Out') {
          if (trans.referenceType === 'Return') {
            monthGroups[key].purchaseReturn += trans.quantity;
          } else {
            monthGroups[key].sales += trans.quantity;
          }
        }
      });

      // Sort by month and item
      const sortedGroups = Object.values(monthGroups).sort((a, b) => {
        const monthCompare = a.month.localeCompare(b.month);
        if (monthCompare !== 0) return monthCompare;
        return a.itemName.localeCompare(b.itemName);
      });

      // Track opening balance per item
      const itemBalances = {};
      items.forEach(item => {
        itemBalances[item._id.toString()] = item.openingBalance || 0;
      });

      // Format month names
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      sortedGroups.forEach(group => {
        const itemId = group.itemId.toString();
        const ob = itemBalances[itemId] || 0;
        const total = ob + group.purchase + group.salesReturn;
        const closingStock = total - group.sales - group.purchaseReturn;

        // Format month as "Apr-2024"
        const [year, month] = group.month.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        const formattedMonth = `${monthName}-${year}`;

        reportData.push({
          month: formattedMonth,
          itemName: `${group.itemName} @ ${parseFloat(group.rate || 0).toFixed(2)} (${group.unit || 'OTHERS'})`,
          ob: parseFloat(ob).toFixed(2),
          purchase: parseFloat(group.purchase).toFixed(2),
          salesReturn: parseFloat(group.salesReturn).toFixed(2),
          total: parseFloat(total).toFixed(2),
          sales: parseFloat(group.sales).toFixed(2),
          purchaseReturn: parseFloat(group.purchaseReturn).toFixed(2),
          closingStock: parseFloat(closingStock).toFixed(2),
          stockValue: parseFloat(closingStock * (group.rate || 0)).toFixed(2)
        });

        itemBalances[itemId] = closingStock;
      });

    } else if (mode === 'range') {
      // From-To Date mode - consolidated per product
      const itemGroups = {};

      transactions.forEach(trans => {
        if (!trans.itemId) return;

        const itemId = trans.itemId._id.toString();

        if (!itemGroups[itemId]) {
          itemGroups[itemId] = {
            itemId: trans.itemId._id,
            itemName: trans.itemId.itemName,
            unit: trans.itemId.unit,
            rate: trans.itemId.salesRate,
            purchase: 0,
            salesReturn: 0,
            sales: 0,
            purchaseReturn: 0
          };
        }

        if (trans.transactionType === 'Stock In') {
          if (trans.referenceType === 'Return') {
            itemGroups[itemId].salesReturn += trans.quantity;
          } else {
            itemGroups[itemId].purchase += trans.quantity;
          }
        } else if (trans.transactionType === 'Stock Out') {
          if (trans.referenceType === 'Return') {
            itemGroups[itemId].purchaseReturn += trans.quantity;
          } else {
            itemGroups[itemId].sales += trans.quantity;
          }
        }
      });

      // Get items with transactions or opening balance
      items.forEach(item => {
        const itemId = item._id.toString();
        const hasTransactions = itemGroups[itemId];
        const hasOpeningBalance = item.openingBalance > 0;

        if (hasTransactions || hasOpeningBalance) {
          const group = itemGroups[itemId] || {
            purchase: 0,
            salesReturn: 0,
            sales: 0,
            purchaseReturn: 0
          };

          const ob = item.openingBalance || 0;
          const total = ob + group.purchase + group.salesReturn;
          const closingStock = total - group.sales - group.purchaseReturn;

          reportData.push({
            itemName: `${item.itemName} @ ${parseFloat(item.salesRate || 0).toFixed(2)} (${item.unit || 'OTHERS'})`,
            ob: parseFloat(ob).toFixed(2),
            purchase: parseFloat(group.purchase).toFixed(2),
            salesReturn: parseFloat(group.salesReturn).toFixed(2),
            total: parseFloat(total).toFixed(2),
            sales: parseFloat(group.sales).toFixed(2),
            purchaseReturn: parseFloat(group.purchaseReturn).toFixed(2),
            closingStock: parseFloat(closingStock).toFixed(2),
            stockValue: parseFloat(closingStock * (item.salesRate || 0)).toFixed(2)
          });
        }
      });

      // Sort by item name
      reportData.sort((a, b) => a.itemName.localeCompare(b.itemName));
    }

    // Calculate grand totals
    const grandTotal = {
      ob: reportData.reduce((sum, row) => sum + parseFloat(row.ob), 0).toFixed(2),
      purchase: reportData.reduce((sum, row) => sum + parseFloat(row.purchase), 0).toFixed(2),
      salesReturn: reportData.reduce((sum, row) => sum + parseFloat(row.salesReturn), 0).toFixed(2),
      total: reportData.reduce((sum, row) => sum + parseFloat(row.total), 0).toFixed(2),
      sales: reportData.reduce((sum, row) => sum + parseFloat(row.sales), 0).toFixed(2),
      purchaseReturn: reportData.reduce((sum, row) => sum + parseFloat(row.purchaseReturn), 0).toFixed(2),
      closingStock: reportData.reduce((sum, row) => sum + parseFloat(row.closingStock), 0).toFixed(2),
      stockValue: reportData.reduce((sum, row) => sum + parseFloat(row.stockValue), 0).toFixed(2)
    };

    res.status(200).json({
      success: true,
      data: {
        financialYear,
        startDate: start,
        endDate: end,
        mode,
        rows: reportData,
        grandTotal
      }
    });
  } catch (error) {
    console.error('Error generating stock register:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating stock register'
    });
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
  getStockRegister
};

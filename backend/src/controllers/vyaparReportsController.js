import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Sales from '../models/Sales.js';
import Item from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  calculateRunningBalance,
  getLedgerCategory
} from '../utils/balanceCalculator.js';
import { getDateRange } from '../utils/dateFilters.js';

/**
 * Sale Report - All sales transactions with filtering
 * GET /api/reports/vyapar/sale-report
 * Query params: filterType, customStart, customEnd, partyId, itemId, paymentStatus
 */
export const getSaleReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyId, itemId, paymentStatus } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query
    const query = {
      billDate: { $gte: startDate, $lte: endDate }
    };

    if (partyId) query.customerId = partyId;
    if (paymentStatus) query.status = paymentStatus;
    if (itemId) query['items.itemId'] = itemId;

    // Fetch sales
    const sales = await Sales.find(query)
      .populate('customerId')
      .sort({ billDate: -1 });

    // Calculate summary
    const summary = {
      totalSales: 0,
      totalTax: 0,
      paidAmount: 0,
      pendingAmount: 0,
      totalBills: sales.length
    };

    sales.forEach(sale => {
      summary.totalSales += sale.grandTotal || 0;
      summary.totalTax += sale.totalGst || 0;
      summary.paidAmount += sale.paidAmount || 0;
      summary.pendingAmount += sale.balanceAmount || 0;
    });

    // Format records
    const records = sales.map(sale => ({
      _id: sale._id,
      date: sale.billDate,
      invoiceNumber: sale.billNumber,
      partyName: sale.customerName || 'Cash Sale',
      itemCount: sale.items.length,
      subtotal: sale.subtotal,
      tax: sale.totalGst,
      total: sale.grandTotal,
      paid: sale.paidAmount,
      balance: sale.balanceAmount,
      paymentStatus: sale.status,
      paymentMode: sale.paymentMode
    }));

    res.json({
      success: true,
      data: {
        summary,
        records,
        filters: { filterType, startDate, endDate, partyId, itemId, paymentStatus }
      }
    });
  } catch (error) {
    console.error('Error in getSaleReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sale report',
      error: error.message
    });
  }
};

/**
 * Purchase Report - All purchase transactions with filtering
 * GET /api/reports/vyapar/purchase-report
 * Query params: filterType, customStart, customEnd, partyId, itemId, paymentStatus
 */
export const getPurchaseReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyId, itemId } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query for purchase vouchers
    const query = {
      voucherType: 'Payment',
      voucherDate: { $gte: startDate, $lte: endDate },
      referenceType: 'Purchase'
    };

    if (partyId) query['entries.ledgerId'] = partyId;

    // Fetch purchase vouchers
    const vouchers = await Voucher.find(query)
      .populate('entries.ledgerId')
      .sort({ voucherDate: -1 });

    // Calculate summary
    const summary = {
      totalPurchases: 0,
      totalBills: vouchers.length,
      paidAmount: 0,
      pendingAmount: 0
    };

    const records = [];

    vouchers.forEach(voucher => {
      const purchaseEntry = voucher.entries.find(e =>
        e.ledgerId && e.ledgerId.ledgerType === 'Purchases A/c'
      );

      const partyEntry = voucher.entries.find(e =>
        e.ledgerId && e.ledgerId.linkedEntity && e.ledgerId.linkedEntity.entityType === 'Supplier'
      );

      if (purchaseEntry) {
        const amount = purchaseEntry.debitAmount || 0;
        summary.totalPurchases += amount;
        summary.paidAmount += amount;

        records.push({
          _id: voucher._id,
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          partyName: partyEntry?.ledgerName || 'Cash Purchase',
          partyId: partyEntry?.ledgerId?._id,
          amount: amount,
          narration: voucher.narration,
          referenceType: voucher.referenceType
        });
      }
    });

    res.json({
      success: true,
      data: {
        summary,
        records,
        filters: { filterType, startDate, endDate, partyId, itemId }
      }
    });
  } catch (error) {
    console.error('Error in getPurchaseReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate purchase report',
      error: error.message
    });
  }
};

/**
 * Party Statement - Individual party account statement
 * GET /api/reports/vyapar/party-statement
 * Query params: ledgerId, filterType, customStart, customEnd
 */
export const getPartyStatement = async (req, res) => {
  try {
    const { ledgerId, filterType, customStart, customEnd } = req.query;

    if (!ledgerId) {
      return res.status(400).json({
        success: false,
        message: 'Ledger ID is required'
      });
    }

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Get ledger details
    const ledger = await Ledger.findById(ledgerId);
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(Ledger, Voucher, ledgerId, startDate);
    const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

    // Fetch voucher entries for the period
    const vouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate },
      'entries.ledgerId': ledgerId
    })
      .populate('entries.ledgerId')
      .sort({ voucherDate: 1 });

    // Process transactions
    const transactions = [];
    let totalDebits = 0;
    let totalCredits = 0;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === ledgerId) {
          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: entry.narration || voucher.narration,
            debitAmount: entry.debitAmount || 0,
            creditAmount: entry.creditAmount || 0,
            referenceType: voucher.referenceType,
            referenceId: voucher.referenceId
          });

          totalDebits += entry.debitAmount || 0;
          totalCredits += entry.creditAmount || 0;
        }
      });
    });

    // Calculate running balance
    const transactionsWithBalance = calculateRunningBalance(openingBalance, transactions, isDebitNature);

    // Calculate closing balance
    const closingBalance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);

    res.json({
      success: true,
      data: {
        ledger: {
          _id: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType
        },
        summary: {
          openingBalance: Math.abs(openingBalance),
          openingBalanceType: getBalanceType(openingBalance, isDebitNature),
          totalDebits,
          totalCredits,
          closingBalance: Math.abs(closingBalance),
          closingBalanceType: getBalanceType(closingBalance, isDebitNature)
        },
        transactions: transactionsWithBalance,
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getPartyStatement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate party statement',
      error: error.message
    });
  }
};

/**
 * Cashflow Report - Categorized receipts and payments
 * GET /api/reports/vyapar/cashflow
 * Query params: filterType, customStart, customEnd, groupBy
 */
export const getCashflowReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, groupBy } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Get Cash ledger
    const cashLedger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active' });
    if (!cashLedger) {
      return res.status(404).json({
        success: false,
        message: 'Cash ledger not found'
      });
    }

    // Calculate opening balance
    const openingCash = await calculateOpeningBalance(Ledger, Voucher, cashLedger._id, startDate);

    // Fetch all vouchers in period
    const vouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate }
    })
      .populate('entries.ledgerId')
      .sort({ voucherDate: 1 });

    // Categorize transactions
    const categories = {
      receipts: {
        sales: 0,
        payments: 0,
        others: 0
      },
      payments: {
        purchases: 0,
        expenses: 0,
        others: 0
      }
    };

    let totalReceipts = 0;
    let totalPayments = 0;
    const records = [];

    vouchers.forEach(voucher => {
      const cashEntry = voucher.entries.find(e =>
        e.ledgerId._id.toString() === cashLedger._id.toString()
      );

      if (cashEntry) {
        const amount = cashEntry.debitAmount || cashEntry.creditAmount || 0;
        const isReceipt = cashEntry.debitAmount > 0;

        const record = {
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          type: isReceipt ? 'Receipt' : 'Payment',
          category: 'Others',
          amount: amount,
          narration: voucher.narration
        };

        // Categorize
        if (voucher.referenceType === 'Sales') {
          record.category = 'Sales';
          categories.receipts.sales += amount;
        } else if (voucher.referenceType === 'Purchase') {
          record.category = 'Purchases';
          categories.payments.purchases += amount;
        } else if (isReceipt) {
          record.category = 'Other Receipts';
          categories.receipts.others += amount;
        } else {
          const isExpense = voucher.entries.some(e =>
            e.ledgerId.ledgerType && e.ledgerId.ledgerType.includes('Expense')
          );
          if (isExpense) {
            record.category = 'Expenses';
            categories.payments.expenses += amount;
          } else {
            record.category = 'Other Payments';
            categories.payments.others += amount;
          }
        }

        if (isReceipt) {
          totalReceipts += amount;
        } else {
          totalPayments += amount;
        }

        records.push(record);
      }
    });

    const closingCash = openingCash + totalReceipts - totalPayments;

    res.json({
      success: true,
      data: {
        summary: {
          openingCash: Math.abs(openingCash),
          totalReceipts,
          totalPayments,
          closingCash: Math.abs(closingCash),
          netCashflow: totalReceipts - totalPayments
        },
        categories,
        records,
        filters: { filterType, startDate, endDate, groupBy }
      }
    });
  } catch (error) {
    console.error('Error in getCashflowReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cashflow report',
      error: error.message
    });
  }
};

/**
 * All Transactions - Complete transaction register
 * GET /api/reports/vyapar/all-transactions
 * Query params: filterType, customStart, customEnd, voucherType, partyId, minAmount, maxAmount
 */
export const getAllTransactions = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, voucherType, partyId, minAmount, maxAmount } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query
    const query = {
      voucherDate: { $gte: startDate, $lte: endDate }
    };

    if (voucherType) query.voucherType = voucherType;
    if (partyId) query['entries.ledgerId'] = partyId;
    if (minAmount || maxAmount) {
      query.totalDebit = {};
      if (minAmount) query.totalDebit.$gte = parseFloat(minAmount);
      if (maxAmount) query.totalDebit.$lte = parseFloat(maxAmount);
    }

    // Fetch vouchers
    const vouchers = await Voucher.find(query)
      .populate('entries.ledgerId')
      .sort({ voucherDate: -1, voucherNumber: -1 });

    // Calculate summary
    const summary = {
      totalTransactions: vouchers.length,
      totalDebits: 0,
      totalCredits: 0,
      byType: {
        Receipt: 0,
        Payment: 0,
        Journal: 0
      }
    };

    const records = vouchers.map(voucher => {
      summary.totalDebits += voucher.totalDebit || 0;
      summary.totalCredits += voucher.totalCredit || 0;
      summary.byType[voucher.voucherType]++;

      return {
        _id: voucher._id,
        date: voucher.voucherDate,
        voucherNumber: voucher.voucherNumber,
        voucherType: voucher.voucherType,
        totalAmount: voucher.totalDebit,
        narration: voucher.narration,
        referenceType: voucher.referenceType,
        referenceId: voucher.referenceId,
        entries: voucher.entries.map(e => ({
          ledgerName: e.ledgerName,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          narration: e.narration
        }))
      };
    });

    res.json({
      success: true,
      data: {
        summary,
        records,
        filters: { filterType, startDate, endDate, voucherType, partyId, minAmount, maxAmount }
      }
    });
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all transactions report',
      error: error.message
    });
  }
};

/**
 * Profit & Loss Report (Enhanced) - Income vs Expenses with drill-down
 * GET /api/reports/vyapar/profit-loss
 * Query params: filterType, customStart, customEnd
 */
export const getVyaparProfitLoss = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Fetch all ledgers
    const ledgers = await Ledger.find({ status: 'Active' });

    const income = [];
    const expenses = [];
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const ledger of ledgers) {
      const category = getLedgerCategory(ledger.ledgerType);

      if (category === 'INCOME') {
        // Get transactions for this ledger
        const vouchers = await Voucher.find({
          voucherDate: { $gte: startDate, $lte: endDate },
          'entries.ledgerId': ledger._id
        });

        let amount = 0;
        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            if (entry.ledgerId.toString() === ledger._id.toString()) {
              amount += (entry.creditAmount || 0) - (entry.debitAmount || 0);
            }
          });
        });

        if (amount !== 0) {
          income.push({
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            amount: Math.abs(amount)
          });
          totalIncome += Math.abs(amount);
        }
      } else if (category === 'EXPENSES') {
        // Get transactions for this ledger
        const vouchers = await Voucher.find({
          voucherDate: { $gte: startDate, $lte: endDate },
          'entries.ledgerId': ledger._id
        });

        let amount = 0;
        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            if (entry.ledgerId.toString() === ledger._id.toString()) {
              amount += (entry.debitAmount || 0) - (entry.creditAmount || 0);
            }
          });
        });

        if (amount !== 0) {
          expenses.push({
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            amount: Math.abs(amount)
          });
          totalExpenses += Math.abs(amount);
        }
      }
    }

    const netProfit = totalIncome - totalExpenses;

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0
        },
        income: income.sort((a, b) => b.amount - a.amount),
        expenses: expenses.sort((a, b) => b.amount - a.amount),
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparProfitLoss:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate profit & loss report',
      error: error.message
    });
  }
};

/**
 * Balance Sheet (Enhanced) - Assets, Liabilities, Capital
 * GET /api/reports/vyapar/balance-sheet
 * Query params: asOnDate
 */
export const getVyaparBalanceSheet = async (req, res) => {
  try {
    const { asOnDate } = req.query;
    const endDate = asOnDate ? new Date(asOnDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch all ledgers
    const ledgers = await Ledger.find({ status: 'Active' });

    const assets = [];
    const liabilities = [];
    const capital = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalCapital = 0;

    for (const ledger of ledgers) {
      const category = getLedgerCategory(ledger.ledgerType);
      const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

      // Calculate balance as on date
      const openingBalance = await calculateOpeningBalance(
        Ledger,
        Voucher,
        ledger._id,
        new Date(0) // From beginning
      );

      const vouchers = await Voucher.find({
        voucherDate: { $lte: endDate },
        'entries.ledgerId': ledger._id
      });

      let totalDebits = 0;
      let totalCredits = 0;

      vouchers.forEach(voucher => {
        voucher.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            totalDebits += entry.debitAmount || 0;
            totalCredits += entry.creditAmount || 0;
          }
        });
      });

      const balance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);

      if (Math.abs(balance) > 0.01) {
        const item = {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          balance: Math.abs(balance),
          balanceType: getBalanceType(balance, isDebitNature)
        };

        if (category === 'ASSETS') {
          assets.push(item);
          totalAssets += Math.abs(balance);
        } else if (category === 'LIABILITIES') {
          liabilities.push(item);
          totalLiabilities += Math.abs(balance);
        } else if (category === 'CAPITAL') {
          capital.push(item);
          totalCapital += Math.abs(balance);
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalAssets,
          totalLiabilities,
          totalCapital,
          liabilitiesAndCapital: totalLiabilities + totalCapital,
          difference: totalAssets - (totalLiabilities + totalCapital)
        },
        assets: assets.sort((a, b) => b.balance - a.balance),
        liabilities: liabilities.sort((a, b) => b.balance - a.balance),
        capital: capital.sort((a, b) => b.balance - a.balance),
        filters: { asOnDate: endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparBalanceSheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate balance sheet',
      error: error.message
    });
  }
};

/**
 * Bill Wise Profit - Profitability analysis by invoice
 * GET /api/reports/vyapar/bill-profit
 * Query params: filterType, customStart, customEnd, minProfit, maxProfit
 */
export const getBillWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, minProfit, maxProfit } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Fetch sales
    const sales = await Sales.find({
      billDate: { $gte: startDate, $lte: endDate }
    })
      .populate('items.itemId')
      .sort({ billDate: -1 });

    const records = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    for (const sale of sales) {
      let saleCost = 0;
      let saleRevenue = sale.subtotal || 0;

      // Calculate cost based on item cost prices
      for (const item of sale.items) {
        if (item.itemId && item.itemId.costPrice) {
          saleCost += item.itemId.costPrice * item.quantity;
        }
      }

      const saleProfit = saleRevenue - saleCost;
      const profitMargin = saleRevenue > 0 ? ((saleProfit / saleRevenue) * 100) : 0;

      // Apply profit filters
      if (minProfit && saleProfit < parseFloat(minProfit)) continue;
      if (maxProfit && saleProfit > parseFloat(maxProfit)) continue;

      records.push({
        _id: sale._id,
        date: sale.billDate,
        invoiceNumber: sale.billNumber,
        partyName: sale.customerName || 'Cash Sale',
        revenue: saleRevenue,
        cost: saleCost,
        profit: saleProfit,
        profitMargin: profitMargin.toFixed(2),
        itemCount: sale.items.length
      });

      totalRevenue += saleRevenue;
      totalCost += saleCost;
      totalProfit += saleProfit;
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalBills: records.length,
          totalRevenue,
          totalCost,
          totalProfit,
          averageProfitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0
        },
        records: records.sort((a, b) => b.profit - a.profit),
        filters: { filterType, startDate, endDate, minProfit, maxProfit }
      }
    });
  } catch (error) {
    console.error('Error in getBillWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate bill wise profit report',
      error: error.message
    });
  }
};

/**
 * Party Wise Profit & Loss - Profitability by customer/supplier
 * GET /api/reports/vyapar/party-profit
 * Query params: filterType, customStart, customEnd, partyType
 */
export const getPartyWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyType } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Fetch sales grouped by customer
    const sales = await Sales.find({
      billDate: { $gte: startDate, $lte: endDate }
    }).populate('items.itemId');

    // Group by party
    const partyMap = new Map();

    for (const sale of sales) {
      const partyId = sale.customerId ? sale.customerId.toString() : 'cash';
      const partyName = sale.customerName || 'Cash Sales';

      if (!partyMap.has(partyId)) {
        partyMap.set(partyId, {
          partyId,
          partyName,
          revenue: 0,
          cost: 0,
          profit: 0,
          billCount: 0
        });
      }

      const party = partyMap.get(partyId);
      const saleRevenue = sale.subtotal || 0;
      let saleCost = 0;

      // Calculate cost
      for (const item of sale.items) {
        if (item.itemId && item.itemId.costPrice) {
          saleCost += item.itemId.costPrice * item.quantity;
        }
      }

      party.revenue += saleRevenue;
      party.cost += saleCost;
      party.profit += (saleRevenue - saleCost);
      party.billCount++;
    }

    const records = Array.from(partyMap.values()).map(party => ({
      ...party,
      profitMargin: party.revenue > 0 ? ((party.profit / party.revenue) * 100).toFixed(2) : 0,
      averageOrderValue: party.billCount > 0 ? (party.revenue / party.billCount).toFixed(2) : 0
    }));

    // Calculate summary
    const summary = {
      totalParties: records.length,
      totalRevenue: records.reduce((sum, p) => sum + p.revenue, 0),
      totalCost: records.reduce((sum, p) => sum + p.cost, 0),
      totalProfit: records.reduce((sum, p) => sum + p.profit, 0),
      totalBills: records.reduce((sum, p) => sum + p.billCount, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        records: records.sort((a, b) => b.profit - a.profit),
        filters: { filterType, startDate, endDate, partyType }
      }
    });
  } catch (error) {
    console.error('Error in getPartyWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate party wise profit report',
      error: error.message
    });
  }
};

/**
 * Trial Balance - Summary of all ledgers with Dr/Cr totals
 * GET /api/reports/vyapar/trial-balance
 * Query params: asOnDate
 */
export const getTrialBalance = async (req, res) => {
  try {
    const { asOnDate } = req.query;
    const endDate = asOnDate ? new Date(asOnDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch all active ledgers
    const ledgers = await Ledger.find({ status: 'Active' });

    const records = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const ledger of ledgers) {
      const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

      // Calculate opening balance
      const openingBalance = await calculateOpeningBalance(
        Ledger,
        Voucher,
        ledger._id,
        new Date(0)
      );

      // Get all transactions up to endDate
      const vouchers = await Voucher.find({
        voucherDate: { $lte: endDate },
        'entries.ledgerId': ledger._id
      });

      let ledgerDebits = 0;
      let ledgerCredits = 0;

      vouchers.forEach(voucher => {
        voucher.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            ledgerDebits += entry.debitAmount || 0;
            ledgerCredits += entry.creditAmount || 0;
          }
        });
      });

      const closingBalance = calculateClosingBalance(
        openingBalance,
        ledgerDebits,
        ledgerCredits,
        isDebitNature
      );

      const balanceType = getBalanceType(closingBalance, isDebitNature);
      const balanceAmount = Math.abs(closingBalance);

      if (balanceAmount > 0.01) {
        records.push({
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          category: getLedgerCategory(ledger.ledgerType),
          debitBalance: balanceType === 'Dr' ? balanceAmount : 0,
          creditBalance: balanceType === 'Cr' ? balanceAmount : 0,
          balanceType
        });

        if (balanceType === 'Dr') {
          totalDebits += balanceAmount;
        } else {
          totalCredits += balanceAmount;
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalLedgers: records.length,
          totalDebits,
          totalCredits,
          difference: Math.abs(totalDebits - totalCredits)
        },
        records: records.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)),
        filters: { asOnDate: endDate }
      }
    });
  } catch (error) {
    console.error('Error in getTrialBalance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate trial balance',
      error: error.message
    });
  }
};

/**
 * Stock Summary - Current stock levels by item
 * GET /api/reports/vyapar/stock-summary
 * Query params: categoryId, minBalance, maxBalance
 */
export const getStockSummary = async (req, res) => {
  try {
    const { categoryId, minBalance, maxBalance } = req.query;

    // Build query
    const query = { status: 'Active' };
    if (categoryId) query.category = categoryId;

    // Fetch items
    const items = await Item.find(query);

    const records = [];
    let totalStockValue = 0;
    let totalItems = 0;

    items.forEach(item => {
      const currentBalance = item.currentBalance || 0;

      // Apply balance filters
      if (minBalance && currentBalance < parseFloat(minBalance)) return;
      if (maxBalance && currentBalance > parseFloat(maxBalance)) return;

      const stockValue = currentBalance * (item.sellingPrice || 0);
      const costValue = currentBalance * (item.costPrice || 0);

      records.push({
        itemId: item._id,
        itemName: item.itemName,
        category: item.category,
        currentBalance,
        unit: item.unit,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        stockValue,
        costValue,
        reorderLevel: item.reorderLevel || 0,
        status: currentBalance <= (item.reorderLevel || 0) ? 'Low Stock' : 'In Stock'
      });

      totalStockValue += stockValue;
      totalItems++;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalItems,
          totalStockValue,
          lowStockItems: records.filter(r => r.status === 'Low Stock').length
        },
        records: records.sort((a, b) => b.stockValue - a.stockValue),
        filters: { categoryId, minBalance, maxBalance }
      }
    });
  } catch (error) {
    console.error('Error in getStockSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock summary',
      error: error.message
    });
  }
};

/**
 * Item Report by Party - Party-wise item movement
 * GET /api/reports/vyapar/item-by-party
 * Query params: filterType, customStart, customEnd, itemId
 */
export const getItemByParty = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, itemId } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query
    const query = {
      billDate: { $gte: startDate, $lte: endDate }
    };
    if (itemId) query['items.itemId'] = itemId;

    // Fetch sales
    const sales = await Sales.find(query).populate('items.itemId');

    // Group by party and item
    const matrix = new Map();

    sales.forEach(sale => {
      const partyKey = sale.customerId ? sale.customerId.toString() : 'cash';
      const partyName = sale.customerName || 'Cash Sales';

      sale.items.forEach(item => {
        const itemKey = item.itemId ? item.itemId._id.toString() : 'unknown';
        const itemName = item.itemName;
        const key = `${partyKey}:${itemKey}`;

        if (!matrix.has(key)) {
          matrix.set(key, {
            partyId: partyKey,
            partyName,
            itemId: itemKey,
            itemName,
            quantity: 0,
            amount: 0,
            billCount: 0
          });
        }

        const record = matrix.get(key);
        record.quantity += item.quantity;
        record.amount += item.amount;
        record.billCount++;
      });
    });

    const records = Array.from(matrix.values());

    res.json({
      success: true,
      data: {
        summary: {
          totalRecords: records.length,
          totalQuantity: records.reduce((sum, r) => sum + r.quantity, 0),
          totalAmount: records.reduce((sum, r) => sum + r.amount, 0)
        },
        records: records.sort((a, b) => b.amount - a.amount),
        filters: { filterType, startDate, endDate, itemId }
      }
    });
  } catch (error) {
    console.error('Error in getItemByParty:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate item by party report',
      error: error.message
    });
  }
};

/**
 * Item Wise Profit/Loss - Product profitability analysis
 * GET /api/reports/vyapar/item-profit
 * Query params: filterType, customStart, customEnd
 */
export const getItemWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Fetch sales
    const sales = await Sales.find({
      billDate: { $gte: startDate, $lte: endDate }
    }).populate('items.itemId');

    // Group by item
    const itemMap = new Map();

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const itemId = item.itemId ? item.itemId._id.toString() : 'unknown';
        const itemName = item.itemName;

        if (!itemMap.has(itemId)) {
          itemMap.set(itemId, {
            itemId,
            itemName,
            quantitySold: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          });
        }

        const record = itemMap.get(itemId);
        const revenue = item.amount;
        const cost = item.itemId && item.itemId.costPrice ? item.itemId.costPrice * item.quantity : 0;

        record.quantitySold += item.quantity;
        record.revenue += revenue;
        record.cost += cost;
        record.profit += (revenue - cost);
      });
    });

    const records = Array.from(itemMap.values()).map(item => ({
      ...item,
      profitMargin: item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(2) : 0,
      averageSellingPrice: item.quantitySold > 0 ? (item.revenue / item.quantitySold).toFixed(2) : 0
    }));

    const summary = {
      totalItems: records.length,
      totalQuantity: records.reduce((sum, i) => sum + i.quantitySold, 0),
      totalRevenue: records.reduce((sum, i) => sum + i.revenue, 0),
      totalCost: records.reduce((sum, i) => sum + i.cost, 0),
      totalProfit: records.reduce((sum, i) => sum + i.profit, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        records: records.sort((a, b) => b.profit - a.profit),
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getItemWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate item wise profit report',
      error: error.message
    });
  }
};

/**
 * Low Stock Summary - Items below reorder level
 * GET /api/reports/vyapar/low-stock
 * Query params: None
 */
export const getLowStockSummary = async (req, res) => {
  try {
    // Fetch all active items
    const items = await Item.find({ status: 'Active' });

    const records = [];
    let totalStockValue = 0;

    items.forEach(item => {
      const currentBalance = item.currentBalance || 0;
      const reorderLevel = item.reorderLevel || 0;

      if (currentBalance <= reorderLevel) {
        const stockValue = currentBalance * (item.sellingPrice || 0);
        const shortage = reorderLevel - currentBalance;

        records.push({
          itemId: item._id,
          itemName: item.itemName,
          category: item.category,
          currentBalance,
          reorderLevel,
          shortage,
          unit: item.unit,
          sellingPrice: item.sellingPrice,
          stockValue,
          status: currentBalance === 0 ? 'Out of Stock' : 'Low Stock'
        });

        totalStockValue += stockValue;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalLowStockItems: records.length,
          outOfStockItems: records.filter(r => r.status === 'Out of Stock').length,
          totalStockValue
        },
        records: records.sort((a, b) => a.shortage - b.shortage),
        filters: {}
      }
    });
  } catch (error) {
    console.error('Error in getLowStockSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate low stock summary',
      error: error.message
    });
  }
};

/**
 * Bank Statement - Bank ledger transactions
 * GET /api/reports/vyapar/bank-statement
 * Query params: ledgerId, filterType, customStart, customEnd
 */
export const getBankStatement = async (req, res) => {
  try {
    const { ledgerId, filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // If no ledgerId provided, find the first bank ledger
    let bankLedgerId = ledgerId;
    if (!bankLedgerId) {
      const bankLedger = await Ledger.findOne({ ledgerType: 'Bank', status: 'Active' });
      if (!bankLedger) {
        return res.status(404).json({
          success: false,
          message: 'No bank ledger found'
        });
      }
      bankLedgerId = bankLedger._id;
    }

    // Get ledger details
    const ledger = await Ledger.findById(bankLedgerId);
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(Ledger, Voucher, bankLedgerId, startDate);
    const isDebitNature = true; // Bank is always debit nature

    // Fetch transactions
    const vouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate },
      'entries.ledgerId': bankLedgerId
    })
      .populate('entries.ledgerId')
      .sort({ voucherDate: 1 });

    const transactions = [];
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === bankLedgerId.toString()) {
          const isDeposit = entry.debitAmount > 0;
          const amount = isDeposit ? entry.debitAmount : entry.creditAmount;

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: entry.narration || voucher.narration,
            deposit: isDeposit ? amount : 0,
            withdrawal: !isDeposit ? amount : 0,
            referenceType: voucher.referenceType
          });

          if (isDeposit) {
            totalDeposits += amount;
          } else {
            totalWithdrawals += amount;
          }
        }
      });
    });

    // Calculate running balance
    const transactionsWithBalance = transactions.map(txn => {
      const balance = openingBalance + totalDeposits - totalWithdrawals;
      return {
        ...txn,
        balance: Math.abs(balance)
      };
    });

    const closingBalance = openingBalance + totalDeposits - totalWithdrawals;

    res.json({
      success: true,
      data: {
        ledger: {
          _id: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType
        },
        summary: {
          openingBalance: Math.abs(openingBalance),
          totalDeposits,
          totalWithdrawals,
          closingBalance: Math.abs(closingBalance),
          netChange: totalDeposits - totalWithdrawals
        },
        transactions: transactionsWithBalance,
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getBankStatement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate bank statement',
      error: error.message
    });
  }
};

/**
 * All Parties Report - List of all parties with outstanding balances
 * GET /api/reports/vyapar/all-parties
 * Query params: partyType, balanceType
 */
export const getAllPartiesReport = async (req, res) => {
  try {
    const { partyType, balanceType } = req.query;

    // Build query for party ledgers
    const query = {
      status: 'Active',
      'linkedEntity.entityType': { $in: ['Farmer', 'Customer', 'Supplier'] }
    };

    if (partyType) query['linkedEntity.entityType'] = partyType;

    // Fetch party ledgers
    const ledgers = await Ledger.find(query).populate('linkedEntity.entityId');

    const records = [];
    let totalReceivables = 0;
    let totalPayables = 0;

    for (const ledger of ledgers) {
      const balance = ledger.currentBalance || 0;
      const absBalance = Math.abs(balance);

      if (absBalance > 0.01) {
        const balType = ledger.balanceType;

        // Apply balance type filter
        if (balanceType && balanceType !== balType) continue;

        records.push({
          ledgerId: ledger._id,
          partyName: ledger.ledgerName,
          partyType: ledger.linkedEntity.entityType,
          balance: absBalance,
          balanceType: balType,
          phone: ledger.linkedEntity.entityId?.phone || '',
          email: ledger.linkedEntity.entityId?.email || ''
        });

        if (balType === 'Dr') {
          totalReceivables += absBalance;
        } else {
          totalPayables += absBalance;
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalParties: records.length,
          totalReceivables,
          totalPayables,
          netBalance: totalReceivables - totalPayables
        },
        records: records.sort((a, b) => b.balance - a.balance),
        filters: { partyType, balanceType }
      }
    });
  } catch (error) {
    console.error('Error in getAllPartiesReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all parties report',
      error: error.message
    });
  }
};

export default {
  getSaleReport,
  getPurchaseReport,
  getPartyStatement,
  getCashflowReport,
  getAllTransactions,
  getVyaparProfitLoss,
  getVyaparBalanceSheet,
  getBillWiseProfit,
  getPartyWiseProfit,
  getTrialBalance,
  getStockSummary,
  getItemByParty,
  getItemWiseProfit,
  getLowStockSummary,
  getBankStatement,
  getAllPartiesReport
};

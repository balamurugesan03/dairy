import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Sales from '../models/Sales.js';
import Item from '../models/Item.js';
import FarmerPayment from '../models/FarmerPayment.js';

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
    const { startDate, endDate } = req.query;

    // Get opening stock
    const openingStock = await Item.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ['$openingBalance', '$purchaseRate'] } } } }
    ]);

    // Get purchases in period
    const purchases = await Voucher.aggregate([
      {
        $match: {
          voucherDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          'entries.ledgerName': /purchase/i
        }
      },
      { $unwind: '$entries' },
      { $match: { 'entries.ledgerName': /purchase/i } },
      { $group: { _id: null, total: { $sum: '$entries.creditAmount' } } }
    ]);

    // Get sales in period
    const sales = await Sales.aggregate([
      {
        $match: {
          billDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);

    // Get closing stock
    const closingStock = await Item.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ['$currentBalance', '$purchaseRate'] } } } }
    ]);

    const openingStockValue = openingStock[0]?.total || 0;
    const purchasesValue = purchases[0]?.total || 0;
    const salesValue = sales[0]?.total || 0;
    const closingStockValue = closingStock[0]?.total || 0;

    const grossProfit = salesValue - (openingStockValue + purchasesValue - closingStockValue);

    res.status(200).json({
      success: true,
      data: {
        openingStock: openingStockValue,
        purchases: purchasesValue,
        sales: salesValue,
        closingStock: closingStockValue,
        grossProfit
      }
    });
  } catch (error) {
    console.error('Error generating trading account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating report'
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

export default {
  getReceiptsDisbursementReport,
  getTradingAccount,
  getProfitLoss,
  getBalanceSheet,
  getSalesReport,
  getStockReport,
  getSubsidyReport
};

import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerLoan from '../models/ProducerLoan.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import ProducerOpening from '../models/ProducerOpening.js';
import Sales from '../models/Sales.js';
import Farmer from '../models/Farmer.js';
import PeriodicalRule from '../models/PeriodicalRule.js';
import mongoose from 'mongoose';

// Get complete farmer ledger with running balance
export const getFarmerLedger = async (req, res) => {
  try {
    const { fromDate, toDate, transactionType } = req.query;
    const farmerId = req.params.farmerId;

    // Build date filter
    const dateFilter = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Collect all transactions
    const transactions = [];

    // 1. Get milk payments
    if (!transactionType || transactionType === 'all' || transactionType === 'payment') {
      const paymentQuery = { farmerId, status: { $ne: 'Cancelled' } };
      if (fromDate || toDate) paymentQuery.paymentDate = dateFilter;

      const payments = await FarmerPayment.find(paymentQuery)
        .sort({ paymentDate: 1 })
        .select('paymentNumber paymentDate milkAmount totalDeduction netPayable paidAmount balanceAmount');

      payments.forEach(p => {
        transactions.push({
          date: p.paymentDate,
          type: 'Milk Payment',
          particulars: `Milk Payment - ${p.paymentNumber}`,
          referenceNo: p.paymentNumber,
          referenceId: p._id,
          debit: 0,
          credit: p.netPayable,
          paidAmount: p.paidAmount
        });
      });
    }

    // 2. Get advances given
    if (!transactionType || transactionType === 'all' || transactionType === 'advance') {
      const advanceQuery = { farmerId, status: { $ne: 'Cancelled' } };
      if (fromDate || toDate) advanceQuery.advanceDate = dateFilter;

      const advances = await Advance.find(advanceQuery)
        .sort({ advanceDate: 1 })
        .select('advanceNumber advanceDate advanceAmount advanceCategory advanceType balanceAmount');

      advances.forEach(a => {
        transactions.push({
          date: a.advanceDate,
          type: 'Advance Given',
          particulars: `${a.advanceCategory || a.advanceType} - ${a.advanceNumber}`,
          referenceNo: a.advanceNumber,
          referenceId: a._id,
          debit: a.advanceAmount,
          credit: 0
        });
      });
    }

    // 3. Get producer loans
    if (!transactionType || transactionType === 'all' || transactionType === 'loan') {
      const loanQuery = { farmerId, status: { $ne: 'Cancelled' } };
      if (fromDate || toDate) loanQuery.loanDate = dateFilter;

      const loans = await ProducerLoan.find(loanQuery)
        .sort({ loanDate: 1 })
        .select('loanNumber loanDate principalAmount loanType outstandingAmount');

      loans.forEach(l => {
        transactions.push({
          date: l.loanDate,
          type: 'Loan Disbursed',
          particulars: `${l.loanType} - ${l.loanNumber}`,
          referenceNo: l.loanNumber,
          referenceId: l._id,
          debit: l.principalAmount,
          credit: 0
        });
      });
    }

    // 4. Get receipts
    if (!transactionType || transactionType === 'all' || transactionType === 'receipt') {
      const receiptQuery = { farmerId, status: 'Active' };
      if (fromDate || toDate) receiptQuery.receiptDate = dateFilter;

      const receipts = await ProducerReceipt.find(receiptQuery)
        .sort({ receiptDate: 1 })
        .select('receiptNumber receiptDate amount receiptType referenceNumber');

      receipts.forEach(r => {
        transactions.push({
          date: r.receiptDate,
          type: 'Receipt',
          particulars: `${r.receiptType} Receipt - ${r.receiptNumber}`,
          referenceNo: r.receiptNumber,
          referenceId: r._id,
          debit: 0,
          credit: r.amount
        });
      });
    }

    // Sort all transactions by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate opening balance (sum of transactions before fromDate)
    let openingBalance = 0;
    if (fromDate) {
      openingBalance = await calculateOpeningBalance(farmerId, new Date(fromDate));
    }

    // Calculate running balance
    let runningBalance = openingBalance;
    const ledgerEntries = transactions.map(t => {
      runningBalance = runningBalance + t.debit - t.credit;
      return {
        ...t,
        balance: runningBalance
      };
    });

    // Calculate totals
    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = runningBalance;

    res.status(200).json({
      success: true,
      data: {
        entries: ledgerEntries,
        summary: {
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance
        }
      }
    });
  } catch (error) {
    console.error('Error fetching farmer ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer ledger'
    });
  }
};

// Calculate opening balance as of a given date
const calculateOpeningBalance = async (farmerId, asOfDate) => {
  let balance = 0;

  // Add advances given before date
  const advancesBeforeDate = await Advance.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        advanceDate: { $lt: asOfDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$advanceAmount' }
      }
    }
  ]);

  if (advancesBeforeDate.length > 0) {
    balance += advancesBeforeDate[0].total;
  }

  // Add loans disbursed before date
  const loansBeforeDate = await ProducerLoan.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        loanDate: { $lt: asOfDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$principalAmount' }
      }
    }
  ]);

  if (loansBeforeDate.length > 0) {
    balance += loansBeforeDate[0].total;
  }

  // Subtract payments made before date
  const paymentsBeforeDate = await FarmerPayment.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        paymentDate: { $lt: asOfDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$netPayable' }
      }
    }
  ]);

  if (paymentsBeforeDate.length > 0) {
    balance -= paymentsBeforeDate[0].total;
  }

  // Subtract receipts received before date
  const receiptsBeforeDate = await ProducerReceipt.aggregate([
    {
      $match: {
        farmerId: new mongoose.Types.ObjectId(farmerId),
        receiptDate: { $lt: asOfDate },
        status: 'Active'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  if (receiptsBeforeDate.length > 0) {
    balance -= receiptsBeforeDate[0].total;
  }

  return balance;
};

// Get farmer ledger summary
export const getLedgerSummary = async (req, res) => {
  try {
    const farmerId = req.params.farmerId;

    // Get farmer details
    const farmer = await Farmer.findById(farmerId)
      .select('farmerNumber personalDetails address');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Get outstanding advances by category
    const advanceOutstanding = await Advance.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] }
        }
      },
      {
        $group: {
          _id: '$advanceCategory',
          totalAmount: { $sum: '$advanceAmount' },
          outstanding: { $sum: '$balanceAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get outstanding loans by type
    const loanOutstanding = await ProducerLoan.getFarmerOutstandingByType(farmerId);

    // Get total loan outstanding
    const loanSummary = await ProducerLoan.getFarmerOutstanding(farmerId);

    // Get pending payment amount
    const pendingPayments = await FarmerPayment.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          status: { $in: ['Pending', 'Partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: '$balanceAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total receipts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyReceipts = await ProducerReceipt.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          receiptDate: { $gte: startOfMonth },
          status: 'Active'
        }
      },
      {
        $group: {
          _id: '$receiptType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate net balance
    const advanceTotal = advanceOutstanding.reduce((sum, a) => sum + a.outstanding, 0);
    const netBalance = advanceTotal + loanSummary.totalOutstanding;

    res.status(200).json({
      success: true,
      data: {
        farmer: {
          id: farmer._id,
          number: farmer.farmerNumber,
          name: farmer.personalDetails?.name,
          village: farmer.address?.village,
          phone: farmer.personalDetails?.phone
        },
        advances: {
          byCategory: advanceOutstanding,
          total: advanceTotal
        },
        loans: {
          byType: loanOutstanding,
          summary: loanSummary
        },
        pendingPayments: pendingPayments[0] || { totalPending: 0, count: 0 },
        monthlyReceipts,
        netBalance
      }
    });
  } catch (error) {
    console.error('Error fetching ledger summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledger summary'
    });
  }
};

// Check welfare recovery eligibility — amount from PeriodicalRule, respects applyPeriod
export const checkWelfareRecovery = async (req, res) => {
  try {
    const farmerId = req.params.farmerId;
    const companyId = req.companyId;
    const checkDate = req.query.date ? new Date(req.query.date) : new Date();
    const fromDate  = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate    = req.query.toDate   ? new Date(req.query.toDate)   : null;

    // 1. Find active PeriodicalRule for DEDUCTIONS with FIXED_AMOUNT
    const rule = await PeriodicalRule.findOne({
      companyId,
      component: 'DEDUCTIONS',
      basedOn:   'FIXED_AMOUNT',
      active:    true,
    }).lean();

    const welfareAmount = rule?.fixedRate || 0;
    const applyPeriod   = rule?.applyPeriod || 'ONCE_IN_MONTH';

    // 2. Determine the check window based on applyPeriod
    let checkStart, checkEnd;
    if (applyPeriod === 'EACH_PERIOD' && fromDate && toDate) {
      checkStart = fromDate;
      checkEnd   = new Date(toDate);
      checkEnd.setHours(23, 59, 59, 999);
    } else {
      // ONCE_IN_MONTH — check the whole month of the payment date / fromDate
      const ref = fromDate || checkDate;
      checkStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      checkEnd   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
    }

    // 3. Check if welfare already deducted in this window
    const existingWelfareDeduction = await FarmerPayment.findOne({
      farmerId,
      paymentDate: { $gte: checkStart, $lte: checkEnd },
      status: { $ne: 'Cancelled' },
      'deductions.type': 'Welfare Recovery',
    });

    const alreadyDeducted = !!existingWelfareDeduction;

    res.status(200).json({
      success: true,
      data: {
        month: checkDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        alreadyDeducted,
        eligibleForDeduction: !alreadyDeducted,
        amount: alreadyDeducted ? 0 : welfareAmount,
        applyPeriod,
        lastDeduction: existingWelfareDeduction ? {
          date: existingWelfareDeduction.paymentDate,
          paymentNumber: existingWelfareDeduction.paymentNumber,
        } : null,
      }
    });
  } catch (error) {
    console.error('Error checking welfare recovery:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking welfare recovery'
    });
  }
};

// Get farmer's outstanding by advance type — recovery-ledger based calculation.
// Matches the same logic used by CF/Cash/Loan Advance summary pages:
//   outstanding = opening + given − recovered(FarmerPayment.deductions) − returned(ProducerReceipt)
// This handles historical wrong Individual Payment data (which sent 'CF Advance' /
// 'Cash Advance' / 'Loan Advance' as deduction types, creating bogus disbursement
// rows) because those bogus rows appear in both the "given" and "recovered" totals
// and cancel out.
export const getFarmerOutstandingByType = async (req, res) => {
  try {
    const farmerId  = req.params.farmerId;
    const companyId = req.companyId;
    const fObjId    = new mongoose.Types.ObjectId(farmerId);
    const cObjId    = new mongoose.Types.ObjectId(companyId);

    const r2 = (v) => Math.round((v || 0) * 100) / 100;

    // Opening balances from ProducerOpening
    const opening = await ProducerOpening.findOne({ farmerId: fObjId, companyId: cObjId }).lean();
    const cfOpen   = r2(opening?.cfAdvance   || 0);
    const cashOpen = r2(opening?.cashAdvance || 0);
    const loanOpen = r2(opening?.loanAdvance || 0);

    // ── CF Advance ────────────────────────────────────────────────────────────
    // Given: inventory credit sales to this farmer + direct CF advance rows
    const [cfSalesAgg, cfAdvAgg, cfPayAgg, cfReceiptAgg] = await Promise.all([
      Sales.aggregate([
        { $match: { companyId: cObjId, customerId: fObjId, customerType: 'Farmer' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Advance.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'CF Advance' } },
        { $group: { _id: null, total: { $sum: '$advanceAmount' } } }
      ]),
      FarmerPayment.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['CF Advance', 'Cattle Feed', 'CF Recovery'] } } },
        { $unwind: '$deductions' },
        { $match: { 'deductions.type': { $in: ['CF Advance', 'Cattle Feed', 'CF Recovery'] } } },
        { $group: { _id: null, total: { $sum: '$deductions.amount' } } }
      ]),
      ProducerReceipt.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, receiptType: 'CF Advance', status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const cfGiven    = r2((cfSalesAgg[0]?.total || 0) + (cfAdvAgg[0]?.total || 0));
    const cfRec      = r2((cfPayAgg[0]?.total || 0) + (cfReceiptAgg[0]?.total || 0));
    const cfOutstanding = Math.max(0, r2(cfOpen + cfGiven - cfRec));

    // ── Cash Advance ──────────────────────────────────────────────────────────
    const [cashAdvAgg, cashPayAgg, cashReceiptAgg] = await Promise.all([
      Advance.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'Cash Advance' } },
        { $group: { _id: null, total: { $sum: '$advanceAmount' } } }
      ]),
      FarmerPayment.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] } } },
        { $unwind: '$deductions' },
        { $match: { 'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] } } },
        { $group: { _id: null, total: { $sum: '$deductions.amount' } } }
      ]),
      ProducerReceipt.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, receiptType: 'Cash Advance', status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const cashGiven       = r2(cashAdvAgg[0]?.total || 0);
    const cashRec         = r2((cashPayAgg[0]?.total || 0) + (cashReceiptAgg[0]?.total || 0));
    const cashOutstanding = Math.max(0, r2(cashOpen + cashGiven - cashRec));

    // ── Loan Advance ──────────────────────────────────────────────────────────
    const [loanLoanAgg, loanAdvAgg, loanPayAgg] = await Promise.all([
      ProducerLoan.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId } },
        { $group: { _id: null, total: { $sum: '$totalLoanAmount' } } }
      ]),
      Advance.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'Loan Advance' } },
        { $group: { _id: null, total: { $sum: '$advanceAmount' } } }
      ]),
      FarmerPayment.aggregate([
        { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['Loan Advance', 'Loan Recovery', 'Loan EMI'] } } },
        { $unwind: '$deductions' },
        { $match: { 'deductions.type': { $in: ['Loan Advance', 'Loan Recovery', 'Loan EMI'] } } },
        { $group: { _id: null, total: { $sum: '$deductions.amount' } } }
      ])
    ]);
    const loanGiven       = r2((loanLoanAgg[0]?.total || 0) + (loanAdvAgg[0]?.total || 0));
    const loanRec         = r2(loanPayAgg[0]?.total || 0);
    const loanOutstanding = Math.max(0, r2(loanOpen + loanGiven - loanRec));

    res.status(200).json({
      success: true,
      data: {
        'CF Advance':   { amount: cfOutstanding,   items: [] },
        'Cash Advance': { amount: cashOutstanding, items: [] },
        'Loan Advance': { amount: loanOutstanding, items: [] }
      }
    });
  } catch (error) {
    console.error('Error fetching outstanding by type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching outstanding by type'
    });
  }
};

export default {
  getFarmerLedger,
  getLedgerSummary,
  checkWelfareRecovery,
  getFarmerOutstandingByType
};

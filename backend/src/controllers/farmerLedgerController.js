import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerLoan from '../models/ProducerLoan.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import Farmer from '../models/Farmer.js';
import mongoose from 'mongoose';

// Get complete farmer ledger with running balance
export const getFarmerLedger = async (req, res) => {
  try {
    const { fromDate, toDate, transactionType } = req.query;
    const farmerId = req.params.farmerId;

    // Build date filter
    const dateFilter = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);

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

// Check welfare recovery eligibility for current month
export const checkWelfareRecovery = async (req, res) => {
  try {
    const farmerId = req.params.farmerId;
    const checkDate = req.query.date ? new Date(req.query.date) : new Date();

    // Get start and end of the month
    const startOfMonth = new Date(checkDate.getFullYear(), checkDate.getMonth(), 1);
    const endOfMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0, 23, 59, 59);

    // Check if welfare recovery has already been deducted this month
    const existingWelfareDeduction = await FarmerPayment.findOne({
      farmerId,
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $ne: 'Cancelled' },
      'deductions.type': 'Welfare Recovery'
    });

    const alreadyDeducted = !!existingWelfareDeduction;

    res.status(200).json({
      success: true,
      data: {
        month: checkDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        alreadyDeducted,
        eligibleForDeduction: !alreadyDeducted,
        amount: 20,
        lastDeduction: existingWelfareDeduction ? {
          date: existingWelfareDeduction.paymentDate,
          paymentNumber: existingWelfareDeduction.paymentNumber
        } : null
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

// Get farmer's outstanding by advance type (for priority deduction)
export const getFarmerOutstandingByType = async (req, res) => {
  try {
    const farmerId = req.params.farmerId;

    // Get advance outstanding by category
    const advancesByCategory = await Advance.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] }
        }
      },
      {
        $group: {
          _id: '$advanceCategory',
          outstanding: { $sum: '$balanceAmount' },
          advances: {
            $push: {
              id: '$_id',
              number: '$advanceNumber',
              amount: '$advanceAmount',
              balance: '$balanceAmount',
              date: '$advanceDate'
            }
          }
        }
      }
    ]);

    // Get loan outstanding by type
    const loansByType = await ProducerLoan.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          status: { $in: ['Active', 'Defaulted'] }
        }
      },
      {
        $group: {
          _id: '$loanType',
          outstanding: { $sum: '$outstandingAmount' },
          loans: {
            $push: {
              id: '$_id',
              number: '$loanNumber',
              principal: '$principalAmount',
              outstanding: '$outstandingAmount',
              emiAmount: '$emiAmount',
              date: '$loanDate'
            }
          }
        }
      }
    ]);

    // Merge and format response
    const outstanding = {
      'Loan Advance': { amount: 0, items: [] },
      'CF Advance': { amount: 0, items: [] },
      'Cash Advance': { amount: 0, items: [] }
    };

    // Add advances
    advancesByCategory.forEach(a => {
      if (outstanding[a._id]) {
        outstanding[a._id].amount += a.outstanding;
        outstanding[a._id].items.push(...a.advances.map(adv => ({
          ...adv,
          source: 'advance'
        })));
      }
    });

    // Add loans
    loansByType.forEach(l => {
      if (outstanding[l._id]) {
        outstanding[l._id].amount += l.outstanding;
        outstanding[l._id].items.push(...l.loans.map(loan => ({
          id: loan.id,
          number: loan.number,
          amount: loan.principal,
          balance: loan.outstanding,
          emiAmount: loan.emiAmount,
          date: loan.date,
          source: 'loan'
        })));
      }
    });

    // Sort items within each category by date (oldest first for FIFO)
    Object.keys(outstanding).forEach(key => {
      outstanding[key].items.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    res.status(200).json({
      success: true,
      data: outstanding
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

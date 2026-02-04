import Farmer from '../models/Farmer.js';
import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerLoan from '../models/ProducerLoan.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import mongoose from 'mongoose';

/**
 * Get Producer Register - Detailed ledger view for a farmer
 * @route GET /api/producer-register/:farmerId
 */
export const getProducerRegister = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { fromDate, toDate } = req.query;
    const companyId = req.userCompany;

    // Validate farmer exists
    const farmer = await Farmer.findOne({
      _id: farmerId,
      companyId
    });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Date range for query
    const startDate = fromDate ? new Date(fromDate) : new Date(new Date().setDate(1));
    const endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Calculate opening balance (balance before startDate)
    const openingBalance = await calculateOpeningBalance(farmerId, companyId, startDate);

    // Get milk collections for the period (try to import MilkCollection)
    let milkCollections = [];
    try {
      const MilkCollection = (await import('../models/MilkCollection.js')).default;
      milkCollections = await MilkCollection.find({
        farmerId,
        companyId,
        collectionDate: { $gte: startDate, $lte: endDate }
      }).sort({ collectionDate: 1 }).lean();
    } catch (err) {
      // MilkCollection model might not exist, continue without it
      console.log('MilkCollection not available:', err.message);
    }

    // Get payments for the period
    const payments = await FarmerPayment.find({
      farmerId,
      companyId,
      paymentDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    }).sort({ paymentDate: 1 }).lean();

    // Get advances for the period
    const advances = await Advance.find({
      farmerId,
      companyId,
      advanceDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    }).sort({ advanceDate: 1 }).lean();

    // Get loans for the period
    const loans = await ProducerLoan.find({
      farmerId,
      companyId,
      loanDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    }).sort({ loanDate: 1 }).lean();

    // Get receipts for the period
    const receipts = await ProducerReceipt.find({
      farmerId,
      companyId,
      receiptDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    }).sort({ receiptDate: 1 }).lean();

    // Build register entries by date
    const entriesMap = new Map();

    // Process milk collections
    milkCollections.forEach(collection => {
      const dateKey = new Date(collection.collectionDate).toISOString().split('T')[0];

      if (!entriesMap.has(dateKey)) {
        entriesMap.set(dateKey, createEmptyEntry(dateKey));
      }

      const entry = entriesMap.get(dateKey);

      if (collection.shift === 'Morning' || collection.shift === 'AM') {
        entry.morningQty += collection.quantity || 0;
      } else {
        entry.eveningQty += collection.quantity || 0;
      }

      entry.totalMilk = entry.morningQty + entry.eveningQty;
      entry.rate = collection.rate || entry.rate;
      entry.totalAmount += (collection.quantity || 0) * (collection.rate || 0);
    });

    // Process payments
    payments.forEach(payment => {
      const dateKey = new Date(payment.paymentDate).toISOString().split('T')[0];

      if (!entriesMap.has(dateKey)) {
        entriesMap.set(dateKey, createEmptyEntry(dateKey));
      }

      const entry = entriesMap.get(dateKey);

      // Milk details from payment if available
      if (payment.milkDetails) {
        if (!entry.morningQty) entry.morningQty = payment.milkDetails.morningQuantity || 0;
        if (!entry.eveningQty) entry.eveningQty = payment.milkDetails.eveningQuantity || 0;
        if (!entry.totalMilk) entry.totalMilk = payment.milkDetails.totalQuantity || 0;
        if (!entry.rate) entry.rate = payment.milkDetails.avgRate || 0;
      }

      if (!entry.totalAmount && payment.milkAmount) {
        entry.totalAmount = payment.milkAmount;
      }

      // Deductions
      if (payment.deductions && Array.isArray(payment.deductions)) {
        payment.deductions.forEach(ded => {
          const dedType = (ded.type || '').toLowerCase();
          if (dedType.includes('loan')) {
            entry.loanDeduction += ded.amount || 0;
          } else if (dedType.includes('cash') || dedType.includes('advance')) {
            entry.cashAdvance += ded.amount || 0;
          } else {
            entry.otherDeduction += ded.amount || 0;
          }
        });
      }

      entry.totalDeduction = entry.loanDeduction + entry.cashAdvance + entry.otherDeduction;

      // Payment details
      entry.paidAmount += payment.paidAmount || 0;
      entry.paymentMode = payment.paymentMode || entry.paymentMode;
    });

    // Process advances
    advances.forEach(advance => {
      const dateKey = new Date(advance.advanceDate).toISOString().split('T')[0];

      if (!entriesMap.has(dateKey)) {
        entriesMap.set(dateKey, createEmptyEntry(dateKey));
      }

      const entry = entriesMap.get(dateKey);

      if (advance.advanceCategory === 'Cash Advance') {
        entry.cashAdvance += advance.advanceAmount || 0;
      } else if (advance.advanceCategory === 'Loan Advance') {
        entry.loanDeduction += advance.advanceAmount || 0;
      } else {
        entry.otherDeduction += advance.advanceAmount || 0;
      }

      entry.totalDeduction = entry.loanDeduction + entry.cashAdvance + entry.otherDeduction;
    });

    // Process receipts
    receipts.forEach(receipt => {
      const dateKey = new Date(receipt.receiptDate).toISOString().split('T')[0];

      if (!entriesMap.has(dateKey)) {
        entriesMap.set(dateKey, createEmptyEntry(dateKey));
      }

      const entry = entriesMap.get(dateKey);
      entry.receiptNo = receipt.receiptNumber || '';
      entry.receiptAmount = receipt.amount || 0;
      entry.receiptDate = receipt.receiptDate;
    });

    // Convert map to sorted array and calculate running balance
    const entries = Array.from(entriesMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = openingBalance;
    entries.forEach(entry => {
      // Balance = Previous + Total Amount - Total Deduction - Paid Amount + Receipt Amount
      runningBalance = runningBalance + entry.totalAmount - entry.totalDeduction - entry.paidAmount + entry.receiptAmount;
      entry.closingBalance = runningBalance;
    });

    // Calculate totals
    const totals = entries.reduce((acc, entry) => ({
      morningQty: acc.morningQty + entry.morningQty,
      eveningQty: acc.eveningQty + entry.eveningQty,
      totalMilk: acc.totalMilk + entry.totalMilk,
      totalAmount: acc.totalAmount + entry.totalAmount,
      loanDeduction: acc.loanDeduction + entry.loanDeduction,
      cashAdvance: acc.cashAdvance + entry.cashAdvance,
      otherDeduction: acc.otherDeduction + entry.otherDeduction,
      totalDeduction: acc.totalDeduction + entry.totalDeduction,
      receiptAmount: acc.receiptAmount + entry.receiptAmount,
      paidAmount: acc.paidAmount + entry.paidAmount
    }), {
      morningQty: 0, eveningQty: 0, totalMilk: 0, totalAmount: 0,
      loanDeduction: 0, cashAdvance: 0, otherDeduction: 0, totalDeduction: 0,
      receiptAmount: 0, paidAmount: 0
    });

    const closingBalance = entries.length > 0
      ? entries[entries.length - 1].closingBalance
      : openingBalance;

    res.status(200).json({
      success: true,
      farmer: {
        _id: farmer._id,
        farmerNumber: farmer.farmerNumber,
        memberId: farmer.memberId,
        name: farmer.personalDetails?.name
      },
      period: {
        fromDate: startDate,
        toDate: endDate
      },
      openingBalance,
      closingBalance,
      entries,
      totals,
      netPayable: totals.totalAmount - totals.totalDeduction
    });

  } catch (error) {
    console.error('Error fetching producer register:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch producer register',
      error: error.message
    });
  }
};

/**
 * Save Producer Register entries
 * @route POST /api/producer-register/:farmerId
 */
export const saveProducerRegister = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { farmerId } = req.params;
    const { fromDate, toDate, entries } = req.body;
    const companyId = req.userCompany;
    const userId = req.user._id;

    // Validate farmer exists
    const farmer = await Farmer.findOne({
      _id: farmerId,
      companyId
    });

    if (!farmer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Process each entry
    const processedEntries = [];
    const errors = [];

    for (const entry of entries) {
      try {
        // Skip empty entries
        if (!entry.date && !entry.morningQty && !entry.eveningQty && !entry.paidAmount) {
          continue;
        }

        const entryDate = entry.date
          ? parseDate(entry.date)
          : new Date();

        // Create payment if paid amount exists
        if (entry.paidAmount && parseFloat(entry.paidAmount) > 0) {
          // Check if payment already exists for this date
          const existingPayment = await FarmerPayment.findOne({
            farmerId,
            companyId,
            paymentDate: {
              $gte: new Date(new Date(entryDate).setHours(0, 0, 0, 0)),
              $lte: new Date(new Date(entryDate).setHours(23, 59, 59, 999))
            },
            status: { $ne: 'Cancelled' }
          }).session(session);

          if (!existingPayment) {
            // Build deductions array
            const deductions = [];
            if (entry.loanDeduction && parseFloat(entry.loanDeduction) > 0) {
              deductions.push({ type: 'Loan Deduction', amount: parseFloat(entry.loanDeduction) });
            }
            if (entry.cashAdvance && parseFloat(entry.cashAdvance) > 0) {
              deductions.push({ type: 'Cash Advance', amount: parseFloat(entry.cashAdvance) });
            }
            if (entry.otherDeduction && parseFloat(entry.otherDeduction) > 0) {
              deductions.push({ type: 'Other Deduction', amount: parseFloat(entry.otherDeduction) });
            }

            const newPayment = new FarmerPayment({
              companyId,
              farmerId,
              paymentDate: entryDate,
              milkDetails: {
                morningQuantity: parseFloat(entry.morningQty) || 0,
                eveningQuantity: parseFloat(entry.eveningQty) || 0,
                totalQuantity: parseFloat(entry.totalMilk) || 0,
                avgRate: parseFloat(entry.rate) || 0
              },
              milkAmount: parseFloat(entry.totalAmount) || 0,
              grossAmount: parseFloat(entry.totalAmount) || 0,
              deductions,
              totalDeduction: parseFloat(entry.totalDeduction) || 0,
              netPayable: (parseFloat(entry.totalAmount) || 0) - (parseFloat(entry.totalDeduction) || 0),
              paidAmount: parseFloat(entry.paidAmount) || 0,
              paymentMode: entry.paymentMode || 'Cash',
              status: 'Paid',
              approvalStatus: 'Approved',
              createdBy: userId
            });

            await newPayment.save({ session });
            processedEntries.push({
              date: entryDate,
              type: 'Payment',
              amount: entry.paidAmount,
              status: 'Created'
            });
          } else {
            processedEntries.push({
              date: entryDate,
              type: 'Payment',
              amount: entry.paidAmount,
              status: 'Exists'
            });
          }
        }

        // Create receipt if receipt amount exists
        if (entry.receiptAmount && parseFloat(entry.receiptAmount) > 0) {
          const receiptDate = entry.receiptDate
            ? parseDate(entry.receiptDate)
            : entryDate;

          const newReceipt = new ProducerReceipt({
            companyId,
            farmerId,
            receiptDate,
            receiptType: 'Cash Advance',
            amount: parseFloat(entry.receiptAmount),
            paymentMode: 'Cash',
            status: 'Active',
            createdBy: userId
          });

          await newReceipt.save({ session });
          processedEntries.push({
            date: receiptDate,
            type: 'Receipt',
            amount: entry.receiptAmount,
            status: 'Created'
          });
        }

      } catch (entryError) {
        errors.push({
          entry,
          error: entryError.message
        });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Register saved successfully',
      processedEntries,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error saving producer register:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save producer register',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get Producer Register Summary (multiple farmers)
 * @route GET /api/producer-register/summary
 */
export const getProducerRegisterSummary = async (req, res) => {
  try {
    const { fromDate, toDate, collectionCenter } = req.query;
    const companyId = req.userCompany;

    const startDate = fromDate ? new Date(fromDate) : new Date(new Date().setDate(1));
    const endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Build farmer query
    const farmerQuery = { companyId, status: 'Active' };
    if (collectionCenter) {
      farmerQuery.collectionCenter = collectionCenter;
    }

    const farmers = await Farmer.find(farmerQuery)
      .select('farmerNumber memberId personalDetails.name')
      .lean();

    // Get summary for each farmer
    const summaries = await Promise.all(
      farmers.map(async (farmer) => {
        const payments = await FarmerPayment.aggregate([
          {
            $match: {
              farmerId: farmer._id,
              companyId: new mongoose.Types.ObjectId(companyId),
              paymentDate: { $gte: startDate, $lte: endDate },
              status: { $ne: 'Cancelled' }
            }
          },
          {
            $group: {
              _id: null,
              totalMilk: { $sum: '$milkDetails.totalQuantity' },
              totalAmount: { $sum: '$milkAmount' },
              totalDeduction: { $sum: '$totalDeduction' },
              totalPaid: { $sum: '$paidAmount' }
            }
          }
        ]);

        const summary = payments[0] || {
          totalMilk: 0,
          totalAmount: 0,
          totalDeduction: 0,
          totalPaid: 0
        };

        return {
          farmerId: farmer._id,
          farmerNumber: farmer.farmerNumber,
          memberId: farmer.memberId,
          farmerName: farmer.personalDetails?.name,
          ...summary,
          netPayable: summary.totalAmount - summary.totalDeduction
        };
      })
    );

    // Filter out farmers with no activity
    const activeSummaries = summaries.filter(s =>
      s.totalMilk > 0 || s.totalAmount > 0 || s.totalPaid > 0
    );

    // Calculate grand totals
    const grandTotals = activeSummaries.reduce((acc, s) => ({
      totalMilk: acc.totalMilk + s.totalMilk,
      totalAmount: acc.totalAmount + s.totalAmount,
      totalDeduction: acc.totalDeduction + s.totalDeduction,
      totalPaid: acc.totalPaid + s.totalPaid,
      netPayable: acc.netPayable + s.netPayable
    }), {
      totalMilk: 0,
      totalAmount: 0,
      totalDeduction: 0,
      totalPaid: 0,
      netPayable: 0
    });

    res.status(200).json({
      success: true,
      period: { fromDate: startDate, toDate: endDate },
      summaries: activeSummaries,
      grandTotals,
      totalFarmers: activeSummaries.length
    });

  } catch (error) {
    console.error('Error fetching producer register summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary',
      error: error.message
    });
  }
};

/**
 * Helper: Calculate opening balance for a farmer
 */
async function calculateOpeningBalance(farmerId, companyId, beforeDate) {
  try {
    // Get all payments before the date
    const paymentsResult = await FarmerPayment.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          companyId: new mongoose.Types.ObjectId(companyId),
          paymentDate: { $lt: beforeDate },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$milkAmount' },
          totalDeduction: { $sum: '$totalDeduction' },
          totalPaid: { $sum: '$paidAmount' }
        }
      }
    ]);

    // Get all advances before the date
    const advancesResult = await Advance.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          companyId: new mongoose.Types.ObjectId(companyId),
          advanceDate: { $lt: beforeDate },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalAdvance: { $sum: '$advanceAmount' },
          totalAdjusted: { $sum: '$adjustedAmount' }
        }
      }
    ]);

    // Get all receipts before the date
    const receiptsResult = await ProducerReceipt.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          companyId: new mongoose.Types.ObjectId(companyId),
          receiptDate: { $lt: beforeDate },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: '$amount' }
        }
      }
    ]);

    const payments = paymentsResult[0] || { totalAmount: 0, totalDeduction: 0, totalPaid: 0 };
    const advances = advancesResult[0] || { totalAdvance: 0, totalAdjusted: 0 };
    const receipts = receiptsResult[0] || { totalReceipts: 0 };

    // Opening Balance = (Total Amount - Total Deduction - Total Paid + Total Receipts)
    // Positive = Society owes farmer, Negative = Farmer owes society
    const openingBalance =
      payments.totalAmount -
      payments.totalDeduction -
      payments.totalPaid +
      receipts.totalReceipts -
      (advances.totalAdvance - advances.totalAdjusted);

    return openingBalance;

  } catch (error) {
    console.error('Error calculating opening balance:', error);
    return 0;
  }
}

/**
 * Helper: Create empty entry object
 */
function createEmptyEntry(dateKey) {
  return {
    date: dateKey,
    morningQty: 0,
    eveningQty: 0,
    totalMilk: 0,
    rate: 0,
    totalAmount: 0,
    loanDeduction: 0,
    cashAdvance: 0,
    otherDeduction: 0,
    totalDeduction: 0,
    receiptNo: '',
    receiptAmount: 0,
    receiptDate: null,
    paidAmount: 0,
    paymentMode: '',
    closingBalance: 0
  };
}

/**
 * Helper: Parse date string (DD/MM/YYYY or YYYY-MM-DD)
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date();

  // Check if DD/MM/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      // Handle 2-digit year
      const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
      return new Date(fullYear, month, day);
    }
  }

  // Default ISO format
  return new Date(dateStr);
}

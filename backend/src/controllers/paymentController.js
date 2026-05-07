import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerLoan from '../models/ProducerLoan.js';
import ProducerOpening from '../models/ProducerOpening.js';
import ProducerPayment from '../models/ProducerPayment.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import { createPaymentVoucher, createRecoveryVoucher, createProducerDuesPaymentVoucher } from '../utils/accountingHelper.js';
import mongoose from 'mongoose';

// ==================== FARMER PAYMENT FUNCTIONS ====================

// Create farmer payment
export const createFarmerPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    paymentData.companyId = req.userCompany;
    paymentData.createdBy = req.user?._id;

    // Calculate total deduction from deductions array (includes advance deductions as separate items)
    const deductionTotal = paymentData.deductions?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

    // Calculate total bonus
    const bonusTotal = paymentData.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
    paymentData.totalBonus = bonusTotal;

    // Calculate gross amount
    paymentData.grossAmount = (paymentData.milkAmount || 0) + bonusTotal;

    // Calculate total deduction (deductions array already contains advance items, no need to add advanceAmount separately)
    paymentData.totalDeduction = deductionTotal + (paymentData.tdsAmount || 0);

    // Calculate net payable = gross amount - total deductions + previous balance (society owes farmer from prior cycles)
    paymentData.netPayable = paymentData.grossAmount - paymentData.totalDeduction + (paymentData.previousBalance || 0);
    paymentData.balanceAmount = paymentData.netPayable - (paymentData.paidAmount || 0);

    // Determine status
    if (paymentData.paidAmount === 0) {
      paymentData.status = 'Pending';
    } else if (paymentData.balanceAmount === 0) {
      paymentData.status = 'Paid';
    } else {
      paymentData.status = 'Partial';
    }

    // Save with retry on duplicate paymentNumber (counter desync)
    let payment;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        delete paymentData.paymentNumber; // force pre-save hook to regenerate each attempt
        payment = new FarmerPayment(paymentData);
        await payment.save();
        break;
      } catch (saveErr) {
        if (saveErr.code === 11000 && saveErr.keyPattern?.paymentNumber && attempt < 3) continue;
        throw saveErr;
      }
    }

    // Auto-reduce advance/loan balances FIFO based on deduction types
    const advanceDeductionTypes = {
      'CF Advance':    'CF Advance',
      'Cash Advance':  'Cash Advance',
      'CF Recovery':   'CF Advance',
      'Cash Recovery': 'Cash Advance',
    };

    const farmerObjId  = new mongoose.Types.ObjectId(paymentData.farmerId);
    const companyObjId = new mongoose.Types.ObjectId(paymentData.companyId);

    for (const deduction of (paymentData.deductions || [])) {
      let remaining = deduction.amount || 0;
      if (remaining <= 0) continue;

      if (advanceDeductionTypes[deduction.type]) {
        const advCategory = advanceDeductionTypes[deduction.type];

        // Reduce Advance records FIFO (oldest first), scoped to this company
        const advances = await Advance.find({
          companyId:       companyObjId,
          farmerId:        farmerObjId,
          advanceCategory: advCategory,
          status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] },
        }).sort({ advanceDate: 1 });

        for (const adv of advances) {
          if (remaining <= 0) break;
          const apply = Math.min(remaining, adv.balanceAmount);
          adv.adjustedAmount = (adv.adjustedAmount || 0) + apply;
          adv.balanceAmount  = adv.balanceAmount - apply;
          adv.status = adv.balanceAmount <= 0 ? 'Adjusted' : 'Partially Adjusted';
          adv.adjustments = adv.adjustments || [];
          adv.adjustments.push({
            date: payment.paymentDate || new Date(),
            amount: apply,
            referenceType: 'Payment',
            referenceId: payment._id,
            paymentNumber: payment.paymentNumber,
            adjustedBy: req.user?._id,
          });
          await adv.save();
          remaining -= apply;
        }

      } else if (deduction.type === 'Loan Advance' || deduction.type === 'Loan Recovery') {
        // Reduce ProducerLoan records FIFO (oldest first), scoped to this company
        const loans = await ProducerLoan.find({
          companyId: companyObjId,
          farmerId:  farmerObjId,
          status:    { $in: ['Active', 'Defaulted'] },
        }).sort({ loanDate: 1 });

        for (const loan of loans) {
          if (remaining <= 0) break;
          const apply = Math.min(remaining, loan.outstandingAmount);
          loan.recoveredAmount  += apply;
          loan.outstandingAmount = loan.totalLoanAmount - loan.recoveredAmount;
          if (loan.outstandingAmount <= 0) {
            loan.status    = 'Closed';
            loan.closedAt  = payment.paymentDate || new Date();
          }
          await loan.save();
          remaining -= apply;
        }

      }
    }

    // Create recovery journal voucher for CF/Cash/Loan recovery deductions (always, even when paidAmount=0)
    try {
      await createRecoveryVoucher(payment);
    } catch (recVoucherErr) {
      console.error('Recovery voucher creation failed:', recVoucherErr);
    }

    // Create accounting voucher for cash/bank payment
    // Auto-post: Dr PRODUCERS DUES / Cr Cash or Bank (Day Book / Cash Book)
    if (paymentData.paidAmount > 0) {
      try {
        const voucher = await createProducerDuesPaymentVoucher({
          amount:        paymentData.paidAmount,
          paymentDate:   payment.paymentDate,
          paymentMode:   payment.paymentMode,
          companyId:     payment.companyId,
          narration:     `Farmer Payment — ${payment.farmerName || ''} ${payment.paymentNumber || ''}`.trim(),
          referenceType: 'FarmerPayment',
          referenceId:   payment._id,
          createdBy:     payment.createdBy,
        });
        if (voucher) {
          payment.voucherId = voucher._id;
          await payment.save();
        }
      } catch (voucherError) {
        console.error('Voucher creation failed:', voucherError);
      }
    }
    // Populate farmer details for response
    await payment.populate('farmerId', 'farmerNumber personalDetails');

    // Auto-create ProducerPayment so net pay appears in /payments/payment-to-producer
    try {
      const farmer = payment.farmerId; // already populated
      const ppData = {
        companyId:         payment.companyId,
        farmerId:          farmer._id || payment.farmerId,
        amountPaid:        payment.netPayable,
        processingPeriod:  {
          fromDate: payment.paymentPeriod?.fromDate || payment.paymentDate,
          toDate:   payment.paymentPeriod?.toDate   || payment.paymentDate,
        },
        paymentDate:          payment.paymentDate,
        isPartialPayment:     payment.status === 'Partial',
        producerNumber:       farmer.farmerNumber || '',
        producerName:         farmer.personalDetails?.name || '',
        paymentMode:          payment.paymentMode || 'Cash',
        lastAbstractBalance:  payment.netPayable,
        remarks:              `Auto — ${payment.paymentNumber || ''}`,
        createdBy:            payment.createdBy,
      };
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const pp = new ProducerPayment(ppData);
          await pp.save();
          break;
        } catch (ppSaveErr) {
          if (ppSaveErr.code === 11000 && ppSaveErr.keyPattern?.paymentNumber && attempt < 3) continue;
          console.warn('ProducerPayment auto-create skipped:', ppSaveErr.message);
          break;
        }
      }
    } catch (ppErr) {
      console.warn('ProducerPayment auto-create skipped:', ppErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating payment'
    });
  } finally {
  }
};

// Get all payments with advanced filtering
export const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      status = '',
      paymentMode = '',
      fromDate = '',
      toDate = '',
      periodFrom = '',
      periodTo = '',
      search = '',
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (req.userCompany) query.companyId = req.userCompany;
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;

    // Filter by payment entry date (used by daily table in /payments/register)
    // setHours on both ends to cover full IST day stored as UTC
    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) {
        const fromStart = new Date(fromDate);
        fromStart.setHours(0, 0, 0, 0);
        query.paymentDate.$gte = fromStart;
      }
      if (toDate) {
        const toEnd = new Date(toDate);
        toEnd.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = toEnd;
      }
    }

    // Filter by milk collection period (used by ledger)
    // Shift ±1 day to handle IST timezone offset (IST midnight stored as UTC 18:30 prev day)
    if (periodFrom) {
      const fromStart = new Date(periodFrom);
      fromStart.setDate(fromStart.getDate() - 1); // cover IST dates stored as UTC prev-day
      query['paymentPeriod.fromDate'] = { $gte: fromStart };
    }
    if (periodTo) {
      const toEnd = new Date(periodTo);
      toEnd.setDate(toEnd.getDate() + 1);
      toEnd.setHours(23, 59, 59, 999);
      query['paymentPeriod.toDate'] = { $lte: toEnd };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const payments = await FarmerPayment.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails bankDetails')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    const total = await FarmerPayment.countDocuments(query);

    // Calculate summary
    const summary = await FarmerPayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMilkAmount: { $sum: '$milkAmount' },
          totalNetPayable: { $sum: '$netPayable' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      summary: summary[0] || { totalMilkAmount: 0, totalNetPayable: 0, totalPaid: 0, totalBalance: 0 },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payments'
    });
  }
};

// Get single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const payment = await FarmerPayment.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('farmerId', 'farmerNumber personalDetails bankDetails contactDetails')
      .populate('advancesAdjusted.advanceId', 'advanceNumber advanceAmount')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('cancelledBy', 'name');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payment'
    });
  }
};

// Get farmer payment history
export const getFarmerPaymentHistory = async (req, res) => {
  try {
    const { fromDate, toDate, status, limit = 50 } = req.query;

    const query = { farmerId: req.params.farmerId };
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const payments = await FarmerPayment.find(query)
      .sort({ paymentDate: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    // Get summary
    const summary = await FarmerPayment.getFarmerPaymentSummary(
      req.params.farmerId,
      fromDate,
      toDate
    );

    res.status(200).json({
      success: true,
      data: payments,
      summary
    });
  } catch (error) {
    console.error('Error fetching farmer payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer payments'
    });
  }
};

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const payment = await FarmerPayment.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === 'Paid' || payment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a paid or cancelled payment'
      });
    }

    const updateData = req.body;

    // Recalculate totals
    if (updateData.paidAmount !== undefined) {
      updateData.balanceAmount = payment.netPayable - updateData.paidAmount;
      if (updateData.balanceAmount === 0) {
        updateData.status = 'Paid';
      } else if (updateData.paidAmount > 0) {
        updateData.status = 'Partial';
      }
    }

    const updatedPayment = await FarmerPayment.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating payment'
    });
  }
};

// Cancel payment
export const deletePayment = async (req, res) => {
  try {
    const payment = await FarmerPayment.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Reverse advance adjustments — find advances that recorded this payment in their adjustments array
    const affectedAdvances = await Advance.find({
      'adjustments.referenceId': payment._id,
    });
    for (const adv of affectedAdvances) {
      const totalReversed = adv.adjustments
        .filter(a => String(a.referenceId) === String(payment._id))
        .reduce((s, a) => s + (a.amount || 0), 0);
      adv.adjustedAmount = Math.max(0, (adv.adjustedAmount || 0) - totalReversed);
      adv.balanceAmount  = (adv.balanceAmount || 0) + totalReversed;
      adv.adjustments    = adv.adjustments.filter(a => String(a.referenceId) !== String(payment._id));
      adv.status = adv.balanceAmount > 0 ? (adv.adjustedAmount > 0 ? 'Partially Adjusted' : 'Active') : 'Adjusted';
      await adv.save();
    }

    // Reverse loan reductions for deductions of type 'Loan Advance'
    for (const deduction of (payment.deductions || [])) {
      if (deduction.type !== 'Loan Advance' || !deduction.amount) continue;
      let remaining = deduction.amount;
      const loans = await ProducerLoan.find({
        farmerId: payment.farmerId,
        status: { $in: ['Active', 'Defaulted', 'Closed'] },
      }).sort({ loanDate: -1 }); // reverse: most recently closed first
      for (const loan of loans) {
        if (remaining <= 0) break;
        const reverseAmt = Math.min(remaining, (loan.recoveredAmount || 0));
        loan.recoveredAmount  -= reverseAmt;
        loan.outstandingAmount = loan.totalLoanAmount - loan.recoveredAmount;
        if (loan.status === 'Closed' && loan.outstandingAmount > 0) {
          loan.status   = 'Active';
          loan.closedAt = undefined;
        }
        await loan.save();
        remaining -= reverseAmt;
      }
    }

    // Remove the auto-posted Day Book / Cash Book voucher
    if (payment.voucherId) {
      try {
        await Voucher.deleteOne({ _id: payment.voucherId });
      } catch (vErr) {
        console.warn('Voucher cleanup skipped on delete:', vErr.message);
      }
    }

    await FarmerPayment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ success: false, message: error.message || 'Error deleting payment' });
  }
};

export const cancelPayment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const payment = await FarmerPayment.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already cancelled'
      });
    }

    // Reverse advance adjustments
    if (payment.advancesAdjusted?.length > 0) {
      for (const adj of payment.advancesAdjusted) {
        await Advance.findByIdAndUpdate(
          adj.advanceId,
          {
            $inc: {
              adjustedAmount: -adj.amount,
              balanceAmount: adj.amount
            },
            $set: { status: 'Active' }
          });
      }
    }

    payment.status = 'Cancelled';
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.user?._id;
    payment.cancellationReason = cancellationReason;

    // Remove the auto-posted Day Book / Cash Book voucher
    if (payment.voucherId) {
      try {
        await Voucher.deleteOne({ _id: payment.voucherId });
      } catch (vErr) {
        console.warn('Voucher cleanup skipped on cancel:', vErr.message);
      }
      payment.voucherId = undefined;
    }

    await payment.save();
    res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling payment'
    });
  } finally {
  }
};

// Get the latest applied payment period's toDate (used by register-ledger to auto-advance to next cycle)
export const getLatestPaymentPeriod = async (req, res) => {
  try {
    const companyId = req.userCompany;
    const result = await FarmerPayment.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          paymentSource: { $in: ['Ledger', 'BankTransfer'] },
          'paymentPeriod.toDate': { $exists: true, $ne: null },
        }
      },
      {
        $group: {
          _id: null,
          latestToDate: { $max: '$paymentPeriod.toDate' },
        }
      }
    ]);
    const latestToDate = result[0]?.latestToDate || null;
    res.json({ success: true, data: { latestToDate } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment statistics
export const getPaymentStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (req.userCompany) query.companyId = req.userCompany;

    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const stats = await FarmerPayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netPayable' },
          paidAmount: { $sum: '$paidAmount' },
          balanceAmount: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const paymentModeStats = await FarmerPayment.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$paymentMode',
          count: { $sum: 1 },
          totalPaid: { $sum: '$paidAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusWise: stats,
        paymentModeWise: paymentModeStats
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payment statistics'
    });
  }
};

// ==================== ADVANCE FUNCTIONS ====================

// Create advance
export const createAdvance = async (req, res) => {
  try {
    const advanceData = req.body;
    advanceData.companyId = req.userCompany;
    advanceData.createdBy = req.user?._id;
    advanceData.balanceAmount = advanceData.advanceAmount;

    // Calculate interest if applicable
    if (advanceData.interestRate > 0) {
      advanceData.interestAmount = (advanceData.advanceAmount * advanceData.interestRate) / 100;
      advanceData.totalDue = advanceData.advanceAmount + advanceData.interestAmount;
      advanceData.balanceAmount = advanceData.totalDue;
    }

    // Check farmer's credit limit
    const farmerOutstanding = await Advance.getFarmerOutstanding(advanceData.farmerId);
    advanceData.availableLimit = (advanceData.farmerCreditLimit || 0) - farmerOutstanding.totalOutstanding;

    const advance = new Advance(advanceData);
    await advance.save();

    // Populate farmer details
    await advance.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Advance created successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error creating advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating advance'
    });
  }
};

// Get all advances with advanced filtering
export const getAllAdvances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      status = '',
      advanceType = '',
      advanceCategory = '',
      search = '',
      fromDate = '',
      toDate = '',
      sortBy = 'advanceDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (req.userCompany) query.companyId = req.userCompany;
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;
    if (advanceType) query.advanceType = advanceType;
    if (advanceCategory) query.advanceCategory = advanceCategory;

    if (fromDate || toDate) {
      query.advanceDate = {};
      if (fromDate) query.advanceDate.$gte = new Date(fromDate);
      if (toDate) query.advanceDate.$lte = new Date(toDate);
    }

    // Search by farmer name or number — lookup Farmer collection first
    if (search) {
      const matchedFarmers = await Farmer.find({
        companyId: req.userCompany,
        $or: [
          { farmerNumber:            { $regex: search, $options: 'i' } },
          { 'personalDetails.name':  { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();
      query.farmerId = { $in: matchedFarmers.map(f => f._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const advances = await Advance.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails address')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    const total = await Advance.countDocuments(query);

    // Calculate summary
    const summary = await Advance.aggregate([
      { $match: { ...query, status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] } } },
      {
        $group: {
          _id: null,
          totalAdvanced: { $sum: '$advanceAmount' },
          totalAdjusted: { $sum: '$adjustedAmount' },
          totalOutstanding: { $sum: '$balanceAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: advances,
      summary: summary[0] || { totalAdvanced: 0, totalAdjusted: 0, totalOutstanding: 0, count: 0 },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advances'
    });
  }
};

// Get single advance by ID
export const getAdvanceById = async (req, res) => {
  try {
    const advance = await Advance.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('farmerId', 'farmerNumber personalDetails bankDetails contactDetails')
      .populate('adjustments.adjustedBy', 'name')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('cancelledBy', 'name');

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    res.status(200).json({
      success: true,
      data: advance
    });
  } catch (error) {
    console.error('Error fetching advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advance'
    });
  }
};

// Get farmer advances
export const getFarmerAdvances = async (req, res) => {
  try {
    const { status = '', includeAdjusted = 'false' } = req.query;

    const query = { farmerId: req.params.farmerId };

    if (status) {
      query.status = status;
    } else if (includeAdjusted === 'false') {
      query.status = { $in: ['Active', 'Partially Adjusted', 'Overdue'] };
    }

    const advances = await Advance.find(query)
      .sort({ advanceDate: -1 })
      .populate('createdBy', 'name');

    // Get total outstanding
    const outstanding = await Advance.getFarmerOutstanding(req.params.farmerId);

    res.status(200).json({
      success: true,
      data: advances,
      outstanding
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advances'
    });
  }
};

// Update advance
export const updateAdvance = async (req, res) => {
  try {
    const advance = await Advance.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status === 'Adjusted' || advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update an adjusted or cancelled advance'
      });
    }

    const updateData = req.body;

    // Don't allow changing amount if adjustments exist
    if (advance.adjustments.length > 0 && updateData.advanceAmount) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change amount after adjustments have been made'
      });
    }

    const updatedAdvance = await Advance.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Advance updated successfully',
      data: updatedAdvance
    });
  } catch (error) {
    console.error('Error updating advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating advance'
    });
  }
};

// Adjust advance
export const adjustAdvance = async (req, res) => {
  try {
    const { adjustmentAmount, referenceType, referenceId, paymentNumber, remarks } = req.body;

    const advance = await Advance.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status === 'Adjusted' || advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Advance is already adjusted or cancelled'
      });
    }

    if (advance.balanceAmount < adjustmentAmount) {
      return res.status(400).json({
        success: false,
        message: `Adjustment amount (${adjustmentAmount}) exceeds balance (${advance.balanceAmount})`
      });
    }

    // Add adjustment entry
    advance.adjustments.push({
      date: new Date(),
      amount: adjustmentAmount,
      referenceType,
      referenceId,
      paymentNumber,
      remarks,
      adjustedBy: req.user?._id
    });

    advance.adjustedAmount += adjustmentAmount;
    advance.balanceAmount -= adjustmentAmount;

    if (advance.balanceAmount === 0) {
      advance.status = 'Adjusted';
    } else {
      advance.status = 'Partially Adjusted';
    }

    await advance.save();

    res.status(200).json({
      success: true,
      message: 'Advance adjusted successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error adjusting advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adjusting advance'
    });
  }
};

// Cancel advance
export const cancelAdvance = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const advance = await Advance.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.adjustments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an advance with adjustments'
      });
    }

    if (advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Advance is already cancelled'
      });
    }

    advance.status = 'Cancelled';
    advance.cancelledAt = new Date();
    advance.cancelledBy = req.user?._id;
    advance.cancellationReason = cancellationReason;
    await advance.save();

    res.status(200).json({
      success: true,
      message: 'Advance cancelled successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error cancelling advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling advance'
    });
  }
};

// Get advance statistics
export const getAdvanceStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (req.userCompany) query.companyId = req.userCompany;

    if (fromDate || toDate) {
      query.advanceDate = {};
      if (fromDate) query.advanceDate.$gte = new Date(fromDate);
      if (toDate) query.advanceDate.$lte = new Date(toDate);
    }

    const stats = await Advance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$advanceAmount' },
          adjustedAmount: { $sum: '$adjustedAmount' },
          balanceAmount: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const typeStats = await Advance.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$advanceType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$advanceAmount' },
          outstanding: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusWise: stats,
        typeWise: typeStats
      }
    });
  } catch (error) {
    console.error('Error fetching advance stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advance statistics'
    });
  }
};

// Bulk create payments (for batch processing)
export const bulkCreatePayments = async (req, res) => {
  try {
    const { payments } = req.body;
    const results = [];
    const errors = [];

    for (const paymentData of payments) {
      try {
        paymentData.companyId = req.userCompany;
        paymentData.createdBy = req.user?._id;

        const payment = new FarmerPayment(paymentData);
        await payment.save();
        results.push({ success: true, data: payment });
      } catch (err) {
        errors.push({ farmerId: paymentData.farmerId, error: err.message });
      }
    }

    if (errors.length === 0) {
      res.status(201).json({
        success: true,
        message: `${results.length} payments created successfully`,
        data: results
      });
    } else if (results.length > 0) {
      res.status(207).json({
        success: true,
        message: `${results.length} payments created, ${errors.length} failed`,
        data: results,
        errors
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'All payments failed',
        errors
      });
    }
  } catch (error) {
    console.error('Error in bulk payment creation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating payments'
    });
  } finally {
  }
};

// ─── Cash Advance Summary (producer-wise report) ─────────────────────────────
export const getCashAdvanceSummary = async (req, res) => {
  try {
    const { fromDate, toDate, farmerId } = req.query;
    const companyId = req.userCompany;
    const cObjId    = new mongoose.Types.ObjectId(companyId);
    const r2 = (v) => Math.round((v || 0) * 100) / 100;

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    const farmerObjId = farmerId ? new mongoose.Types.ObjectId(farmerId) : null;

    // 1. Opening balances from ProducerOpening (cashAdvance field)
    const openingFilter = { companyId: cObjId };
    if (farmerObjId) openingFilter.farmerId = farmerObjId;
    const openings = await ProducerOpening.find(openingFilter)
      .populate('farmerId', 'farmerNumber personalDetails')
      .lean();

    // 2. Advances given in period (Cash Advance category)
    const advMatchStage = {
      companyId:       cObjId,
      advanceCategory: 'Cash Advance',
      advanceDate:     { $gte: start, $lte: end },
      status:          { $ne: 'Cancelled' },
    };
    if (farmerObjId) advMatchStage.farmerId = farmerObjId;

    const advancesAgg = await Advance.aggregate([
      { $match: advMatchStage },
      { $group: { _id: '$farmerId', totalAdvanced: { $sum: '$advanceAmount' } } },
    ]);
    const advancedMap = {};
    advancesAgg.forEach(a => { advancedMap[a._id?.toString()] = r2(a.totalAdvanced); });

    // 3. Recovery in period from FarmerPayment deductions (type = 'Cash Advance' or 'Cash Recovery')
    const pmtMatchStage = {
      companyId:         cObjId,
      paymentDate:       { $gte: start, $lte: end },
      status:            { $ne: 'Cancelled' },
      'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] },
    };
    if (farmerObjId) pmtMatchStage.farmerId = farmerObjId;

    const recoveryAgg = await FarmerPayment.aggregate([
      { $match: pmtMatchStage },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] } } },
      { $group: { _id: '$farmerId', totalRecovery: { $sum: '$deductions.amount' } } },
    ]);
    const recoveryMap = {};
    recoveryAgg.forEach(r => { recoveryMap[r._id?.toString()] = r2(r.totalRecovery); });

    // 4. Build rows from openings
    const rows = openings
      .filter(o => o.farmerId)
      .map((o, i) => {
        const fid      = o.farmerId._id?.toString() || o.farmerId?.toString();
        const opening  = r2(o.cashAdvance || 0);
        const advanced = r2(advancedMap[fid] || 0);
        const recovery = r2(recoveryMap[fid] || 0);
        const balance  = r2(opening + advanced - recovery);
        const farmer   = typeof o.farmerId === 'object' ? o.farmerId : {};
        return {
          slNo:         i + 1,
          farmerId:     fid,
          farmerNumber: farmer.farmerNumber || o.producerNumber || '',
          farmerName:   farmer.personalDetails?.name || o.producerName || '',
          opening,
          advanced,
          recovery,
          balance,
        };
      })
      .filter(r => r.opening !== 0 || r.advanced !== 0 || r.recovery !== 0);

    // 5. Include farmers with advances but no opening record
    const openingFarmerIds = new Set(rows.map(r => r.farmerId));
    for (const [fid, advAmt] of Object.entries(advancedMap)) {
      if (openingFarmerIds.has(fid)) continue;
      const farmer = await Farmer.findById(fid).select('farmerNumber personalDetails').lean();
      if (!farmer) continue;
      const recovery = r2(recoveryMap[fid] || 0);
      rows.push({
        slNo:         rows.length + 1,
        farmerId:     fid,
        farmerNumber: farmer.farmerNumber || '',
        farmerName:   farmer.personalDetails?.name || '',
        opening:      0,
        advanced:     advAmt,
        recovery,
        balance:      r2(advAmt - recovery),
      });
    }

    rows.forEach((r, i) => { r.slNo = i + 1; });

    const grandTotals = {
      opening:  r2(rows.reduce((s, r) => s + r.opening,  0)),
      advanced: r2(rows.reduce((s, r) => s + r.advanced, 0)),
      recovery: r2(rows.reduce((s, r) => s + r.recovery, 0)),
      balance:  r2(rows.reduce((s, r) => s + r.balance,  0)),
    };

    res.json({ success: true, data: { rows, grandTotals } });
  } catch (err) {
    console.error('getCashAdvanceSummary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  // Payment functions
  createFarmerPayment,
  getAllPayments,
  getPaymentById,
  getFarmerPaymentHistory,
  updatePayment,
  cancelPayment,
  getPaymentStats,
  bulkCreatePayments,
  // Advance functions
  createAdvance,
  getAllAdvances,
  getAdvanceById,
  getFarmerAdvances,
  updateAdvance,
  adjustAdvance,
  cancelAdvance,
  getAdvanceStats,
  getCashAdvanceSummary
};

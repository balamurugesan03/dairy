import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerLoan from '../models/ProducerLoan.js';
import ProducerOpening from '../models/ProducerOpening.js';
import ProducerPayment from '../models/ProducerPayment.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import { createPaymentVoucher, createRecoveryVoucher, createProducerDuesPaymentVoucher } from '../utils/accountingHelper.js';
import { saveWithUniqueNumber } from '../models/Counter.js';
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

    // Save with retry + counter resync on duplicate paymentNumber
    delete paymentData.paymentNumber;
    const payment = await saveWithUniqueNumber({
      Model:       FarmerPayment,
      companyId:   paymentData.companyId,
      prefix:      'PAY',
      numberField: 'paymentNumber',
      build: () => new FarmerPayment({ ...paymentData, paymentNumber: undefined }),
    });

    // Split deduction handling into ADVANCE (new disbursement → create record)
    // vs RECOVERY (reduce existing balances FIFO).
    //   • 'CF Advance' / 'Cash Advance'  → new Advance row in the CF / Cash
    //     module so it shows up immediately as outstanding for the farmer.
    //   • 'Loan Advance'                 → new ProducerLoan row in the Loans
    //     module.
    //   • 'CF Recovery' / 'Cash Recovery' → reduce existing Advance balances.
    //   • 'Loan Recovery'                → reduce existing ProducerLoan.
    const recoveryDeductionTypes = {
      'CF Recovery':   'CF Advance',
      'Cash Recovery': 'Cash Advance',
    };

    const farmerObjId  = new mongoose.Types.ObjectId(paymentData.farmerId);
    const companyObjId = new mongoose.Types.ObjectId(paymentData.companyId);

    // Track leftover recovery per opening-balance bucket. After FIFO over real
    // Advance / ProducerLoan records, anything still owed comes off the
    // ProducerOpening row — that's how the Cash / Loan / CF modules see the
    // recovery for farmers whose advances exist only as opening balances.
    let leftoverCF   = 0;
    let leftoverCash = 0;
    let leftoverLoan = 0;

    for (const deduction of (paymentData.deductions || [])) {
      const amount = deduction.amount || 0;
      if (amount <= 0) continue;

      // ── New CF / Cash advance disbursed during cycle → create Advance row ─
      if (deduction.type === 'CF Advance' || deduction.type === 'Cash Advance') {
        try {
          const adv = new Advance({
            companyId:       companyObjId,
            farmerId:        farmerObjId,
            advanceDate:     payment.paymentDate || new Date(),
            advanceCategory: deduction.type,
            advanceAmount:   amount,
            balanceAmount:   amount,
            paymentMode:     'Cash',
            remarks: `From Payment ${payment.paymentNumber || ''}${deduction.description ? ' — ' + deduction.description : ''}`.trim(),
            createdBy:       req.user?._id,
          });
          await adv.save();
        } catch (advErr) {
          console.warn(`Advance create skipped (${deduction.type}):`, advErr.message);
        }
        continue;
      }

      // ── New loan disbursed during cycle → create ProducerLoan row ────────
      if (deduction.type === 'Loan Advance') {
        try {
          const loan = new ProducerLoan({
            companyId:         companyObjId,
            farmerId:          farmerObjId,
            loanDate:          payment.paymentDate || new Date(),
            loanType:          'Loan Advance',
            principalAmount:   amount,
            interestAmount:    0,
            totalLoanAmount:   amount,
            recoveredAmount:   0,
            outstandingAmount: amount,
            remarks: `From Payment ${payment.paymentNumber || ''}${deduction.description ? ' — ' + deduction.description : ''}`.trim(),
            createdBy:         req.user?._id,
          });
          await loan.save();
        } catch (loanErr) {
          console.warn('ProducerLoan create skipped:', loanErr.message);
        }
        continue;
      }

      // ── CF / Cash recovery → reduce existing Advance FIFO ────────────────
      if (recoveryDeductionTypes[deduction.type]) {
        const advCategory = recoveryDeductionTypes[deduction.type];
        let remaining = amount;
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

        if (remaining > 0) {
          if (advCategory === 'CF Advance')   leftoverCF   += remaining;
          if (advCategory === 'Cash Advance') leftoverCash += remaining;
        }
        continue;
      }

      // ── Loan recovery → reduce existing ProducerLoan FIFO ────────────────
      if (deduction.type === 'Loan Recovery') {
        let remaining = amount;
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

        if (remaining > 0) leftoverLoan += remaining;
      }
    }

    // ProducerOpening is intentionally NOT mutated here. The opening balance
    // entered on /daily-collections/producer-openings is the immutable starting
    // point; recoveries surface on the advance summary pages
    // (/payments/cash-advance, /payments/cattle-feed-advance, /payments/loans)
    // because those pages compute closing balance as
    //   opening + advanced − recovery
    // where `recovery` is aggregated from FarmerPayment.deductions of type
    // 'Cash Recovery' / 'CF Recovery' / 'Loan Recovery'. Reducing the opening
    // here would cause double-counting on those summaries.
    void leftoverCF; void leftoverCash; void leftoverLoan;

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

    // Auto-create ProducerPayment ONLY when the payment was actually paid out
    // (cash/cheque, paidAmount > 0). Pending Bank-Transfer rows must not mirror
    // here, otherwise retrieveBalances treats the farmer as already-paid and
    // hides them from the Bank Transfer queue.
    if ((paymentData.paidAmount || 0) > 0) {
      try {
        const farmer = payment.farmerId; // already populated
        const ppData = {
          companyId:         payment.companyId,
          farmerId:          farmer._id || payment.farmerId,
          amountPaid:        payment.paidAmount,
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
        try {
          await saveWithUniqueNumber({
            Model:       ProducerPayment,
            companyId:   payment.companyId,
            prefix:      'PTP',
            numberField: 'paymentNumber',
            build:       () => new ProducerPayment(ppData),
          });
        } catch (ppSaveErr) {
          console.warn('ProducerPayment auto-create skipped:', ppSaveErr.message);
        }
      } catch (ppErr) {
        console.warn('ProducerPayment auto-create skipped:', ppErr.message);
      }
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

// Reverse every side-effect of a saved FarmerPayment so the farmer's CF / Cash
// / Loan ledgers, Day Book vouchers, and ProducerPayment row all return to
// their pre-save state. ProducerOpening is intentionally NEVER mutated —
// createFarmerPayment doesn't touch it (the advance summary pages compute
// closing as opening + advanced − recovery and recoveries are sourced from
// FarmerPayment.deductions), so neither should the reverse.
//
// Reverses, in order:
//   1. Advance recovery FIFO — restore balances on Advance rows we adjusted.
//   2. ProducerLoan recovery FIFO — restore loan outstanding & status.
//   3. Auto-created Advance rows (CF/Cash advances disbursed by this payment).
//   4. Auto-created ProducerLoan rows (Loan Advances disbursed by this payment).
//   5. Auto-posted Vouchers (recovery journal + producers-dues payment).
//   6. Auto-created ProducerPayment row (the /payment-to-producer mirror).
export const purgeFarmerPaymentSideEffects = async (payment) => {
  // 1. Reverse Advance adjustments that referenced this payment
  const affectedAdvances = await Advance.find({ 'adjustments.referenceId': payment._id });
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

  // 2. Reverse ProducerLoan recoveries for Loan Advance / Loan Recovery deductions
  for (const deduction of (payment.deductions || [])) {
    if (!['Loan Advance', 'Loan Recovery'].includes(deduction.type) || !deduction.amount) continue;
    let remaining = deduction.amount;
    const loans = await ProducerLoan.find({
      farmerId: payment.farmerId,
      status: { $in: ['Active', 'Defaulted', 'Closed'] },
    }).sort({ loanDate: -1 });
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

  // 3 & 4. Delete Advance / ProducerLoan rows AUTO-CREATED by this payment.
  // createFarmerPayment stamps `remarks: \`From Payment <paymentNumber>...\``
  // on every advance/loan it disburses, so we can remove them by remarks match.
  if (payment.paymentNumber) {
    const remarksRe = new RegExp(`^From Payment ${payment.paymentNumber}\\b`);
    try { await Advance.deleteMany({ companyId: payment.companyId, farmerId: payment.farmerId, remarks: remarksRe }); }
    catch (e) { console.warn('Advance auto-create cleanup skipped:', e.message); }
    try { await ProducerLoan.deleteMany({ companyId: payment.companyId, farmerId: payment.farmerId, remarks: remarksRe }); }
    catch (e) { console.warn('ProducerLoan auto-create cleanup skipped:', e.message); }
  }

  // 5. Delete every Voucher tied to this FarmerPayment (recovery journal +
  // producers-dues payment + any future ones — all use referenceType=FarmerPayment).
  try {
    await Voucher.deleteMany({ referenceType: 'FarmerPayment', referenceId: payment._id });
  } catch (vErr) {
    console.warn('Voucher cleanup skipped:', vErr.message);
    // Fallback: at least clean up the directly-referenced voucher
    if (payment.voucherId) {
      try { await Voucher.deleteOne({ _id: payment.voucherId }); } catch {}
    }
  }

  // 6. Delete the auto-mirrored ProducerPayment (`Auto — <paymentNumber>` remarks)
  if (payment.paymentNumber) {
    try {
      await ProducerPayment.deleteMany({
        companyId: payment.companyId,
        farmerId:  payment.farmerId,
        remarks:   new RegExp(`^Auto — ${payment.paymentNumber}\\b`),
      });
    } catch (ppErr) {
      console.warn('ProducerPayment auto-create cleanup skipped:', ppErr.message);
    }
  }
};

// Cancel payment
export const deletePayment = async (req, res) => {
  try {
    const payment = await FarmerPayment.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    await purgeFarmerPaymentSideEffects(payment);
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
        delete paymentData.paymentNumber;

        const payment = await saveWithUniqueNumber({
          Model:       FarmerPayment,
          companyId:   paymentData.companyId,
          prefix:      'PAY',
          numberField: 'paymentNumber',
          build: () => new FarmerPayment({ ...paymentData, paymentNumber: undefined }),
        });
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

    // Each row shows the [start,end] period activity, with the Opening column =
    // ProducerOpening.cashAdvance + (advances given before start) − (recoveries
    // before start). Previous month's closing carries into next month's opening.
    // 4 bulk aggregations (2 prior + 2 in-period) — no per-farmer N+1.

    const cashDedTypes = ['Cash Advance', 'Cash Recovery'];

    // ── Period (current) totals ─────────────────────────────────────────────
    // 2a. Advances given in [start, end]
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

    // 3a. Recovery whose CYCLE ends in [start, end]
    const pmtMatchStage = {
      companyId:         cObjId,
      status:            { $ne: 'Cancelled' },
      'deductions.type': { $in: cashDedTypes },
      $or: [
        { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
        { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
        { 'paymentPeriod.toDate': null,                paymentDate: { $gte: start, $lte: end } },
      ],
    };
    if (farmerObjId) pmtMatchStage.farmerId = farmerObjId;

    const recoveryAgg = await FarmerPayment.aggregate([
      { $match: pmtMatchStage },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: cashDedTypes } } },
      { $group: { _id: '$farmerId', totalRecovery: { $sum: '$deductions.amount' } } },
    ]);
    const recoveryMap = {};
    recoveryAgg.forEach(r => { recoveryMap[r._id?.toString()] = r2(r.totalRecovery); });

    // ── Prior totals (everything BEFORE start) for opening-carry computation ─
    // 2b. Prior advances given before start
    const priorAdvMatch = {
      companyId:       cObjId,
      advanceCategory: 'Cash Advance',
      advanceDate:     { $lt: start },
      status:          { $ne: 'Cancelled' },
    };
    if (farmerObjId) priorAdvMatch.farmerId = farmerObjId;

    const priorAdvAgg = await Advance.aggregate([
      { $match: priorAdvMatch },
      { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } },
    ]);
    const priorAdvancedMap = {};
    priorAdvAgg.forEach(a => { priorAdvancedMap[a._id?.toString()] = r2(a.total); });

    // 3b. Prior recovery whose CYCLE ended before start
    const priorPmtMatch = {
      companyId:         cObjId,
      status:            { $ne: 'Cancelled' },
      'deductions.type': { $in: cashDedTypes },
      $or: [
        { 'paymentPeriod.toDate': { $lt: start } },
        { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
        { 'paymentPeriod.toDate': null,                paymentDate: { $lt: start } },
      ],
    };
    if (farmerObjId) priorPmtMatch.farmerId = farmerObjId;

    const priorRecoveryAgg = await FarmerPayment.aggregate([
      { $match: priorPmtMatch },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: cashDedTypes } } },
      { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } },
    ]);
    const priorRecoveryMap = {};
    priorRecoveryAgg.forEach(r => { priorRecoveryMap[r._id?.toString()] = r2(r.total); });

    // 4. Build rows from openings
    const computeOpening = (fid, baseOpening) => {
      const prevAdv = priorAdvancedMap[fid] || 0;
      const prevRec = priorRecoveryMap[fid] || 0;
      return r2(baseOpening + prevAdv - prevRec);
    };

    const rows = openings
      .filter(o => o.farmerId)
      .map((o, i) => {
        const fid      = o.farmerId._id?.toString() || o.farmerId?.toString();
        const opening  = computeOpening(fid, r2(o.cashAdvance || 0));
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
      const opening  = computeOpening(fid, 0);
      const recovery = r2(recoveryMap[fid] || 0);
      rows.push({
        slNo:         rows.length + 1,
        farmerId:     fid,
        farmerNumber: farmer.farmerNumber || '',
        farmerName:   farmer.personalDetails?.name || '',
        opening,
        advanced:     advAmt,
        recovery,
        balance:      r2(opening + advAmt - recovery),
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

// ─── GET Cash Advance Ledger (single farmer) ─────────────────────────────────
// Same shape as getLoanAdvanceLedger / getCFAdvanceLedger. Opening carries from
// before `start`. Period entries are cash disbursals (Advance category
// 'Cash Advance', credits) and cash recoveries (FarmerPayment deductions of
// type 'Cash Advance' / 'Cash Recovery', debits).
export const getCashAdvanceLedger = async (req, res) => {
  try {
    const { farmerId, fromDate, toDate } = req.query;
    const companyId = req.userCompany;
    if (!farmerId) {
      return res.status(400).json({ success: false, message: 'farmerId is required' });
    }

    const cObjId = new mongoose.Types.ObjectId(companyId);
    const fObjId = new mongoose.Types.ObjectId(farmerId);
    const r2 = (v) => Math.round((v || 0) * 100) / 100;

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    const opening = await ProducerOpening.findOne({ companyId: cObjId, farmerId: fObjId }).lean();
    const baseOpening = r2(opening?.cashAdvance || 0);

    const cashDedTypes = ['Cash Advance', 'Cash Recovery'];

    const buildEntries = async (s, e) => {
      const entries = [];

      const advs = await Advance.find({
        companyId:       cObjId,
        farmerId:        fObjId,
        advanceCategory: 'Cash Advance',
        advanceDate:     { $gte: s, $lte: e },
        status:          { $ne: 'Cancelled' },
      }).lean();
      for (const a of advs) {
        entries.push({
          date:        a.advanceDate,
          type:        'ADVANCE',
          refNo:       a.advanceNumber || '',
          description: `Cash Advance${a.purpose ? ' — ' + a.purpose : ''}`,
          debit:       0,
          credit:      r2(a.advanceAmount || 0),
        });
      }

      const pmts = await FarmerPayment.find({
        companyId:         cObjId,
        farmerId:          fObjId,
        status:            { $ne: 'Cancelled' },
        'deductions.type': { $in: cashDedTypes },
        paymentDate:       { $gte: s, $lte: e },
      }).lean();
      for (const p of pmts) {
        for (const d of (p.deductions || [])) {
          if (!cashDedTypes.includes(d.type) || !d.amount) continue;
          entries.push({
            date:        p.paymentDate,
            type:        'RECOVERY',
            refNo:       p.paymentNumber,
            description: `Cash Recovery — ${d.description || d.type}`,
            debit:       r2(d.amount),
            credit:      0,
          });
        }
      }

      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      return entries;
    };

    const priorEntries = await buildEntries(new Date('2000-01-01'), new Date(start.getTime() - 1));
    const priorCredit  = r2(priorEntries.reduce((s, e) => s + e.credit, 0));
    const priorDebit   = r2(priorEntries.reduce((s, e) => s + e.debit,  0));
    const effectiveOpening = r2(baseOpening + priorCredit - priorDebit);

    const entries = await buildEntries(start, end);

    let balance = effectiveOpening;
    const ledgerRows = entries.map(e => {
      balance = r2(balance + e.credit - e.debit);
      return { ...e, balance };
    });

    const totalCredit = r2(entries.reduce((s, e) => s + e.credit, 0));
    const totalDebit  = r2(entries.reduce((s, e) => s + e.debit,  0));
    const closingBalance = r2(effectiveOpening + totalCredit - totalDebit);

    res.json({
      success: true,
      data: {
        openingBalance: effectiveOpening,
        entries:        ledgerRows,
        totalDebit,
        totalCredit,
        closingBalance,
      },
    });
  } catch (err) {
    console.error('getCashAdvanceLedger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Loan Advance Ledger (single farmer) ─────────────────────────────────
// Mirrors getCFAdvanceLedger: opening = baseOpening + (advances disbursed before
// start) − (recoveries before start). Period entries are loan disbursals
// (Advance category 'Loan Advance') as DEBITS and Loan Recoveries from
// FarmerPayment / loan-only ProducerLoan EMIs as CREDITS. Wait — loans are an
// "owed to society" balance, so disbursals INCREASE outstanding (debit-style)
// and recoveries DECREASE it. We use advanced/recovery columns directly.
export const getLoanAdvanceLedger = async (req, res) => {
  try {
    const { farmerId, fromDate, toDate } = req.query;
    const companyId = req.userCompany;
    if (!farmerId) {
      return res.status(400).json({ success: false, message: 'farmerId is required' });
    }

    const cObjId = new mongoose.Types.ObjectId(companyId);
    const fObjId = new mongoose.Types.ObjectId(farmerId);
    const r2 = (v) => Math.round((v || 0) * 100) / 100;

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    const opening = await ProducerOpening.findOne({ companyId: cObjId, farmerId: fObjId }).lean();
    const baseOpening = r2(opening?.loanAdvance || 0);

    const loanDedTypes = ['Loan Advance', 'Loan Recovery', 'Loan EMI'];

    const buildEntries = async (s, e) => {
      const entries = [];

      // Loan disbursals → CREDIT (increases outstanding)
      const advs = await Advance.find({
        companyId:       cObjId,
        farmerId:        fObjId,
        advanceCategory: 'Loan Advance',
        advanceDate:     { $gte: s, $lte: e },
        status:          { $ne: 'Cancelled' },
      }).lean();
      for (const a of advs) {
        entries.push({
          date:        a.advanceDate,
          type:        'ADVANCE',
          refNo:       a.advanceNumber || '',
          description: `Loan Disbursement${a.purpose ? ' — ' + a.purpose : ''}`,
          debit:       0,
          credit:      r2(a.advanceAmount || 0),
        });
      }

      // Loan recoveries (FarmerPayment deductions) → DEBIT (reduces outstanding)
      const pmts = await FarmerPayment.find({
        companyId:         cObjId,
        farmerId:          fObjId,
        status:            { $ne: 'Cancelled' },
        'deductions.type': { $in: loanDedTypes },
        paymentDate:       { $gte: s, $lte: e },
      }).lean();
      for (const p of pmts) {
        for (const d of (p.deductions || [])) {
          if (!loanDedTypes.includes(d.type) || !d.amount) continue;
          entries.push({
            date:        p.paymentDate,
            type:        'RECOVERY',
            refNo:       p.paymentNumber,
            description: `Loan Recovery — ${d.description || d.type}`,
            debit:       r2(d.amount),
            credit:      0,
          });
        }
      }

      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      return entries;
    };

    // Carry from before `start`: lifetimeOpening + priorCredit (disbursals) − priorDebit (recoveries)
    const priorEntries = await buildEntries(new Date('2000-01-01'), new Date(start.getTime() - 1));
    const priorCredit  = r2(priorEntries.reduce((s, e) => s + e.credit, 0));
    const priorDebit   = r2(priorEntries.reduce((s, e) => s + e.debit,  0));
    const effectiveOpening = r2(baseOpening + priorCredit - priorDebit);

    const entries = await buildEntries(start, end);

    let balance = effectiveOpening;
    const ledgerRows = entries.map(e => {
      balance = r2(balance + e.credit - e.debit);
      return { ...e, balance };
    });

    const totalCredit = r2(entries.reduce((s, e) => s + e.credit, 0));
    const totalDebit  = r2(entries.reduce((s, e) => s + e.debit,  0));
    const closingBalance = r2(effectiveOpening + totalCredit - totalDebit);

    res.json({
      success: true,
      data: {
        openingBalance: effectiveOpening,
        entries:        ledgerRows,
        totalDebit,
        totalCredit,
        closingBalance,
      },
    });
  } catch (err) {
    console.error('getLoanAdvanceLedger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Loan Advance Summary ─────────────────────────────────────────────────
// Same shape and carry-forward semantics as getCashAdvanceSummary, scoped to
// the 'Loan Advance' advance category and 'Loan Advance' / 'Loan Recovery'
// deduction types. Opening = ProducerOpening.loanAdvance + (advances disbursed
// before start) − (recoveries before start). Period columns show in-window
// activity. Six bulk aggregations, no per-farmer N+1.
export const getLoanAdvanceSummary = async (req, res) => {
  try {
    const { fromDate, toDate, farmerId } = req.query;
    const companyId = req.userCompany;
    const cObjId    = new mongoose.Types.ObjectId(companyId);
    const r2 = (v) => Math.round((v || 0) * 100) / 100;

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    const farmerObjId = farmerId ? new mongoose.Types.ObjectId(farmerId) : null;

    // 1. Opening balances from ProducerOpening (loanAdvance field)
    const openingFilter = { companyId: cObjId };
    if (farmerObjId) openingFilter.farmerId = farmerObjId;
    const openings = await ProducerOpening.find(openingFilter)
      .populate('farmerId', 'farmerNumber personalDetails')
      .lean();

    const loanDedTypes = ['Loan Advance', 'Loan Recovery', 'Loan EMI'];

    // ── Period (current) totals ─────────────────────────────────────────────
    // 2a. Loan Advances disbursed in [start, end]
    const advMatchStage = {
      companyId:       cObjId,
      advanceCategory: 'Loan Advance',
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

    // 3a. Recovery whose CYCLE ends in [start, end]
    const pmtMatchStage = {
      companyId:         cObjId,
      status:            { $ne: 'Cancelled' },
      'deductions.type': { $in: loanDedTypes },
      $or: [
        { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
        { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
        { 'paymentPeriod.toDate': null,                paymentDate: { $gte: start, $lte: end } },
      ],
    };
    if (farmerObjId) pmtMatchStage.farmerId = farmerObjId;

    const recoveryAgg = await FarmerPayment.aggregate([
      { $match: pmtMatchStage },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: loanDedTypes } } },
      { $group: { _id: '$farmerId', totalRecovery: { $sum: '$deductions.amount' } } },
    ]);
    const recoveryMap = {};
    recoveryAgg.forEach(r => { recoveryMap[r._id?.toString()] = r2(r.totalRecovery); });

    // ── Prior totals (everything BEFORE start) for opening-carry ────────────
    // 2b. Prior loan advances disbursed before start
    const priorAdvMatch = {
      companyId:       cObjId,
      advanceCategory: 'Loan Advance',
      advanceDate:     { $lt: start },
      status:          { $ne: 'Cancelled' },
    };
    if (farmerObjId) priorAdvMatch.farmerId = farmerObjId;

    const priorAdvAgg = await Advance.aggregate([
      { $match: priorAdvMatch },
      { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } },
    ]);
    const priorAdvancedMap = {};
    priorAdvAgg.forEach(a => { priorAdvancedMap[a._id?.toString()] = r2(a.total); });

    // 3b. Prior recoveries whose CYCLE ended before start
    const priorPmtMatch = {
      companyId:         cObjId,
      status:            { $ne: 'Cancelled' },
      'deductions.type': { $in: loanDedTypes },
      $or: [
        { 'paymentPeriod.toDate': { $lt: start } },
        { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
        { 'paymentPeriod.toDate': null,                paymentDate: { $lt: start } },
      ],
    };
    if (farmerObjId) priorPmtMatch.farmerId = farmerObjId;

    const priorRecoveryAgg = await FarmerPayment.aggregate([
      { $match: priorPmtMatch },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: loanDedTypes } } },
      { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } },
    ]);
    const priorRecoveryMap = {};
    priorRecoveryAgg.forEach(r => { priorRecoveryMap[r._id?.toString()] = r2(r.total); });

    // 4. Build rows from openings
    const computeOpening = (fid, baseOpening) => {
      const prevAdv = priorAdvancedMap[fid] || 0;
      const prevRec = priorRecoveryMap[fid] || 0;
      return r2(baseOpening + prevAdv - prevRec);
    };

    const rows = openings
      .filter(o => o.farmerId)
      .map((o, i) => {
        const fid      = o.farmerId._id?.toString() || o.farmerId?.toString();
        const opening  = computeOpening(fid, r2(o.loanAdvance || 0));
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

    // 5. Include farmers with loan advances but no opening record
    const openingFarmerIds = new Set(rows.map(r => r.farmerId));
    for (const [fid, advAmt] of Object.entries(advancedMap)) {
      if (openingFarmerIds.has(fid)) continue;
      const farmer = await Farmer.findById(fid).select('farmerNumber personalDetails').lean();
      if (!farmer) continue;
      const opening  = computeOpening(fid, 0);
      const recovery = r2(recoveryMap[fid] || 0);
      rows.push({
        slNo:         rows.length + 1,
        farmerId:     fid,
        farmerNumber: farmer.farmerNumber || '',
        farmerName:   farmer.personalDetails?.name || '',
        opening,
        advanced:     advAmt,
        recovery,
        balance:      r2(opening + advAmt - recovery),
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
    console.error('getLoanAdvanceSummary error:', err);
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
  getCashAdvanceSummary,
  getLoanAdvanceSummary,
  getLoanAdvanceLedger,
  getCashAdvanceLedger,
};

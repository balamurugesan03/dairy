import mongoose from 'mongoose';
import ProducerPayment from '../models/ProducerPayment.js';
import Farmer from '../models/Farmer.js';
import FarmerPayment from '../models/FarmerPayment.js';
import BankTransfer from '../models/BankTransfer.js';
import PaymentRegister from '../models/PaymentRegister.js';
import Voucher from '../models/Voucher.js';
import { saveWithUniqueNumber } from '../models/Counter.js';
import { createProducerDuesPaymentVoucher } from '../utils/accountingHelper.js';

function fmtDateDMY(d) {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// ±2-day window to handle timezone differences when comparing stored dates
function cycleDateRange(dateStr) {
  const mid = new Date(dateStr);
  return {
    $gte: new Date(mid.getTime() - 2 * 24 * 60 * 60 * 1000),
    $lt:  new Date(mid.getTime() + 2 * 24 * 60 * 60 * 1000),
  };
}

// ─── Get Payment Cycles ────────────────────────────────────────────────────────
// Returns distinct from/to date pairs from saved PaymentRegisters (Producers/Ledger)
export const getCycles = async (req, res) => {
  try {
    const companyId = new mongoose.Types.ObjectId(req.userCompany);

    const registers = await PaymentRegister.find({
      companyId,
      registerType: { $in: ['Producers', 'Ledger'] },
      status: { $in: ['Saved', 'Printed'] },
    })
      .select('fromDate toDate')
      .sort({ toDate: -1 })
      .lean();

    const seen = new Set();
    const cycles = [];
    for (const r of registers) {
      const key = `${new Date(r.fromDate).toISOString().slice(0,10)}|${new Date(r.toDate).toISOString().slice(0,10)}`;
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push({ fromDate: r.fromDate, toDate: r.toDate, label: `${fmtDateDMY(r.fromDate)} – ${fmtDateDMY(r.toDate)}` });
      }
    }

    res.json({ success: true, data: cycles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Pending Farmers in a Saved Cycle ─────────────────────────────────────
// Returns the saved PaymentRegister's farmer list for the cycle, minus any
// farmer already paid via cash (ProducerPayment) or bank transfer
// (FarmerPayment with paymentSource=BankTransfer + status=Paid). Lets the
// Payment to Producer screen show the same farmer set as Bank Transfer.
export const getCyclePendingFarmers = async (req, res) => {
  try {
    const { cycleFromDate, cycleToDate } = req.query;
    const companyId = new mongoose.Types.ObjectId(req.userCompany);

    if (!cycleFromDate || !cycleToDate) return res.json({ success: true, data: [] });

    const dayMs = 24 * 60 * 60 * 1000;
    const fromMid = new Date(cycleFromDate);
    const toMid   = new Date(cycleToDate);
    const range = (mid) => ({
      $gte: new Date(mid.getTime() - 2 * dayMs),
      $lte: new Date(mid.getTime() + 2 * dayMs),
    });

    const register = await PaymentRegister.findOne({
      companyId,
      registerType: { $in: ['Ledger', 'Producers'] },
      fromDate:     range(fromMid),
      toDate:       range(toMid),
      status:       { $in: ['Saved', 'Printed'] },
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!register?.entries?.length) return res.json({ success: true, data: [] });

    // Build the "already paid" set
    const alreadyPaid = new Set();

    const cashPaid = await ProducerPayment.find({
      companyId,
      'processingPeriod.fromDate': range(fromMid),
      'processingPeriod.toDate':   range(toMid),
    }).select('farmerId').lean();
    cashPaid.forEach(p => p.farmerId && alreadyPaid.add(p.farmerId.toString()));

    const bankPaid = await FarmerPayment.find({
      companyId,
      paymentSource: 'BankTransfer',
      status:        'Paid',
      'paymentPeriod.fromDate': range(fromMid),
      'paymentPeriod.toDate':   range(toMid),
    }).select('farmerId').lean();
    bankPaid.forEach(p => p.farmerId && alreadyPaid.add(p.farmerId.toString()));

    const data = register.entries
      .filter(e => e.farmerId && !alreadyPaid.has(e.farmerId.toString()))
      .map(e => ({
        farmerId:     e.farmerId,
        producerId:   e.producerId   || e.productId   || '',
        producerName: e.producerName || e.productName || '',
        netPay:       e.netPay || 0,
        paymentMode:  e.payMode || e.paymentMode || 'Bank',
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('getCyclePendingFarmers error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Bank-Transfer-Paid Farmers for a Cycle ────────────────────────────────
export const getBankTransferPaid = async (req, res) => {
  try {
    const { cycleFromDate, cycleToDate } = req.query;
    const companyId = new mongoose.Types.ObjectId(req.userCompany);

    if (!cycleFromDate || !cycleToDate) return res.json({ success: true, data: [] });

    const fps = await FarmerPayment.find({
      companyId,
      paymentSource: 'BankTransfer',
      status: 'Paid',
      'paymentPeriod.fromDate': cycleDateRange(cycleFromDate),
      'paymentPeriod.toDate':   cycleDateRange(cycleToDate),
    })
      .populate('farmerId', 'farmerNumber personalDetails')
      .select('farmerId farmerName paidAmount netPayable paymentDate')
      .lean();

    // Build farmerId -> applyDate map from BankTransfer documents (source of truth).
    // This corrects records that were saved before the paymentDate fix was applied.
    const dayMs = 24 * 60 * 60 * 1000;
    const cycleEnd = new Date(cycleToDate);
    const bankTransfers = await BankTransfer.find({
      companyId,
      status: { $in: ['Applied', 'Completed'] },
      asOnDate: {
        $gte: new Date(cycleEnd.getTime() - 2 * dayMs),
        $lte: new Date(cycleEnd.getTime() + 2 * dayMs),
      },
    }).select('applyDate transferDetails').lean();

    const farmerApplyDateMap = new Map();
    for (const bt of bankTransfers) {
      for (const detail of bt.transferDetails || []) {
        if (detail.farmerId) {
          farmerApplyDateMap.set(detail.farmerId.toString(), bt.applyDate);
        }
      }
    }

    const data = fps.map(fp => {
      const farmerIdStr = fp.farmerId?._id?.toString() || fp.farmerId?.toString();
      return {
        _id:            fp._id,
        farmerId:       fp.farmerId,
        producerNumber: fp.farmerId?.farmerNumber || '',
        producerName:   fp.farmerName || fp.farmerId?.personalDetails?.name || '',
        amountPaid:     fp.paidAmount || fp.netPayable || 0,
        paymentDate:    farmerApplyDateMap.get(farmerIdStr) || fp.paymentDate,
        paymentMode:    'Bank Transfer',
        paymentType:    'BankTransfer',
        status:         'Paid',
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Create Payment ────────────────────────────────────────────────────────────
export const createPayment = async (req, res) => {
  try {
    const {
      farmerId,
      amountPaid,
      processingPeriod,
      paymentDate,
      isPartialPayment,
      paymentCenter,
      paymentCenterName,
      producerNumber,
      producerName,
      refNo,
      lastAbstractBalance,
      printSlip,
      paymentMode,
      bankLedgerId,
      bankLedgerName,
      remarks
    } = req.body;

    // Validate required fields
    if (!farmerId) {
      return res.status(400).json({ success: false, message: 'farmerId is required' });
    }
    if (amountPaid === undefined || amountPaid === null || amountPaid < 0) {
      return res.status(400).json({ success: false, message: 'amountPaid must be a non-negative number' });
    }
    if (!processingPeriod || !processingPeriod.fromDate || !processingPeriod.toDate) {
      return res.status(400).json({ success: false, message: 'processingPeriod (fromDate and toDate) is required' });
    }
    if (!paymentDate) {
      return res.status(400).json({ success: false, message: 'paymentDate is required' });
    }

    // Block duplicate cash payment for the same farmer + cycle so the operator
    // cannot re-enter a producer who has already been paid in this applied cycle.
    const dupCash = await ProducerPayment.findOne({
      companyId:                   new mongoose.Types.ObjectId(req.userCompany),
      farmerId:                    new mongoose.Types.ObjectId(farmerId),
      status:                      { $ne: 'Cancelled' },
      'processingPeriod.fromDate': cycleDateRange(processingPeriod.fromDate),
      'processingPeriod.toDate':   cycleDateRange(processingPeriod.toDate),
    }).select('_id amountPaid paymentDate refNo').lean();

    if (dupCash) {
      return res.status(409).json({
        success: false,
        message: `Already paid in this cycle on ${fmtDateDMY(dupCash.paymentDate)} (₹${(dupCash.amountPaid || 0).toFixed(2)}${dupCash.refNo ? `, Ref ${dupCash.refNo}` : ''}).`,
        data: { alreadyPaidCash: true, cashPayment: dupCash },
      });
    }

    // Also block if a Bank Transfer is already applied for this cycle.
    const btDup = await FarmerPayment.exists({
      companyId:                  new mongoose.Types.ObjectId(req.userCompany),
      farmerId:                   new mongoose.Types.ObjectId(farmerId),
      paymentSource:              'BankTransfer',
      status:                     'Paid',
      'paymentPeriod.fromDate':   cycleDateRange(processingPeriod.fromDate),
      'paymentPeriod.toDate':     cycleDateRange(processingPeriod.toDate),
    });
    if (btDup) {
      return res.status(409).json({
        success: false,
        message: 'This producer has already been paid via Bank Transfer for this cycle.',
        data: { bankTransferPaid: true },
      });
    }

    const buildPayment = () => new ProducerPayment({
      companyId: req.userCompany,
      farmerId,
      amountPaid,
      processingPeriod: {
        fromDate: new Date(processingPeriod.fromDate),
        toDate: new Date(processingPeriod.toDate)
      },
      paymentDate: new Date(paymentDate),
      isPartialPayment: isPartialPayment || false,
      paymentCenter: paymentCenter || null,
      paymentCenterName: paymentCenterName || 'All',
      producerNumber: producerNumber || '',
      producerName: producerName || '',
      refNo: refNo || '',
      lastAbstractBalance: lastAbstractBalance || 0,
      printSlip: printSlip || false,
      paymentMode: paymentMode || 'Cash',
      bankLedgerId: bankLedgerId || null,
      bankLedgerName: bankLedgerName || '',
      remarks: remarks || '',
      createdBy: req.user?._id
    });

    // Save with retry on duplicate paymentNumber + counter resync on the 3rd
    // attempt. Handles cases where the counter lags behind existing records
    // (DB restore / seed / out-of-band insert).
    const payment = await saveWithUniqueNumber({
      Model:       ProducerPayment,
      companyId:   req.userCompany,
      prefix:      'PTP',
      numberField: 'paymentNumber',
      build:       buildPayment,
    });

    // Update the corresponding FarmerPayment record to reflect this cash payment
    try {
      const farmerObjId  = new mongoose.Types.ObjectId(farmerId);
      const companyObjId = new mongoose.Types.ObjectId(req.userCompany);
      const periodFilter = {
        companyId:     companyObjId,
        farmerId:      farmerObjId,
        status:        { $in: ['Pending', 'Partial'] },
        // Never touch BankTransfer-sourced records — those belong to the bank
        // transfer module. Updating them here marks them "Paid" via a different
        // channel, which causes getBankTransferPaid to surface a phantom entry
        // in the Payment-to-Producer grid with the cycle's toDate as the date.
        paymentSource: { $ne: 'BankTransfer' },
      };
      if (processingPeriod?.fromDate) periodFilter['paymentPeriod.fromDate'] = { $gte: new Date(processingPeriod.fromDate) };
      if (processingPeriod?.toDate)   periodFilter['paymentPeriod.toDate']   = { $lte: new Date(new Date(processingPeriod.toDate).setHours(23, 59, 59, 999)) };

      const pendingFP = await FarmerPayment.find(periodFilter).sort({ createdAt: -1 });
      let remaining = amountPaid;
      for (const fp of pendingFP) {
        if (remaining <= 0) break;
        const outstanding = fp.balanceAmount > 0 ? fp.balanceAmount : fp.netPayable;
        const apply = Math.min(remaining, outstanding);
        fp.paidAmount  = (fp.paidAmount || 0) + apply;
        fp.paymentMode = paymentMode || fp.paymentMode;
        // pre-save hook recomputes balanceAmount and status
        await fp.save();
        remaining -= apply;
      }
    } catch (fpErr) {
      console.warn('FarmerPayment update skipped:', fpErr.message);
    }

    // Auto-post to Day Book / Cash Book — Dr PRODUCERS DUES / Cr Cash or Bank
    try {
      if (payment.amountPaid > 0) {
        const voucher = await createProducerDuesPaymentVoucher({
          amount:          payment.amountPaid,
          paymentDate:     payment.paymentDate,
          paymentMode:     payment.paymentMode,
          bankLedgerId:    payment.bankLedgerId || null,
          bankLedgerName:  payment.bankLedgerName || '',
          companyId:       payment.companyId,
          narration:       `Payment to Producer — ${payment.producerName || ''} ${payment.producerNumber ? '(#' + payment.producerNumber + ')' : ''}`.trim(),
          referenceType:   'ProducerPayment',
          referenceId:     payment._id,
          createdBy:       payment.createdBy,
        });
        if (voucher) {
          payment.voucherId = voucher._id;
          await payment.save();
        }
      }
    } catch (voucherErr) {
      console.warn('ProducerPayment voucher creation skipped:', voucherErr.message);
    }

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('Error creating producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error creating payment' });
  }
};

// ─── Get Payments ──────────────────────────────────────────────────────────────
export const getPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      last5Days,
      fromDate,
      toDate,
      cycleFromDate,
      cycleToDate,
      centerId,
      search
    } = req.query;

    const companyId = req.userCompany;
    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };

    // Cycle-based filter takes priority over paymentDate
    if (cycleFromDate && cycleToDate) {
      filter['processingPeriod.fromDate'] = cycleDateRange(cycleFromDate);
      filter['processingPeriod.toDate']   = cycleDateRange(cycleToDate);
    } else if (last5Days === 'true') {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fiveDaysAgo.setHours(0, 0, 0, 0);
      filter.paymentDate = { $gte: fiveDaysAgo };
    } else {
      if (fromDate || toDate) {
        filter.paymentDate = {};
        if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          filter.paymentDate.$lte = end;
        }
      }
    }

    // Collection center filter
    if (centerId && centerId !== 'all') {
      filter.paymentCenter = new mongoose.Types.ObjectId(centerId);
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { producerNumber: searchRegex },
        { producerName: searchRegex },
        { refNo: searchRegex }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      ProducerPayment.find(filter)
        .populate('farmerId', 'farmerNumber personalDetails')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProducerPayment.countDocuments(filter)
    ]);

    // Summary aggregate (all matching records, not just current page)
    const summaryAgg = await ProducerPayment.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryAgg[0] || { totalAmount: 0, count: 0 };

    return res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalAmount: summary.totalAmount,
        count: summary.count
      }
    });
  } catch (error) {
    console.error('Error fetching producer payments:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error fetching payments' });
  }
};

// ─── Get Producer Balance ──────────────────────────────────────────────────────
export const getProducerBalance = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { fromDate, toDate } = req.query;
    const companyId = req.userCompany;

    if (!farmerId || !mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({ success: false, message: 'Valid farmerId is required' });
    }

    // Get farmer info
    const farmer = await Farmer.findOne({
      _id: new mongoose.Types.ObjectId(farmerId),
      companyId: new mongoose.Types.ObjectId(companyId)
    })
      .select('farmerNumber personalDetails bankDetails')
      .lean();

    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }

    // ── Last Abstract Balance = the saved cycle's NET PAY for this farmer ──
    // Look up the PaymentRegister entry for this farmer in the selected cycle
    // and return entry.netPay as the abstract balance. This is the gross amount
    // the society owes the farmer at cycle close (after deductions but before
    // any cash/bank payment). FarmerPayment.balanceAmount is "deductions
    // unrecovered" and is no longer used here.
    let balance = 0;
    const prMatch = {
      companyId:          new mongoose.Types.ObjectId(companyId),
      registerType:       { $in: ['Ledger', 'Producers'] },
      'entries.farmerId': new mongoose.Types.ObjectId(farmerId),
      status:             { $in: ['Saved', 'Printed'] },
    };
    if (fromDate || toDate) {
      const dayMs = 24 * 60 * 60 * 1000;
      if (fromDate) {
        const mid = new Date(fromDate);
        prMatch.fromDate = {
          $gte: new Date(mid.getTime() - 2 * dayMs),
          $lte: new Date(mid.getTime() + 2 * dayMs),
        };
      }
      if (toDate) {
        const mid = new Date(toDate);
        prMatch.toDate = {
          $gte: new Date(mid.getTime() - 2 * dayMs),
          $lte: new Date(mid.getTime() + 2 * dayMs),
        };
      }
    }

    const latestRegister = await PaymentRegister.findOne(prMatch)
      .sort({ toDate: -1, createdAt: -1 })
      .select('entries')
      .lean();

    if (latestRegister) {
      const entry = latestRegister.entries.find(
        e => e.farmerId?.toString() === farmerId
      );
      balance = entry?.netPay || 0;
    }

    // Fallback (no register entry — cycle not saved for this farmer): fall
    // back to FarmerPayment.netPayable so the form still shows something
    // sensible instead of zero.
    if (!balance) {
      const fpMatch = {
        companyId: new mongoose.Types.ObjectId(companyId),
        farmerId:  new mongoose.Types.ObjectId(farmerId),
        status:    { $in: ['Pending', 'Partial'] },
      };
      if (fromDate) fpMatch['paymentPeriod.fromDate'] = { $gte: new Date(fromDate) };
      if (toDate)   fpMatch['paymentPeriod.toDate']   = { $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)) };

      const balanceAgg = await FarmerPayment.aggregate([
        { $match: fpMatch },
        { $group: { _id: null, totalBalance: { $sum: '$balanceAmount' }, totalNetPayable: { $sum: '$netPayable' } } }
      ]);
      balance = balanceAgg[0]?.totalNetPayable || balanceAgg[0]?.totalBalance || 0;
    }

    // Check if already paid via Bank Transfer for this cycle
    const btFilter = {
      companyId:     new mongoose.Types.ObjectId(companyId),
      farmerId:      new mongoose.Types.ObjectId(farmerId),
      paymentSource: 'BankTransfer',
      status:        'Paid',
    };
    if (fromDate) btFilter['paymentPeriod.fromDate'] = cycleDateRange(fromDate);
    if (toDate)   btFilter['paymentPeriod.toDate']   = cycleDateRange(toDate);
    const btPaid = await FarmerPayment.exists(btFilter);

    // Check if already paid via Cash (ProducerPayment) for this cycle so the
    // form can warn the operator and block re-entry.
    let cashPaid = null;
    if (fromDate && toDate) {
      cashPaid = await ProducerPayment.findOne({
        companyId:                  new mongoose.Types.ObjectId(companyId),
        farmerId:                   new mongoose.Types.ObjectId(farmerId),
        status:                     { $ne: 'Cancelled' },
        'processingPeriod.fromDate': cycleDateRange(fromDate),
        'processingPeriod.toDate':   cycleDateRange(toDate),
      })
        .select('amountPaid paymentDate paymentMode refNo')
        .lean();
    }

    return res.json({
      success: true,
      data: {
        balance,
        bankTransferPaid: !!btPaid,
        alreadyPaidCash: !!cashPaid,
        cashPayment: cashPaid || null,
        farmer: {
          _id: farmer._id,
          number: farmer.farmerNumber,
          name: farmer.personalDetails?.name || '',
          bankName: farmer.bankDetails?.bankName || '',
          accountNumber: farmer.bankDetails?.accountNumber || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching producer balance:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error fetching balance' });
  }
};

// ─── Update Payment ────────────────────────────────────────────────────────────
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const payment = await ProducerPayment.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled payment' });
    }

    const allowedFields = ['refNo', 'amountPaid', 'printSlip', 'paymentMode', 'bankLedgerId', 'bankLedgerName', 'remarks'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    }

    await payment.save();

    return res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error updating producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error updating payment' });
  }
};

// ─── Cancel Payment ────────────────────────────────────────────────────────────
export const cancelPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const payment = await ProducerPayment.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Payment is already cancelled' });
    }

    payment.status = 'Cancelled';
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.user?._id;

    // Remove the auto-posted voucher so the cancelled payment no longer affects Day Book / Cash Book
    if (payment.voucherId) {
      try {
        await Voucher.deleteOne({ _id: payment.voucherId });
      } catch (vErr) {
        console.warn('Voucher cleanup skipped on cancel:', vErr.message);
      }
      payment.voucherId = undefined;
    }

    await payment.save();

    return res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error cancelling producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error cancelling payment' });
  }
};

// ─── Delete Payment (permanent) ───────────────────────────────────────────────
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const payment = await ProducerPayment.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Reverse the FarmerPayment paidAmount that this producer payment had applied,
    // unless the record was already cancelled (in which case nothing was applied).
    if (payment.status !== 'Cancelled' && payment.amountPaid > 0) {
      try {
        const farmerObjId  = new mongoose.Types.ObjectId(payment.farmerId);
        const companyObjId = new mongoose.Types.ObjectId(companyId);
        const periodFilter = {
          companyId:     companyObjId,
          farmerId:      farmerObjId,
          paidAmount:    { $gt: 0 },
          paymentSource: { $ne: 'BankTransfer' },
        };
        if (payment.processingPeriod?.fromDate) periodFilter['paymentPeriod.fromDate'] = { $gte: new Date(payment.processingPeriod.fromDate) };
        if (payment.processingPeriod?.toDate)   periodFilter['paymentPeriod.toDate']   = { $lte: new Date(new Date(payment.processingPeriod.toDate).setHours(23, 59, 59, 999)) };

        const fps = await FarmerPayment.find(periodFilter).sort({ updatedAt: -1 });
        let remaining = payment.amountPaid;
        for (const fp of fps) {
          if (remaining <= 0) break;
          const reverse = Math.min(remaining, fp.paidAmount || 0);
          fp.paidAmount = (fp.paidAmount || 0) - reverse;
          // pre-save hook recomputes balanceAmount and status
          await fp.save();
          remaining -= reverse;
        }
      } catch (fpErr) {
        console.warn('FarmerPayment reversal skipped:', fpErr.message);
      }
    }

    // Remove the auto-posted voucher so Day Book / Cash Book no longer reflect this payment
    if (payment.voucherId) {
      try {
        await Voucher.deleteOne({ _id: payment.voucherId });
      } catch (vErr) {
        console.warn('Voucher cleanup skipped on delete:', vErr.message);
      }
    }

    await ProducerPayment.deleteOne({ _id: payment._id });

    return res.json({ success: true, message: 'Payment deleted permanently' });
  } catch (error) {
    console.error('Error deleting producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error deleting payment' });
  }
};

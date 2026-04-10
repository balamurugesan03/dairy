import PaymentRegister from '../models/PaymentRegister.js';
import MilkCollection from '../models/MilkCollection.js';
import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import Farmer from '../models/Farmer.js';
import ProducerOpening from '../models/ProducerOpening.js';
import IndividualDeductionEarning from '../models/IndividualDeductionEarning.js';
import PeriodicalRule from '../models/PeriodicalRule.js';

// ─── GET all registers (paginated, date filter) ───────────────────────────────
export const getPaymentRegisters = async (req, res) => {
  try {
    const { fromDate, toDate, status, registerType, page = 1, limit = 20 } = req.query;
    const companyId = req.companyId;

    const filter = { companyId };
    if (fromDate || toDate) {
      filter.fromDate = {};
      if (fromDate) filter.fromDate.$gte = new Date(fromDate);
      if (toDate)   filter.fromDate.$lte = new Date(toDate);
    }
    if (status)       filter.status       = status;
    if (registerType) filter.registerType = registerType;

    const total = await PaymentRegister.countDocuments(filter);
    // For Ledger type, include entries so history page can render them
    const selectFields = registerType === 'Ledger' ? '' : '-entries';
    const registers = await PaymentRegister.find(filter)
      .select(selectFields)
      .sort({ fromDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, data: registers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET single register with full entries ────────────────────────────────────
export const getPaymentRegister = async (req, res) => {
  try {
    const reg = await PaymentRegister.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GENERATE entries from milk collection data ───────────────────────────────
export const generatePaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // 1. Get all active farmers
    const farmers = await Farmer.find({ companyId, status: 'Active' })
      .select('farmerNumber personalDetails bankDetails collectionCenter')
      .populate('collectionCenter', 'centerName')
      .lean();

    const entries = [];

    for (const farmer of farmers) {
      // 2. Aggregate milk collections for this period
      const milkAgg = await MilkCollection.aggregate([
        {
          $match: {
            farmer: farmer._id,
            companyId,
            date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalQty:    { $sum: '$qty' },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      const milkData = milkAgg[0] || { totalQty: 0, totalAmount: 0 };

      // Skip farmers with no milk this period
      if (milkData.totalQty === 0 && milkData.totalAmount === 0) continue;

      // 3. Previous balance — unpaid/partial farmer payments
      const prevAgg = await FarmerPayment.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            status: { $in: ['Pending', 'Partial'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
      ]);
      const previousBalance = prevAgg[0]?.total || 0;

      entries.push({
        farmerId:        farmer._id,
        productId:       farmer.farmerNumber || '',
        productName:     farmer.personalDetails?.name || '',
        qty:             Math.round((milkData.totalQty || 0) * 100) / 100,
        milkValue:       Math.round((milkData.totalAmount || 0) * 100) / 100,
        previousBalance: Math.round(previousBalance * 100) / 100,
        welfare:         0,
        deductions:      0,
        center:          farmer.collectionCenter?.centerName || '',
      });
    }

    // Sort by productId
    entries.sort((a, b) => (a.productId || '').localeCompare(b.productId || ''));

    res.json({
      success: true,
      data: {
        fromDate: start,
        toDate:   end,
        entries,
        totalEntries: entries.length,
      },
    });
  } catch (err) {
    console.error('generatePaymentRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GENERATE Producer Payment Register entries ───────────────────────────────
export const generateProducerPaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // 1. Get all active farmers
    const farmers = await Farmer.find({ companyId, status: 'Active' })
      .select('farmerNumber personalDetails')
      .lean();

    // 2. Bulk-aggregate all active advances for this company (grouped by farmer + category)
    const allAdvances = await Advance.aggregate([
      {
        $match: {
          companyId,
          status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] },
        },
      },
      {
        $group: {
          _id: { farmerId: '$farmerId', category: '$advanceCategory' },
          total: { $sum: '$balanceAmount' },
        },
      },
    ]);
    // Build map: farmerId -> { 'CF Advance': X, 'Loan Advance': Y, 'Cash Advance': Z }
    const advanceMap = {};
    allAdvances.forEach(a => {
      const fid = a._id.farmerId?.toString();
      if (!fid) return;
      if (!advanceMap[fid]) advanceMap[fid] = {};
      advanceMap[fid][a._id.category] = a.total;
    });

    // 3. Bulk-aggregate ProducerOpening as fallback
    const openings = await ProducerOpening.find({ companyId }).lean();
    const openingMap = {};
    openings.forEach(o => {
      const fid = o.farmerId?.toString();
      if (fid) openingMap[fid] = o;
    });

    // 4. Welfare amount — from active PeriodicalRule (DEDUCTIONS + FIXED_AMOUNT)
    const welfareRule = await PeriodicalRule.findOne({
      companyId,
      component: 'DEDUCTIONS',
      basedOn:   'FIXED_AMOUNT',
      active:    true,
    }).lean();
    const welfareFixed = welfareRule?.fixedRate || 0;
    const welfareApplyPeriod = welfareRule?.applyPeriod || 'EACH_PERIOD';

    // If ONCE_IN_MONTH: find farmers who already had welfare deducted this month
    let alreadyDeductedSet = new Set();
    if (welfareFixed > 0 && welfareApplyPeriod === 'ONCE_IN_MONTH') {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd   = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      const existing   = await FarmerPayment.find({
        companyId,
        paymentDate: { $gte: monthStart, $lte: monthEnd },
        status: { $ne: 'Cancelled' },
        'deductions.type': 'Welfare Recovery',
      }).select('farmerId').lean();
      existing.forEach(p => alreadyDeductedSet.add(p.farmerId?.toString()));
    }

    const entries = [];

    for (const farmer of farmers) {
      // 5. Milk collections for period
      const milkAgg = await MilkCollection.aggregate([
        { $match: { farmer: farmer._id, companyId, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, totalQty: { $sum: '$qty' }, totalAmount: { $sum: '$amount' } } },
      ]);
      const milkData = milkAgg[0] || { totalQty: 0, totalAmount: 0 };
      if (milkData.totalQty === 0 && milkData.totalAmount === 0) continue;

      const fid     = farmer._id.toString();
      const adv     = advanceMap[fid]  || {};
      const opening = openingMap[fid]  || {};

      // 6. Previous balance — from ProducerOpening dueAmount
      const previousBalance = opening.dueAmount || 0;

      // 7. CF / Loan / Cash advances — from Advance model (all outstanding), fallback ProducerOpening
      const cfAdv   = adv['CF Advance']   ?? opening.cfAdvance   ?? 0;
      const loanAdv = adv['Loan Advance'] ?? opening.loanAdvance ?? 0;
      const cashAdv = adv['Cash Advance'] ?? opening.cashAdvance ?? 0;

      // 8. Welfare — from PeriodicalRule fixedRate (0 if ONCE_IN_MONTH and already deducted)
      const welfare = (welfareFixed > 0 && !alreadyDeductedSet.has(fid)) ? welfareFixed : 0;

      const milkValue  = Math.round((milkData.totalAmount || 0) * 100) / 100;
      const netPayable = milkValue - welfare - cfAdv - loanAdv - cashAdv + previousBalance;

      entries.push({
        farmerId:        farmer._id,
        productId:       farmer.farmerNumber || '',
        productName:     farmer.personalDetails?.name || '',
        qty:             Math.round((milkData.totalQty || 0) * 100) / 100,
        milkValue,
        previousBalance: Math.round(previousBalance * 100) / 100,
        welfare:         Math.round(welfare   * 100) / 100,
        cfRec:           Math.round(cfAdv     * 100) / 100,
        loanAdv:         Math.round(loanAdv   * 100) / 100,
        cashPocket:      Math.round(cashAdv   * 100) / 100,
        netPay:          Math.round(netPayable * 100) / 100,
        payStatus:       netPayable > 0 ? 'Payable' : netPayable < 0 ? 'Receivable' : '',
      });
    }

    entries.sort((a, b) => (a.productId || '').localeCompare(b.productId || ''));

    res.json({
      success: true,
      data: { fromDate: start, toDate: end, entries, totalEntries: entries.length },
    });
  } catch (err) {
    console.error('generateProducerPaymentRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE / SAVE register ───────────────────────────────────────────────────
export const createPaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate, entries, remarks, status } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const { registerType } = req.body;
    const reg = new PaymentRegister({
      companyId,
      fromDate:     new Date(fromDate),
      toDate:       new Date(toDate),
      registerType: registerType || 'Creditor',
      entries:      entries || [],
      remarks,
      status:       status || 'Saved',
      createdBy:    req.user?._id,
    });

    await reg.save();
    res.status(201).json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE register ──────────────────────────────────────────────────────────
export const updatePaymentRegister = async (req, res) => {
  try {
    const { entries, remarks, status, fromDate, toDate } = req.body;
    const reg = await PaymentRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });

    if (entries  !== undefined) reg.entries  = entries;
    if (remarks  !== undefined) reg.remarks  = remarks;
    if (status   !== undefined) reg.status   = status;
    if (fromDate !== undefined) reg.fromDate = new Date(fromDate);
    if (toDate   !== undefined) reg.toDate   = new Date(toDate);

    await reg.save();
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE register ──────────────────────────────────────────────────────────
export const deletePaymentRegister = async (req, res) => {
  try {
    const reg = await PaymentRegister.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Producers register for a period (latest saved) ───────────────────────
export const getProducersForPeriod = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate); end.setHours(23, 59, 59, 999);

    // Find the most recently saved Producers register whose period overlaps the requested range
    const reg = await PaymentRegister.findOne({
      companyId,
      registerType: 'Producers',
      fromDate: { $lte: end },
      toDate:   { $gte: start },
    }).sort({ createdAt: -1 });

    if (!reg) return res.json({ success: true, data: null });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET latest Producers register (no date filter) ───────────────────────────
export const getLatestProducers = async (req, res) => {
  try {
    const companyId = req.companyId;
    const reg = await PaymentRegister.findOne({
      companyId,
      registerType: 'Producers',
    }).sort({ createdAt: -1 });

    if (!reg) return res.json({ success: true, data: null });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── APPLY payment for a single entry in a register ───────────────────────────
export const applyEntryPayment = async (req, res) => {
  try {
    const { registerId, entryId } = req.params;
    const { paymentMode, paidAmount, cfRec, cashRec, loanRec, otherDed } = req.body;
    const companyId = req.companyId;

    const reg = await PaymentRegister.findOne({ _id: registerId, companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });

    const entry = reg.entries.id(entryId);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (entry.paid) return res.status(400).json({ success: false, message: 'Already paid' });

    const mode      = paymentMode || 'Cash';
    const netAmount = paidAmount  || entry.netPay;

    // Build deductions array for FarmerPayment
    const deductions = [];
    if ((entry.welfare || 0)    > 0) deductions.push({ type: 'Welfare Recovery', amount: entry.welfare,    description: 'Welfare' });
    if ((entry.cfRec   || 0)    > 0) deductions.push({ type: 'CF Advance',       amount: entry.cfRec,      description: 'CF Advance' });
    if ((cfRec         || 0)    > 0) deductions.push({ type: 'CF Recovery',       amount: cfRec,            description: 'CF Recovery' });
    if ((entry.loanAdv || 0)    > 0) deductions.push({ type: 'Loan Advance',     amount: entry.loanAdv,    description: 'Loan Advance' });
    if ((loanRec       || 0)    > 0) deductions.push({ type: 'Loan Recovery',     amount: loanRec,          description: 'Loan Recovery' });
    if ((entry.cashPocket || 0) > 0) deductions.push({ type: 'Cash Advance',     amount: entry.cashPocket, description: 'Cash Advance' });
    if ((cashRec       || 0)    > 0) deductions.push({ type: 'Cash Recovery',     amount: cashRec,          description: 'Cash Recovery' });
    if ((otherDed      || 0)    > 0) deductions.push({ type: 'Other',             amount: otherDed,         description: 'Other' });

    // Create FarmerPayment
    const fp = new FarmerPayment({
      companyId,
      farmerId:        entry.farmerId,
      farmerName:      entry.productName,
      paymentDate:     new Date(),
      paymentPeriod:   { fromDate: reg.fromDate, toDate: reg.toDate, periodType: 'Custom' },
      milkAmount:      entry.milkValue,
      previousBalance: entry.previousBalance,
      deductions,
      paidAmount:      netAmount,
      paymentMode:     mode,
      status:          'Paid',
      remarks:         `Ledger — ${reg.fromDate.toLocaleDateString('en-IN')}–${reg.toDate.toLocaleDateString('en-IN')}`,
    });
    await fp.save();

    // Mark entry paid
    entry.paid            = true;
    entry.paymentMode     = mode;
    entry.paidAmount      = netAmount;
    entry.farmerPaymentId = fp._id;
    await reg.save();

    res.json({ success: true, data: { farmerPaymentId: fp._id, entry } });
  } catch (err) {
    console.error('applyEntryPayment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

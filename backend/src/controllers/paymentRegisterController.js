import PaymentRegister from '../models/PaymentRegister.js';
import MilkCollection from '../models/MilkCollection.js';
import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import Farmer from '../models/Farmer.js';

// ─── GET all registers (paginated, date filter) ───────────────────────────────
export const getPaymentRegisters = async (req, res) => {
  try {
    const { fromDate, toDate, status, page = 1, limit = 20 } = req.query;
    const companyId = req.companyId;

    const filter = { companyId };
    if (fromDate || toDate) {
      filter.fromDate = {};
      if (fromDate) filter.fromDate.$gte = new Date(fromDate);
      if (toDate)   filter.fromDate.$lte = new Date(toDate);
    }
    if (status) filter.status = status;

    const total = await PaymentRegister.countDocuments(filter);
    const registers = await PaymentRegister.find(filter)
      .select('-entries')
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

    const entries = [];

    for (const farmer of farmers) {
      // 2. Milk collections for period
      const milkAgg = await MilkCollection.aggregate([
        { $match: { farmer: farmer._id, companyId, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, totalQty: { $sum: '$qty' }, totalAmount: { $sum: '$amount' } } },
      ]);
      const milkData = milkAgg[0] || { totalQty: 0, totalAmount: 0 };
      if (milkData.totalQty === 0 && milkData.totalAmount === 0) continue;

      // 3. Previous balance — unpaid/partial payments BEFORE this period
      const prevAgg = await FarmerPayment.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            status: { $in: ['Pending', 'Partial'] },
            paymentDate: { $lt: start },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
      ]);
      const previousBalance = prevAgg[0]?.total || 0;

      // 4. Welfare deductions for this period
      const welfareAgg = await FarmerPayment.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            paymentDate: { $gte: start, $lte: end },
            status: { $ne: 'Cancelled' },
          },
        },
        { $unwind: '$deductions' },
        {
          $match: {
            'deductions.type': {
              $in: ['Welfare Recovery', 'Society Fee', 'Insurance', 'Flood Relief Fund'],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
      ]);
      const welfare = welfareAgg[0]?.total || 0;

      // 5. C/F Recovery (CF Advance deductions) for this period
      const cfRecAgg = await FarmerPayment.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            paymentDate: { $gte: start, $lte: end },
            status: { $ne: 'Cancelled' },
          },
        },
        { $unwind: '$deductions' },
        { $match: { 'deductions.type': 'CF Advance' } },
        { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
      ]);
      const cfRec = cfRecAgg[0]?.total || 0;

      // 6. Cash Pocket — active Cash Advances issued in this period
      const cashPocketAgg = await Advance.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            advanceCategory: 'Cash Advance',
            advanceDate: { $gte: start, $lte: end },
            status: { $in: ['Active', 'Partially Adjusted'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
      ]);
      const cashPocket = cashPocketAgg[0]?.total || 0;

      const milkValue  = Math.round((milkData.totalAmount || 0) * 100) / 100;
      const netPayable = milkValue - welfare - cfRec - cashPocket + previousBalance;

      entries.push({
        farmerId:        farmer._id,
        productId:       farmer.farmerNumber || '',
        productName:     farmer.personalDetails?.name || '',
        qty:             Math.round((milkData.totalQty || 0) * 100) / 100,
        milkValue,
        previousBalance: Math.round(previousBalance * 100) / 100,
        welfare:         Math.round(welfare * 100) / 100,
        cfRec:           Math.round(cfRec * 100) / 100,
        cashPocket:      Math.round(cashPocket * 100) / 100,
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

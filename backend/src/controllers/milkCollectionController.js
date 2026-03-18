import MilkCollection from '../models/MilkCollection.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances } from '../utils/accountingHelper.js';

// ── Auto-generate bill number: MC-YYMM-XXXXX ─────────────────────────────────
// Reads actual DB max each call — always returns next available number
const generateBillNo = async (companyId) => {
  const now   = new Date();
  const yy    = String(now.getFullYear()).slice(2);
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `MC-${yy}${mm}-`;

  const last = await MilkCollection.findOne(
    { companyId, billNo: { $regex: `^${prefix}` } },
    { billNo: 1 },
    { sort: { billNo: -1 } }
  );
  const seq = last ? parseInt(last.billNo.split('-').pop(), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createCollection = async (req, res) => {
  try {
    // Retry loop: if two requests race and grab the same billNo,
    // re-read the DB max and try the next one — guaranteed to converge.
    let entry;
    for (let attempt = 0; attempt < 10; attempt++) {
      const billNo = await generateBillNo(req.companyId);
      entry = new MilkCollection({
        ...req.body,
        billNo,
        companyId: req.companyId,
        createdBy: req.user?._id
      });
      try {
        await entry.save();
        break; // success — exit retry loop
      } catch (dupErr) {
        if (dupErr.code === 11000 && dupErr.keyPattern?.billNo && attempt < 9) {
          continue; // duplicate billNo — re-read DB and retry
        }
        throw dupErr; // other error or exhausted retries
      }
    }

    // ── Auto-create Journal voucher: Dr PRODUCERS DUES / Cr MILK PURCHASE ──
    try {
      const [debitLedger, creditLedger] = await Promise.all([
        Ledger.findOne({ ledgerName: 'PRODUCERS DUES', companyId: req.companyId }),
        Ledger.findOne({ ledgerName: 'MILK PURCHASE',  companyId: req.companyId })
      ]);
      if (!debitLedger) console.warn('[MilkCollection] Ledger not found: "PRODUCERS DUES" — create it in Accounts');
      if (!creditLedger) console.warn('[MilkCollection] Ledger not found: "MILK PURCHASE" — create it in Accounts');
      if (debitLedger && creditLedger) {
        const vEntries = [
          { ledgerId: debitLedger._id, ledgerName: debitLedger.ledgerName, debitAmount: entry.amount, creditAmount: 0,
            narration: `${entry.shift} shift` },
          { ledgerId: creditLedger._id, ledgerName: creditLedger.ledgerName, debitAmount: 0, creditAmount: entry.amount,
            narration: `${entry.shift} shift` }
        ];
        const voucherNumber = await generateVoucherNumber('Journal', req.companyId);
        const voucher = new Voucher({
          voucherType: 'Journal', voucherNumber,
          voucherDate: entry.date, entries: vEntries,
          totalDebit: entry.amount, totalCredit: entry.amount,
          narration: `Milk Purchase - ${entry.billNo} - ${entry.farmerName || ''} (${entry.shift})`,
          referenceType: 'Purchase', referenceId: entry._id,
          companyId: req.companyId
        });
        await voucher.save();
        await updateLedgerBalances(vEntries);
        entry.voucherId = voucher._id;
        await entry.save();
      }
    } catch (vErr) {
      console.warn('[MilkCollection] Voucher creation failed (non-fatal):', vErr.message);
    }

    const populated = await MilkCollection.findById(entry._id)
      .populate('collectionCenter', 'centerName')
      .populate('agent', 'agentName')
      .populate('farmer', 'farmerNumber personalDetails.name');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Error creating milk collection:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET ALL (with date/shift/center filters) ───────────────────────────────────
export const getAllCollections = async (req, res) => {
  try {
    const {
      date, shift, collectionCenter, farmerNumber,
      fromDate, toDate,
      page = 1, limit = 200
    } = req.query;

    const query = { companyId: req.companyId };

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate)   query.date.$lte = new Date(toDate);
    }

    if (shift)            query.shift            = shift;
    if (collectionCenter) query.collectionCenter = collectionCenter;
    if (farmerNumber)     query.farmerNumber     = farmerNumber;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await MilkCollection.countDocuments(query);

    const records = await MilkCollection.find(query)
      .populate('collectionCenter', 'centerName')
      .populate('agent', 'agentName')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: records,
      pagination: { currentPage: parseInt(page), total, limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error fetching milk collections:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET SINGLE ────────────────────────────────────────────────────────────────
export const getCollectionById = async (req, res) => {
  try {
    const record = await MilkCollection.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('collectionCenter', 'centerName')
      .populate('agent', 'agentName')
      .populate('farmer', 'farmerNumber personalDetails.name');

    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const updateCollection = async (req, res) => {
  try {
    const { billNo, companyId, createdBy, ...updates } = req.body;

    const record = await MilkCollection.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const deleteCollection = async (req, res) => {
  try {
    const record = await MilkCollection.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId
    });

    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    // Reverse ledger balances and delete linked voucher
    if (record.voucherId) {
      try {
        const voucher = await Voucher.findById(record.voucherId);
        if (voucher) {
          await reverseLedgerBalances(voucher.entries);
          await voucher.deleteOne();
        }
      } catch (vErr) {
        console.warn('[MilkCollection] Voucher reversal failed (non-fatal):', vErr.message);
      }
    }

    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FARMER HISTORY ────────────────────────────────────────────────────────────
export const getFarmerHistory = async (req, res) => {
  try {
    const { farmerNumber } = req.params;
    const { fromDate, toDate, shift, page = 1, limit = 50 } = req.query;

    const query = { companyId: req.companyId, farmerNumber };
    if (shift) query.shift = shift;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate)   query.date.$lte = new Date(toDate);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await MilkCollection.countDocuments(query);

    const records = await MilkCollection.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, data: records, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FARMER-WISE SUMMARY (aggregation) ────────────────────────────────────────
export const getFarmerWiseSummary = async (req, res) => {
  try {
    const { fromDate, toDate, shift, collectionCenter } = req.query;

    const match = { companyId: req.companyId };

    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) match.date.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        match.date.$lte = to;
      }
    }
    if (shift)            match.shift            = shift;
    if (collectionCenter) match.collectionCenter = new (await import('mongoose')).default.Types.ObjectId(collectionCenter);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id:          '$farmerNumber',
          farmerName:   { $first: '$farmerName' },
          farmerId:     { $first: '$farmer' },
          totalEntries: { $sum: 1 },
          amEntries:    { $sum: { $cond: [{ $eq: ['$shift', 'AM'] }, 1, 0] } },
          pmEntries:    { $sum: { $cond: [{ $eq: ['$shift', 'PM'] }, 1, 0] } },
          totalQty:     { $sum: '$qty' },
          avgFat:       { $avg: '$fat' },
          avgClr:       { $avg: '$clr' },
          avgSnf:       { $avg: '$snf' },
          avgRate:      { $avg: '$rate' },
          totalIncentive: { $sum: '$incentive' },
          totalAmount:  { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await MilkCollection.aggregate(pipeline);

    const result = rows.map(r => ({
      farmerNumber:   r._id,
      farmerName:     r.farmerName   || '',
      farmerId:       r.farmerId,
      totalEntries:   r.totalEntries,
      amEntries:      r.amEntries,
      pmEntries:      r.pmEntries,
      totalQty:       parseFloat(r.totalQty.toFixed(2)),
      avgFat:         parseFloat(r.avgFat.toFixed(2)),
      avgClr:         parseFloat(r.avgClr.toFixed(1)),
      avgSnf:         parseFloat(r.avgSnf.toFixed(2)),
      avgRate:        parseFloat(r.avgRate.toFixed(2)),
      totalIncentive: parseFloat(r.totalIncentive.toFixed(2)),
      totalAmount:    parseFloat(r.totalAmount.toFixed(2)),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in farmer-wise summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FARMER STATS (10-day avg or custom days) ──────────────────────────────────
export const getFarmerStats = async (req, res) => {
  try {
    const { farmerNumber } = req.params;
    const days = parseInt(req.query.days) || 10;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const records = await MilkCollection.find({
      companyId: req.companyId,
      farmerNumber,
      date: { $gte: fromDate }
    }).sort({ date: -1 });

    if (!records.length) {
      return res.json({
        success: true,
        data: { avgQty: 0, avgFat: 0, avgClr: 0, avgSnf: 0, avgRate: 0, totalAmount: 0, count: 0 }
      });
    }

    const count      = records.length;
    const avgQty     = records.reduce((s, r) => s + r.qty,    0) / count;
    const avgFat     = records.reduce((s, r) => s + r.fat,    0) / count;
    const avgClr     = records.reduce((s, r) => s + r.clr,    0) / count;
    const avgSnf     = records.reduce((s, r) => s + r.snf,    0) / count;
    const avgRate    = records.reduce((s, r) => s + r.rate,   0) / count;
    const totalAmount= records.reduce((s, r) => s + r.amount, 0);

    res.json({
      success: true,
      data: {
        avgQty:     parseFloat(avgQty.toFixed(2)),
        avgFat:     parseFloat(avgFat.toFixed(2)),
        avgClr:     parseFloat(avgClr.toFixed(1)),
        avgSnf:     parseFloat(avgSnf.toFixed(2)),
        avgRate:    parseFloat(avgRate.toFixed(2)),
        totalAmount:parseFloat(totalAmount.toFixed(2)),
        count
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

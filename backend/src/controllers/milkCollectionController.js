import fs from 'fs';
import XLSX from 'xlsx';
import mongoose from 'mongoose';
import MilkCollection from '../models/MilkCollection.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import MilkSales from '../models/MilkSales.js';
import { generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances, findOrCreateLedger } from '../utils/accountingHelper.js';
import { recomputeFarmerEligibility, recomputeFarmersEligibility } from '../utils/farmerEligibilityHelper.js';

// ── Auto-post bulk milk purchase to PRODUCERS DUES / MILK PURCHASE ────────────
// Day Book derives the milk-purchase entry directly from MilkCollection
// (one combined AM+PM line per day), so no per-collection or per-shift
// vouchers are posted here — that previously produced 3 duplicate Day Book
// entries per day. Kept as a no-op so existing call sites remain.
const postBulkMilkPurchaseVouchers = async (/* docs, companyId */) => {
  return;
};

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

    // Note: Day Book auto-posts a single combined AM+PM line per day directly
    // from the MilkCollection records, so no per-collection voucher is created
    // here (previously this produced one extra duplicate Day Book entry per
    // farmer-collection on top of the daily aggregation).

    const populated = await MilkCollection.findById(entry._id)
      .populate('collectionCenter', 'centerName')
      .populate('agent', 'agentName')
      .populate('farmer', 'farmerNumber personalDetails.name');

    if (entry.farmer) {
      try { await recomputeFarmerEligibility(entry.farmer, req.companyId); }
      catch (elErr) { console.warn('[MilkCollection] Eligibility recompute failed (non-fatal):', elErr.message); }
    }

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
      date, shift, collectionCenter, centreId, farmerNumber,
      fromDate, toDate,
      page = 1, limit = 200,
      lean,
    } = req.query;

    const query = { companyId: req.companyId };

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0);     query.date.$gte = s; }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23, 59, 59, 999); query.date.$lte = t; }
    }

    if (shift)        query.shift        = shift;
    if (farmerNumber) query.farmerNumber = farmerNumber;
    const effectiveCenter = collectionCenter || centreId;
    if (effectiveCenter) {
      try { query.collectionCenter = new mongoose.Types.ObjectId(effectiveCenter); }
      catch { query.collectionCenter = effectiveCenter; }
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await MilkCollection.countDocuments(query);

    // For large exports, skip populate and use lean() for much faster query
    const isLean = lean === 'true' || parseInt(limit) >= 1000;
    let q = MilkCollection.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit));
    if (isLean) {
      q = q.lean();
    } else {
      q = q.populate('collectionCenter', 'centerName').populate('agent', 'agentName');
    }
    const records = await q;

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

    const existing = await MilkCollection.findOne(
      { _id: req.params.id, companyId: req.companyId },
      { farmer: 1 }
    );

    const record = await MilkCollection.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    try {
      const farmersToRecompute = new Set();
      if (record.farmer) farmersToRecompute.add(String(record.farmer));
      if (existing?.farmer) farmersToRecompute.add(String(existing.farmer));
      await recomputeFarmersEligibility([...farmersToRecompute], req.companyId);
    } catch (elErr) {
      console.warn('[MilkCollection] Eligibility recompute failed (non-fatal):', elErr.message);
    }

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

    if (record.farmer) {
      try { await recomputeFarmerEligibility(record.farmer, req.companyId); }
      catch (elErr) { console.warn('[MilkCollection] Eligibility recompute failed (non-fatal):', elErr.message); }
    }

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

// ── DATE SUMMARY (for bulk delete picker) ─────────────────────────────────────
// GET /milk-collections/date-summary?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// Returns [{ date, shift, count }] so the frontend can show a date checkbox list.
export const getDateSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'fromDate and toDate required' });

    const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(toDate);   end.setHours(23, 59, 59, 999);

    const rows = await MilkCollection.aggregate([
      { $match: { companyId: req.companyId, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            date:  { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
            shift: '$shift'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.shift': 1 } }
    ]);

    res.json({
      success: true,
      data: rows.map(r => ({ date: r._id.date, shift: r._id.shift, count: r.count }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BULK DELETE ───────────────────────────────────────────────────────────────
// POST /milk-collections/bulk-delete
// Body: { slots: [{ date: 'YYYY-MM-DD', shift: 'AM'|'PM'|null }, ...] }
// Deletes all records matching any slot + reverses vouchers.
export const bulkDeleteCollections = async (req, res) => {
  try {
    const { slots } = req.body;
    const companyId = req.companyId;

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, message: 'slots array required' });
    }

    const makeStart = (d) => { const s = new Date(d); s.setHours(0, 0, 0, 0); return s; };
    const makeEnd   = (d) => { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; };

    // Build $or conditions for each slot
    const orConditions = slots.map(slot => {
      const cond = { date: { $gte: makeStart(slot.date), $lte: makeEnd(slot.date) } };
      if (slot.shift) cond.shift = slot.shift;
      return cond;
    });

    const filter = { companyId, $or: orConditions };

    const records = await MilkCollection.find(filter, { _id: 1, voucherId: 1 }).lean();
    if (records.length === 0) {
      return res.json({ success: true, deleted: 0, message: 'No records found for selected dates' });
    }

    // Reverse all linked vouchers
    const voucherIds = records.map(r => r.voucherId).filter(Boolean);
    for (const vid of voucherIds) {
      try {
        const voucher = await Voucher.findById(vid);
        if (voucher) {
          await reverseLedgerBalances(voucher.entries);
          await voucher.deleteOne();
        }
      } catch (vErr) {
        console.warn('[BulkDelete] Voucher reversal failed (non-fatal):', vErr.message);
      }
    }

    const ids = records.map(r => r._id);
    await MilkCollection.deleteMany({ _id: { $in: ids } });

    res.json({ success: true, deleted: records.length, message: `${records.length} records deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ZIBITT BROWSER IMPORT ─────────────────────────────────────────────────────
// Accepts raw Zibitt DailyCollection rows parsed in the browser (any file size).
// Uses mapDailyCollectionRow so all Zibitt columns (Collection_Id, Supplier_ID,
// Rt_Date, Shift 0/1, CowFAT/CLR/SNF/QtyLtr/Rate/Amount, TimeIncentive …) are
// handled identically to the server-side file upload path.
export const zibittBrowserImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ success: false, message: 'No records provided' });

    const companyId = req.companyId;

    // Map raw Zibitt column names → internal field names
    const mapped = records.map((r, i) => mapDailyCollectionRow(r, i));

    // Farmer lookup: first by farmerNumber, fallback by memberId
    const uniqueNums = [...new Set(mapped.map(r => r.farmerNumber).filter(Boolean))];
    const farmers = await Farmer.find(
      { farmerNumber: { $in: uniqueNums }, companyId },
      { farmerNumber: 1, memberId: 1, 'personalDetails.name': 1 }
    ).lean();
    const farmerMap = {};
    for (const f of farmers)
      farmerMap[String(f.farmerNumber)] = { id: f._id, name: f.personalDetails?.name || '' };

    const unresolved = uniqueNums.filter(n => !farmerMap[n]);
    if (unresolved.length) {
      const byMember = await Farmer.find(
        { memberId: { $in: unresolved }, companyId },
        { memberId: 1, 'personalDetails.name': 1 }
      ).lean();
      for (const f of byMember)
        if (f.memberId) farmerMap[String(f.memberId)] = { id: f._id, name: f.personalDetails?.name || '' };
    }

    const unlinked = [];
    const docs = [];
    for (const r of mapped) {
      const fm = farmerMap[r.farmerNumber];
      if (!fm) unlinked.push(r.farmerNumber);
      docs.push({ ...r, farmer: fm?.id ?? null, farmerName: fm?.name ?? '', companyId });
    }

    if (!docs.length)
      return res.status(400).json({ success: false, message: 'No records to import' });

    const CHUNK = 1000;
    let inserted = 0, duplicates = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError' || err.code === 11000) {
          const ok = err.result?.insertedCount ?? err.result?.nInserted ?? err.insertedDocs?.length ?? 0;
          inserted   += ok;
          duplicates += docs.slice(i, i + CHUNK).length - ok;
        } else throw err;
      }
    }

    await postBulkMilkPurchaseVouchers(docs, companyId);
    await recomputeFarmersEligibility(docs.map(d => d.farmer), companyId);

    const uniqueUnlinked = [...new Set(unlinked)];
    let msg = `${inserted} imported`;
    if (duplicates)            msg += `, ${duplicates} skipped (duplicate)`;
    if (uniqueUnlinked.length) msg += ` | ${uniqueUnlinked.length} Supplier IDs not linked to farmer`;

    res.status(201).json({
      success: true,
      data: { inserted, skipped: duplicates, unlinked: uniqueUnlinked.length, total: records.length },
      message: msg
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── LinZA IMPORT (Merged OpenLyssa export: Nos/BillDate/Shift/Ltr/Fat/Clr/Snf/Rate/Incent/Amt) ──
export const linzaImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ success: false, message: 'No records provided' });

    const companyId = req.companyId;

    const allFarmers = await Farmer.find({ companyId }, 'farmerNumber memberId personalDetails.name _id').lean();
    const farmerMap = {};
    const addToMap = (key, val) => {
      const k = String(key).trim();
      if (!k) return;
      farmerMap[k] = val;
      const numeric = String(parseInt(k, 10));
      if (numeric !== k && numeric !== 'NaN') farmerMap[numeric] = val;
    };
    for (const f of allFarmers) {
      if (f.farmerNumber) addToMap(f.farmerNumber, { id: f._id, name: f.personalDetails?.name || '' });
    }
    for (const f of allFarmers) {
      if (f.memberId && !farmerMap[String(f.memberId)])
        addToMap(f.memberId, { id: f._id, name: f.personalDetails?.name || '' });
    }

    const parseLinZADate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
      const str = String(val).trim();
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      const d = new Date(str);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const docs = [];
    const unmatched = [];

    for (const row of records) {
      const nos = String(row.Nos ?? row.nos ?? '').trim();
      const nosNum = String(parseInt(nos, 10));
      const fm = farmerMap[nos] ?? farmerMap[nosNum];
      if (!fm && nos) unmatched.push(nos);

      docs.push({
        billNo:       String(row.BillNo ?? row.billno ?? `LNZ-${nos}`),
        date:         parseLinZADate(row.BillDate ?? row.billdate),
        shift:        parseShift(row),
        farmer:       fm ? fm.id : null,
        farmerNumber: nos,
        farmerName:   fm ? fm.name : String(row.Name ?? ''),
        qty:          Number(row.Ltr    ?? row.ltr    ?? row.qty    ?? 0) || 0,
        fat:          Number(row.Fat    ?? row.fat    ?? 0),
        clr:          Number(row.Clr    ?? row.clr    ?? 0),
        snf:          Number(row.Snf    ?? row.snf    ?? 0),
        rate:         Number(row.Rate   ?? row.rate   ?? 0),
        incentive:    Number(row.Incent ?? row.incent ?? row.incentive ?? 0),
        amount:       Number(row.Amt    ?? row.amt    ?? row.Amount  ?? 0),
        companyId,
      });
    }

    if (!docs.length)
      return res.status(400).json({ success: false, message: 'No records to import' });

    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.code === 11000) inserted += err.result?.nInserted ?? 0;
        else throw err;
      }
    }

    await postBulkMilkPurchaseVouchers(docs, companyId);
    await recomputeFarmersEligibility(docs.map(d => d.farmer), companyId);

    const uniqueUnmatched = [...new Set(unmatched)];
    const dupSkipped = docs.length - inserted;
    const msg = uniqueUnmatched.length
      ? `${inserted} imported (${uniqueUnmatched.length} Nos not found: ${uniqueUnmatched.slice(0, 5).join(', ')}${uniqueUnmatched.length > 5 ? '…' : ''})`
      : `${inserted} records imported`;

    res.status(201).json({ success: true, data: { inserted, skipped: dupSkipped, unmatchedFarmers: uniqueUnmatched.length }, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── OPENLYSSA IMPORT (Date/Shift/mc_id/producer_id/slno/qty/kg/fat/clr/snf/rate/amount/incentive) ──
export const openLyssaImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ success: false, message: 'No records provided' });

    const companyId = req.companyId;

    // Build farmer lookup map by farmerNumber and memberId
    const allFarmers = await Farmer.find({ companyId }, 'farmerNumber memberId personalDetails.name _id').lean();
    const farmerMap = {};
    for (const f of allFarmers) {
      if (f.farmerNumber) farmerMap[String(f.farmerNumber).trim()] = { id: f._id, name: f.personalDetails?.name || '' };
    }
    for (const f of allFarmers) {
      const mid = String(f.memberId || '').trim();
      if (mid && !farmerMap[mid]) farmerMap[mid] = { id: f._id, name: f.personalDetails?.name || '' };
    }

    const parseOLDate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
      if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400000));
      const s = String(val).trim();
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
      const d = new Date(s);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const docs = [];
    const unmatched = new Set();

    for (let idx = 0; idx < records.length; idx++) {
      const row = records[idx];
      const producerId = String(row.producer_id ?? row.Producer_Id ?? row.PRODUCER_ID ?? '').trim();
      const fm = farmerMap[producerId];
      if (!fm && producerId) unmatched.add(producerId);

      const dateVal = parseOLDate(row.Date ?? row.date ?? row.DATE);
      const dateStr = dateVal.toISOString().slice(0, 10).replace(/-/g, '');
      const slno    = row.slno ?? row.Slno ?? row.SLNO ?? (idx + 1);
      const shift   = (() => {
        const s = String(row.Shift ?? row.shift ?? row.SHIFT ?? 'AM').toUpperCase().trim();
        if (s === 'AM' || s === 'PM') return s;
        return s === '0' || s === '1' ? 'AM' : 'PM';
      })();

      docs.push({
        billNo:       `OL-${dateStr}-${slno}`,
        date:         dateVal,
        shift,
        farmer:       fm ? fm.id : null,
        farmerNumber: producerId,
        farmerName:   fm ? fm.name : '',
        qty:          Number(row.qty ?? row.Qty ?? row.QTY ?? 0) || 0,
        fat:          Number(row.fat ?? row.Fat ?? row.FAT ?? 0),
        clr:          Number(row.clr ?? row.Clr ?? row.CLR ?? 0),
        snf:          Number(row.snf ?? row.Snf ?? row.SNF ?? 0),
        rate:         Number(row.rate ?? row.Rate ?? row.RATE ?? 0),
        amount:       Number(row.amount ?? row.Amount ?? row.AMOUNT ?? 0),
        incentive:    Number(row.incentive ?? row.Incentive ?? row.INCENTIVE ?? 0),
        companyId,
      });
    }

    if (!docs.length)
      return res.status(400).json({ success: false, message: 'No records to import' });

    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.code === 11000) inserted += err.result?.nInserted ?? 0;
        else throw err;
      }
    }

    await postBulkMilkPurchaseVouchers(docs, companyId);
    await recomputeFarmersEligibility(docs.map(d => d.farmer), companyId);

    const dupSkipped = docs.length - inserted;
    const um = [...unmatched];
    const msg = um.length
      ? `${inserted} imported (${um.length} producer IDs not matched: ${um.slice(0,5).join(', ')}${um.length > 5 ? '…' : ''})`
      : `${inserted} records imported`;

    res.status(201).json({ success: true, data: { inserted, skipped: dupSkipped, unmatched: um.length }, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── BULK IMPORT  (Zibitt DailyCollection / CSV — no accounting vouchers) ──────
export const bulkImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    // Resolve supplier numbers → Farmer ObjectIds
    // First pass: match by farmerNumber; second pass: match unresolved by memberId
    const uniqueNumbers = [...new Set(records.map(r => String(r.farmerNumber || '')).filter(Boolean))];
    const farmers = await Farmer.find(
      { farmerNumber: { $in: uniqueNumbers }, companyId: req.companyId },
      { farmerNumber: 1, memberId: 1, 'personalDetails.name': 1 }
    ).lean();
    const farmerMap = {};
    for (const f of farmers) farmerMap[f.farmerNumber] = { id: f._id, name: f.personalDetails?.name || '' };

    // Fallback: numbers not found by farmerNumber → try memberId (members in Zibitt/OpenlyPSSA)
    const unmatched = uniqueNumbers.filter(n => !farmerMap[n]);
    if (unmatched.length > 0) {
      const memberFarmers = await Farmer.find(
        { memberId: { $in: unmatched }, companyId: req.companyId },
        { memberId: 1, farmerNumber: 1, 'personalDetails.name': 1 }
      ).lean();
      for (const f of memberFarmers) {
        if (f.memberId) farmerMap[f.memberId] = { id: f._id, name: f.personalDetails?.name || '' };
      }
    }

    const skipped = [];
    const docs = [];
    for (const r of records) {
      const fn = String(r.farmerNumber || '');
      const fm = farmerMap[fn];
      if (!fm) { skipped.push(fn); continue; }
      docs.push({ ...r, date: parseAnyDate(r.date), farmer: fm.id, farmerName: r.farmerName || fm.name, farmerNumber: fn, companyId: req.companyId });
    }

    if (docs.length === 0) {
      const unknown = [...new Set(skipped)].slice(0, 10).join(', ');
      return res.status(400).json({ success: false, message: `No matching farmers found. Unknown numbers: ${unknown}` });
    }

    let inserted = 0;
    try {
      const result = await MilkCollection.insertMany(docs, { ordered: false });
      inserted = result.length;
    } catch (err) {
      if (err.name === 'BulkWriteError' || err.code === 11000) {
        inserted = err.result?.nInserted ?? 0;
      } else {
        throw err;
      }
    }

    // Auto-post to PRODUCERS DUES / MILK PURCHASE
    await postBulkMilkPurchaseVouchers(docs, req.companyId);
    await recomputeFarmersEligibility(docs.map(d => d.farmer), req.companyId);

    const unknown = [...new Set(skipped)].slice(0, 5).join(', ');
    const msg = skipped.length
      ? `${inserted} imported, ${skipped.length} skipped (farmer not found: ${unknown}${skipped.length > 5 ? '…' : ''})`
      : `${inserted} records imported`;

    res.status(201).json({ success: true, data: { inserted, skipped: skipped.length }, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── FILE UPLOAD IMPORT  (server-side parse — handles large files >50 MB) ──────
// Maps Zibitt DailyCollection AND OpenLyssa mc_proc_detail columns
const parseAnyDate = (v) => {
  if (!v && v !== 0) return new Date();
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000));
  const s = String(v).trim();
  // DD-MM-YYYY or DD-MM-YYYY HH:MM
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};

const parseShift = (row) => {
  // Zibitt raw DB: Shift 0=AM, 1=PM  |  CSV export: Shift 'AM'/'PM'
  // OpenLyssa: mc_time='AM'/'PM', shift_id=1/2, col_mode=D/M
  if (row.Shift != null) {
    const s = String(row.Shift).toUpperCase().trim();
    if (s === 'AM' || s === 'PM') return s;
    return s === '0' ? 'AM' : 'PM';
  }
  if (row.shift != null) {
    const s = String(row.shift).toUpperCase().trim();
    if (s === 'AM' || s === 'PM') return s;
    return s === '0' ? 'AM' : 'PM';
  }
  if (row.mc_time) { const t = String(row.mc_time).toUpperCase(); return t.includes('AM') ? 'AM' : 'PM'; }
  if (row.col_mode) return String(row.col_mode).toUpperCase() === 'D' ? 'AM' : 'PM';
  if (row.shift_id) return String(row.shift_id) === '1' ? 'AM' : 'PM';
  return 'AM';
};

const mapDailyCollectionRow = (row, idx) => {
  // Build a unique billNo:
  // 1. Collection_Id — globally unique in Zibitt DB (best)
  // 2. Date + Receipt_NO composite — Receipt_NO resets each month so
  //    combining it with the date makes it unique across months/sheets
  // 3. Fallback to row index
  const colId     = row.Collection_Id ?? row.collection_id ?? row.CollectionId;
  const receiptNo = row.Receipt_NO    ?? row.ReceiptNo    ?? row.receipt_no ?? row.slno;
  const rtDate    = String(row.Rt_Date ?? row.rt_date ?? row.Date ?? row.date ?? '').replace(/\//g, '-').trim();
  let billNo;
  if (colId) {
    billNo = String(colId);
  } else if (receiptNo && rtDate) {
    billNo = `${rtDate}-${receiptNo}`;
  } else if (receiptNo) {
    billNo = String(receiptNo);
  } else {
    billNo = `ZB-${idx + 1}`;
  }
  return {
  billNo,
  date:         parseAnyDate(row.Rt_Date ?? row.rt_date ?? row.Date ?? row.date ?? row.mc_date ?? ''),
  shift:        parseShift(row),
  farmerNumber: String(row.Supplier_ID ?? row.supplier_id ?? row.SupplierId ?? row.producer_id ?? ''),
  qty:          Number(row.CowQtyLtr ?? row.cowqtyltr ?? row.Qty ?? row.qty ?? 0) || Number(row.CowQtyKG ?? row.cowqtykg ?? 0) || 0,
  fat:          Number(row.CowFAT ?? row.cowfat ?? row.FAT ?? row.fat ?? 0),
  clr:          Number(row.CowCLR ?? row.cowclr ?? row.CLR ?? row.clr ?? 0),
  snf:          Number(row.CowSNF ?? row.cowsnf ?? row.SNF ?? row.snf ?? 0),
  rate:         Number(row.CowRate ?? row.cowrate ?? row.Rate ?? row.rate ?? 0),
  amount:       Number(row.Amount ?? row.amount ?? 0),
  incentive:    Number(row.TimeIncentive ?? row.timeincentive ?? row.incentive ?? 0),
  };
};

export const fileUploadImportCollections = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    filePath = req.file.path;

    // Parse file server-side — detect semicolon-delimited CSV (Zibitt export)
    // Parse file server-side — detect semicolon-delimited CSV (Zibitt export)
    const raw = fs.readFileSync(filePath);
    const sample = raw.slice(0, 4000).toString('utf8');
    const semiCount  = (sample.match(/;/g)  || []).length;
    const commaCount = (sample.match(/,/g)  || []).length;
    const opts = { type: 'buffer', cellDates: false, sheetStubs: false, defval: '' };
    if (semiCount > commaCount) opts.FS = ';';

    const wb = XLSX.read(raw, opts);

    // Read ALL sheets and combine — Zibitt exports often split data across
    // multiple sheets (one per month/year/centre). Only reading sheet[0] would
    // silently drop all other sheets.
    let allRows = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      allRows = allRows.concat(sheetRows);
    }

    if (!allRows.length) return res.status(400).json({ success: false, message: 'File is empty' });

    const rows = allRows.filter(r => Object.values(r).some(v => v !== '' && v !== null));
    console.log(`[MilkCollection Import] Sheets: ${wb.SheetNames.length}, Total rows: ${rows.length}, columns: ${Object.keys(rows[0] || {}).join(', ')}`);

    // Resolve supplier numbers → Farmer ObjectIds
    // First pass: match by farmerNumber; second pass: match unresolved by memberId
    const mapped = rows.map((r, i) => mapDailyCollectionRow(r, i));
    const uniqueNums = [...new Set(mapped.map(r => r.farmerNumber).filter(Boolean))];
    const farmers = await Farmer.find(
      { farmerNumber: { $in: uniqueNums }, companyId: req.companyId },
      { farmerNumber: 1, memberId: 1, 'personalDetails.name': 1 }
    ).lean();
    const farmerMap = {};
    for (const f of farmers) farmerMap[f.farmerNumber] = { id: f._id, name: f.personalDetails?.name || '' };

    // Fallback: numbers not found by farmerNumber → try memberId (members in Zibitt/OpenlyPSSA)
    const unmatched = uniqueNums.filter(n => !farmerMap[n]);
    if (unmatched.length > 0) {
      const memberFarmers = await Farmer.find(
        { memberId: { $in: unmatched }, companyId: req.companyId },
        { memberId: 1, farmerNumber: 1, 'personalDetails.name': 1 }
      ).lean();
      for (const f of memberFarmers) {
        if (f.memberId) farmerMap[f.memberId] = { id: f._id, name: f.personalDetails?.name || '' };
      }
    }

    const unlinked = [];
    const docs = [];
    for (const r of mapped) {
      const fm = farmerMap[r.farmerNumber];
      if (!fm) unlinked.push(r.farmerNumber);
      docs.push({
        ...r,
        farmer:     fm ? fm.id   : null,
        farmerName: fm ? fm.name : '',
        companyId: req.companyId
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ success: false, message: 'No records to import' });
    }

    // Insert in chunks of 1000 to avoid driver limits
    const CHUNK = 1000;
    let inserted = 0;
    let duplicates = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError' || err.code === 11000) {
          // Mongoose 9 / MongoDB driver 6: use insertedCount; fall back to nInserted / insertedDocs
          const ok = err.result?.insertedCount
            ?? err.result?.nInserted
            ?? err.insertedDocs?.length
            ?? 0;
          inserted   += ok;
          duplicates += (docs.slice(i, i + CHUNK).length - ok);
        } else {
          throw err;
        }
      }
    }

    // Only voucher-post the records that were actually inserted (not duplicates)
    const insertedDocs = docs.filter(d => d.billNo);   // all docs attempted

    const uniqueUnlinked = [...new Set(unlinked)];
    let msg = `${inserted} imported`;
    if (duplicates)             msg += `, ${duplicates} skipped (already exists)`;
    if (uniqueUnlinked.length)  msg += ` (${uniqueUnlinked.length} supplier IDs not linked to farmer — imported without farmer link)`;

    await postBulkMilkPurchaseVouchers(insertedDocs, req.companyId);
    await recomputeFarmersEligibility(insertedDocs.map(d => d.farmer), req.companyId);

    res.json({ success: true, data: { inserted, unlinked: uniqueUnlinked.length, total: rows.length }, message: msg });
  } catch (err) {
    console.error('[MilkCollection fileImport] Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    if (filePath) try { fs.unlinkSync(filePath); } catch (_) {}
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

// ── FARMER CRITERIA SUMMARY ───────────────────────────────────────────────────
// GET /milk-collections/summary/farmer-criteria
// Params: fromDate, toDate, memberType (all|member|nonMember),
//         minDays, minQty, minTotalSolid
// Returns per-farmer: totalDays, totalShifts, totalQty, avgFat, avgSnf, totalSolid, totalAmount, address
export const getFarmerCriteriaSummary = async (req, res) => {
  try {
    const { fromDate, toDate, memberType, minDays, minQty, minTotalSolid } = req.query;

    const match = { companyId: req.companyId };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0); match.date.$gte = s; }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23, 59, 59, 999); match.date.$lte = t; }
    }

    // Stage 1: Sum per farmer per day (to count distinct days correctly)
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            farmerNumber: '$farmerNumber',
            dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } }
          },
          farmerId:    { $first: '$farmer' },
          farmerName:  { $first: '$farmerName' },
          shifts:      { $sum: 1 },
          dayQty:      { $sum: '$qty' },
          dayFatQty:   { $sum: { $multiply: ['$qty', '$fat'] } },
          daySnfQty:   { $sum: { $multiply: ['$qty', '$snf'] } },
          dayAmount:   { $sum: '$amount' },
        }
      },
      // Stage 2: Aggregate per farmer (each doc = 1 day)
      {
        $group: {
          _id:         '$_id.farmerNumber',
          farmerId:    { $first: '$farmerId' },
          farmerName:  { $first: '$farmerName' },
          totalDays:   { $sum: 1 },
          totalShifts: { $sum: '$shifts' },
          totalQty:    { $sum: '$dayQty' },
          totalFatQty: { $sum: '$dayFatQty' },
          totalSnfQty: { $sum: '$daySnfQty' },
          totalAmount: { $sum: '$dayAmount' },
        }
      },
      // Stage 3: Derived fields
      {
        $addFields: {
          avgFat:     { $cond: [{ $gt: ['$totalQty', 0] }, { $divide: ['$totalFatQty', '$totalQty'] }, 0] },
          avgSnf:     { $cond: [{ $gt: ['$totalQty', 0] }, { $divide: ['$totalSnfQty', '$totalQty'] }, 0] },
          totalSolid: { $cond: [{ $gt: ['$totalQty', 0] }, { $divide: [{ $add: ['$totalFatQty', '$totalSnfQty'] }, '$totalQty'] }, 0] },
        }
      },
    ];

    // Stage 4: Apply criteria HAVING filters
    const criteriaMatch = {};
    if (minDays    && parseFloat(minDays)    > 0) criteriaMatch.totalDays   = { $gte: parseFloat(minDays) };
    if (minQty     && parseFloat(minQty)     > 0) criteriaMatch.totalQty    = { $gte: parseFloat(minQty) };
    if (minTotalSolid && parseFloat(minTotalSolid) > 0) criteriaMatch.totalSolid = { $gte: parseFloat(minTotalSolid) };
    if (Object.keys(criteriaMatch).length) pipeline.push({ $match: criteriaMatch });

    // Stage 5: Lookup farmer for address + membership
    pipeline.push(
      { $lookup: { from: 'farmers', localField: 'farmerId', foreignField: '_id', as: 'fd' } },
      {
        $addFields: {
          farmerDoc:  { $arrayElemAt: ['$fd', 0] },
        }
      },
      {
        $addFields: {
          isMember: { $ifNull: ['$farmerDoc.isMembership', false] },
          address: {
            $trim: {
              input: {
                $reduce: {
                  input: [
                    { $ifNull: ['$farmerDoc.address.place',   ''] },
                    { $ifNull: ['$farmerDoc.address.village', ''] },
                    { $ifNull: ['$farmerDoc.address.post',    ''] },
                  ],
                  initialValue: '',
                  in: {
                    $cond: [
                      { $eq: ['$$value', ''] },
                      '$$this',
                      { $cond: [{ $eq: ['$$this', ''] }, '$$value', { $concat: ['$$value', ', ', '$$this'] }] }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      { $project: { fd: 0, farmerDoc: 0 } }
    );

    // Stage 6: Membership filter
    if (memberType === 'member')    pipeline.push({ $match: { isMember: true } });
    if (memberType === 'nonMember') pipeline.push({ $match: { isMember: { $ne: true } } });

    pipeline.push({ $sort: { _id: 1 } });

    const rows = await MilkCollection.aggregate(pipeline);

    const f2 = v => parseFloat(Number(v || 0).toFixed(2));
    const f3 = v => parseFloat(Number(v || 0).toFixed(3));
    const result = rows.map(r => ({
      farmerNumber: r._id,
      farmerName:   r.farmerName || '',
      address:      r.address    || '',
      isMember:     r.isMember   || false,
      totalDays:    r.totalDays  || 0,
      totalShifts:  r.totalShifts || 0,
      totalQty:     f3(r.totalQty),
      avgFat:       f2(r.avgFat),
      avgSnf:       f2(r.avgSnf),
      totalSolid:   f2(r.totalSolid),
      totalAmount:  f2(r.totalAmount),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Farmer criteria summary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── FARMER-WISE SUMMARY (aggregation) ────────────────────────────────────────
export const getFarmerWiseSummary = async (req, res) => {
  try {
    const { fromDate, toDate, shift, collectionCenter } = req.query;

    const match = { companyId: req.companyId };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0); match.date.$gte = s; }
      if (toDate) { const to = new Date(toDate); to.setHours(23, 59, 59, 999); match.date.$lte = to; }
    }
    if (shift)            match.shift            = shift;
    if (collectionCenter) match.collectionCenter = new mongoose.Types.ObjectId(collectionCenter);

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'farmers', localField: 'farmer', foreignField: '_id', as: 'farmerDoc' } },
      { $addFields: { isMember: { $ifNull: [{ $arrayElemAt: ['$farmerDoc.isMembership', 0] }, false] } } },
      {
        $group: {
          _id:            '$farmerNumber',
          farmerName:     { $first: '$farmerName' },
          farmerId:       { $first: '$farmer' },
          isMember:       { $first: '$isMember' },
          totalEntries:   { $sum: 1 },
          amEntries:      { $sum: { $cond: [{ $eq: ['$shift', 'AM'] }, 1, 0] } },
          pmEntries:      { $sum: { $cond: [{ $eq: ['$shift', 'PM'] }, 1, 0] } },
          totalQty:       { $sum: '$qty' },
          avgFat:         { $avg: '$fat' },
          avgClr:         { $avg: '$clr' },
          avgSnf:         { $avg: '$snf' },
          avgRate:        { $avg: '$rate' },
          totalIncentive: { $sum: '$incentive' },
          totalAmount:    { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await MilkCollection.aggregate(pipeline);
    const f2 = v => parseFloat(Number(v || 0).toFixed(2));
    const result = rows.map(r => ({
      farmerNumber:   r._id,
      farmerName:     r.farmerName   || '',
      farmerId:       r.farmerId,
      isMember:       r.isMember     || false,
      totalEntries:   r.totalEntries,
      amEntries:      r.amEntries,
      pmEntries:      r.pmEntries,
      totalQty:       f2(r.totalQty),
      avgFat:         f2(r.avgFat),
      avgClr:         parseFloat(Number(r.avgClr || 0).toFixed(1)),
      avgSnf:         f2(r.avgSnf),
      avgRate:        f2(r.avgRate),
      totalIncentive: f2(r.totalIncentive),
      totalAmount:    f2(r.totalAmount),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in farmer-wise summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FARMER-WISE STATEMENT (date-wise AM/PM detail per farmer) ─────────────────
export const getFarmerWiseStatement = async (req, res) => {
  try {
    const { farmerSearch, fromDate, toDate } = req.query;
    const match = { companyId: req.companyId };

    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0); match.date.$gte = s; }
      if (toDate) { const d = new Date(toDate); d.setHours(23, 59, 59, 999); match.date.$lte = d; }
    }
    if (farmerSearch) {
      match.$or = [
        { farmerNumber: { $regex: farmerSearch, $options: 'i' } },
        { farmerName:   { $regex: farmerSearch, $options: 'i' } }
      ];
    }

    const records = await MilkCollection.find(match)
      .sort({ farmerNumber: 1, date: 1, shift: 1 })
      .lean();

    const f2 = v => +Number(v || 0).toFixed(2);
    const f1 = v => +Number(v || 0).toFixed(1);

    // Group: farmerNumber → dateKey → { amList[], pmList[] }
    // Using lists so that multiple entries per shift on the same day are all preserved
    const farmerMap = new Map();
    for (const rec of records) {
      const fn = rec.farmerNumber;
      if (!farmerMap.has(fn)) farmerMap.set(fn, { farmerNumber: fn, farmerName: rec.farmerName || '', dateMap: new Map() });
      const farmer = farmerMap.get(fn);
      const d = rec.date;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!farmer.dateMap.has(dateKey)) farmer.dateMap.set(dateKey, { date: dateKey, amList: [], pmList: [] });
      const sess = { qty: rec.qty||0, clr: rec.clr||0, fat: rec.fat||0, snf: rec.snf||0, rate: rec.rate||0, incentive: rec.incentive||0, value: rec.amount||0 };
      if (rec.shift === 'AM') farmer.dateMap.get(dateKey).amList.push(sess);
      else farmer.dateMap.get(dateKey).pmList.push(sess);
    }

    const result = [];
    for (const [, farmer] of farmerMap) {
      // Build one row per "slot" — when a day has 2 AM entries and 1 PM entry,
      // produce 2 rows: row[0] = { am: amList[0], pm: pmList[0] }, row[1] = { am: amList[1], pm: null }
      const rows = [];
      for (const day of farmer.dateMap.values()) {
        const slots = Math.max(day.amList.length, day.pmList.length, 1);
        for (let i = 0; i < slots; i++) {
          const am = day.amList[i] || null;
          const pm = day.pmList[i] || null;
          rows.push({
            date: day.date,
            am,
            pm,
            totalQty:   f2((am?.qty||0) + (pm?.qty||0)),
            totalValue: f2((am?.value||0) + (pm?.value||0))
          });
        }
      }

      const amR = rows.filter(r => r.am);
      const pmR = rows.filter(r => r.pm);
      const amAvg = (key) => amR.length ? f2(amR.reduce((s,r)=>s+r.am[key],0)/amR.length) : 0;
      const pmAvg = (key) => pmR.length ? f2(pmR.reduce((s,r)=>s+r.pm[key],0)/pmR.length) : 0;

      const amQty   = f2(amR.reduce((s,r)=>s+r.am.qty,0));
      const amInc   = f2(amR.reduce((s,r)=>s+r.am.incentive,0));
      const amValue = f2(amR.reduce((s,r)=>s+r.am.value,0));
      const pmQty   = f2(pmR.reduce((s,r)=>s+r.pm.qty,0));
      const pmInc   = f2(pmR.reduce((s,r)=>s+r.pm.incentive,0));
      const pmValue = f2(pmR.reduce((s,r)=>s+r.pm.value,0));

      result.push({
        farmerNumber: farmer.farmerNumber,
        farmerName:   farmer.farmerName,
        rows,
        totals: {
          amQty,
          amClr:       amR.length ? f1(amR.reduce((s,r)=>s+r.am.clr,0)/amR.length) : 0,
          amFat:       amAvg('fat'),
          amSnf:       amAvg('snf'),
          amRate:      amAvg('rate'),
          amIncentive: amInc,
          amValue,
          pmQty,
          pmClr:       pmR.length ? f1(pmR.reduce((s,r)=>s+r.pm.clr,0)/pmR.length) : 0,
          pmFat:       pmAvg('fat'),
          pmSnf:       pmAvg('snf'),
          pmRate:      pmAvg('rate'),
          pmIncentive: pmInc,
          pmValue,
          totalQty:    f2(amQty + pmQty),
          totalValue:  f2(amValue + pmValue),
          amCount:     amR.length,
          pmCount:     pmR.length
        }
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in farmer-wise statement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── DATE-WISE SUMMARY ─────────────────────────────────────────────────────────
export const getDateWiseSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;
    const f2 = v => +Number(v || 0).toFixed(2);
    const f3 = v => +Number(v || 0).toFixed(3);

    const dateFilter = {};
    if (fromDate) { const s = new Date(fromDate); s.setHours(0,0,0,0); dateFilter.$gte = s; }
    if (toDate)   { const t = new Date(toDate); t.setHours(23,59,59,999); dateFilter.$lte = t; }
    const dateMatch = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const SCHOOL_CATS = new Set(['School', 'Anganwadi']);

    // 1. Purchase — member/non-member per date
    const purchaseAgg = await MilkCollection.aggregate([
      { $match: { companyId, ...dateMatch } },
      { $lookup: { from: 'farmers', localField: 'farmer', foreignField: '_id', as: 'fd' } },
      { $addFields: {
        isMember: { $ifNull: [{ $arrayElemAt: ['$fd.isMembership', 0] }, false] },
        dateStr:  { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
      }},
      { $group: {
        _id:       { dateStr: '$dateStr', isMember: '$isMember' },
        farmerIds: { $addToSet: '$farmerNumber' },
        qty:       { $sum: '$qty' },
        amount:    { $sum: '$amount' },
      }},
      { $sort: { '_id.dateStr': 1 } },
    ]);

    // 2. Sales — local / credit / school / sample per date
    const salesAgg = await MilkSales.aggregate([
      { $match: { companyId, ...dateMatch } },
      { $lookup: { from: 'customers', localField: 'creditorId', foreignField: '_id', as: 'cred' } },
      { $addFields: {
        category: { $ifNull: [{ $arrayElemAt: ['$cred.category', 0] }, 'Others'] },
        dateStr:  { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
      }},
      { $group: {
        _id:    { dateStr: '$dateStr', saleMode: '$saleMode', category: '$category' },
        qty:    { $sum: '$litre' },
        amount: { $sum: '$amount' },
      }},
      { $sort: { '_id.dateStr': 1 } },
    ]);

    // Build slot map
    const slotMap = {};
    const slot = d => {
      if (!slotMap[d]) slotMap[d] = {
        memNos: 0, memQty: 0, memAmt: 0,
        nonMemNos: 0, nonMemQty: 0, nonMemAmt: 0,
        localQty: 0, localAmt: 0,
        creditQty: 0, creditAmt: 0,
        schoolQty: 0, schoolAmt: 0,
        sampleQty: 0, sampleAmt: 0,
      };
      return slotMap[d];
    };

    for (const c of purchaseAgg) {
      const s = slot(c._id.dateStr);
      if (c._id.isMember) {
        s.memNos += c.farmerIds.length; s.memQty += c.qty; s.memAmt += c.amount;
      } else {
        s.nonMemNos += c.farmerIds.length; s.nonMemQty += c.qty; s.nonMemAmt += c.amount;
      }
    }

    for (const x of salesAgg) {
      const s = slot(x._id.dateStr);
      if      (x._id.saleMode === 'LOCAL')               { s.localQty  += x.qty; s.localAmt  += x.amount; }
      else if (x._id.saleMode === 'SAMPLE')              { s.sampleQty += x.qty; s.sampleAmt += x.amount; }
      else if (SCHOOL_CATS.has(x._id.category))         { s.schoolQty += x.qty; s.schoolAmt += x.amount; }
      else                                               { s.creditQty += x.qty; s.creditAmt += x.amount; }
    }

    const result = Object.entries(slotMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, s]) => {
        const totalNos = s.memNos + s.nonMemNos;
        const totalQty = s.memQty + s.nonMemQty;
        const totalAmt = s.memAmt + s.nonMemAmt;
        return {
          date:       dateStr,
          memNos:     s.memNos,      memQty: f3(s.memQty),    memAmt: f2(s.memAmt),
          nonMemNos:  s.nonMemNos,   nonMemQty: f3(s.nonMemQty), nonMemAmt: f2(s.nonMemAmt),
          totalNos,                  totalQty: f3(totalQty),   totalAmt: f2(totalAmt),
          avgRate: totalQty > 0 ? f2(totalAmt / totalQty) : 0,
          localQty:  f3(s.localQty),  localAmt:  f2(s.localAmt),
          creditQty: f3(s.creditQty), creditAmt: f2(s.creditAmt),
          schoolQty: f3(s.schoolQty), schoolAmt: f2(s.schoolAmt),
          sampleQty: f3(s.sampleQty), sampleAmt: f2(s.sampleAmt),
        };
      });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Date-wise summary error:', err);
    res.status(500).json({ success: false, message: err.message });
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

// ── DAIRYSOFT IMPORT ─────────────────────────────────────────────────────────
// Accepts rows from DairySoft export Excel with columns:
// Bill No, Farmer No, Farmer Name, Date (DD/MM/YYYY), Shift, Litres, KG, FAT %, CLR, SNF %, Incentive (₹), Rate/L (₹), Amount (₹)
// Records with unmatched farmer numbers are imported with farmer=null (name taken from file).
export const dairysoftImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ success: false, message: 'No records provided' });

    const companyId = req.companyId;

    const allFarmers = await Farmer.find({ companyId }, 'farmerNumber memberId personalDetails.name _id').lean();
    const farmerMap = {};
    const addToMap = (key, val) => {
      const k = String(key).trim();
      if (!k) return;
      farmerMap[k] = val;
      const numeric = String(parseInt(k, 10));
      if (numeric !== k && numeric !== 'NaN') farmerMap[numeric] = val;
    };
    for (const f of allFarmers) {
      if (f.farmerNumber) addToMap(f.farmerNumber, { id: f._id, name: f.personalDetails?.name || '' });
    }
    for (const f of allFarmers) {
      if (f.memberId && !farmerMap[String(f.memberId)])
        addToMap(f.memberId, { id: f._id, name: f.personalDetails?.name || '' });
    }

    const parseDSDate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
      if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400000));
      const str = String(val).trim();
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      const d = new Date(str);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const docs = [];
    const unmatched = [];

    for (const row of records) {
      const farmerNo = String(row['Farmer No'] ?? row['FarmerNo'] ?? row['farmer_no'] ?? row['farmerNo'] ?? '').trim();
      const farmerNoNum = String(parseInt(farmerNo, 10));
      const fm = farmerMap[farmerNo] ?? farmerMap[farmerNoNum];
      if (!fm && farmerNo) unmatched.push(farmerNo);

      const farmerNameFromFile = String(row['Farmer Name'] ?? row['FarmerName'] ?? row['farmerName'] ?? '').trim();
      const billNo = String(row['Bill No'] ?? row['BillNo'] ?? row['billNo'] ?? '').trim();
      const shift = (() => {
        const s = String(row['Shift'] ?? row['shift'] ?? 'AM').toUpperCase().trim();
        return (s === 'AM' || s === 'PM') ? s : 'AM';
      })();

      docs.push({
        billNo:       billNo ? `DS-${billNo}` : `DS-${farmerNo}-${docs.length + 1}`,
        date:         parseDSDate(row['Date'] ?? row['date']),
        shift,
        farmer:       fm ? fm.id : null,
        farmerNumber: farmerNo,
        farmerName:   fm ? fm.name : farmerNameFromFile,
        qty:          Number(row['Litres'] ?? row['litres'] ?? row['Qty'] ?? row['qty'] ?? 0) || 0,
        fat:          Number(row['FAT %'] ?? row['Fat %'] ?? row['fat'] ?? 0),
        clr:          Number(row['CLR'] ?? row['clr'] ?? 0),
        snf:          Number(row['SNF %'] ?? row['Snf %'] ?? row['snf'] ?? 0),
        rate:         Number(row['Rate/L (₹)'] ?? row['Rate/L'] ?? row['Rate'] ?? row['rate'] ?? 0),
        incentive:    Number(row['Incentive (₹)'] ?? row['Incentive'] ?? row['incentive'] ?? 0),
        amount:       Number(row['Amount (₹)'] ?? row['Amount'] ?? row['amount'] ?? 0),
        companyId,
      });
    }

    if (!docs.length)
      return res.status(400).json({ success: false, message: 'No records to import' });

    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.code === 11000) inserted += err.result?.nInserted ?? 0;
        else throw err;
      }
    }

    await recomputeFarmersEligibility(docs.map(d => d.farmer), companyId);

    const uniqueUnmatched = [...new Set(unmatched)];
    const dupSkipped = docs.length - inserted;
    const msg = uniqueUnmatched.length
      ? `${inserted} imported (${uniqueUnmatched.length} Farmer Nos not in system: ${uniqueUnmatched.slice(0, 5).join(', ')}${uniqueUnmatched.length > 5 ? '…' : ''} — imported with file name)`
      : `${inserted} records imported`;

    res.status(201).json({ success: true, data: { inserted, skipped: dupSkipped, unmatchedFarmers: uniqueUnmatched.length }, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Per-centre entry count for a given date (used by main centre indicator)
export const getCentreSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const start = new Date(date || new Date());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const rows = await MilkCollection.aggregate([
      { $match: { companyId: req.companyId, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$collectionCenter',
          count:       { $sum: 1 },
          totalQty:    { $sum: '$qty' },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'collectioncenters',
          localField: '_id',
          foreignField: '_id',
          as: 'centre'
        }
      },
      { $unwind: { path: '$centre', preserveNullAndEmpty: true } },
      {
        $project: {
          centreId:    '$_id',
          centreName:  { $ifNull: ['$centre.centerName', 'Main Centre'] },
          count:       1,
          totalQty:    1,
          totalAmount: 1
        }
      },
      { $sort: { centreName: 1 } }
    ]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── COLLECTION ANALYSIS — farmer-wise with Farmer profile join ─────────────────
export const getCollectionAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, shift, collectionCenter, memberType } = req.query;

    const match = { companyId: req.companyId };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0);   match.date.$gte = s; }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23, 59, 59, 999); match.date.$lte = t; }
    }
    if (shift)            match.shift            = shift;
    if (collectionCenter) match.collectionCenter = new mongoose.Types.ObjectId(collectionCenter);

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'farmers',
          localField: 'farmer',
          foreignField: '_id',
          as: 'farmerDoc',
        },
      },
      {
        $addFields: {
          farmerData: { $arrayElemAt: ['$farmerDoc', 0] },
          dateStr:    { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          isMember:   { $ifNull: [{ $arrayElemAt: ['$farmerDoc.isMembership', 0] }, false] },
        },
      },
      ...(memberType === 'member'    ? [{ $match: { isMember: true  } }] : []),
      ...(memberType === 'nonMember' ? [{ $match: { isMember: false } }] : []),
      {
        $group: {
          _id:            '$farmerNumber',
          farmerName:     { $first: '$farmerName' },
          memberId:       { $first: '$farmerData.memberId' },
          houseName:      { $first: '$farmerData.address.houseName' },
          gender:         { $first: '$farmerData.personalDetails.gender' },
          caste:          { $first: '$farmerData.personalDetails.caste' },
          farmerType:     { $first: '$farmerData.farmerType' },
          cowType:        { $first: '$farmerData.cowType' },
          isMember:       { $first: '$isMember' },
          totalSessions:  { $sum: 1 },
          amSessions:     { $sum: { $cond: [{ $eq: ['$shift', 'AM'] }, 1, 0] } },
          pmSessions:     { $sum: { $cond: [{ $eq: ['$shift', 'PM'] }, 1, 0] } },
          distinctDates:  { $addToSet: '$dateStr' },
          totalQty:       { $sum: '$qty' },
          avgFat:         { $avg: '$fat' },
          avgClr:         { $avg: '$clr' },
          avgSnf:         { $avg: '$snf' },
          avgRate:        { $avg: '$rate' },
          totalIncentive: { $sum: '$incentive' },
          totalAmount:    { $sum: '$amount' },
        },
      },
      { $addFields: { totalDays: { $size: '$distinctDates' } } },
      { $sort: { _id: 1 } },
    ];

    const rows = await MilkCollection.aggregate(pipeline);

    const f2 = v => parseFloat(Number(v || 0).toFixed(2));
    const f1 = v => parseFloat(Number(v || 0).toFixed(1));

    const result = rows.map(r => ({
      farmerNumber:   r._id,
      memberId:       r.memberId      || '',
      farmerName:     r.farmerName    || '',
      houseName:      r.houseName     || '',
      gender:         r.gender        || '',
      caste:          r.caste         || '',
      farmerType:     r.farmerType    || '',
      cowType:        r.cowType       || '',
      isMember:       r.isMember      || false,
      totalDays:      r.totalDays     || 0,
      totalSessions:  r.totalSessions || 0,
      amSessions:     r.amSessions    || 0,
      pmSessions:     r.pmSessions    || 0,
      totalQty:       f2(r.totalQty),
      avgFat:         f2(r.avgFat),
      avgClr:         f1(r.avgClr),
      avgSnf:         f2(r.avgSnf),
      avgRate:        f2(r.avgRate),
      totalIncentive: f2(r.totalIncentive),
      totalAmount:    f2(r.totalAmount),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in collection analysis:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Society Report ─────────────────────────────────────────────────────────────
export const getSocietyReport = async (req, res) => {
  try {
    const { fromDate, toDate, memberType } = req.query;
    const { default: mongoose } = await import('mongoose');

    const match = { companyId: req.companyId };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) { const s = new Date(fromDate); s.setHours(0, 0, 0, 0);    match.date.$gte = s; }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23, 59, 59, 999); match.date.$lte = t; }
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'farmers',
          localField: 'farmer',
          foreignField: '_id',
          as: 'farmerDoc',
        },
      },
      {
        $addFields: {
          farmerData: { $arrayElemAt: ['$farmerDoc', 0] },
          dateStr:    { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          isMember:   { $ifNull: [{ $arrayElemAt: ['$farmerDoc.isMembership', 0] }, false] },
        },
      },
      ...(memberType === 'member'    ? [{ $match: { isMember: true  } }] : []),
      ...(memberType === 'nonMember' ? [{ $match: { isMember: false } }] : []),
      {
        $group: {
          _id:           '$farmerNumber',
          farmerName:    { $first: '$farmerName' },
          place:         { $first: '$farmerData.address.place' },
          houseName:     { $first: '$farmerData.address.houseName' },
          isMember:      { $first: '$isMember' },
          totalSessions: { $sum: 1 },
          distinctDates: { $addToSet: '$dateStr' },
          totalQty:      { $sum: '$qty' },
          avgFat:        { $avg: '$fat' },
          avgSnf:        { $avg: '$snf' },
          totalAmount:   { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          totalDays:  { $size: '$distinctDates' },
          totalSolid: {
            $add: [
              { $ifNull: ['$avgFat', 0] },
              { $ifNull: ['$avgSnf', 0] },
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await MilkCollection.aggregate(pipeline);
    const f2 = v => parseFloat(Number(v || 0).toFixed(2));

    const result = rows.map(r => ({
      farmerNumber:  r._id,
      farmerName:    r.farmerName  || '',
      place:         r.place       || r.houseName || '',
      isMember:      r.isMember    || false,
      totalSessions: r.totalSessions || 0,
      totalDays:     r.totalDays   || 0,
      totalQty:      f2(r.totalQty),
      avgFat:        f2(r.avgFat),
      avgSnf:        f2(r.avgSnf),
      totalSolid:    f2(r.totalSolid),
      totalAmount:   f2(r.totalAmount),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in society report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


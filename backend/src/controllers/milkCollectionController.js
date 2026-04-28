import fs from 'fs';
import XLSX from 'xlsx';
import MilkCollection from '../models/MilkCollection.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import { generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances, findOrCreateLedger } from '../utils/accountingHelper.js';

// ── Auto-post bulk milk purchase to PRODUCERS DUES / MILK PURCHASE ────────────
// Groups docs by date+shift, creates one Journal voucher per group
const postBulkMilkPurchaseVouchers = async (docs, companyId) => {
  try {
    const groups = {};
    for (const doc of docs) {
      const dateKey = new Date(doc.date).toISOString().slice(0, 10);
      const key     = `${dateKey}-${doc.shift}`;
      if (!groups[key]) groups[key] = { date: new Date(doc.date), shift: doc.shift, total: 0 };
      groups[key].total += Number(doc.amount) || 0;
    }

    const [producerDues, milkPurchase] = await Promise.all([
      findOrCreateLedger('PRODUCERS DUES', 'Liability', 'Current Liabilities', 'Cr', companyId),
      findOrCreateLedger('MILK PURCHASE',  'Expense',   'Purchase Accounts',   'Dr', companyId)
    ]);

    for (const g of Object.values(groups)) {
      if (g.total <= 0) continue;
      const entries = [
        { ledgerId: producerDues._id, ledgerName: producerDues.ledgerName, debitAmount: g.total, creditAmount: 0 },
        { ledgerId: milkPurchase._id, ledgerName: milkPurchase.ledgerName, debitAmount: 0, creditAmount: g.total }
      ];
      const vNo = await generateVoucherNumber('MilkPurchase', companyId);
      await new Voucher({
        voucherType:   'MilkPurchase',
        voucherNumber: vNo,
        voucherDate:   g.date,
        entries,
        totalDebit:    g.total,
        totalCredit:   g.total,
        narration:     `Milk Purchase Import — ${g.date.toISOString().slice(0, 10)} (${g.shift})`,
        referenceType: 'MilkPurchase',
        companyId
      }).save();
      await updateLedgerBalances(entries);
    }
  } catch (vErr) {
    console.warn('[MilkCollection] Bulk voucher posting failed (non-fatal):', vErr.message);
  }
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

    // ── Auto-create Journal voucher: Dr PRODUCERS DUES / Cr MILK PURCHASE ──
    try {
      const [debitLedger, creditLedger] = await Promise.all([
        findOrCreateLedger('PRODUCERS DUES', 'Liability', 'Current Liabilities', 'Cr', req.companyId),
        findOrCreateLedger('MILK PURCHASE',  'Expense',   'Purchase Accounts',   'Dr', req.companyId)
      ]);
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

// ── ZIBITT RAW DB IMPORT ──────────────────────────────────────────────────────
//  Accepts raw Zibitt table rows: dcs_id, mc_id, slno, producer_id,
//  qty, fat, clr, snf, rate, amount, incentive, col_mode, date_entry
//  col_mode: D → AM (Morning),  M → PM (Evening)
export const zibittRawImportCollections = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const companyId = req.companyId;

    // Pre-load all farmers for O(1) lookup (farmerNumber + memberId fallback)
    const allFarmers = await Farmer.find(
      { companyId },
      'farmerNumber memberId personalDetails.name _id'
    ).lean();

    const farmerMap = {};
    for (const f of allFarmers) {
      if (f.farmerNumber) farmerMap[String(f.farmerNumber)] = { id: f._id, name: f.personalDetails?.name || '' };
    }
    for (const f of allFarmers) {
      if (f.memberId && !farmerMap[String(f.memberId)]) {
        farmerMap[String(f.memberId)] = { id: f._id, name: f.personalDetails?.name || '' };
      }
    }

    const parseDateTime = (row) => {
      const dateStr = row.date_entry || row.mc_date || row.date || '';
      if (!dateStr) return new Date();
      if (typeof dateStr === 'number') return new Date(Math.round((dateStr - 25569) * 86400000));
      const str = String(dateStr).trim();
      const [datePart, timePart] = str.split(' ');
      const parts = datePart.split(/[-/]/);
      if (parts.length !== 3) return new Date(str);
      // DD-MM-YYYY or YYYY-MM-DD
      const isYearFirst = parts[0].length === 4;
      const [dd, mm, yyyy] = isYearFirst ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
      return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${timePart || '00:00'}:00`);
    };

    const docs = [];
    const skipped = [];

    for (const row of records) {
      const producerId = String(row.producer_id || '');
      const fm = farmerMap[producerId];

      if (!fm) {
        skipped.push(producerId || `slno-${row.slno}`);
        continue;
      }

      docs.push({
        billNo:       `MC-${row.dcs_id || 0}-${row.mc_id || 0}-${row.producer_id}-${row.slno || 0}`,
        date:         parseDateTime(row),
        shift:        parseShift(row),
        farmer:       fm.id,
        farmerNumber: producerId,
        farmerName:   fm.name,
        qty:          Number(row.qty)       || 0,
        fat:          Number(row.fat)       || 0,
        clr:          Number(row.clr)       || 0,
        snf:          Number(row.snf)       || 0,
        rate:         Number(row.rate)      || 0,
        incentive:    Number(row.incentive) || 0,
        amount:       Number(row.amount)    || 0,
        companyId,
      });
    }

    if (docs.length === 0) {
      const unknown = [...new Set(skipped)].slice(0, 10).join(', ');
      return res.status(400).json({ success: false, message: `No matching farmers found. Unknown producer_ids: ${unknown}` });
    }

    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
          inserted += err.result?.nInserted ?? 0;
        } else {
          throw err;
        }
      }
    }

    // Auto-post to PRODUCERS DUES / MILK PURCHASE
    await postBulkMilkPurchaseVouchers(docs, companyId);

    const unknownSample = [...new Set(skipped)].slice(0, 5).join(', ');
    const totalSkipped = skipped.length + (docs.length - inserted);
    const msg = skipped.length
      ? `${inserted} imported, ${totalSkipped} skipped (farmer not found: ${unknownSample}${skipped.length > 5 ? '…' : ''})`
      : `${inserted} records imported`;

    res.status(201).json({ success: true, data: { inserted, skipped: totalSkipped }, message: msg });
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
      docs.push({ ...r, farmer: fm.id, farmerName: r.farmerName || fm.name, farmerNumber: fn, companyId: req.companyId });
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
  // Zibitt: Shift 0=AM, 1=PM  |  OpenLyssa: mc_time='AM'/'PM', shift_id=1/2, col_mode=D/M
  if (row.Shift != null) return String(row.Shift) === '0' ? 'AM' : 'PM';
  if (row.shift != null) return String(row.shift) === '0' ? 'AM' : 'PM';
  if (row.mc_time) { const t = String(row.mc_time).toUpperCase(); return t.includes('AM') ? 'AM' : 'PM'; }
  if (row.col_mode) return String(row.col_mode).toUpperCase() === 'D' ? 'AM' : 'PM';
  if (row.shift_id) return String(row.shift_id) === '1' ? 'AM' : 'PM';
  return 'AM';
};

const mapDailyCollectionRow = (row, idx) => ({
  billNo:       String(row.Receipt_NO ?? row.ReceiptNo ?? row.receipt_no ?? row.slno ?? `ZB-${idx + 1}`),
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
});

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
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!jsonData.length) return res.status(400).json({ success: false, message: 'File is empty' });

    const rows = jsonData.filter(r => Object.values(r).some(v => v !== '' && v !== null));
    console.log(`[MilkCollection Import] File rows: ${rows.length}, columns: ${Object.keys(rows[0] || {}).join(', ')}`);

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

    const skipped = [];
    const docs = [];
    for (const r of mapped) {
      const fm = farmerMap[r.farmerNumber];
      if (!fm) { skipped.push(r.farmerNumber); continue; }
      docs.push({ ...r, farmer: fm.id, farmerName: fm.name, companyId: req.companyId });
    }

    if (docs.length === 0) {
      const unknown = [...new Set(skipped)].slice(0, 10).join(', ');
      return res.status(400).json({ success: false, message: `No matching farmers found. Unknown producer numbers: ${unknown}` });
    }

    // Insert in chunks of 1000 to avoid driver limits
    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      try {
        const result = await MilkCollection.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.name === 'BulkWriteError' || err.code === 11000) {
          inserted += err.result?.nInserted ?? 0;
        } else {
          throw err;
        }
      }
    }

    const unknownSample = [...new Set(skipped)].slice(0, 5).join(', ');
    const msg = skipped.length
      ? `${inserted} imported, ${skipped.length} skipped (farmer not found: ${unknownSample}${skipped.length > 5 ? '…' : ''})`
      : `${inserted} records imported`;

    await postBulkMilkPurchaseVouchers(docs, req.companyId);

    res.json({ success: true, data: { inserted, skipped: skipped.length, total: rows.length }, message: msg });
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

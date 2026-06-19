import fs from 'fs';
import XLSX from 'xlsx';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import {
  generateVoucherNumber,
  updateLedgerBalances,
  reverseLedgerBalances,
  findOrCreateLedger,
} from '../utils/accountingHelper.js';

// Resolve a ledger by name from the user's Ledger Management, tolerating case
// and whitespace differences. Falls back to creating one only if the user has
// no matching ledger at all (e.g., on a fresh company before seeding).
async function resolveLedger(name, ledgerType, parentGroup, balanceType, companyId) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Ledger.findOne({
    companyId,
    ledgerName: { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' },
  });
  if (existing) return existing;
  return findOrCreateLedger(name, ledgerType, parentGroup, balanceType, companyId);
}

// ── Auto-post Union Sales adjustment voucher (Day Book only) ─────────────────
//   Dr MILMA UNION   (expenditure side)
//   Cr UNION SALES   (income side)
// Both legs are non-cash, so nothing shows in Cash Book — Day Book picks the
// Journal voucher's debit on the payment side and credit on the receipt side.
// Ledgers are resolved from the user's Ledger Management (case-insensitive).
async function createUnionSalesVoucher(slip, companyId) {
  const amount = parseFloat(slip.amount) || 0;
  if (amount <= 0) return null;

  const [milmaUnion, unionSales] = await Promise.all([
    resolveLedger('MILMA UNION', 'Advance due to Society', 'ASSET',  'Dr', companyId),
    resolveLedger('UNION SALES', 'Sales',                  'INCOME', 'Cr', companyId),
  ]);

  const shiftNote = slip.time ? ` (${slip.time})` : '';
  const entries = [
    { ledgerId: milmaUnion._id, ledgerName: milmaUnion.ledgerName, debitAmount: amount, creditAmount: 0,      narration: `Union Sales${shiftNote}` },
    { ledgerId: unionSales._id, ledgerName: unionSales.ledgerName, debitAmount: 0,      creditAmount: amount, narration: `Union Sales${shiftNote}` },
  ];
  const voucherNumber = await generateVoucherNumber('Journal', companyId);
  const voucher = new Voucher({
    voucherType:   'Journal',
    voucherNumber,
    voucherDate:   slip.date,
    entries,
    totalDebit:    amount,
    totalCredit:   amount,
    narration:     `Union Sales — ${slip.slipNo || ''}${shiftNote} | Qty: ${slip.qty} L | Rate: ${slip.rate}`,
    referenceType: 'UnionSales',
    referenceId:   slip._id,
    companyId,
  });
  await voucher.save();
  await updateLedgerBalances(entries);
  return voucher;
}

async function reverseUnionSalesVoucher(slip) {
  if (!slip?.voucherId) return;
  try {
    const voucher = await Voucher.findById(slip.voucherId);
    if (voucher) {
      await reverseLedgerBalances(voucher.entries);
      await voucher.deleteOne();
    }
  } catch (err) {
    console.warn('[UnionSales] Voucher reversal failed (non-fatal):', err.message);
  }
}

// ── Auto-generate slip number: USS-YYMM-XXXXX ─────────────────────────────
const generateSlipNo = async (companyId) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `USS-${yy}${mm}-`;

  const last = await UnionSalesSlip.findOne(
    { companyId, slipNo: { $regex: `^${prefix}` } },
    { slipNo: 1 },
    { sort: { slipNo: -1 } }
  );

  let seq = 1;
  if (last) {
    const parts = last.slipNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
};

// ── CREATE ─────────────────────────────────────────────────────────────────
export const createSlip = async (req, res) => {
  try {
    const { date, time } = req.body;

    // Duplicate check: same date + time for this company
    const dateObj = new Date(date);
    dateObj.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const existing = await UnionSalesSlip.findOne({
      companyId: req.companyId,
      date: { $gte: dateObj, $lt: nextDay },
      time,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A Union Sales Slip already exists for ${new Date(date).toLocaleDateString('en-IN')} - ${time} session.`,
      });
    }

    const slipNo = await generateSlipNo(req.companyId);

    // Auto-calculate amount
    const qty = parseFloat(req.body.qty) || 0;
    const rate = parseFloat(req.body.rate) || 0;
    const amount = parseFloat((qty * rate).toFixed(2));

    const slip = new UnionSalesSlip({
      ...req.body,
      slipNo,
      amount,
      date: dateObj,
      companyId: req.companyId,
      createdBy: req.user?._id,
    });

    await slip.save();

    // Auto-post Day Book adjustment: Dr MILMA UNION / Cr UNION SALES
    try {
      const voucher = await createUnionSalesVoucher(slip, req.companyId);
      if (voucher) {
        slip.voucherId = voucher._id;
        await slip.save();
      }
    } catch (vErr) {
      console.warn('[UnionSales] Voucher creation failed (non-fatal):', vErr.message);
    }

    res.status(201).json({ success: true, data: slip });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record already exists for this Date and Time session.',
      });
    }
    console.error('Error creating union sales slip:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET ALL ────────────────────────────────────────────────────────────────
export const getAllSlips = async (req, res) => {
  try {
    const {
      month, year, fromDate, toDate,
      time, search,
      page = 1, limit = 100,
      sortField = 'date', sortOrder = 'desc',
    } = req.query;

    const query = { companyId: req.companyId };

    // Month + Year filter
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    if (time) query.time = time;

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDir };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await UnionSalesSlip.countDocuments(query);

    let records = await UnionSalesSlip.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Search filter (client-side friendly, applied after fetch)
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(r =>
        r.slipNo?.toLowerCase().includes(q) ||
        r.time?.toLowerCase().includes(q)
      );
    }

    // Monthly totals aggregation
    const totals = await UnionSalesSlip.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$qty' },
          totalAmount: { $sum: '$amount' },
          totalUnionSpoilage: { $sum: '$unionSpoilage' },
          totalTransportationSpoilage: { $sum: '$transportationSpoilage' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: records,
      totals: totals[0] || { totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0, count: 0 },
      pagination: {
        currentPage: parseInt(page),
        total,
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching union sales slips:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET SINGLE ─────────────────────────────────────────────────────────────
export const getSlipById = async (req, res) => {
  try {
    const slip = await UnionSalesSlip.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: slip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ─────────────────────────────────────────────────────────────────
export const updateSlip = async (req, res) => {
  try {
    const { date, time, qty, rate } = req.body;

    // Duplicate check: same date + time (exclude self)
    if (date && time) {
      const dateObj = new Date(date);
      dateObj.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      const duplicate = await UnionSalesSlip.findOne({
        companyId: req.companyId,
        date: { $gte: dateObj, $lt: nextDay },
        time,
        _id: { $ne: req.params.id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Another record already exists for ${new Date(date).toLocaleDateString('en-IN')} - ${time} session.`,
        });
      }
    }

    // Recalculate amount if qty or rate changed
    const updates = { ...req.body };
    if (qty !== undefined || rate !== undefined) {
      const existing = await UnionSalesSlip.findById(req.params.id);
      const newQty = parseFloat(qty ?? existing?.qty ?? 0);
      const newRate = parseFloat(rate ?? existing?.rate ?? 0);
      updates.amount = parseFloat((newQty * newRate).toFixed(2));
    }

    // Normalize date
    if (updates.date) {
      const d = new Date(updates.date);
      d.setUTCHours(0, 0, 0, 0);
      updates.date = d;
    }

    const { slipNo, companyId, createdBy, ...safeUpdates } = updates;

    const slip = await UnionSalesSlip.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );

    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });

    // Re-post the Day Book voucher to reflect any qty/rate/date/time changes
    try {
      await reverseUnionSalesVoucher(slip);
      const voucher = await createUnionSalesVoucher(slip, req.companyId);
      slip.voucherId = voucher?._id;
      await slip.save();
    } catch (vErr) {
      console.warn('[UnionSales] Voucher refresh failed (non-fatal):', vErr.message);
    }

    res.json({ success: true, data: slip });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record already exists for this Date and Time session.',
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE ─────────────────────────────────────────────────────────────────
export const deleteSlip = async (req, res) => {
  try {
    const slip = await UnionSalesSlip.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });

    // Reverse the Day Book voucher
    await reverseUnionSalesVoucher(slip);

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── BACKFILL VOUCHERS ─────────────────────────────────────────────────────
// Posts the Day Book journal voucher (Dr MILMA UNION / Cr UNION SALES) for any
// existing Union Sales slip that doesn't already have one. Safe to re-run.
export const backfillVouchers = async (req, res) => {
  try {
    const slips = await UnionSalesSlip.find({
      companyId: req.companyId,
      $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
      amount: { $gt: 0 },
    }).sort({ date: 1, time: 1 });

    const result = { total: slips.length, posted: 0, skipped: 0, errors: [] };

    for (const slip of slips) {
      try {
        const voucher = await createUnionSalesVoucher(slip, req.companyId);
        if (voucher) {
          slip.voucherId = voucher._id;
          await slip.save();
          result.posted++;
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors.push({ slipNo: slip.slipNo, message: err.message });
        result.skipped++;
      }
    }

    res.json({
      success: true,
      message: `Backfill complete: ${result.posted} posted, ${result.skipped} skipped`,
      data: result,
    });
  } catch (error) {
    console.error('Union sales backfill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Date parser: DD-MM-YYYY string or Excel serial ─────────────────────────
const parseDairyDate = (v) => {
  if (!v) return null;
  if (typeof v === 'number' && v > 1000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const d = new Date(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

// ── Dairy Access DB column resolver ────────────────────────────────────────
const resolveDairyRow = (row, cols) => {
  const find = (...names) => {
    for (const n of names) {
      const c = cols.find(c => c.toLowerCase() === n.toLowerCase());
      if (c !== undefined) return c;
    }
    return null;
  };

  const parseNum = (val) => parseFloat(String(val ?? '').replace(/,/g, '')) || 0;

  const dateCol     = find('DDate', 'Date', 'CollDate', 'Rt_Date');
  const shiftCol    = find('Shift', 'shift');
  const toQtyCol    = find('ToQTY', 'ToQty', 'To_QTY', 'To_Qty');
  const fromQtyCol  = find('FromQTY', 'FromQty', 'From_QTY', 'From_Qty');
  const toFatCol    = find('ToFAT', 'ToFat', 'To_FAT');
  const fromFatCol  = find('FromFAT', 'FromFat', 'From_FAT');
  const toSnfCol    = find('ToSNF', 'ToSnf', 'To_SNF');
  const fromSnfCol  = find('FromSNF', 'FromSnf', 'From_SNF');
  const toRateCol   = find('ToRate', 'To_Rate', 'ToRATE');
  const fromRateCol = find('FromRate', 'From_Rate', 'FromRATE');
  const toAmtCol    = find('ToAmount', 'ToAmt', 'To_Amount', 'To_Amt');
  const fromAmtCol  = find('FromAmount', 'FromAmt', 'From_Amount', 'From_Amt');

  const date = parseDairyDate(dateCol ? row[dateCol] : null);

  // Dairy union sales: Shift 0 = AM, 1 = PM
  const shiftRaw = shiftCol ? row[shiftCol] : '';
  const shiftNum = Number(shiftRaw);
  const time = shiftNum === 0 ? 'AM' : shiftNum === 1 ? 'PM'
             : String(shiftRaw).toUpperCase() === 'AM' ? 'AM' : 'PM';

  // Prefer To fields (milk sent to union); fallback to From
  const toQty   = toQtyCol   ? parseNum(row[toQtyCol])   : 0;
  const fromQty = fromQtyCol ? parseNum(row[fromQtyCol]) : 0;
  const qty     = toQty > 0 ? toQty : fromQty;

  const toFat   = toFatCol   ? parseNum(row[toFatCol])   : 0;
  const fromFat = fromFatCol ? parseNum(row[fromFatCol]) : 0;
  const fat     = toFat > 0 ? toFat : fromFat;

  const toSnf   = toSnfCol   ? parseNum(row[toSnfCol])   : 0;
  const fromSnf = fromSnfCol ? parseNum(row[fromSnfCol]) : 0;
  const snf     = toSnf > 0 ? toSnf : fromSnf;

  const toRate  = toRateCol  ? parseNum(row[toRateCol])  : 0;
  const fromRate= fromRateCol? parseNum(row[fromRateCol]) : 0;
  const rate    = toRate > 0 ? toRate : fromRate;

  const toAmt   = toAmtCol   ? parseNum(row[toAmtCol])   : 0;
  const fromAmt = fromAmtCol ? parseNum(row[fromAmtCol]) : 0;
  const amount  = toAmt > 0 ? toAmt : fromAmt > 0 ? fromAmt : parseFloat((qty * rate).toFixed(2));

  return { date, time, qty, fat, snf, rate, amount };
};

// ── Aggregate raw rows → one entry per Date+Shift ──────────────────────────
const aggregateByDateShift = (rows) => {
  const grouped = {};
  for (const r of rows) {
    if (!r.date || r.qty <= 0) continue;
    const dateKey = r.date.toISOString().slice(0, 10);
    const key = `${dateKey}-${r.time}`;
    if (!grouped[key]) {
      grouped[key] = { date: r.date, time: r.time, totalQty: 0, totalAmount: 0, fatSum: 0, snfSum: 0 };
    }
    const g = grouped[key];
    g.totalQty    += r.qty;
    g.totalAmount += r.amount;
    g.fatSum      += r.qty * r.fat;
    g.snfSum      += r.qty * r.snf;
  }
  return Object.values(grouped).map(g => ({
    date:   g.date,
    time:   g.time,
    qty:    parseFloat(g.totalQty.toFixed(3)),
    amount: parseFloat(g.totalAmount.toFixed(2)),
    fat:    parseFloat((g.fatSum / g.totalQty).toFixed(2)),
    snf:    parseFloat((g.snfSum / g.totalQty).toFixed(2)),
    rate:   parseFloat((g.totalAmount / g.totalQty).toFixed(4)),
  }));
};

// ── Shared insert logic (upsert — updates existing record if same date+time) ─
const processImportSlips = async (rows, companyId, userId) => {
  const results = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [], skipReasons: {} };
  const addSkip = (reason) => {
    results.skipReasons[reason] = (results.skipReasons[reason] || 0) + 1;
    results.skipped++;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      if (!row.date) { addSkip('No date'); continue; }
      if (!row.time) { addSkip('No time'); continue; }
      const qty = Number(row.qty) || 0;
      if (qty <= 0) { addSkip('Zero qty'); continue; }

      const d = new Date(row.date); d.setUTCHours(0, 0, 0, 0);
      const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);

      const amount                = Number(row.amount) || parseFloat((qty * (Number(row.rate) || 0)).toFixed(2));
      const fat                   = Number(row.fat) || 0;
      const snf                   = Number(row.snf) || 0;
      const rate                  = Number(row.rate) || 0;
      const unionSpoilage         = Number(row.unionSpoilage) || 0;
      const transportationSpoilage = Number(row.transportationSpoilage) || 0;
      const spoilage              = unionSpoilage > 0 || transportationSpoilage > 0;

      // Try to find existing record for same date + time
      const existing = await UnionSalesSlip.findOne({ companyId, time: row.time, date: { $gte: d, $lt: nextD } });

      if (existing) {
        const updated = await UnionSalesSlip.findByIdAndUpdate(
          existing._id,
          { $set: { qty, fat, snf, rate, amount, spoilage, unionSpoilage, transportationSpoilage } },
          { new: true }
        );
        results.updated++;
        try {
          await reverseUnionSalesVoucher(updated);
          const voucher = await createUnionSalesVoucher(updated, companyId);
          updated.voucherId = voucher?._id;
          await updated.save();
        } catch (vErr) {
          console.warn('[UnionSales] Voucher refresh failed (non-fatal):', vErr.message);
        }
      } else {
        const slipNo = await generateSlipNo(companyId);
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const slip = new UnionSalesSlip({
              slipNo: attempt === 0 ? slipNo : await generateSlipNo(companyId),
              date: d, time: row.time,
              qty, fat, snf, rate, amount,
              spoilage, unionSpoilage, transportationSpoilage,
              companyId, createdBy: userId,
            });
            await slip.save();
            try {
              const voucher = await createUnionSalesVoucher(slip, companyId);
              if (voucher) { slip.voucherId = voucher._id; await slip.save(); }
            } catch (vErr) {
              console.warn('[UnionSales] Voucher creation failed (non-fatal):', vErr.message);
            }
            results.created++;
            break;
          } catch (dupErr) {
            if (dupErr.code === 11000 && attempt < 4) continue;
            throw dupErr;
          }
        }
      }
    } catch (err) {
      results.errors.push({ row: rowNum, message: err.message });
      results.skipped++;
    }
  }
  return results;
};

// ── ZIBITT RAW DB IMPORT ─────────────────────────────────────────────────────
//  Raw fields: dcs_id, ms_id, ms_date (dd-mm-yyyy OR Excel serial), ms_time (AM/PM),
//  qty_ltr, fat, snf, rate, amount, union_spoilage, transit_spoilage
//  Aggregates by date+time before upserting — safe to re-run with any DCS count.
export const zibittRawImportSlips = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const parseZibittDate = (v) => {
      if (!v) return null;
      // JavaScript Date object (cellDates:true path)
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      // Excel serial number — XLSX.js default when cell is date-formatted
      if (typeof v === 'number' && v > 1000) {
        return new Date(Math.round((v - 25569) * 86400 * 1000));
      }
      const str = String(v).trim();
      if (!str) return null;
      // DD-MM-YYYY or YYYY-MM-DD (dash-separated)
      const dash = str.split('-');
      if (dash.length === 3) {
        let yyyy, mm, dd;
        if (dash[0].length === 4) { [yyyy, mm, dd] = dash; }
        else { [dd, mm, yyyy] = dash; }
        const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
        return isNaN(d.getTime()) ? null : d;
      }
      // DD/MM/YYYY or MM/DD/YYYY (slash-separated — assume DD/MM for India)
      const slash = str.split('/');
      if (slash.length === 3) {
        const [p0, p1, p2] = slash;
        const d = p2.length === 4
          ? new Date(`${p2}-${p1.padStart(2,'0')}-${p0.padStart(2,'0')}`) // DD/MM/YYYY
          : new Date(str);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    };

    const mapped = records.map(row => ({
      date:                   parseZibittDate(row.ms_date),
      time:                   String(row.ms_time || '').trim().toUpperCase() === 'PM' ? 'PM' : 'AM',
      // Use qty_ltr first; fall back to qty_kg if liters not recorded
      qty:                    parseFloat(row.qty_ltr) || parseFloat(row.qty_kg) || 0,
      fat:                    parseFloat(row.fat)              || 0,
      snf:                    parseFloat(row.snf)              || 0,
      rate:                   parseFloat(row.rate)             || 0,
      amount:                 parseFloat(row.amount)           || 0,
      unionSpoilage:          parseFloat(row.union_spoilage)   || 0,
      transportationSpoilage: parseFloat(row.transit_spoilage) || 0,
    }));

    // Aggregate by date+time — sum qty/amount/spoilage; weight-average fat/snf/rate
    const grouped = {};
    for (const r of mapped) {
      if (!r.date || r.qty <= 0) continue;
      const dateKey = r.date.toISOString().slice(0, 10);
      const key = `${dateKey}-${r.time}`;
      if (!grouped[key]) {
        grouped[key] = { date: r.date, time: r.time, totalQty: 0, totalAmount: 0, fatSum: 0, snfSum: 0, unionSpg: 0, transitSpg: 0 };
      }
      const g = grouped[key];
      g.totalQty    += r.qty;
      g.totalAmount += r.amount;
      g.fatSum      += r.qty * r.fat;
      g.snfSum      += r.qty * r.snf;
      g.unionSpg    += r.unionSpoilage;
      g.transitSpg  += r.transportationSpoilage;
    }
    const aggregated = Object.values(grouped).map(g => ({
      date:                   g.date,
      time:                   g.time,
      qty:                    parseFloat(g.totalQty.toFixed(3)),
      amount:                 parseFloat(g.totalAmount.toFixed(2)),
      fat:                    parseFloat((g.fatSum   / g.totalQty).toFixed(2)),
      snf:                    parseFloat((g.snfSum   / g.totalQty).toFixed(2)),
      rate:                   parseFloat((g.totalAmount / g.totalQty).toFixed(4)),
      unionSpoilage:          parseFloat(g.unionSpg.toFixed(3)),
      transportationSpoilage: parseFloat(g.transitSpg.toFixed(3)),
    }));

    if (!aggregated.length) {
      return res.status(400).json({
        success: false,
        message: `No valid rows found. Parsed ${mapped.length} rows but all had missing date or zero qty. Check ms_date format (DD-MM-YYYY) and qty_ltr column.`,
      });
    }

    const results = await processImportSlips(aggregated, req.companyId, req.user?._id);
    results.rawRows = mapped.length;
    results.aggregatedGroups = aggregated.length;

    res.json({
      success: true,
      data: results,
      message: `${results.created} created, ${results.updated} updated, ${results.skipped} skipped (from ${mapped.length} raw rows → ${aggregated.length} date/shift groups)`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── BULK IMPORT via JSON body ───────────────────────────────────────────────
export const bulkImportSlips = async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Records array is required' });
    }
    const results = await processImportSlips(records, req.companyId, req.user?._id);
    res.json({ success: true, message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`, data: results });
  } catch (error) {
    console.error('Union sales bulk import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FILE UPLOAD IMPORT (Zibitt DailyCollection export — aggregated) ────────
export const fileUploadImportSlips = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    filePath = req.file.path;

    // Read raw buffer — detect TSV vs CSV/Excel
    const raw = fs.readFileSync(filePath);
    const sample = raw.slice(0, 4000).toString('utf8');
    const tabCount   = (sample.match(/\t/g)  || []).length;
    const commaCount = (sample.match(/,(?!\d{3})/g) || []).length;
    const opts = { type: 'buffer', cellDates: false, sheetStubs: false, defval: '' };
    if (tabCount > commaCount) opts.FS = '\t';

    const wb = XLSX.read(raw, opts);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!jsonData.length) return res.status(400).json({ success: false, message: 'File is empty or has no data rows' });

    const nonEmptyData = jsonData.filter(row =>
      Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
    );
    if (!nonEmptyData.length) {
      return res.status(400).json({ success: false, message: 'File has no data rows (all rows are empty)' });
    }

    const cols = Object.keys(nonEmptyData[0]);
    console.log('[UnionSales Import] File columns:', cols);

    // Map all raw rows
    const allMapped = nonEmptyData.map(row => resolveDairyRow(row, cols));
    console.log('[UnionSales Import] First mapped row:', JSON.stringify(allMapped[0]));

    // Aggregate: one record per Date+Shift using weighted averages
    const aggregated = aggregateByDateShift(allMapped);

    if (!aggregated.length) {
      const sample = allMapped[0] || {};
      return res.status(400).json({
        success: false,
        message: `No valid rows found after aggregation.\nFile columns: ${cols.join(', ')}\nFirst row parsed: date=${sample.date}, qty=${sample.qty}, time=${sample.time}\nExpected columns: DDate/Rt_Date, Shift, FromQTY/ToQTY, FromFAT/ToFAT, FromSNF/ToSNF, FromAmount/ToAmount`,
      });
    }

    console.log(`[UnionSales Import] Raw rows: ${allMapped.length}, Aggregated groups: ${aggregated.length}`);

    const results = await processImportSlips(aggregated, req.companyId, req.user?._id);
    results.rawRows = allMapped.length;
    results.aggregatedGroups = aggregated.length;
    results.debugSample = aggregated.slice(0, 3).map(r => ({
      date: r.date ? r.date.toISOString().slice(0, 10) : null,
      time: r.time, qty: r.qty, fat: r.fat, snf: r.snf, rate: r.rate, amount: r.amount,
    }));
    res.json({ success: true, message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped (from ${allMapped.length} raw rows → ${aggregated.length} date/shift groups)`, data: results });
  } catch (error) {
    console.error('Union sales file import error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (filePath) fs.unlink(filePath, () => {});
  }
};

// ── UNION SALES REPORT ─────────────────────────────────────────────────────
//  GET /report?fromDate=&toDate=&time=
//  Returns raw records + pre-grouped summaries (byDate / byMonth / byYear)
export const getUnionSalesReport = async (req, res) => {
  try {
    const { fromDate, toDate, time } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(toDate);   end.setHours(23, 59, 59, 999);

    const match = { companyId: req.companyId, date: { $gte: start, $lte: end } };
    if (time) match.time = time;

    const records = await UnionSalesSlip.find(match).sort({ date: 1, time: 1 }).lean();

    // ── In-memory grouping helpers ───────────────────────────────
    const emptyBucket = () => ({
      amQty: 0, amAmount: 0, pmQty: 0, pmAmount: 0,
      totalQty: 0, totalAmount: 0,
      unionSpoilage: 0, transportSpoilage: 0, count: 0,
      fatSum: 0, snfSum: 0, fatCount: 0,
    });

    const addTo = (bucket, r) => {
      bucket.totalQty    += r.qty    || 0;
      bucket.totalAmount += r.amount || 0;
      bucket.unionSpoilage      += r.unionSpoilage      || 0;
      bucket.transportSpoilage  += r.transportationSpoilage || 0;
      bucket.count++;
      if (r.fat > 0) { bucket.fatSum += r.fat; bucket.snfSum += r.snf || 0; bucket.fatCount++; }
      if (r.time === 'AM') { bucket.amQty += r.qty || 0; bucket.amAmount += r.amount || 0; }
      else                 { bucket.pmQty += r.qty || 0; bucket.pmAmount += r.amount || 0; }
    };

    const summary  = emptyBucket();
    const dateMap  = {};
    const monthMap = {};
    const yearMap  = {};

    records.forEach(r => {
      addTo(summary, r);

      const d  = new Date(r.date);
      const dk = d.toISOString().split('T')[0];          // YYYY-MM-DD
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      const yk = String(d.getFullYear());                 // YYYY

      if (!dateMap[dk])  { dateMap[dk]  = { date: dk, ...emptyBucket() }; }
      if (!monthMap[mk]) { monthMap[mk] = { month: mk, year: d.getFullYear(), monthNum: d.getMonth() + 1, ...emptyBucket() }; }
      if (!yearMap[yk])  { yearMap[yk]  = { year: yk, ...emptyBucket() }; }

      addTo(dateMap[dk],  r);
      addTo(monthMap[mk], r);
      addTo(yearMap[yk],  r);
    });

    const finalize = (obj) => ({
      ...obj,
      avgFat: obj.fatCount > 0 ? +(obj.fatSum / obj.fatCount).toFixed(2) : 0,
      avgSnf: obj.fatCount > 0 ? +(obj.snfSum / obj.fatCount).toFixed(2) : 0,
    });

    const sortedDate  = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).map(finalize);
    const sortedMonth = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).map(finalize);
    const sortedYear  = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year)).map(finalize);

    res.json({
      success: true,
      data: {
        summary: finalize(summary),
        records,
        byDate:  sortedDate,
        byMonth: sortedMonth,
        byYear:  sortedYear,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

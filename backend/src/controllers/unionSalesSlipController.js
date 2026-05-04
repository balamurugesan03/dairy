import fs from 'fs';
import XLSX from 'xlsx';
import UnionSalesSlip from '../models/UnionSalesSlip.js';

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
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

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
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

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
      d.setHours(0, 0, 0, 0);
      updates.date = d;
    }

    const { slipNo, companyId, createdBy, ...safeUpdates } = updates;

    const slip = await UnionSalesSlip.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );

    if (!slip) return res.status(404).json({ success: false, message: 'Record not found' });
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
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
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
  const results = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      if (!row.date) { results.skipped++; continue; }
      if (!row.time) { results.skipped++; continue; }
      const qty = Number(row.qty) || 0;
      if (qty <= 0) { results.skipped++; continue; }

      const d = new Date(row.date); d.setHours(0, 0, 0, 0);
      const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);

      const amount = Number(row.amount) || parseFloat((qty * (Number(row.rate) || 0)).toFixed(2));
      const fat    = Number(row.fat) || 0;
      const snf    = Number(row.snf) || 0;
      const rate   = Number(row.rate) || 0;

      // Try to find existing record for same date + time
      const existing = await UnionSalesSlip.findOne({ companyId, time: row.time, date: { $gte: d, $lt: nextD } });

      if (existing) {
        // Update existing record with new aggregated values
        await UnionSalesSlip.findByIdAndUpdate(existing._id, { $set: { qty, fat, snf, rate, amount } });
        results.updated++;
      } else {
        // Insert new record
        const slipNo = await generateSlipNo(companyId);
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const slip = new UnionSalesSlip({
              slipNo: attempt === 0 ? slipNo : await generateSlipNo(companyId),
              date: d, time: row.time,
              qty, fat, snf, rate, amount,
              spoilage: false, unionSpoilage: 0, transportationSpoilage: 0,
              companyId, createdBy: userId,
            });
            await slip.save();
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
//  Raw fields: dcs_id, ms_id, ms_date (dd-mm-yyyy), ms_time (AM/PM),
//  qty_ltr, fat, snf, rate, amount, union_spoilage, transit_spoilage
//  Upserts by date+time — safe to re-run.
export const zibittRawImportSlips = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const str = String(dateStr);
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      const [yyyy, mm, dd] = parts; // ms_date is yyyy-mm-dd format
      const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
      return isNaN(d.getTime()) ? null : d;
    };

    const mapped = records.map(row => ({
      date:                   parseDate(row.ms_date),
      time:                   String(row.ms_time || '').toUpperCase() === 'PM' ? 'PM' : 'AM',
      qty:                    Number(row.qty_ltr)          || 0,
      fat:                    Number(row.fat)              || 0,
      snf:                    Number(row.snf)              || 0,
      rate:                   Number(row.rate)             || 0,
      amount:                 Number(row.amount)           || 0,
      spoilage:               Number(row.union_spoilage) > 0 || Number(row.transit_spoilage) > 0,
      unionSpoilage:          Number(row.union_spoilage)   || 0,
      transportationSpoilage: Number(row.transit_spoilage) || 0,
    }));

    const results = await processImportSlips(mapped, req.companyId, req.user?._id);
    res.json({
      success: true,
      data: results,
      message: `${results.created} created, ${results.updated} updated, ${results.skipped} skipped`
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

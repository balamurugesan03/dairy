import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { MilmaChartMaster, MilmaChartDetail } from '../models/MilmaChart.js';
import { isAdminUser } from '../utils/milkScope.js';

// ─── Helper: parse Excel date serial (e.g. 43727 → Date) ─────────────────────
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(val);
  if (typeof val === 'number') {
    // Excel serial: days since 1899-12-30
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SUPER-ADMIN: Upload Excel file for a specific company
//  POST /api/milma-charts/admin/upload
//  Body (multipart): companyId, file (xlsx)
// ════════════════════════════════════════════════════════════════════════════
export const uploadMilmaChart = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ success: false, message: 'companyId is required' });
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: 'Invalid companyId — must be a valid MongoDB ObjectId' });
    }
    if (!req.file)  return res.status(400).json({ success: false, message: 'Excel file is required' });

    // ── Parse workbook ────────────────────────────────────────────────────────
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    if (wb.SheetNames.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel must contain 2 sheets: rate chart detail + chart master' });
    }

    const detailSheet = wb.Sheets[wb.SheetNames[0]];
    const masterSheet = wb.Sheets[wb.SheetNames[1]];

    const detailRows = XLSX.utils.sheet_to_json(detailSheet, { defval: 0 });
    const masterRows = XLSX.utils.sheet_to_json(masterSheet, { defval: 0 });

    if (!detailRows.length) return res.status(400).json({ success: false, message: 'Rate chart detail sheet is empty' });
    if (!masterRows.length) return res.status(400).json({ success: false, message: 'Chart master sheet is empty' });

    // ── Count detail rows per chart_id (for rowCount denormalisation) ─────────
    const detailCounts = {};
    for (const row of detailRows) {
      detailCounts[row.chart_id] = (detailCounts[row.chart_id] || 0) + 1;
    }

    // ── Upsert Chart Masters ───────────────────────────────────────────────────
    const masterOps = masterRows.map(row => ({
      updateOne: {
        filter: { companyId, chartId: row.chart_id },
        update: {
          $set: {
            dateFrom:        parseExcelDate(row.date_from) || new Date(),
            rateSNF:         Number(row.rate_snf)          || 0,
            rateFAT:         Number(row.rate_fat)          || 0,
            subSNF:          Number(row.sub_snf)           || 0,
            subTotalSolids:  Number(row.sub_total_solids)  || 0,
            bestSNF:         Number(row.best_snf)          || 0,
            bestTotalSolids: Number(row.best_total_solids) || 0,
            remarks:         String(row.remarks || ''),
            rowCount:        detailCounts[row.chart_id]    || 0,
            source:          'Import',
          }
        },
        upsert: true,
      }
    }));
    await MilmaChartMaster.bulkWrite(masterOps, { ordered: false });

    // ── Bulk replace Chart Detail rows ────────────────────────────────────────
    // Only the chart versions in this file are replaced — other versions (earlier
    // imports, or versions the society created itself) are left untouched.
    // Use upsert so duplicate (chartId+fat+clr) rows within the Excel don't crash the import
    const fileChartIds = [...new Set(masterRows.map(r => Number(r.chart_id)))];
    await MilmaChartDetail.deleteMany({ companyId, chartId: { $in: fileChartIds } });

    const BATCH = 2000;
    for (let i = 0; i < detailRows.length; i += BATCH) {
      const ops = detailRows.slice(i, i + BATCH).map(row => ({
        updateOne: {
          filter: {
            companyId,
            chartId: Number(row.chart_id),
            fat:     Number(row.fat),
            clr:     Number(row.clr),
          },
          update: { $set: { snf: Number(row.snf), rate: Number(row.rate) } },
          upsert: true,
        }
      }));
      await MilmaChartDetail.bulkWrite(ops, { ordered: false });
    }

    res.json({
      success: true,
      message: `Uploaded ${masterRows.length} chart versions and ${detailRows.length} rate rows`,
      masterCount: masterRows.length,
      detailCount: detailRows.length,
    });
  } catch (err) {
    console.error('Milma chart upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  SUPER-ADMIN: Get detail rows for a specific chart version (paginated)
//  GET /api/milma-charts/admin/:companyId/detail?chartId=X&page=1&limit=100
// ════════════════════════════════════════════════════════════════════════════
export const adminGetDetail = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }
    const { chartId, page = 1, limit = 100 } = req.query;
    if (!chartId) return res.status(400).json({ success: false, message: 'chartId is required' });

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const query = { companyId: req.params.companyId, chartId: Number(chartId) };

    const [rows, total] = await Promise.all([
      MilmaChartDetail.find(query).sort({ fat: 1, clr: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      MilmaChartDetail.countDocuments(query),
    ]);

    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  SUPER-ADMIN: List chart masters for a company
//  GET /api/milma-charts/admin/:companyId/masters
// ════════════════════════════════════════════════════════════════════════════
export const adminGetMasters = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }
    const masters = await MilmaChartMaster
      .find({ companyId: req.params.companyId })
      .sort({ chartId: 1 });
    res.json({ success: true, data: masters });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  SUPER-ADMIN: Delete all charts for a company
//  DELETE /api/milma-charts/admin/:companyId
// ════════════════════════════════════════════════════════════════════════════
export const adminDeleteCharts = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }
    await Promise.all([
      MilmaChartMaster.deleteMany({ companyId: req.params.companyId }),
      MilmaChartDetail.deleteMany({ companyId: req.params.companyId }),
    ]);
    res.json({ success: true, message: 'All Milma chart data deleted for this company' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  COMPANY USER: List chart masters (for MilkPurchaseSettings display)
//  GET /api/milma-charts/masters
// ════════════════════════════════════════════════════════════════════════════
export const getMasters = async (req, res) => {
  try {
    const masters = await MilmaChartMaster
      .find({ companyId: req.companyId })
      .sort({ chartId: 1 });
    res.json({ success: true, data: masters });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  SOCIETY (company login): own chart versions
//  Every query is scoped to req.companyId, so a society only ever sees and
//  changes its own charts. Imported versions (source 'Import' / no source) are
//  read-only here; a society adds versions and may delete only its own.
//  Society versions get chart ids from 1001 up, so a later super-admin import
//  (Milma's own ids 1, 2, 3 …) can never land on them.
// ════════════════════════════════════════════════════════════════════════════
const SOCIETY_CHART_ID_START = 1001;

const canEditCharts = (req) => {
  if (req.userType === 'company' || isAdminUser(req.user || {})) return true;
  const perm = (req.user?.permissions || []).find(p => p.module === 'milkCollection.rateChart');
  return !!(perm && (perm.write || perm.edit));
};
const denyEdit = (res) => res.status(403).json({ success: false, message: 'You do not have permission to change rate charts' });

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const nextSocietyChartId = async (companyId) => {
  const last = await MilmaChartMaster.findOne({ companyId }).sort({ chartId: -1 }).select('chartId').lean();
  return Math.max(SOCIETY_CHART_ID_START, (last?.chartId || 0) + 1);
};

const masterNumbers = (src = {}, body = {}) => {
  const pick = (k) => (body[k] !== undefined && body[k] !== '' && body[k] !== null ? Number(body[k]) || 0 : Number(src[k]) || 0);
  return {
    rateSNF: pick('rateSNF'), rateFAT: pick('rateFAT'),
    subSNF: pick('subSNF'), subTotalSolids: pick('subTotalSolids'),
    bestSNF: pick('bestSNF'), bestTotalSolids: pick('bestTotalSolids'),
  };
};

// GET /api/milma-charts/detail?chartId=X&page=1&limit=100 — own company only
export const getDetail = async (req, res) => {
  try {
    const { chartId, page = 1, limit = 100 } = req.query;
    if (!chartId) return res.status(400).json({ success: false, message: 'chartId is required' });
    const query = { companyId: req.companyId, chartId: Number(chartId) };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      MilmaChartDetail.find(query).sort({ fat: 1, clr: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      MilmaChartDetail.countDocuments(query),
    ]);
    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/milma-charts/versions
// { dateFrom, copyFromChartId, rateAdjust, rateSNF, rateFAT, subSNF, subTotalSolids, bestSNF, bestTotalSolids, remarks }
// New version = copy of an existing version's rate table (imported or own), every
// rate shifted by rateAdjust (₹/L), effective from dateFrom. The source is not changed.
export const createVersion = async (req, res) => {
  try {
    if (!canEditCharts(req)) return denyEdit(res);
    const companyId = req.companyId;
    const { dateFrom, copyFromChartId, rateAdjust = 0, remarks = '' } = req.body || {};
    if (!dateFrom) return res.status(400).json({ success: false, message: 'Effective From date is required' });
    const from = new Date(dateFrom);
    if (Number.isNaN(from.getTime())) return res.status(400).json({ success: false, message: 'Invalid Effective From date' });

    const masters = await MilmaChartMaster.find({ companyId }).lean();
    const sameDay = masters.find(m => dayKey(m.dateFrom) === dayKey(from));
    if (sameDay) {
      return res.status(409).json({ success: false, message: `Chart ${sameDay.chartId} already starts on ${dayKey(from)} — choose another date` });
    }
    const source = copyFromChartId != null && copyFromChartId !== ''
      ? masters.find(m => m.chartId === Number(copyFromChartId))
      : [...masters].sort((a, b) => new Date(b.dateFrom) - new Date(a.dateFrom))[0];
    if (!source) return res.status(400).json({ success: false, message: 'Choose an existing chart version to copy the rate table from' });

    const rows = await MilmaChartDetail.find({ companyId, chartId: source.chartId }).select('fat clr snf rate -_id').lean();
    if (!rows.length) return res.status(400).json({ success: false, message: `Chart ${source.chartId} has no rate rows to copy` });

    const adjust = Number(rateAdjust) || 0;
    let master;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        master = await MilmaChartMaster.create({
          companyId,
          chartId: await nextSocietyChartId(companyId),
          dateFrom: from,
          ...masterNumbers(source, req.body),
          remarks: String(remarks || `Copy of chart ${source.chartId}${adjust ? ` ${adjust > 0 ? '+' : ''}${adjust}/L` : ''}`),
          rowCount: rows.length,
          source: 'Society',
          createdBy: req.user?._id,
        });
        break;
      } catch (err) {
        if (err.code !== 11000 || attempt === 4) throw err;   // chart id race → take the next
      }
    }

    const BATCH = 2000;
    for (let i = 0; i < rows.length; i += BATCH) {
      await MilmaChartDetail.insertMany(rows.slice(i, i + BATCH).map(r => ({
        companyId, chartId: master.chartId, fat: r.fat, clr: r.clr, snf: r.snf,
        rate: Math.max(0, Number((Number(r.rate) + adjust).toFixed(2))),
      })), { ordered: false });
    }
    res.status(201).json({ success: true, data: master, message: `Chart ${master.chartId} created from chart ${source.chartId} (${rows.length} rates)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/milma-charts/upload (multipart file) — same 2-sheet Excel as the super-admin
// upload, for the logged-in society only. Adds versions; a version whose Effective From
// date already exists is skipped (no duplicates, existing versions untouched).
export const uploadOwnChart = async (req, res) => {
  try {
    if (!canEditCharts(req)) return denyEdit(res);
    const companyId = req.companyId;
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    if (wb.SheetNames.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel must contain 2 sheets: rate chart detail + chart master' });
    }
    const detailRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: 0 });
    const masterRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { defval: 0 });
    if (!detailRows.length || !masterRows.length) {
      return res.status(400).json({ success: false, message: 'Both the rate chart detail and chart master sheets need rows' });
    }

    const existingDays = new Set((await MilmaChartMaster.find({ companyId }).select('dateFrom').lean()).map(m => dayKey(m.dateFrom)));
    const created = [], skipped = [];
    for (const row of masterRows) {
      const from = parseExcelDate(row.date_from);
      if (!from) { skipped.push(`chart ${row.chart_id}: no valid date_from`); continue; }
      if (existingDays.has(dayKey(from))) { skipped.push(`chart ${row.chart_id}: ${dayKey(from)} already exists`); continue; }
      const rows = detailRows.filter(d => Number(d.chart_id) === Number(row.chart_id));
      if (!rows.length) { skipped.push(`chart ${row.chart_id}: no rate rows`); continue; }

      const chartId = await nextSocietyChartId(companyId);
      await MilmaChartMaster.create({
        companyId, chartId, dateFrom: from,
        rateSNF: Number(row.rate_snf) || 0, rateFAT: Number(row.rate_fat) || 0,
        subSNF: Number(row.sub_snf) || 0, subTotalSolids: Number(row.sub_total_solids) || 0,
        bestSNF: Number(row.best_snf) || 0, bestTotalSolids: Number(row.best_total_solids) || 0,
        remarks: String(row.remarks || ''), rowCount: 0, source: 'Society', createdBy: req.user?._id,
      });
      // upsert: duplicate (fat, clr) rows inside the file don't fail the import
      const BATCH = 2000;
      for (let i = 0; i < rows.length; i += BATCH) {
        await MilmaChartDetail.bulkWrite(rows.slice(i, i + BATCH).map(d => ({
          updateOne: {
            filter: { companyId, chartId, fat: Number(d.fat), clr: Number(d.clr) },
            update: { $set: { snf: Number(d.snf), rate: Number(d.rate) } },
            upsert: true,
          },
        })), { ordered: false });
      }
      const rowCount = await MilmaChartDetail.countDocuments({ companyId, chartId });
      await MilmaChartMaster.updateOne({ companyId, chartId }, { $set: { rowCount } });
      existingDays.add(dayKey(from));
      created.push(chartId);
    }

    res.json({
      success: true,
      created: created.length,
      skipped,
      message: `${created.length} chart version(s) added${skipped.length ? `, ${skipped.length} skipped (${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? ' …' : ''})` : ''}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/milma-charts/versions/:chartId — only versions the society created
export const deleteVersion = async (req, res) => {
  try {
    if (!canEditCharts(req)) return denyEdit(res);
    const chartId = Number(req.params.chartId);
    const master = await MilmaChartMaster.findOne({ companyId: req.companyId, chartId });
    if (!master) return res.status(404).json({ success: false, message: 'Chart version not found' });
    if (master.source !== 'Society') {
      return res.status(403).json({ success: false, message: 'Imported chart versions cannot be deleted here' });
    }
    await Promise.all([
      MilmaChartDetail.deleteMany({ companyId: req.companyId, chartId }),
      master.deleteOne(),
    ]);
    res.json({ success: true, message: `Chart ${chartId} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  COMPANY USER: Rate lookup
//  POST /api/milma-charts/lookup
//  Body: { date, fat, clr }
// ════════════════════════════════════════════════════════════════════════════
export const lookupRate = async (req, res) => {
  try {
    const { date, fat, clr, snf } = req.body;
    if (!date || fat == null) {
      return res.status(400).json({ success: false, message: 'date and fat are required' });
    }
    // mode: 'FAT-CLR' (default) or 'FAT-SNF'
    const mode = (snf != null && clr == null) ? 'FAT-SNF' : 'FAT-CLR';
    if (mode === 'FAT-CLR' && clr == null) {
      return res.status(400).json({ success: false, message: 'clr is required for FAT-CLR mode' });
    }
    if (mode === 'FAT-SNF' && snf == null) {
      return res.status(400).json({ success: false, message: 'snf is required for FAT-SNF mode' });
    }

    const lookupDate = new Date(date);

    // Find the active chart master: latest dateFrom <= lookupDate
    const master = await MilmaChartMaster
      .findOne({ companyId: req.companyId, dateFrom: { $lte: lookupDate } })
      .sort({ dateFrom: -1 });

    if (!master) {
      return res.status(404).json({ success: false, message: 'No Milma rate chart found for this date' });
    }

    let detail;
    // Round to chart precision: FAT/SNF to 1 decimal, CLR to nearest integer
    const fatR = Math.round(Number(fat) * 10) / 10;
    const clrR = Math.round(Number(clr));
    const snfR = Math.round(Number(snf) * 10) / 10;

    if (mode === 'FAT-CLR') {
      // CLR-FAT combination: lookup by fat+clr → return snf+rate
      detail = await MilmaChartDetail.findOne({
        companyId: req.companyId,
        chartId:   master.chartId,
        fat:       fatR,
        clr:       clrR,
      });
      if (!detail) {
        return res.status(404).json({
          success: false,
          message: `No rate found for FAT=${fatR}, CLR=${clrR} in chart ${master.chartId}`,
          chartId: master.chartId,
          dateFrom: master.dateFrom,
        });
      }
      return res.json({
        success:  true,
        mode:     'FAT-CLR',
        rate:     detail.rate,
        snf:      detail.snf,
        clr:      detail.clr,
        chartId:  master.chartId,
        dateFrom: master.dateFrom,
        remarks:  master.remarks,
      });
    } else {
      // FAT-SNF combination: lookup by fat+snf → return clr+rate
      detail = await MilmaChartDetail.findOne({
        companyId: req.companyId,
        chartId:   master.chartId,
        fat:       fatR,
        snf:       snfR,
      });
      if (!detail) {
        return res.status(404).json({
          success: false,
          message: `No rate found for FAT=${fatR}, SNF=${snfR} in chart ${master.chartId}`,
          chartId: master.chartId,
          dateFrom: master.dateFrom,
        });
      }
      return res.json({
        success:  true,
        mode:     'FAT-SNF',
        rate:     detail.rate,
        snf:      detail.snf,
        clr:      detail.clr,
        chartId:  master.chartId,
        dateFrom: master.dateFrom,
        remarks:  master.remarks,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

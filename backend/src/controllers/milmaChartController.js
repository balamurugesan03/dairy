import XLSX from 'xlsx';
import { MilmaChartMaster, MilmaChartDetail } from '../models/MilmaChart.js';

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
          }
        },
        upsert: true,
      }
    }));
    await MilmaChartMaster.bulkWrite(masterOps, { ordered: false });

    // ── Bulk replace Chart Detail rows ────────────────────────────────────────
    // Delete existing detail for this company then insert fresh batch
    await MilmaChartDetail.deleteMany({ companyId });

    const BATCH = 2000;
    for (let i = 0; i < detailRows.length; i += BATCH) {
      const batch = detailRows.slice(i, i + BATCH).map(row => ({
        companyId,
        chartId: Number(row.chart_id),
        fat:     Number(row.fat),
        clr:     Number(row.clr),
        snf:     Number(row.snf),
        rate:    Number(row.rate),
      }));
      await MilmaChartDetail.insertMany(batch, { ordered: false });
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

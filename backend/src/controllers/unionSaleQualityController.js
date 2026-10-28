import mongoose from 'mongoose';
import UnionSaleSettings from '../models/UnionSaleSettings.js';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';
import Company from '../models/Company.js';
import MilkPurchaseSettings from '../models/MilkPurchaseSettings.js';
import { syncFromDairySlips } from '../utils/unionFromDairySync.js';

// ════════════════════════════════════════════════════════════════
//  Union Sale Quality Comparison + Union Sales Settings
//
//  Procurement (From Dairy) = Daily Collection List, per date + centre.
//  To Dairy                  = Union Sales slips (society-level), per date.
//  TS = FAT + SNF.  TS-based rate = TS × TS rate / 100.
//  Average Rate:
//    From Dairy — TS enabled & date ≥ its From Date → the From Dairy TS rate
//                 configured in Union Sales → Settings (NOT the Milk Purchase TS
//                 rate); otherwise Σ amount / Σ qty.
//    To Dairy   — TS enabled & date ≥ its From Date → the manually entered
//                 To Dairy TS rate; otherwise the slips' Σ amount / Σ qty.
//  Both sides use the same TS formula; only the rate source differs.
// ════════════════════════════════════════════════════════════════

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const ymd = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');
const r2 = (n) => Number((Number(n) || 0).toFixed(2));

// Period in force on a YYYY-MM-DD day (fromDate ≤ day ≤ toDate; no toDate = open)
const periodOn = (periods, day) => periods
  .filter(p => ymd(p.fromDate) <= day && (!p.toDate || ymd(p.toDate) >= day))
  .sort((a, b) => ymd(b.fromDate).localeCompare(ymd(a.fromDate)))[0] || null;

// TS rate periods are defined by their From Date: each one runs until the day before
// the next starts, the last one is open-ended — so they can never overlap. A period
// with useToDate keeps the To Date the user fixed (it must end before the next
// starts); days between that To Date and the next From Date have no TS rate.
const normalisePeriods = (list = [], label = 'To Dairy') => {
  const rows = list
    .filter(p => p && p.fromDate && Number(p.tsRate) >= 0 && p.tsRate !== '' && p.tsRate !== null)
    .map(p => ({
      tsRate: Number(p.tsRate),
      fromDate: dayStart(p.fromDate),
      useToDate: !!(p.useToDate && p.toDate),
      fixedTo: p.useToDate && p.toDate ? dayStart(p.toDate) : null,
      remarks: p.remarks || ''
    }))
    .sort((a, b) => a.fromDate - b.fromDate);
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i], next = rows[i + 1];
    if (p.fixedTo && p.fixedTo < p.fromDate) {
      throw new Error(`${label}: To Date ${ymd(p.fixedTo)} is before From Date ${ymd(p.fromDate)}`);
    }
    if (next && ymd(next.fromDate) === ymd(p.fromDate)) {
      throw new Error(`Two ${label} TS rates start on the same date (${ymd(p.fromDate)})`);
    }
    if (next && p.fixedTo && p.fixedTo >= next.fromDate) {
      throw new Error(`${label}: the rate from ${ymd(p.fromDate)} ends ${ymd(p.fixedTo)}, after the next rate starts (${ymd(next.fromDate)})`);
    }
  }
  return rows.map(({ fixedTo, ...p }, i) => {
    const next = rows[i + 1];
    let toDate = fixedTo;
    if (!toDate && next) { toDate = new Date(next.fromDate); toDate.setDate(toDate.getDate() - 1); }
    return { ...p, toDate };
  });
};

// A side's TS rule starts with its earliest TS rate (no separate From Date is entered)
const firstFrom = (periods = []) => periods.reduce((min, p) => (!min || p.fromDate < min ? p.fromDate : min), null);

const plainPeriods = (list = []) => list.map(p => ({
  tsRate: p.tsRate, fromDate: p.fromDate, toDate: p.toDate, useToDate: p.useToDate, remarks: p.remarks
}));

// Dairy names are NOT kept in Union Sales settings — they are read from the existing
// configuration every time:
//   From Dairy — this society: Society Name (else Company Name), Region (District) and
//                State, as set by the Super Admin on the company
//   To Dairy   — the union: To Dairy name from Machine Configuration, same Region / State
// label → "TS Rate Settings (<label>)" headings in settings and the report.
const dairyNames = async (companyId) => {
  const [company, mps] = await Promise.all([
    Company.findById(companyId).select('companyName societyName societyCode state district').lean(),
    MilkPurchaseSettings.findOne({ companyId }).select('toDairy').lean()
  ]);
  const state = company?.state || '';
  const region = company?.district || '';   // the company record has no separate Region — District is it
  const join = (...parts) => parts.filter(Boolean).join(', ');
  const fromName = company?.societyName || company?.companyName || '';
  const toName = mps?.toDairy?.name || '';
  return {
    fromDairy: { name: fromName, code: company?.societyCode || '', region, state, label: join(fromName, state) },
    toDairy:   { name: toName, code: mps?.toDairy?.code || '', region, state, label: join(toName, state) }
  };
};

// From Dairy automatic Union Sales slips (utils/unionFromDairySync.js): re-synced from
// `from` (YYYY-MM-DD; default From Dairy From Date) to today after a settings change.
const runFromDairySync = async (companyId, from) => {
  try {
    return await syncFromDairySlips(companyId, from ? { from } : {});
  } catch (err) {
    console.warn('[UnionFromDairy] sync failed (non-fatal):', err.message);
    return { error: err.message };
  }
};
const syncText = (r) => {
  if (!r || r.disabled) return '';
  if (r.error) return ` — automatic Union Sales entries not refreshed: ${r.error}`;
  const parts = [r.created && `${r.created} created`, r.updated && `${r.updated} updated`, r.removed && `${r.removed} removed`].filter(Boolean);
  const manual = r.skippedManual ? ` (${r.skippedManual} session(s) kept as entered manually)` : '';
  return parts.length || manual ? ` — Union Sales entries: ${parts.join(', ') || 'no change'}${manual}` : '';
};
const earlier = (...days) => days.filter(Boolean).sort()[0];

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════
export const getUnionSaleSettings = async (req, res) => {
  try {
    const [settings, names] = await Promise.all([
      UnionSaleSettings.getOrCreate(req.companyId),
      dairyNames(req.companyId)
    ]);
    // Drop any Region / Dairy name saved by the old settings screen — names come from `names`
    const data = settings.toObject();
    for (const side of ['fromDairy', 'toDairy']) if (data[side]) delete data[side].regionName;
    res.json({ success: true, data: { ...data, names } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const saveUnionSaleSettings = async (req, res) => {
  try {
    const { fromDairy = {}, toDairy = {} } = req.body;
    const current = await UnionSaleSettings.getOrCreate(req.companyId);
    // From Date is no longer entered: each side starts with its earliest TS rate
    const side = (s, tsRates) => ({ tsEnabled: !!s.tsEnabled, fromDate: firstFrom(tsRates), tsRates });
    const update = {
      // From Dairy TS rates are kept unless sent — they are normally changed one at a
      // time through Apply / Delete (applyFromDairyRate / deleteFromDairyRate)
      fromDairy: side(fromDairy, normalisePeriods(Array.isArray(fromDairy.tsRates) ? fromDairy.tsRates : plainPeriods(current.fromDairy?.tsRates), 'From Dairy')),
      toDairy: side(toDairy, normalisePeriods(toDairy.tsRates))
    };
    if (update.fromDairy.tsEnabled && !update.fromDairy.tsRates.length) {
      return res.status(400).json({ success: false, message: 'From Dairy: apply at least one TS rate' });
    }
    if (update.toDairy.tsEnabled && !update.toDairy.tsRates.length) {
      return res.status(400).json({ success: false, message: 'To Dairy: add at least one TS rate' });
    }
    if (req.user?._id) update.lastUpdatedBy = req.user._id;

    const settings = await UnionSaleSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    // From Dairy enabled → generate / refresh its entries; a later From Date also drops
    // automatic entries before it
    const sync = update.fromDairy.tsEnabled
      ? await runFromDairySync(req.companyId, earlier(ymd(current.fromDairy?.fromDate), ymd(update.fromDairy.fromDate)))
      : null;
    res.json({ success: true, data: settings, sync, message: `Union Sales settings saved${syncText(sync)}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── From Dairy TS rates: Apply (add / replace one period) and Delete ──
// POST /union-sales-slips/settings/from-dairy-rates  { fromDate, useToDate, toDate, tsRate, remarks }
// A period with the same From Date is replaced; all other (historical) periods are kept.
export const applyFromDairyRate = async (req, res) => {
  try {
    const { fromDate, toDate, useToDate, tsRate, remarks } = req.body || {};
    if (!fromDate) return res.status(400).json({ success: false, message: 'From Date is required' });
    if (tsRate === '' || tsRate === null || tsRate === undefined || Number.isNaN(Number(tsRate)) || Number(tsRate) < 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid TS Rate' });
    }
    if (useToDate && !toDate) return res.status(400).json({ success: false, message: 'Select the To Date, or untick "Use To Date"' });

    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    const day = ymd(dayStart(fromDate));
    const kept = plainPeriods(settings.fromDairy?.tsRates).filter(p => ymd(p.fromDate) !== day);
    const tsRates = normalisePeriods([...kept, { fromDate, toDate, useToDate: !!useToDate, tsRate, remarks }], 'From Dairy');

    const saved = await UnionSaleSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: { 'fromDairy.tsRates': tsRates, 'fromDairy.fromDate': firstFrom(tsRates), ...(req.user?._id ? { lastUpdatedBy: req.user._id } : {}) } },
      { new: true, runValidators: true }
    );
    const sync = await runFromDairySync(req.companyId, day);
    res.json({ success: true, data: saved, sync, message: `From Dairy TS rate applied${syncText(sync)}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /union-sales-slips/settings/from-dairy-rates/:rateId — the previous open rate then runs on
export const deleteFromDairyRate = async (req, res) => {
  try {
    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    const all = settings.fromDairy?.tsRates || [];
    if (!all.some(p => String(p._id) === req.params.rateId)) {
      return res.status(404).json({ success: false, message: 'TS rate not found' });
    }
    const removedFrom = ymd(all.find(p => String(p._id) === req.params.rateId).fromDate);
    const tsRates = normalisePeriods(plainPeriods(all.filter(p => String(p._id) !== req.params.rateId)), 'From Dairy');
    const saved = await UnionSaleSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: { 'fromDairy.tsRates': tsRates, 'fromDairy.fromDate': firstFrom(tsRates) } },
      { new: true, runValidators: true }
    );
    const sync = await runFromDairySync(req.companyId, removedFrom);
    res.json({ success: true, data: saved, sync, message: `From Dairy TS rate deleted${syncText(sync)}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /union-sales-slips/settings/from-dairy-sync  { fromDate?, toDate? }
// Generate / refresh the automatic From Dairy entries on demand (safe to repeat).
export const syncFromDairyEntries = async (req, res) => {
  try {
    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    if (!settings.fromDairy?.tsEnabled) {
      return res.status(400).json({ success: false, message: 'Enable From Dairy TS Rate Settings first' });
    }
    const { fromDate, toDate } = req.body || {};
    const r = await syncFromDairySlips(req.companyId, {
      ...(fromDate ? { from: ymd(dayStart(fromDate)) } : {}),
      ...(toDate ? { to: ymd(dayStart(toDate)) } : {})
    });
    res.json({ success: true, data: r, message: `From Dairy entries refreshed${syncText(r) || ' — no change'}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /union-sales/settings/to-dairy-rate?date=YYYY-MM-DD — for the slip entry form
export const getToDairyRate = async (req, res) => {
  try {
    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    const td = settings.toDairy || {};
    const day = req.query.date || ymd(new Date());
    const active = td.tsEnabled && td.fromDate && ymd(td.fromDate) <= day;
    const period = active ? periodOn(td.tsRates || [], day) : null;
    res.json({ success: true, data: { enabled: !!active, tsRate: period ? period.tsRate : null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  QUALITY COMPARISON REPORT
// ════════════════════════════════════════════════════════════════
const figures = ({ qty, fatQty, snfQty, amount }, tsRate) => {
  const fat = qty ? fatQty / qty : 0;
  const snf = qty ? snfQty / qty : 0;
  const ts = fat + snf;
  const actualRate = qty ? amount / qty : 0;
  const rate = tsRate !== null && tsRate !== undefined ? (ts * tsRate) / 100 : actualRate;
  return {
    qty: r2(qty),
    fat: r2(fat),
    snf: r2(snf),
    ts: r2(ts),
    rate: r2(rate),
    amount: r2(rate * qty),
    rateSource: tsRate !== null && tsRate !== undefined ? 'TS' : 'Actual',
    tsRate: tsRate ?? null
  };
};

const add = (acc, g) => {
  acc.qty += g.qty || 0;
  acc.fatQty += g.fatQty || 0;
  acc.snfQty += g.snfQty || 0;
  acc.amount += g.amount || 0;
  return acc;
};
const zero = () => ({ qty: 0, fatQty: 0, snfQty: 0, amount: 0 });

export const getQualityComparison = async (req, res) => {
  try {
    const { fromDate, toDate, centerId } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const companyId = req.companyId;
    const start = dayStart(fromDate);
    const end = dayEnd(toDate);

    const collMatch = { companyId: toObjectId(companyId), date: { $gte: start, $lte: end } };
    if (centerId) collMatch.collectionCenter = toObjectId(centerId);

    const [settings, centres, procGroups, slipGroups] = await Promise.all([
      UnionSaleSettings.getOrCreate(companyId),
      CollectionCenter.find({ companyId }).select('centerName centerType centerCode').lean(),
      MilkCollection.aggregate([
        { $match: collMatch },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
              centre: '$collectionCenter'
            },
            qty: { $sum: '$qty' },
            fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
            snfQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$snf', 0] }] } },
            amount: { $sum: '$amount' }
          }
        }
      ]),
      UnionSalesSlip.aggregate([
        { $match: { companyId: toObjectId(companyId), date: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
            qty: { $sum: '$qty' },
            fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
            snfQty: { $sum: { $multiply: ['$qty', '$snf'] } },
            amount: { $sum: '$amount' },
            slips: { $sum: 1 }
          }
        }
      ])
    ]);

    const fd = settings.fromDairy || {};
    const td = settings.toDairy || {};
    const names = await dairyNames(companyId);
    // TS rate per side for a day, or null when the TS rule doesn't apply
    const fromTsRate = (day) => {
      if (!fd.tsEnabled || !fd.fromDate || ymd(fd.fromDate) > day) return null;
      return periodOn(fd.tsRates || [], day)?.tsRate ?? null;   // own From Dairy rate, never Milk Purchase's
    };
    const toTsRate = (day) => {
      if (!td.tsEnabled || !td.fromDate || ymd(td.fromDate) > day) return null;
      return periodOn(td.tsRates || [], day)?.tsRate ?? null;
    };

    const centreById = Object.fromEntries(centres.map(c => [String(c._id), c]));
    const centreLabel = (c) => (c ? { centreCode: c.centerCode || '', centreName: c.centerName } : { centreCode: '', centreName: 'Unassigned' });
    const headOffice = centres.find(c => c.centerType === 'Head Office');

    // ── Section 1: Procurement Data (per date + centre) ─────────
    const procByDay = {};
    const procurement = procGroups.map(g => {
      const day = g._id.day;
      add(procByDay[day] ||= zero(), g);
      return { date: day, ...centreLabel(centreById[String(g._id.centre)]), ...figures(g, fromTsRate(day)) };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.centreName.localeCompare(b.centreName));

    // ── Section 2: To Dairy (union slips, per date) ──────────────
    const slipByDay = Object.fromEntries(slipGroups.map(g => [g._id, g]));
    const toDairy = slipGroups.map(g => ({
      date: g._id,
      ...centreLabel(headOffice),
      slips: g.slips,
      ...figures(g, toTsRate(g._id))
    })).sort((a, b) => a.date.localeCompare(b.date));

    // ── Section 3: Comparison (per date) ─────────────────────────
    const days = [...new Set([...Object.keys(procByDay), ...Object.keys(slipByDay)])].sort();
    const comparison = days.map(day => {
      const actual = procByDay[day] ? figures(procByDay[day], fromTsRate(day)) : null;
      const union = slipByDay[day] ? figures(slipByDay[day], toTsRate(day)) : null;
      const diff = actual && union ? {
        qty: r2(union.qty - actual.qty),
        fat: r2(union.fat - actual.fat),
        snf: r2(union.snf - actual.snf),
        ts: r2(union.ts - actual.ts),
        rate: r2(union.rate - actual.rate),
        amount: r2(union.amount - actual.amount)
      } : null;
      return { date: day, actual, toDairy: union, diff };
    });

    // Period totals (qty-weighted), only over days present on both sides for the difference
    const procAll = Object.values(procByDay).reduce((a, g) => add(a, g), zero());
    const slipAll = slipGroups.reduce((a, g) => add(a, g), zero());
    const sumAmount = (rows) => rows.reduce((s, r) => s + r.amount, 0);
    const totalOf = (all, rows) => {
      const f = figures(all, null);
      // Average rate over the period = Σ(day rate × day qty) / Σ qty, so TS days are respected
      const amount = sumAmount(rows);
      return { ...f, rate: all.qty ? r2(amount / all.qty) : 0, amount: r2(amount) };
    };
    const actualDays = comparison.filter(c => c.actual).map(c => c.actual);
    const unionDays = comparison.filter(c => c.toDairy).map(c => c.toDairy);
    const totals = {
      actual: totalOf(procAll, actualDays),
      toDairy: totalOf(slipAll, unionDays)
    };
    // Comparison total: only days present on BOTH sides, so a day whose union slip
    // isn't entered yet doesn't show up as a false shortage
    const matched = comparison.filter(c => c.actual && c.toDairy);
    const matchedProc = matched.reduce((a, c) => add(a, procByDay[c.date]), zero());
    const matchedSlip = matched.reduce((a, c) => add(a, slipByDay[c.date]), zero());
    const cmpActual = totalOf(matchedProc, matched.map(c => c.actual));
    const cmpUnion = totalOf(matchedSlip, matched.map(c => c.toDairy));
    totals.comparison = {
      actual: cmpActual,
      toDairy: cmpUnion,
      diff: {
        qty: r2(cmpUnion.qty - cmpActual.qty),
        fat: r2(cmpUnion.fat - cmpActual.fat),
        snf: r2(cmpUnion.snf - cmpActual.snf),
        ts: r2(cmpUnion.ts - cmpActual.ts),
        rate: r2(cmpUnion.rate - cmpActual.rate),
        amount: r2(cmpUnion.amount - cmpActual.amount)
      },
      matchedDays: matched.length,
      unmatchedDays: comparison.length - matched.length
    };

    res.json({
      success: true,
      data: {
        procurement,
        toDairy,
        comparison,
        totals,
        settings: {
          fromDairy: { tsEnabled: !!fd.tsEnabled, label: names.fromDairy.label, fromDate: fd.fromDate },
          toDairy: { tsEnabled: !!td.tsEnabled, label: names.toDairy.label, fromDate: td.fromDate }
        },
        names,
        // Union slips are for the whole society; with one centre selected the comparison
        // is that centre's procurement against the whole-society slip
        singleCentre: !!centerId,
        centreName: centerId ? (centreById[String(centerId)]?.centerName || '') : 'All Centres'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

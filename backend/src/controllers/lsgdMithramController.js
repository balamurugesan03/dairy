import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';
import FarmerApplication from '../models/FarmerApplication.js';
import SocietyInfo from '../models/SocietyInfo.js';
import Company from '../models/Company.js';
import LsgdWardMember from '../models/LsgdWardMember.js';
import LsgdStatement from '../models/LsgdStatement.js';
import { isSuperAdminReq, isAdminTierReq } from '../utils/userTier.js';
import { findPanchayatFarmerIds, wardMatches, farmerWardsOf, wardNumberOf } from '../utils/panchayatMatch.js';

// ════════════════════════════════════════════════════════════════
//  LSGD Reports → LSGD Milk Statement (formerly "LSGD Milk Statement";
//  route / permission keys keep the old "mithram" name)
//
//  Panchayat (+ optional ward) farmers with their month-wise milk
//  quantity from Milk Purchase for From–To, Total Milk × subsidy
//  rate = Total Amount. The statement is computed here; the screen
//  lets the user drop rows / change the Subsidy Allotted and Last
//  Subsidy Allotted and save the statement — Farmer Management and
//  Milk Purchase are never written.
// ════════════════════════════════════════════════════════════════

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const IST = 'Asia/Kolkata';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_MONTHS = 24;
const norm = (s) => String(s ?? '').trim().toUpperCase();
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactCi = (s) => ({ $regex: `^\\s*${escapeRegex(String(s).trim())}\\s*$`, $options: 'i' });

/**
 * Bank / Aadhaar details are on this statement, so reads are limited too:
 * Super Admin, Admin, or a user given the Reports module / this report.
 * Centre logins never.
 */
const canUseReport = (req) => {
  if (isSuperAdminReq(req) || isAdminTierReq(req)) return true;
  if (req.userType !== 'user') return false;
  return (req.user?.permissions || []).some((p) =>
    (p.module === 'reports' || p.module === 'reports.lsgdMithram') && (p.read || p.write || p.edit || p.delete));
};
const deny = (res) => res.status(403).json({ success: false, message: 'You do not have access to the LSGD Milk Statement' });
const userName = (req) => req.user?.displayName || req.user?.name || req.user?.username || req.user?.companyName || req.user?.email || '';

/** ?aliases=a,b → ['a','b'] (other spellings of the Panchayat, e.g. its Malayalam name) */
const aliasesOf = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);

const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/** Months from → to as { key: 'YYYY-MM', label: 'Apr 2026', month, year } */
export const monthsBetween = (fromYmd, toYmd) => {
  let y = Number(fromYmd.slice(0, 4));
  let m = Number(fromYmd.slice(5, 7));
  const ey = Number(toYmd.slice(0, 4));
  const em = Number(toYmd.slice(5, 7));
  const out = [];
  while (y < ey || (y === ey && m <= em)) {
    out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTH_NAMES[m - 1]} ${y}`, month: m, year: y });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length > MAX_MONTHS) break;
  }
  return out;
};

/** Financial year(s) the period falls in: "2026-27" or "2025-26 & 2026-27" */
const fyOf = (ymd) => {
  const y = Number(ymd.slice(0, 4));
  const start = Number(ymd.slice(5, 7)) >= 4 ? y : y - 1;
  return { start, label: `${start}-${String((start + 1) % 100).padStart(2, '0')}` };
};

// GET /lsgd-mithram/wards?panchayat= — wards of the Panchayat's farmers + wards with a saved member
export const getWards = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const { panchayat } = req.query;
    if (!String(panchayat || '').trim()) return res.json({ success: true, data: [] });
    const [farmerWards, members] = await Promise.all([
      farmerWardsOf(req.companyId, panchayat, aliasesOf(req.query.aliases)),
      LsgdWardMember.find({ companyId: req.companyId, panchayatKey: norm(panchayat) }).select('ward wardNumber').lean()
    ]);
    const byKey = new Map();
    for (const w of farmerWards) byKey.set(norm(w.ward), { ...w });
    for (const m of members) {
      const k = norm(m.ward);
      const cur = byKey.get(k);
      if (!cur) byKey.set(k, { ward: m.ward, wardNumber: m.wardNumber || wardNumberOf(m.ward), farmers: 0 });
      else if (!cur.wardNumber && m.wardNumber) cur.wardNumber = m.wardNumber;
    }
    const data = [...byKey.values()].sort((a, b) =>
      (Number(a.wardNumber) || 9999) - (Number(b.wardNumber) || 9999) || a.ward.localeCompare(b.ward));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /lsgd-mithram/ward-members?panchayat=&ward= — saved ward members (latest first)
export const getWardMembers = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const { panchayat, ward } = req.query;
    if (!panchayat) return res.json({ success: true, data: [] });
    const filter = { companyId: req.companyId, panchayatKey: norm(panchayat) };
    if (ward) filter.wardKey = norm(ward);
    const data = await LsgdWardMember.find(filter).sort({ updatedAt: -1 }).select('panchayat ward wardNumber memberName phone').lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /lsgd-mithram/ward-members — remember the ward member typed on the statement
export const saveWardMember = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const panchayat = String(req.body.panchayat || '').trim();
    const ward = String(req.body.ward || '').trim();
    const memberName = String(req.body.memberName || '').trim();
    if (!panchayat || !ward || !memberName) {
      return res.status(400).json({ success: false, message: 'Panchayat, ward and ward member name are required' });
    }
    const filter = { companyId: req.companyId, panchayatKey: norm(panchayat), wardKey: norm(ward), memberName: exactCi(memberName) };
    let doc = await LsgdWardMember.findOne(filter);
    if (!doc) doc = new LsgdWardMember({ companyId: req.companyId, panchayat, ward, memberName });
    if (req.body.wardNumber !== undefined) doc.wardNumber = String(req.body.wardNumber || '').trim();
    if (req.body.phone !== undefined) doc.phone = String(req.body.phone || '').trim();
    doc.markModified('memberName');   // bump updatedAt → becomes the ward's default member
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /lsgd-mithram/statement?fromDate&toDate&panchayat&aliases&ward&wardNumber&rate&onlySuppliers&scope&excludeId
//   Panchayat is matched loosely (spelling, "Grama Panchayath" suffix, Malayalam alias) on the
//   farmer's Panchayat, then — if nobody has it — on village / place / post / taluk.
//   scope=all lists every producer of the society (when Panchayat is not recorded at all).
export const getStatement = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const { fromDate, toDate } = req.query;
    const scope = req.query.scope === 'all' ? 'all' : 'panchayat';
    const panchayat = String(req.query.panchayat || '').trim();
    // All producers → no ward filter
    const ward = scope === 'all' ? '' : String(req.query.ward || '').trim();
    const wardNumberQ = scope === 'all' ? '' : String(req.query.wardNumber || '').trim();
    if (!isYmd(fromDate) || !isYmd(toDate)) return res.status(400).json({ success: false, message: 'From Date and To Date are required (YYYY-MM-DD)' });
    if (fromDate > toDate) return res.status(400).json({ success: false, message: 'From Date must be on or before To Date' });
    if (!panchayat && scope !== 'all') return res.status(400).json({ success: false, message: 'Select or type a Panchayat' });
    const rate = Number(req.query.rate ?? 0);
    if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ success: false, message: 'Subsidy amount must be zero or more' });
    const onlySuppliers = String(req.query.onlySuppliers ?? 'true') !== 'false';

    const months = monthsBetween(fromDate, toDate);
    if (months.length > MAX_MONTHS) return res.status(400).json({ success: false, message: `Select a period of ${MAX_MONTHS} months or less` });

    const companyId = new mongoose.Types.ObjectId(String(req.companyId));
    const match = await findPanchayatFarmerIds(companyId, panchayat, { aliases: aliasesOf(req.query.aliases), scope });

    const panchayatFarmers = match.ids.length ? await Farmer.find({ companyId, _id: { $in: match.ids } })
      .select('farmerNumber memberId status collectionCenter personalDetails.name address.ward address.wardNumber address.panchayat bankDetails.accountNumber bankDetails.bankName bankDetails.ifsc bankDetails.branch secondaryBankDetails payTo parentFarmer identityDetails.aadhaar')
      .lean() : [];
    const farmers = panchayatFarmers.filter((f) => wardMatches(f.address, ward, wardNumberQ));

    // Which documents each farmer has in Farmers Management (flags only — not the files)
    const has = (k) => ({ $gt: [{ $strLenCP: { $ifNull: [`$documents.${k}`, ''] } }, 0] });
    const docRows = farmers.length ? await Farmer.aggregate([
      { $match: { companyId, _id: { $in: farmers.map((f) => f._id) } } },
      { $project: { bankPassbook: has('bankPassbook'), aadhaar: has('aadhaar'), rationCard: has('rationCard'), incomeProof: has('incomeProof'),
        otherCount: { $size: { $ifNull: ['$documents.additionalDocuments', []] } } } }
    ]) : [];
    const docsOf = new Map(docRows.map((d) => [String(d._id), { bankPassbook: d.bankPassbook, aadhaar: d.aadhaar, rationCard: d.rationCard, incomeProof: d.incomeProof, otherCount: d.otherCount }]));

    // Parent Grouping: the parent farmer of each child (shown in the Parent Farmer column)
    const parentIds = [...new Set(farmers.map((f) => f.parentFarmer && String(f.parentFarmer)).filter(Boolean))];
    const parents = parentIds.length ? await Farmer.find({ companyId, _id: { $in: parentIds } }).select('farmerNumber personalDetails.name').lean() : [];
    const parentOf = new Map(parents.map((p) => [String(p._id), `${p.farmerNumber} - ${p.personalDetails?.name || ''}`]));

    // Milk Purchase quantity per farmer per month (IST calendar). The date range is
    // widened by a day each side, then cut exactly on the IST date, so it does not
    // matter whether an entry was saved at IST or UTC midnight.
    const loose = (ymd, days) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000);
    const milk = farmers.length ? await MilkCollection.aggregate([
      { $match: { companyId, farmer: { $in: farmers.map((f) => f._id) }, date: { $gte: loose(fromDate, -1), $lt: loose(toDate, 2) } } },
      { $addFields: { _d: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: IST } } } },
      { $match: { _d: { $gte: fromDate, $lte: toDate } } },
      { $group: { _id: { farmer: '$farmer', month: { $substrBytes: ['$_d', 0, 7] } }, qty: { $sum: '$qty' } } }
    ]) : [];
    const qtyOf = new Map();
    for (const m of milk) {
      const k = String(m._id.farmer);
      if (!qtyOf.has(k)) qtyOf.set(k, {});
      qtyOf.get(k)[m._id.month] = r2(m.qty);
    }

    // List Number = beneficiary list no. from the farmer's LSGD application (scheme year of From Date first)
    const fy = fyOf(fromDate);
    const fyTo = fyOf(toDate);
    const apps = farmers.length ? await FarmerApplication.find({
      companyId, farmerId: { $in: farmers.map((f) => f._id) }, beneficiaryNo: { $nin: ['', null] }
    }).select('farmerId year beneficiaryNo updatedAt').sort({ updatedAt: -1 }).lean() : [];
    const listNoOf = new Map();
    for (const a of apps) {
      const k = String(a.farmerId);
      const score = a.year === fy.start ? 2 : (a.year === fyTo.start ? 1 : 0);
      const cur = listNoOf.get(k);
      if (!cur || score > cur.score) listNoOf.set(k, { score, value: a.beneficiaryNo });
    }

    // Last Subsidy Allotted = the farmer's Subsidy Allotted on the latest earlier saved statement
    const excludeId = mongoose.isValidObjectId(req.query.excludeId) ? req.query.excludeId : null;
    const earlier = farmers.length ? await LsgdStatement.find({
      companyId, toDate: { $lt: fromDate }, ...(excludeId ? { _id: { $ne: excludeId } } : {})
    }).select('allotted fromDate toDate').sort({ toDate: -1, updatedAt: -1 }).limit(60).lean() : [];
    const lastOf = new Map();
    for (const s of earlier) {
      for (const [id, amt] of Object.entries(s.allotted || {})) {
        if (!lastOf.has(id)) lastOf.set(id, { amount: r2(amt), period: `${s.fromDate} to ${s.toDate}` });
      }
    }

    const centres = await CollectionCenter.find({ companyId }).select('centerCode').lean();
    const centreCode = Object.fromEntries(centres.map((c) => [String(c._id), c.centerCode || '']));
    const multiCentre = new Set(farmers.map((f) => String(f.collectionCenter || ''))).size > 1;

    const rows = [];
    for (const f of farmers) {
      const id = String(f._id);
      const perMonth = qtyOf.get(id) || {};
      const monthly = Object.fromEntries(months.map((m) => [m.key, perMonth[m.key] || 0]));
      const totalMilk = r2(Object.values(monthly).reduce((s, q) => s + q, 0));
      if (onlySuppliers ? totalMilk <= 0 : (totalMilk <= 0 && f.status === 'Inactive')) continue;
      const code = centreCode[String(f.collectionCenter)] || '';
      const totalAmount = r2(totalMilk * rate);
      rows.push({
        farmerId: id,
        farmerNumber: f.farmerNumber || '',
        producerNo: multiCentre && code ? `${code}/${f.farmerNumber}` : (f.farmerNumber || ''),
        centreCode: code,
        name: f.personalDetails?.name || '',
        listNo: listNoOf.get(id)?.value || '',
        accountNumber: f.bankDetails?.accountNumber || '',
        bankName: f.bankDetails?.bankName || '',
        ifsc: (f.bankDetails?.ifsc || '').toUpperCase(),
        branch: f.bankDetails?.branch || '',
        // Secondary bank (Farmer Settings → Secondary Bank) and the account payments use
        secBankName: f.secondaryBankDetails?.bankName || '',
        secAccountNumber: f.secondaryBankDetails?.accountNumber || '',
        secIfsc: (f.secondaryBankDetails?.ifsc || '').toUpperCase(),
        secBranch: f.secondaryBankDetails?.branch || '',
        payTo: f.payTo || 'Primary',
        parentNo: f.parentFarmer ? (parentOf.get(String(f.parentFarmer)) || '') : '',
        aadhaar: f.identityDetails?.aadhaar || '',
        ward: f.address?.ward || '',
        panchayat: f.address?.panchayat || '',
        wardNumber: wardNumberOf(f.address?.wardNumber) || wardNumberOf(f.address?.ward),
        status: f.status || 'Active',
        monthly,
        totalMilk,
        rate,
        totalAmount,
        subsidyAllotted: totalAmount,
        lastSubsidy: lastOf.get(id)?.amount ?? 0,
        lastSubsidyPeriod: lastOf.get(id)?.period || '',
        docs: docsOf.get(id) || { bankPassbook: false, aadhaar: false, rationCard: false, incomeProof: false, otherCount: 0 }
      });
    }
    const numOf = (s) => { const n = parseInt(String(s).replace(/\D/g, ''), 10); return Number.isNaN(n) ? Infinity : n; };
    rows.sort((a, b) => a.centreCode.localeCompare(b.centreCode, undefined, { numeric: true })
      || numOf(a.farmerNumber) - numOf(b.farmerNumber)
      || a.farmerNumber.localeCompare(b.farmerNumber) || a.name.localeCompare(b.name));

    const totals = {
      monthly: Object.fromEntries(months.map((m) => [m.key, r2(rows.reduce((s, r) => s + r.monthly[m.key], 0))])),
      totalMilk: r2(rows.reduce((s, r) => s + r.totalMilk, 0)),
      totalAmount: r2(rows.reduce((s, r) => s + r.totalAmount, 0)),
      subsidyAllotted: r2(rows.reduce((s, r) => s + r.subsidyAllotted, 0)),
      lastSubsidy: r2(rows.reduce((s, r) => s + r.lastSubsidy, 0))
    };

    const [info, company] = await Promise.all([
      SocietyInfo.findOne({ companyId }).select('societyName societyCode city').lean(),
      Company.findById(companyId).select('companyName societyName').lean()
    ]);
    const fyLabel = fy.label === fyTo.label ? fy.label : `${fy.label} & ${fyTo.label}`;

    res.json({
      success: true,
      data: {
        months,
        rows,
        totals,
        meta: {
          fromDate, toDate, rate, onlySuppliers, scope,
          // the name as selected / typed — the farmer record may hold a Block / Taluk name
          panchayat: panchayat || (scope === 'all' ? 'All Producers' : ''),
          ward: String(ward || '').trim(),
          wardNumber: wardNumberQ,
          financialYear: fyLabel,
          societyName: info?.societyName?.trim() || company?.societyName || company?.companyName || '',
          societyCode: info?.societyCode?.trim() || '',
          matchedBy: match.matchedBy,            // panchayat | address | all | none
          farmersInPanchayat: panchayatFarmers.length,
          farmersInWard: farmers.length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Saved statements ──────────────────────────────────────────────
const MAX_ROWS = 5000;
const amountMap = (obj, ids) => {
  const out = {};
  for (const [k, v] of Object.entries(obj && typeof obj === 'object' ? obj : {})) {
    const n = Number(v);
    if (ids.has(k) && Number.isFinite(n) && n >= 0) out[k] = r2(n);
  }
  return out;
};

/** Validated document fields from the request body */
const statementFields = (body) => {
  const b = body || {};
  if (!isYmd(b.fromDate) || !isYmd(b.toDate)) throw Object.assign(new Error('From Date and To Date are required'), { status: 400 });
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : [];
  const ids = new Set(rows.map((r) => String(r?.farmerId || '')).filter(Boolean));
  const removed = (Array.isArray(b.removed) ? b.removed : []).map(String).filter((id) => ids.has(id));
  const removedSet = new Set(removed);
  const overrides = amountMap(b.overrides, ids);
  const lastSubsidy = amountMap(b.lastSubsidy, ids);
  const rate = Number(b.rate) || 0;
  // Final Subsidy Allotted per included farmer (same rule as the screen: override, else Total Milk × rate)
  const allotted = {};
  let totalMilk = 0;
  for (const r of rows) {
    const id = String(r.farmerId || '');
    if (!id || removedSet.has(id)) continue;
    totalMilk += Number(r.totalMilk) || 0;
    allotted[id] = id in overrides ? overrides[id] : r2((Number(r.totalMilk) || 0) * rate);
  }
  const panchayat = String(b.panchayat || '').trim() || (b.scope === 'all' ? 'All Producers' : '');
  if (!panchayat) throw Object.assign(new Error('Panchayat is required'), { status: 400 });
  return {
    title: String(b.title || '').trim().slice(0, 150),
    fromDate: b.fromDate, toDate: b.toDate, rate, panchayat,
    ward: String(b.ward || '').trim(),
    wardNumber: String(b.wardNumber || '').trim(),
    wardMember: String(b.wardMember || '').trim(),
    onlySuppliers: b.onlySuppliers !== false,
    scope: b.scope === 'all' ? 'all' : 'panchayat',
    months: Array.isArray(b.months) ? b.months.slice(0, MAX_MONTHS + 1) : [],
    rows,
    meta: b.meta && typeof b.meta === 'object' ? b.meta : {},
    removed, overrides, lastSubsidy,
    hiddenColumns: (Array.isArray(b.hiddenColumns) ? b.hiddenColumns : []).map(String).slice(0, 100),
    withDocs: b.withDocs !== false,
    footerNote: String(b.footerNote || '').slice(0, 3000),
    producerCount: Object.keys(allotted).length,
    totalMilk: r2(totalMilk),
    subsidyAllotted: r2(Object.values(allotted).reduce((s, v) => s + v, 0)),
    allotted
  };
};

// GET /lsgd-mithram/saved?panchayat= — list (no rows)
export const listSaved = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const filter = { companyId: req.companyId };
    if (String(req.query.panchayat || '').trim()) filter.panchayatKey = norm(req.query.panchayat);
    const data = await LsgdStatement.find(filter)
      .select('title fromDate toDate rate panchayat ward wardNumber wardMember producerCount totalMilk subsidyAllotted createdBy updatedBy createdAt updatedAt')
      .sort({ updatedAt: -1 }).limit(300).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /lsgd-mithram/saved/:id
export const getSaved = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    const doc = await LsgdStatement.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /lsgd-mithram/saved — save a new statement
export const createSaved = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const fields = statementFields(req.body);
    const doc = await LsgdStatement.create({ ...fields, companyId: req.companyId, createdBy: userName(req), updatedBy: userName(req) });
    res.status(201).json({ success: true, data: { _id: doc._id, updatedAt: doc.updatedAt }, message: 'Statement saved' });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// PUT /lsgd-mithram/saved/:id — save changes to an existing statement
export const updateSaved = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    const doc = await LsgdStatement.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!doc) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    doc.set({ ...statementFields(req.body), updatedBy: userName(req) });
    ['meta', 'overrides', 'lastSubsidy', 'allotted', 'rows', 'months'].forEach((k) => doc.markModified(k));
    await doc.save();
    res.json({ success: true, data: { _id: doc._id, updatedAt: doc.updatedAt }, message: 'Statement updated' });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// DELETE /lsgd-mithram/saved/:id — the saved statement only; farmers are untouched
export const deleteSaved = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    const r = await LsgdStatement.deleteOne({ _id: req.params.id, companyId: req.companyId });
    if (!r.deletedCount) return res.status(404).json({ success: false, message: 'Saved statement not found' });
    res.json({ success: true, message: 'Saved statement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Share by Email ────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_ATTACH_BYTES = 24 * 1024 * 1024;   // most mail servers stop at 25 MB
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
};
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

// POST /lsgd-mithram/email { to, cc, subject, message, attachments: [{ filename, contentType, contentBase64 }] }
export const emailStatement = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const to = splitEmails(req.body.to);
    const cc = splitEmails(req.body.cc);
    if (!to.length) return res.status(400).json({ success: false, message: 'Enter the recipient email address' });
    const bad = [...to, ...cc].filter((e) => !EMAIL_RE.test(e));
    if (bad.length) return res.status(400).json({ success: false, message: `Invalid email address: ${bad.join(', ')}` });
    if (to.length + cc.length > 10) return res.status(400).json({ success: false, message: 'Up to 10 recipients' });

    const list = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    if (!list.length) return res.status(400).json({ success: false, message: 'Attach the PDF and/or the Excel file' });
    let bytes = 0;
    const attachments = [];
    for (const a of list.slice(0, 2)) {
      const ext = ALLOWED_TYPES[a?.contentType];
      if (!ext || typeof a.contentBase64 !== 'string') return res.status(400).json({ success: false, message: 'Only PDF and Excel attachments are allowed' });
      const content = Buffer.from(a.contentBase64, 'base64');
      bytes += content.length;
      let filename = String(a.filename || `LSGD_Milk_Statement${ext}`).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      if (!filename.toLowerCase().endsWith(ext)) filename += ext;
      attachments.push({ filename, content, contentType: a.contentType });
    }
    if (bytes > MAX_ATTACH_BYTES) {
      return res.status(413).json({ success: false, message: 'Attachments are larger than 24 MB — send without attached documents, or only the Excel file' });
    }

    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      return res.status(500).json({ success: false, message: 'SMTP not configured. Please update SMTP_USER and SMTP_PASS in .env file.' });
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const subject = String(req.body.subject || 'LSGD Milk Statement').slice(0, 200);
    const message = String(req.body.message || '').slice(0, 5000);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
      ${message ? `<p>${escHtml(message).replace(/\n/g, '<br/>')}</p>` : '<p>Please find the LSGD Milk Statement attached.</p>'}
      <p style="color:#888;font-size:12px">Attached: ${attachments.map((a) => escHtml(a.filename)).join(', ')}</p>
    </div>`;

    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Dairy Society ERP'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: to.join(', '),
      ...(cc.length ? { cc: cc.join(', ') } : {}),
      subject,
      html,
      attachments
    });
    res.json({ success: true, message: `Email sent to ${to.join(', ')}` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Email could not be sent: ${err.message}` });
  }
};

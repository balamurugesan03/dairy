import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';
import FarmerApplication from '../models/FarmerApplication.js';
import SocietyInfo from '../models/SocietyInfo.js';
import Company from '../models/Company.js';
import LsgdWardMember from '../models/LsgdWardMember.js';
import { panchayatRegex } from './farmerFormController.js';
import { isSuperAdminReq, isAdminTierReq } from '../utils/userTier.js';

// ════════════════════════════════════════════════════════════════
//  LSGD Reports → LSGD Mithram Statement
//
//  Panchayat (+ optional ward) farmers with their month-wise milk
//  quantity from Milk Purchase for From–To, Total Milk × subsidy
//  rate = Total Amount. The statement is computed here; the screen
//  only lets the user drop rows / change the Subsidy Allotted —
//  Farmer Management and Milk Purchase are never written.
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
const deny = (res) => res.status(403).json({ success: false, message: 'You do not have access to the LSGD Mithram Statement' });

/** "5", "Ward 5", "W-05 Kanjiram" → "5" */
const wardNumberOf = (ward) => {
  const m = String(ward || '').match(/\d+/);
  return m ? String(Number(m[0])) : '';
};

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
    if (!panchayat) return res.json({ success: true, data: [] });
    const [farmerWards, members] = await Promise.all([
      Farmer.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(String(req.companyId)), 'address.panchayat': panchayatRegex(panchayat) } },
        { $group: { _id: { $trim: { input: { $ifNull: ['$address.ward', ''] } } }, farmers: { $sum: 1 } } }
      ]),
      LsgdWardMember.find({ companyId: req.companyId, panchayatKey: norm(panchayat) }).select('ward wardNumber').lean()
    ]);
    const byKey = new Map();
    for (const w of farmerWards) {
      if (!w._id) continue;
      const k = norm(w._id);
      const cur = byKey.get(k);
      if (cur) cur.farmers += w.farmers;
      else byKey.set(k, { ward: w._id, wardNumber: wardNumberOf(w._id), farmers: w.farmers });
    }
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

// GET /lsgd-mithram/statement?fromDate&toDate&panchayat&ward&rate&onlySuppliers
export const getStatement = async (req, res) => {
  try {
    if (!canUseReport(req)) return deny(res);
    const { fromDate, toDate, panchayat, ward } = req.query;
    if (!isYmd(fromDate) || !isYmd(toDate)) return res.status(400).json({ success: false, message: 'From Date and To Date are required (YYYY-MM-DD)' });
    if (fromDate > toDate) return res.status(400).json({ success: false, message: 'From Date must be on or before To Date' });
    if (!String(panchayat || '').trim()) return res.status(400).json({ success: false, message: 'Select a Panchayat' });
    const rate = Number(req.query.rate ?? 0);
    if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ success: false, message: 'Subsidy amount must be zero or more' });
    const onlySuppliers = String(req.query.onlySuppliers ?? 'true') !== 'false';

    const months = monthsBetween(fromDate, toDate);
    if (months.length > MAX_MONTHS) return res.status(400).json({ success: false, message: `Select a period of ${MAX_MONTHS} months or less` });

    const companyId = new mongoose.Types.ObjectId(String(req.companyId));
    const farmerFilter = { companyId, 'address.panchayat': panchayatRegex(panchayat) };
    if (String(ward || '').trim()) farmerFilter['address.ward'] = exactCi(ward);

    const farmers = await Farmer.find(farmerFilter)
      .select('farmerNumber memberId status collectionCenter personalDetails.name address.ward address.panchayat bankDetails.accountNumber bankDetails.bankName bankDetails.ifsc identityDetails.aadhaar documents.aadhaar documents.bankPassbook documents.rationCard')
      .lean();

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
        aadhaar: f.identityDetails?.aadhaar || '',
        ward: f.address?.ward || '',
        status: f.status || 'Active',
        monthly,
        totalMilk,
        rate,
        totalAmount,
        subsidyAllotted: totalAmount,
        docs: {
          bankPassbook: !!f.documents?.bankPassbook,
          aadhaar: !!f.documents?.aadhaar,
          rationCard: !!f.documents?.rationCard
        }
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
      subsidyAllotted: r2(rows.reduce((s, r) => s + r.subsidyAllotted, 0))
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
          fromDate, toDate, rate, onlySuppliers,
          panchayat: String(farmers[0]?.address?.panchayat || panchayat).trim(),
          ward: String(ward || '').trim(),
          financialYear: fyLabel,
          societyName: info?.societyName?.trim() || company?.societyName || company?.companyName || '',
          societyCode: info?.societyCode?.trim() || '',
          farmersInPanchayat: farmers.length
        }
      }
    });
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
      let filename = String(a.filename || `LSGD_Mithram_Statement${ext}`).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
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

    const subject = String(req.body.subject || 'LSGD Mithram Statement').slice(0, 200);
    const message = String(req.body.message || '').slice(0, 5000);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
      ${message ? `<p>${escHtml(message).replace(/\n/g, '<br/>')}</p>` : '<p>Please find the LSGD Mithram Statement attached.</p>'}
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

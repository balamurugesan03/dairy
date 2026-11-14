import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';
import { farmerWardsOf, wardNumberOf } from '../utils/panchayatMatch.js';

// ════════════════════════════════════════════════════════════════
//  Lookups for the farmer report forms (Crop Damage Statement,
//  Monthly Agri Statistics): Panchayat list, farmers with the
//  details a form can fill in, the farmer's uploaded documents,
//  and Agri Statistics figures taken from Farmer + Milk records.
// ════════════════════════════════════════════════════════════════

// Documents attached after the report, in print order (incomeProof = "Income Proof";
// documents.additionalDocuments holds further "Other" documents)
export const FORM_DOCUMENTS = ['bankPassbook', 'aadhaar', 'rationCard', 'incomeProof'];
const docFlags = () => ({
  ...Object.fromEntries(FORM_DOCUMENTS.map((k) => [k, { $gt: [{ $strLenCP: { $ifNull: [`$documents.${k}`, ''] } }, 0] }])),
  otherCount: { $size: { $ifNull: ['$documents.additionalDocuments', []] } }
});

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Same Panchayat whatever the case / surrounding spaces
export const panchayatRegex = (p) => ({ $regex: `^\\s*${escapeRegex(String(p).trim())}\\s*$`, $options: 'i' });
const panchayatMatch = (p) => ({ 'address.panchayat': panchayatRegex(p) });

// GET /farmer-forms/panchayats — distinct Panchayats in Farmer Management
export const getPanchayats = async (req, res) => {
  try {
    const list = await Farmer.distinct('address.panchayat', { companyId: req.companyId });
    const seen = new Map();
    for (const p of list) {
      const v = String(p || '').trim();
      if (v && !seen.has(v.toUpperCase())) seen.set(v.toUpperCase(), v);
    }
    res.json({ success: true, data: [...seen.values()].sort((a, b) => a.localeCompare(b)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /farmer-forms/farmers?panchayat= — light farmer list with the auto-fill fields
export const getFormFarmers = async (req, res) => {
  try {
    const filter = { companyId: req.companyId };
    if (req.query.panchayat) Object.assign(filter, panchayatMatch(req.query.panchayat));
    const farmers = await Farmer.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(String(req.companyId)) } },
      {
        $project: {
          farmerNumber: 1,
          name: '$personalDetails.name',
          phone: '$personalDetails.phone',
          aadhaar: '$identityDetails.aadhaar',
          bankName: '$bankDetails.bankName',
          accountNumber: '$bankDetails.accountNumber',
          branch: '$bankDetails.branch',
          ifsc: '$bankDetails.ifsc',
          // Secondary bank + which one payments use; Parent Grouping link
          secBankName: '$secondaryBankDetails.bankName',
          secAccountNumber: '$secondaryBankDetails.accountNumber',
          secBranch: '$secondaryBankDetails.branch',
          secIfsc: '$secondaryBankDetails.ifsc',
          payTo: 1,
          parentFarmer: 1,
          panchayat: '$address.panchayat',
          village: '$address.village',
          ward: '$address.ward',
          wardNumber: '$address.wardNumber',
          taluk: '$address.taluk',
          // Application forms (Panchayat subsidy / incentive)
          houseName: '$address.houseName',
          houseNumber: '$address.houseNumber',
          place: '$address.place',
          post: '$address.post',
          pin: '$address.pin',
          gender: '$personalDetails.gender',
          caste: '$personalDetails.caste',
          rationCardNo: '$identityDetails.rationCardNo',
          voterId: '$identityDetails.voterId',
          memberId: 1,
          isMembership: 1,
          collectionCenter: 1,
          // which documents are uploaded (not the files themselves)
          docs: docFlags()
        }
      },
      { $sort: { name: 1 } }
    ]);
    // Centre code / name: farmer numbers repeat per centre, so the form shows "C2/15"
    const centres = await CollectionCenter.find({ companyId: req.companyId }).select('centerCode centerName').lean();
    const centreOf = Object.fromEntries(centres.map((c) => [String(c._id), c]));
    farmers.forEach((f) => {
      const c = centreOf[String(f.collectionCenter)];
      f.centreCode = c?.centerCode || '';
      f.centreName = c?.centerName || '';
      delete f.collectionCenter;
    });
    res.json({ success: true, data: farmers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /farmer-forms/documents/:farmerId — Bank Statement, Aadhaar, Ration Card (only those uploaded)
export const getFarmerDocuments = async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ _id: req.params.farmerId, companyId: req.companyId })
      .select([...FORM_DOCUMENTS.map((k) => `documents.${k}`), 'documents.additionalDocuments'].join(' ')).lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });
    const docs = {};
    for (const k of FORM_DOCUMENTS) if (farmer.documents?.[k]) docs[k] = farmer.documents[k];
    const other = (farmer.documents?.additionalDocuments || []).filter(Boolean);
    if (other.length) docs.additionalDocuments = other;
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const r2 = (n) => Number((Number(n) || 0).toFixed(2));

// GET /agri-stats/prefill?panchayat&month&year — figures for one Panchayat and month
export const getAgriPrefill = async (req, res) => {
  try {
    const { panchayat, month, year } = req.query;
    if (!panchayat) return res.status(400).json({ success: false, message: 'panchayat is required' });
    const farmers = await Farmer.find({ companyId: req.companyId, status: { $ne: 'Inactive' }, ...panchayatMatch(panchayat) })
      .select('personalDetails.gender personalDetails.caste address.village address.panchayat').lean();

    // Farmers row: SC / ST from caste; Female / Male from gender
    const caste = (f) => String(f.personalDetails?.caste || '').trim().toUpperCase();
    const count = (fn) => farmers.filter(fn).length;
    const population = {
      sc: count((f) => caste(f) === 'SC'),
      st: count((f) => caste(f) === 'ST'),
      female: count((f) => f.personalDetails?.gender === 'Female'),
      male: count((f) => f.personalDetails?.gender === 'Male'),
      farmers: farmers.length
    };

    // Most common village of these farmers
    const villages = {};
    farmers.forEach((f) => { const v = String(f.address?.village || '').trim(); if (v) villages[v] = (villages[v] || 0) + 1; });
    const village = Object.entries(villages).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Milk purchased from these farmers in the month
    let milk = null;
    const mi = MONTHS.indexOf(month);
    const y = Number(year);
    if (mi >= 0 && y && farmers.length) {
      const start = new Date(Date.UTC(y, mi, 1) - 5.5 * 3600 * 1000);       // IST month
      const end = new Date(Date.UTC(y, mi + 1, 1) - 5.5 * 3600 * 1000);
      const [agg] = await MilkCollection.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(String(req.companyId)), farmer: { $in: farmers.map((f) => f._id) }, date: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: null,
            qty: { $sum: '$qty' },
            fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
            snfQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$snf', 0] }] } },
            amount: { $sum: '$amount' }
          }
        }
      ]);
      if (agg?.qty) {
        const days = new Date(y, mi + 1, 0).getDate();
        milk = {
          qty: r2(agg.qty),
          avgPerDay: r2(agg.qty / days),
          fat: r2(agg.fatQty / agg.qty),
          snf: r2(agg.snfQty / agg.qty),
          avgPrice: r2(agg.amount / agg.qty)
        };
      }
    }

    // Name as written in Farmer Management (the typed one if no farmer has it)
    const name = String(farmers[0]?.address?.panchayat || panchayat).trim();
    res.json({ success: true, data: { panchayat: name, village, population, milk } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  Save-back: details typed on an LSGD / farmer report go to the same
//  farmer in Farmers Management (never a new farmer), so the next report
//  and every other screen gets them.
//   • A detail the farmer does not have yet is always filled in.
//   • A detail the farmer already has is replaced only when the user
//     changed that field on the report (`changed`), so a stale value on
//     an old application never overwrites a newer farmer record.
// ════════════════════════════════════════════════════════════════
const SYNC_FIELDS = [
  // [form field, farmer path, label]
  ['bankName',      'bankDetails.bankName',      'Bank Name'],
  ['accountNumber', 'bankDetails.accountNumber', 'Account Number'],
  ['ifsc',          'bankDetails.ifsc',          'IFSC Code'],
  ['branch',        'bankDetails.branch',        'Branch'],
  ['ward',          'address.ward',              'Ward'],
  ['wardNumber',    'address.wardNumber',        'Ward No'],
  ['panchayat',     'address.panchayat',         'Panchayat'],
  ['aadhaarNumber', 'identityDetails.aadhaar',   'Aadhaar'],
  ['mobileNumber',  'personalDetails.phone',     'Mobile'],
  // Farmer Application forms
  ['pincode',       'address.pin',               'PIN Code'],
  ['houseNumber',   'address.houseNumber',       'House Number'],
  ['rationCardNo',  'identityDetails.rationCardNo', 'Ration Card No'],
  ['electionId',    'identityDetails.voterId',   'Election ID'],
  ['category',      'personalDetails.caste',     'Category'],
  ['gender',        'personalDetails.gender',    'Gender'],
  ['membershipNo',  'memberId',                  'Membership No'],
];
export const SYNC_FIELD_NAMES = SYNC_FIELDS.map(([f]) => f);
const ADDRESS_PARTS = ['address.houseName', 'address.place', 'address.post'];

const pathGet = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

/**
 * Save a report's farmer details to the farmer.
 * @param form     report fields (bankName, accountNumber, ifsc, ward, wardNumber, panchayat, …)
 * @param changed  form fields the user edited on the report — these replace existing values
 * @returns labels saved, e.g. ['Account Number', 'Ward (updated)']
 */
export const syncFarmerFromForm = async (companyId, farmerId, form = {}, { changed = [] } = {}) => {
  if (!farmerId || !mongoose.isValidObjectId(String(farmerId))) return [];
  const farmer = await Farmer.findOne({ _id: farmerId, companyId })
    .select([...SYNC_FIELDS.map(([, path]) => path), ...ADDRESS_PARTS].join(' ') + ' bankDetails.bankLedgerId').lean();
  if (!farmer) return [];
  const edited = new Set((Array.isArray(changed) ? changed : []).map(String));
  const data = { ...form };
  // Ward picked without a number → number from the ward ("Ward 5" → 5)
  if (edited.has('ward') && !String(data.wardNumber ?? '').trim() && wardNumberOf(data.ward)) {
    data.wardNumber = wardNumberOf(data.ward);
    edited.add('wardNumber');
  }
  const $set = {};
  const added = [];
  // Bank fields go together: without an edit, only when the farmer has no bank yet or it is the
  // same bank — never another bank's account / IFSC under the farmer's bank name
  const norm = (s) => String(s ?? '').trim().toUpperCase();
  const farmerBank = norm(farmer.bankDetails?.bankName);
  const bankEdited = ['bankName', 'accountNumber', 'ifsc', 'branch'].some((f) => edited.has(f));
  const sameBank = bankEdited || !farmerBank || !norm(data.bankName) || farmerBank === norm(data.bankName);
  for (const [field, path, label] of SYNC_FIELDS) {
    if (path.startsWith('bankDetails.') && !sameBank) continue;
    const v = String(data[field] ?? '').trim();
    if (!v) continue;
    const cur = String(pathGet(farmer, path) ?? '').trim();
    if (cur && !edited.has(field)) continue;          // keep Farmers Management's value
    if (cur && norm(cur) === norm(v)) continue;       // nothing to change
    if (path === 'personalDetails.gender' && !['Male', 'Female', 'Other'].includes(v)) continue;
    $set[path] = path === 'bankDetails.ifsc' || path === 'identityDetails.voterId' ? v.toUpperCase() : v;
    added.push(cur ? `${label} (updated)` : label);
  }
  // Address typed on a form: only when the farmer has no address at all (it can't be split into parts)
  const addressText = String(data.address ?? '').trim();
  if (typeof data.address === 'string' && addressText && ADDRESS_PARTS.every((p) => !String(pathGet(farmer, p) ?? '').trim())) {
    $set['address.place'] = addressText;
    added.push('Address');
  }
  // Bank from Farmer Bank Details: carry its ledger too
  if ($set['bankDetails.bankName'] && (!farmer.bankDetails?.bankLedgerId || edited.has('bankName'))
    && data.bankLedgerId && mongoose.isValidObjectId(String(data.bankLedgerId))) {
    $set['bankDetails.bankLedgerId'] = data.bankLedgerId;
  }
  if (added.length) await Farmer.updateOne({ _id: farmer._id }, { $set });
  return added;
};

// Same checks as the application forms
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const nospace = (s) => String(s ?? '').replace(/\s+/g, '');
export const validateFarmerDetails = (b) => {
  const errors = [];
  const ifsc = String(b.ifsc || '').trim().toUpperCase();
  if (ifsc && !IFSC_RE.test(ifsc)) errors.push('IFSC Code must be 11 characters like SBIN0001234');
  const ac = nospace(b.accountNumber);
  if (ac && !/^\d{6,18}$/.test(ac)) errors.push('Bank Account Number must be 6–18 digits');
  const aadhaar = nospace(b.aadhaarNumber);
  if (aadhaar && !/^\d{12}$/.test(aadhaar)) errors.push('Aadhaar Number must be 12 digits');
  const mobile = nospace(b.mobileNumber);
  if (mobile && !/^\d{10}$/.test(mobile)) errors.push('Mobile Number must be 10 digits');
  return errors;
};

// PUT /farmer-forms/farmers/:farmerId/details { ...fields, changed: [field] }
//   Farmer details edited on an LSGD report (e.g. a Milk Statement row) → Farmers Management
export const updateFarmerDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.farmerId)) return res.status(404).json({ success: false, message: 'Farmer not found' });
    const errors = validateFarmerDetails(req.body || {});
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('; '), errors });
    const body = { ...req.body };
    ['accountNumber', 'aadhaarNumber', 'mobileNumber'].forEach((k) => { if (body[k] != null) body[k] = nospace(body[k]); });
    const changed = (Array.isArray(body.changed) ? body.changed : []).filter((f) => SYNC_FIELD_NAMES.includes(f));
    const exists = await Farmer.exists({ _id: req.params.farmerId, companyId: req.companyId });
    if (!exists) return res.status(404).json({ success: false, message: 'Farmer not found in Farmers Management' });
    const synced = await syncFarmerFromForm(req.companyId, req.params.farmerId, body, { changed });
    const f = await Farmer.findById(req.params.farmerId)
      .select('farmerNumber personalDetails.name personalDetails.phone bankDetails identityDetails.aadhaar address').lean();
    res.json({
      success: true,
      synced,
      data: {
        _id: f._id, farmerNumber: f.farmerNumber, name: f.personalDetails?.name || '', phone: f.personalDetails?.phone || '',
        bankName: f.bankDetails?.bankName || '', branch: f.bankDetails?.branch || '', accountNumber: f.bankDetails?.accountNumber || '',
        ifsc: (f.bankDetails?.ifsc || '').toUpperCase(), aadhaar: f.identityDetails?.aadhaar || '',
        panchayat: f.address?.panchayat || '', ward: f.address?.ward || '', wardNumber: f.address?.wardNumber || ''
      },
      message: synced.length ? `Saved to Farmers Management: ${synced.join(', ')}` : 'No change — Farmers Management already has these details'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Documents uploaded from a report → the farmer's Documents in Farmers Management ──
// Slots: bankPassbook (Bank Statement), aadhaar, rationCard, incomeProof (Income Proof
// — as in Add Farmer) — one file each, a new upload replaces it. "other" adds to
// documents.additionalDocuments (max 5, an identical file is not added twice).
const DOC_LABELS = { bankPassbook: 'Bank Statement', aadhaar: 'Aadhaar Card Copy', rationCard: 'Ration Card Copy', incomeProof: 'Income Proof', other: 'Other Document' };
const MAX_DOC_BYTES = 5 * 1024 * 1024;           // per file, after the browser has shrunk images
const MAX_OTHER = 5;
const DATA_URL_HEAD = /^data:(image\/(png|jpe?g|webp|gif|bmp)|application\/pdf);base64,/i;

const documentSummary = async (companyId, farmerId) => {
  const [d] = await Farmer.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(farmerId)), companyId: new mongoose.Types.ObjectId(String(companyId)) } },
    { $project: { farmerNumber: 1, docs: docFlags() } }
  ]);
  return d ? { farmerId: d._id, farmerNumber: d.farmerNumber, ...d.docs } : null;
};

// GET /farmer-forms/documents/:farmerId/summary — which documents are uploaded (no files)
export const getFarmerDocumentSummary = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.farmerId)) return res.status(404).json({ success: false, message: 'Farmer not found' });
    const data = await documentSummary(req.companyId, req.params.farmerId);
    if (!data) return res.status(404).json({ success: false, message: 'Farmer not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /farmer-forms/documents/:farmerId { type, data: 'data:…;base64,…', farmerNumber? }
export const uploadFarmerDocument = async (req, res) => {
  try {
    const { type, data } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.farmerId)) return res.status(404).json({ success: false, message: 'Farmer not found' });
    if (!DOC_LABELS[type]) return res.status(400).json({ success: false, message: 'Unknown document type' });
    if (typeof data !== 'string' || !DATA_URL_HEAD.test(data) || !/^[A-Za-z0-9+/=\r\n]*$/.test(data.slice(data.indexOf(',') + 1, data.indexOf(',') + 2001))) {
      return res.status(400).json({ success: false, message: 'Upload an image (JPG / PNG) or a PDF' });
    }
    const bytes = Math.floor((data.length - data.indexOf(',') - 1) * 0.75);
    if (bytes > MAX_DOC_BYTES) return res.status(413).json({ success: false, message: 'File is larger than 5 MB' });

    const farmer = await Farmer.findOne({ _id: req.params.farmerId, companyId: req.companyId })
      .select('farmerNumber documents.additionalDocuments');
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found in Farmers Management' });
    // The report names the farmer by number — refuse if it is a different farmer
    if (req.body.farmerNumber && String(req.body.farmerNumber).trim() !== String(farmer.farmerNumber || '').trim()) {
      return res.status(409).json({ success: false, message: `Farmer Number ${req.body.farmerNumber} does not match this farmer (${farmer.farmerNumber})` });
    }

    let message;
    if (type === 'other') {
      const list = (farmer.documents?.additionalDocuments || []).filter(Boolean);
      if (list.includes(data)) {
        message = 'This document is already saved for the farmer';
      } else {
        if (list.length >= MAX_OTHER) return res.status(400).json({ success: false, message: `Up to ${MAX_OTHER} other documents — remove one first` });
        await Farmer.updateOne({ _id: farmer._id }, { $set: { 'documents.additionalDocuments': [...list, data] } });
        message = `${DOC_LABELS.other} saved to Farmers Management`;
      }
    } else {
      await Farmer.updateOne({ _id: farmer._id }, { $set: { [`documents.${type}`]: data } });
      message = `${DOC_LABELS[type]} saved to Farmers Management`;
    }
    res.json({ success: true, message, data: await documentSummary(req.companyId, farmer._id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /farmer-forms/documents/:farmerId/:type[?index=n] — remove a document from the farmer
export const deleteFarmerDocument = async (req, res) => {
  try {
    const { farmerId, type } = req.params;
    if (!mongoose.isValidObjectId(farmerId)) return res.status(404).json({ success: false, message: 'Farmer not found' });
    if (!DOC_LABELS[type]) return res.status(400).json({ success: false, message: 'Unknown document type' });
    const farmer = await Farmer.findOne({ _id: farmerId, companyId: req.companyId }).select('documents.additionalDocuments');
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });
    if (type === 'other') {
      const list = (farmer.documents?.additionalDocuments || []).filter(Boolean);
      const i = Number(req.query.index);
      if (!Number.isInteger(i) || i < 0 || i >= list.length) return res.status(400).json({ success: false, message: 'Document not found' });
      list.splice(i, 1);
      await Farmer.updateOne({ _id: farmer._id }, { $set: { 'documents.additionalDocuments': list } });
    } else {
      await Farmer.updateOne({ _id: farmer._id }, { $unset: { [`documents.${type}`]: 1 } });
    }
    res.json({ success: true, message: `${DOC_LABELS[type]} removed`, data: await documentSummary(req.companyId, farmer._id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /farmer-forms/wards?panchayat=&aliases= — wards already recorded for the Panchayat's
// farmers (name + ward number), for the Add / Edit Farmer address and the LSGD reports
export const getPanchayatWards = async (req, res) => {
  try {
    const panchayat = String(req.query.panchayat || '').trim();
    if (!panchayat) return res.json({ success: true, data: [] });
    const aliases = String(req.query.aliases || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const data = await farmerWardsOf(req.companyId, panchayat, aliases);
    data.sort((a, b) => (Number(a.wardNumber) || 9999) - (Number(b.wardNumber) || 9999) || a.ward.localeCompare(b.ward));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

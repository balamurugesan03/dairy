import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';

// ════════════════════════════════════════════════════════════════
//  Lookups for the farmer report forms (Crop Damage Statement,
//  Monthly Agri Statistics): Panchayat list, farmers with the
//  details a form can fill in, the farmer's uploaded documents,
//  and Agri Statistics figures taken from Farmer + Milk records.
// ════════════════════════════════════════════════════════════════

// Documents attached after the report, in print order
export const FORM_DOCUMENTS = ['bankPassbook', 'aadhaar', 'rationCard'];

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
          panchayat: '$address.panchayat',
          village: '$address.village',
          ward: '$address.ward',
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
          docs: Object.fromEntries(FORM_DOCUMENTS.map((k) => [k, { $gt: [{ $strLenCP: { $ifNull: [`$documents.${k}`, ''] } }, 0] }]))
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
      .select(FORM_DOCUMENTS.map((k) => `documents.${k}`).join(' ')).lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });
    const docs = {};
    for (const k of FORM_DOCUMENTS) if (farmer.documents?.[k]) docs[k] = farmer.documents[k];
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
//  Save-back: details typed on a report form that Farmer Management
//  does not have yet are written to the farmer, so the next report
//  (and every other screen) gets them. Existing values are never
//  overwritten — Farmer Management stays the source of truth.
// ════════════════════════════════════════════════════════════════
const SYNC_FIELDS = [
  // [form field, farmer path, label]
  ['bankName',      'bankDetails.bankName',      'Bank Name'],
  ['accountNumber', 'bankDetails.accountNumber', 'Account Number'],
  ['ifsc',          'bankDetails.ifsc',          'IFSC Code'],
  ['branch',        'bankDetails.branch',        'Branch'],
  ['ward',          'address.ward',              'Ward'],
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
const ADDRESS_PARTS = ['address.houseName', 'address.place', 'address.post'];

const pathGet = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

/** Fill the farmer's missing details from a saved form; returns the labels that were added. */
export const syncFarmerFromForm = async (companyId, farmerId, form = {}) => {
  if (!farmerId || !mongoose.isValidObjectId(String(farmerId))) return [];
  const farmer = await Farmer.findOne({ _id: farmerId, companyId })
    .select([...SYNC_FIELDS.map(([, path]) => path), ...ADDRESS_PARTS].join(' ') + ' bankDetails.bankLedgerId').lean();
  if (!farmer) return [];
  const $set = {};
  const added = [];
  // Bank fields go together: only when the farmer has no bank yet, or it is the same bank —
  // never another bank's account / IFSC under the farmer's bank name
  const norm = (s) => String(s ?? '').trim().toUpperCase();
  const farmerBank = norm(farmer.bankDetails?.bankName);
  const sameBank = !farmerBank || !norm(form.bankName) || farmerBank === norm(form.bankName);
  for (const [field, path, label] of SYNC_FIELDS) {
    if (path.startsWith('bankDetails.') && !sameBank) continue;
    const v = String(form[field] ?? '').trim();
    if (!v || String(pathGet(farmer, path) ?? '').trim()) continue;
    if (path === 'personalDetails.gender' && !['Male', 'Female', 'Other'].includes(v)) continue;
    $set[path] = path === 'bankDetails.ifsc' || path === 'identityDetails.voterId' ? v.toUpperCase() : v;
    added.push(label);
  }
  // Address typed on a form: only when the farmer has no address at all (it can't be split into parts)
  const addressText = String(form.address ?? '').trim();
  if (typeof form.address === 'string' && addressText && ADDRESS_PARTS.every((p) => !String(pathGet(farmer, p) ?? '').trim())) {
    $set['address.place'] = addressText;
    added.push('Address');
  }
  // Bank from Farmer Bank Details: carry its ledger too, when the farmer has none
  if ($set['bankDetails.bankName'] && !farmer.bankDetails?.bankLedgerId && form.bankLedgerId && mongoose.isValidObjectId(String(form.bankLedgerId))) {
    $set['bankDetails.bankLedgerId'] = form.bankLedgerId;
  }
  if (added.length) await Farmer.updateOne({ _id: farmer._id }, { $set });
  return added;
};

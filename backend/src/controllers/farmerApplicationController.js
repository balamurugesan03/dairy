import mongoose from 'mongoose';
import FarmerApplication from '../models/FarmerApplication.js';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import SocietyInfo from '../models/SocietyInfo.js';
import Company from '../models/Company.js';
import { panchayatRegex, syncFarmerFromForm } from './farmerFormController.js';

// ════════════════════════════════════════════════════════════════
//  Farmer Applications — Panchayat milk subsidy / incentive forms.
//  Farmer details come from Farmer Management; missing ones typed
//  on the form are saved back to the same farmer (never a new one).
// ════════════════════════════════════════════════════════════════

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const digits = (s) => String(s ?? '').replace(/\s+/g, '');

/** Server-side checks (the form checks the same before saving). */
const validate = (b) => {
  const errors = [];
  if (!b.farmerId || !mongoose.isValidObjectId(String(b.farmerId))) errors.push('Farmer Number is required');
  if (!Number(b.year)) errors.push('Year is required');
  if (!String(b.panchayat || '').trim()) errors.push('Panchayat is required');
  if (!String(b.applicantName || '').trim()) errors.push('Applicant name is required');
  const ifsc = String(b.ifsc || '').trim().toUpperCase();
  if (ifsc && !IFSC_RE.test(ifsc)) errors.push('IFSC Code must be 11 characters like SBIN0001234');
  const ac = digits(b.accountNumber);
  if (ac && !/^\d{6,18}$/.test(ac)) errors.push('Bank Account Number must be 6–18 digits');
  const aadhaar = digits(b.aadhaarNumber);
  if (aadhaar && !/^\d{12}$/.test(aadhaar)) errors.push('Aadhaar Number must be 12 digits');
  const mobile = digits(b.mobileNumber);
  if (mobile && !/^\d{10}$/.test(mobile)) errors.push('Mobile Number must be 10 digits');
  const pin = digits(b.pincode);
  if (pin && !/^\d{6}$/.test(pin)) errors.push('PIN Code must be 6 digits');
  return errors;
};

const clean = (b) => {
  const out = { ...b };
  delete out._id; delete out.companyId; delete out.applicationNo; delete out.createdAt; delete out.updatedAt;
  out.year = Number(b.year);
  out.panchayat = String(b.panchayat || '').trim();
  out.ifsc = String(b.ifsc || '').trim().toUpperCase();
  out.accountNumber = digits(b.accountNumber);
  out.aadhaarNumber = digits(b.aadhaarNumber);
  out.mobileNumber = digits(b.mobileNumber);
  out.pincode = digits(b.pincode);
  out.cowCount = b.cowCount === '' || b.cowCount == null ? null : Number(b.cowCount);
  out.avgMilkPerDay = b.avgMilkPerDay === '' || b.avgMilkPerDay == null ? null : Number(b.avgMilkPerDay);
  return out;
};

// Membership No is saved to the farmer only when the form says "member"
const syncPayload = (a) => ({ ...a, membershipNo: a.isMember ? a.membershipNo : '' });

// ── GET ALL ── ?year&panchayat&formType&status&search&page&limit
export const getApplications = async (req, res) => {
  try {
    const { year, panchayat, formType, status, search = '', page = 1, limit = 20 } = req.query;
    const q = { companyId: req.companyId };
    if (year) q.year = Number(year);
    if (panchayat) q.panchayat = panchayatRegex(panchayat);
    if (formType) q.formType = formType;
    if (status) q.status = status;
    if (search.trim()) {
      const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.$or = [
        { applicantName: { $regex: s, $options: 'i' } },
        { farmerNumber: search.trim() },
        { applicationNo: { $regex: s, $options: 'i' } },
      ];
    }
    const total = await FarmerApplication.countDocuments(q);
    const applications = await FarmerApplication.find(q)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();
    res.json({ success: true, data: { applications, total, page: +page, limit: +limit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const app = await FarmerApplication.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const nextApplicationNo = async (companyId, year) => {
  const prefix = `APP-${String(year).slice(-2)}${String(year + 1).slice(-2)}-`;
  const last = await FarmerApplication.findOne({ companyId, applicationNo: { $regex: `^${prefix}` } })
    .sort({ applicationNo: -1 }).select('applicationNo').lean();
  const n = last ? parseInt(last.applicationNo.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
};

export const createApplication = async (req, res) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('; '), errors });
    const body = clean(req.body);

    const farmer = await Farmer.findOne({ _id: body.farmerId, companyId: req.companyId }).select('farmerNumber').lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found in Farmer Management' });

    // One application per farmer, year and form
    const existing = await FarmerApplication.findOne({
      companyId: req.companyId, farmerId: body.farmerId, year: body.year, formType: body.formType || 'SUBSIDY',
    }).select('_id applicationNo').lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `This farmer already has an application for ${body.year}-${body.year + 1} (${existing.applicationNo}) — open it to edit`,
        existingId: existing._id,
      });
    }

    const app = await FarmerApplication.create({
      ...body,
      farmerNumber: body.farmerNumber || farmer.farmerNumber,
      applicationNo: await nextApplicationNo(req.companyId, body.year),
      companyId: req.companyId,
    });
    const synced = await syncFarmerFromForm(req.companyId, app.farmerId, syncPayload(body));
    res.status(201).json({ success: true, data: app, synced });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('; '), errors });
    const body = clean(req.body);
    const app = await FarmerApplication.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      body,
      { new: true, runValidators: true }
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    const synced = await syncFarmerFromForm(req.companyId, app.farmerId, syncPayload(body));
    res.json({ success: true, data: app, synced });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteApplication = async (req, res) => {
  try {
    const app = await FarmerApplication.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /farmer-applications/prefill?farmerId&year&date
 * Society name, and the farmer's average milk per day (for the secretary's
 * certificate): milk poured in the scheme's financial year up to the
 * application date — or the 12 months before it when that year has none —
 * divided by the days the farmer poured.
 */
export const getApplicationPrefill = async (req, res) => {
  try {
    const { farmerId, year, date } = req.query;
    const [info, company] = await Promise.all([
      SocietyInfo.findOne({ companyId: req.companyId }).select('societyName city').lean(),
      Company.findById(req.companyId).select('companyName societyName').lean(),
    ]);
    const societyName = info?.societyName || company?.societyName || company?.companyName || '';

    let milk = null;
    if (farmerId && mongoose.isValidObjectId(String(farmerId))) {
      const asOf = date ? new Date(date) : new Date();
      const end = new Date(asOf); end.setHours(23, 59, 59, 999);
      const avgFor = async (start, stop) => {
        const [agg] = await MilkCollection.aggregate([
          { $match: { companyId: new mongoose.Types.ObjectId(String(req.companyId)), farmer: new mongoose.Types.ObjectId(String(farmerId)), date: { $gte: start, $lte: stop } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } }, qty: { $sum: '$qty' } } },
          { $group: { _id: null, qty: { $sum: '$qty' }, days: { $sum: 1 } } },
        ]);
        return agg?.days ? { qty: +agg.qty.toFixed(2), days: agg.days, avgPerDay: +(agg.qty / agg.days).toFixed(2), from: start, to: stop } : null;
      };
      const y = Number(year);
      if (y) {
        const fyStart = new Date(y, 3, 1);
        const fyEnd = new Date(y + 1, 2, 31, 23, 59, 59, 999);
        if (fyStart <= end) milk = await avgFor(fyStart, end < fyEnd ? end : fyEnd);
      }
      if (!milk) {
        const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
        milk = await avgFor(start, end);
      }
    }
    res.json({ success: true, data: { societyName, place: info?.city || '', milk } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

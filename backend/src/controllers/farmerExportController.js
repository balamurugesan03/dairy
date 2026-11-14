import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import CollectionCenter from '../models/CollectionCenter.js';

// ════════════════════════════════════════════════════════════════
//  Farmers Management → Producer Management → Export Farmer
//  (Super Admin only — the route carries requireSuperAdmin)
//
//  One flat row per farmer with readable column names, ready for Excel.
//  Photos and uploaded documents are not exported.
// ════════════════════════════════════════════════════════════════

const ymd = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');
const numOf = (s) => { const n = parseInt(String(s || '').replace(/\D/g, ''), 10); return Number.isNaN(n) ? Infinity : n; };

// GET /farmers/export?status=Active|Inactive&collectionCenter=<id>
export const exportFarmers = async (req, res) => {
  try {
    const companyId = new mongoose.Types.ObjectId(String(req.companyId));
    const filter = { companyId };
    if (['Active', 'Inactive'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.collectionCenter && mongoose.isValidObjectId(req.query.collectionCenter)) {
      filter.collectionCenter = new mongoose.Types.ObjectId(req.query.collectionCenter);
    }

    const [farmers, centres] = await Promise.all([
      Farmer.find(filter).select('-documents -personalDetails.photo -shareHistory -termination -eligibility').lean(),
      CollectionCenter.find({ companyId }).select('centerCode centerName').lean(),
    ]);
    const centreOf = new Map(centres.map((c) => [String(c._id), c]));
    const numberOf = new Map(farmers.map((f) => [String(f._id), f.farmerNumber]));

    const rows = farmers.map((f) => {
      const c = centreOf.get(String(f.collectionCenter)) || {};
      const p = f.personalDetails || {};
      const a = f.address || {};
      const id = f.identityDetails || {};
      const b = f.bankDetails || {};
      const s = f.secondaryBankDetails || {};
      return {
        'Farmer Number': f.farmerNumber || '',
        'Member ID': f.memberId || '',
        'Centre Code': c.centerCode || '',
        'Centre': c.centerName || '',
        'Name': p.name || '',
        'Father / Husband Name': p.fatherName || '',
        'Gender': p.gender || '',
        'Date of Birth': ymd(p.dob),
        'Age': p.age ?? '',
        'Phone Number': p.phone || '',
        'Caste': p.caste || '',
        'Nominee Name': p.nomineeName || '',
        'Nominee Relation': p.nomineeRelation || '',
        'House Name': a.houseName || '',
        'House Number': a.houseNumber || '',
        'Panchayat': a.panchayat || '',
        'Ward': a.ward || '',
        'Ward Number': a.wardNumber || '',
        'Place': a.place || '',
        'Post': a.post || '',
        'Village': a.village || '',
        'Block / Taluk': a.taluk || '',
        'PIN Code': a.pin || '',
        'Aadhaar': id.aadhaar || '',
        'PAN': id.pan || '',
        'Ration Card No': id.rationCardNo || '',
        'Voter ID': id.voterId || '',
        'Ksheerasree ID': id.ksheerasreeId || '',
        'Welfare No': id.welfareNo || '',
        'Bank Name': b.bankName || '',
        'Branch': b.branch || '',
        'Account Number': b.accountNumber || '',
        'IFSC': (b.ifsc || '').toUpperCase(),
        'Secondary Bank Name': s.bankName || '',
        'Secondary Branch': s.branch || '',
        'Secondary Account Number': s.accountNumber || '',
        'Secondary IFSC': (s.ifsc || '').toUpperCase(),
        'Pay To': f.payTo || 'Primary',
        'Parent Farmer Number': f.parentFarmer ? (numberOf.get(String(f.parentFarmer)) || '') : '',
        'Farmer Type': f.farmerType || '',
        'Cow Type': f.cowType || '',
        'Member': f.isMembership ? 'Yes' : 'No',
        'Membership Date': ymd(f.membershipDate),
        'Admission Date': ymd(f.admissionDate),
        'Total Shares': f.financialDetails?.totalShares ?? '',
        'Status': f.status || 'Active',
      };
    });
    rows.sort((x, y) => String(x['Centre Code']).localeCompare(String(y['Centre Code']), undefined, { numeric: true })
      || numOf(x['Farmer Number']) - numOf(y['Farmer Number'])
      || String(x['Farmer Number']).localeCompare(String(y['Farmer Number'])));

    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Export failed' });
  }
};

import SocietyInfo     from '../models/SocietyInfo.js';
import SocietyDocument from '../models/SocietyDocument.js';
import { getSocietyProfile, applyCompanyValues } from '../utils/societyProfile.js';

// ════════════════════════════════════════════════════════════════
//  GET  /api/society-info
//  Returns { info: {...}, documents: [...], companyFields: [...] }
//  info = Society Information merged with the company configuration
//  (Super Admin); companyFields = the keys that came from the company
// ════════════════════════════════════════════════════════════════
export const getSocietyInfo = async (req, res) => {
  try {
    const [{ info, companyFields }, documents] = await Promise.all([
      getSocietyProfile(req.companyId),
      SocietyDocument.find({ companyId: req.companyId }).lean(),
    ]);
    res.json({ success: true, data: { info, documents, companyFields } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  PUT  /api/society-info
//  Upsert society basic + board info
// ════════════════════════════════════════════════════════════════
export const upsertSocietyInfo = async (req, res) => {
  try {
    const { _id, companyId, createdAt, updatedAt, __v, ...body } = req.body || {};
    const info = await SocietyInfo.findOneAndUpdate(
      { companyId: req.companyId },
      // company-owned values (Super Admin) are kept whatever the form sends
      { ...(await applyCompanyValues(req.companyId, body)), companyId: req.companyId },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: info });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  PUT  /api/society-info/documents/:documentKey
//  Upsert a single document record
// ════════════════════════════════════════════════════════════════
export const upsertDocument = async (req, res) => {
  try {
    const { documentKey } = req.params;

    // Auto-compute status based on expiryDate
    let { status } = req.body;
    const { expiryDate, fileData } = req.body;
    if (!fileData) {
      status = 'Pending';
    } else if (expiryDate) {
      status = new Date(expiryDate) < new Date() ? 'Expired' : 'Valid';
    } else {
      status = 'Valid';
    }

    const doc = await SocietyDocument.findOneAndUpdate(
      { companyId: req.companyId, documentKey },
      { ...req.body, companyId: req.companyId, documentKey, status },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  DELETE  /api/society-info/documents/:documentKey
//  Remove file + document data (keep empty record)
// ════════════════════════════════════════════════════════════════
export const deleteDocument = async (req, res) => {
  try {
    const { documentKey } = req.params;
    await SocietyDocument.findOneAndUpdate(
      { companyId: req.companyId, documentKey },
      { fileData: null, fileName: null, fileType: null, documentNumber: '', expiryDate: null, status: 'Pending' }
    );
    res.json({ success: true, message: 'Document cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

import SocietyInfo     from '../models/SocietyInfo.js';
import SocietyDocument from '../models/SocietyDocument.js';

// ════════════════════════════════════════════════════════════════
//  GET  /api/society-info
//  Returns { info: {...}, documents: [...] }
// ════════════════════════════════════════════════════════════════
export const getSocietyInfo = async (req, res) => {
  try {
    const [info, documents] = await Promise.all([
      SocietyInfo.findOne({ companyId: req.companyId }).lean(),
      SocietyDocument.find({ companyId: req.companyId }).lean(),
    ]);
    res.json({ success: true, data: { info: info || {}, documents } });
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
    const info = await SocietyInfo.findOneAndUpdate(
      { companyId: req.companyId },
      { ...req.body, companyId: req.companyId },
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

import CollectionCenter from '../models/CollectionCenter.js';
import FarmerSettings from '../models/FarmerSettings.js';
import {
  ensureCentreCodes, nextCentreCode, normaliseCentreCode, centreCodeTaken,
  getCentreCodeStart, syncCentreCodeChange
} from '../utils/centreCode.js';

// centerCode is validated separately (prefix C fixed, number editable, unique per company)
const stripSystemFields = (body) => {
  const { centerCode, farmerNoCode, companyId, ...rest } = body || {};
  return rest;
};

const hasCode = (body) => body && body.centerCode !== undefined && body.centerCode !== null && String(body.centerCode).trim() !== '';

// Validate a requested code → { code } or { error }
async function checkRequestedCode(companyId, raw, excludeId) {
  const code = normaliseCentreCode(raw);
  if (!code) return { error: 'Center Code must be C followed by a number (e.g. C100)' };
  if (await centreCodeTaken(companyId, code, excludeId)) return { error: `Center Code ${code} is already used by another centre` };
  return { code };
}

const isCodeClash = (err) => err?.code === 11000 && /centerCode/.test(err.message || '');

// Create new collection center
export const createCollectionCenter = async (req, res) => {
  try {
    await ensureCentreCodes(req.companyId).catch(() => {});

    // A code chosen by the user is kept exactly (and must be free)
    if (hasCode(req.body)) {
      const chk = await checkRequestedCode(req.companyId, req.body.centerCode);
      if (chk.error) return res.status(400).json({ success: false, message: chk.error });
      const collectionCenter = await CollectionCenter.create({
        ...stripSystemFields(req.body),
        centerCode: chk.code,
        companyId: req.companyId
      });
      return res.status(201).json({ success: true, message: 'Collection center created successfully', data: collectionCenter });
    }

    // Two creates racing for the same code → the unique index rejects one; take the next
    let collectionCenter;
    for (let attempt = 0; ; attempt++) {
      collectionCenter = new CollectionCenter({
        ...stripSystemFields(req.body),
        centerCode: await nextCentreCode(req.companyId),
        companyId: req.companyId
      });
      try {
        await collectionCenter.save();
        break;
      } catch (err) {
        if (!isCodeClash(err) || attempt >= 5) throw err;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Collection center created successfully',
      data: collectionCenter
    });
  } catch (error) {
    console.error('Error creating collection center:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: isCodeClash(error) ? 'This Center Code is already in use' : 'Collection center with this name already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error creating collection center'
    });
  }
};

// Get all collection centers with pagination and filters
export const getAllCollectionCenters = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', centerType = '', status = '' } = req.query;

    await ensureCentreCodes(req.companyId).catch(() => {});
    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { centerName: { $regex: search, $options: 'i' } },
        { 'address.village': { $regex: search, $options: 'i' } },
        { 'address.district': { $regex: search, $options: 'i' } },
        { 'contactDetails.incharge': { $regex: search, $options: 'i' } }
      ];
    }

    if (centerType) {
      query.centerType = centerType;
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const centers = await CollectionCenter.find(query)
      .sort({ centerName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CollectionCenter.countDocuments(query);

    res.status(200).json({
      success: true,
      data: centers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching collection centers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching collection centers'
    });
  }
};

// Get collection center by ID
export const getCollectionCenterById = async (req, res) => {
  try {
    const center = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!center) {
      return res.status(404).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    res.status(200).json({
      success: true,
      data: center
    });
  } catch (error) {
    console.error('Error fetching collection center:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching collection center'
    });
  }
};

// Update collection center
export const updateCollectionCenter = async (req, res) => {
  try {
    const before = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId })
      .select('centerCode').lean();
    if (!before) {
      return res.status(404).json({ success: false, message: 'Collection center not found' });
    }

    const update = stripSystemFields(req.body);
    let newCode = null;
    if (hasCode(req.body)) {
      const chk = await checkRequestedCode(req.companyId, req.body.centerCode, before._id);
      if (chk.error) return res.status(400).json({ success: false, message: chk.error });
      if (chk.code !== before.centerCode) { newCode = chk.code; update.centerCode = newCode; }
    }

    const center = await CollectionCenter.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      update,
      { new: true, runValidators: true }
    );

    // Code changed → farmers stay linked by _id; rewrite ledger names that embed the code
    let sync = null;
    if (newCode) sync = await syncCentreCodeChange(req.companyId, center._id, before.centerCode, newCode);

    res.status(200).json({
      success: true,
      message: newCode
        ? `Collection center updated — code ${before.centerCode || '-'} → ${newCode}${sync?.ledgers ? ` (${sync.ledgers} farmer ledger names updated)` : ''}`
        : 'Collection center updated successfully',
      data: center
    });
  } catch (error) {
    console.error('Error updating collection center:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: isCodeClash(error) ? 'This Center Code is already in use' : 'Collection center with this name already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error updating collection center'
    });
  }
};

// Centre code settings: starting number + the code the next new centre will get
export const getCentreCodeSettings = async (req, res) => {
  try {
    await ensureCentreCodes(req.companyId).catch(() => {});
    const [startNumber, nextCode] = await Promise.all([getCentreCodeStart(req.companyId), nextCentreCode(req.companyId)]);
    res.json({ success: true, data: { prefix: 'C', startNumber, nextCode } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCentreCodeSettings = async (req, res) => {
  try {
    const n = parseInt(req.body?.startNumber, 10);
    if (!(n > 0) || n > 999999) {
      return res.status(400).json({ success: false, message: 'Starting number must be between 1 and 999999' });
    }
    await FarmerSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: { centreCodeStart: n } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const nextCode = await nextCentreCode(req.companyId);
    res.json({
      success: true,
      message: `Centre codes start at C${n} — next new centre gets ${nextCode}`,
      data: { prefix: 'C', startNumber: n, nextCode }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete/Deactivate collection center
export const deleteCollectionCenter = async (req, res) => {
  try {
    const center = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!center) {
      return res.status(404).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    // Soft delete - change status to Inactive
    center.status = 'Inactive';
    await center.save();

    res.status(200).json({
      success: true,
      message: 'Collection center deactivated successfully',
      data: center
    });
  } catch (error) {
    console.error('Error deleting collection center:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting collection center'
    });
  }
};

// Toggle status (Active/Inactive)
export const toggleStatus = async (req, res) => {
  try {
    const center = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!center) {
      return res.status(404).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    center.status = center.status === 'Active' ? 'Inactive' : 'Active';
    await center.save();

    res.status(200).json({
      success: true,
      message: `Collection center ${center.status === 'Active' ? 'activated' : 'deactivated'} successfully`,
      data: center
    });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error toggling status'
    });
  }
};

// Bulk import from OpenLyssa collection_center table
export const bulkImportCollectionCenters = async (req, res) => {
  try {
    const { centers } = req.body;

    if (!centers || !Array.isArray(centers) || centers.length === 0) {
      return res.status(400).json({ success: false, message: 'Centers array is required' });
    }

    const results = { total: centers.length, created: 0, updated: 0, errors: [] };

    for (let i = 0; i < centers.length; i++) {
      const row = centers[i];
      const rowNumber = i + 2;

      try {
        if (!row.centerName) {
          results.errors.push({ row: rowNumber, centerName: 'N/A', message: 'centerName is required' });
          continue;
        }

        const existing = await CollectionCenter.findOne({
          centerName: row.centerName,
          companyId: req.companyId
        });

        const data = {
          centerName:  row.centerName,
          centerType:  row.centerType  || 'Sub Centre',
          status:      row.status      || 'Active',
          startDate:   row.startDate   ? new Date(row.startDate) : new Date(),
          description: row.description || undefined,
          companyId:   req.companyId,
        };
        if (row.street) data['address.street'] = row.street;

        if (existing) {
          await CollectionCenter.findByIdAndUpdate(existing._id, { $set: data });
          results.updated++;
        } else {
          await CollectionCenter.create({ ...data, address: { street: row.street || undefined } });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: rowNumber, centerName: row.centerName || 'N/A', message: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import done: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      data: results
    });
  } catch (error) {
    console.error('Bulk import collection centers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Bulk import failed' });
  }
};

// Set or update login credentials for a sub-centre
export const setCentreCredentials = async (req, res) => {
  try {
    const { username, password, isLoginEnabled, allowedModules } = req.body;
    const centre = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!centre) return res.status(404).json({ success: false, message: 'Centre not found' });

    if (username) {
      // Check username uniqueness
      const conflict = await CollectionCenter.findOne({ username: username.toLowerCase(), _id: { $ne: centre._id } });
      if (conflict) return res.status(400).json({ success: false, message: 'Username already taken' });
      centre.username = username.toLowerCase();
    }
    if (password) centre.password = password;
    if (typeof isLoginEnabled === 'boolean') centre.isLoginEnabled = isLoginEnabled;
    if (allowedModules && Array.isArray(allowedModules)) centre.allowedModules = allowedModules;

    await centre.save();

    const result = centre.toObject();
    delete result.password;
    res.status(200).json({ success: true, message: 'Credentials updated', data: result });
  } catch (error) {
    console.error('setCentreCredentials error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get credential info (no password) for a sub-centre
export const getCentreCredentials = async (req, res) => {
  try {
    const centre = await CollectionCenter.findOne({ _id: req.params.id, companyId: req.companyId })
      .select('username isLoginEnabled allowedModules centerName');
    if (!centre) return res.status(404).json({ success: false, message: 'Centre not found' });
    res.status(200).json({ success: true, data: centre });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createCollectionCenter,
  getAllCollectionCenters,
  getCollectionCenterById,
  updateCollectionCenter,
  deleteCollectionCenter,
  toggleStatus,
  bulkImportCollectionCenters,
  setCentreCredentials,
  getCentreCredentials,
  getCentreCodeSettings,
  updateCentreCodeSettings
};

import CollectionCenter from '../models/CollectionCenter.js';

// Create new collection center
export const createCollectionCenter = async (req, res) => {
  try {
    const collectionCenter = new CollectionCenter({ ...req.body, companyId: req.companyId });
    await collectionCenter.save();

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
        message: 'Collection center with this name already exists'
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
    const center = await CollectionCenter.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!center) {
      return res.status(404).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Collection center updated successfully',
      data: center
    });
  } catch (error) {
    console.error('Error updating collection center:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Collection center with this name already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error updating collection center'
    });
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

export default {
  createCollectionCenter,
  getAllCollectionCenters,
  getCollectionCenterById,
  updateCollectionCenter,
  deleteCollectionCenter,
  toggleStatus,
  bulkImportCollectionCenters
};

import Farmer from '../models/Farmer.js';
import Ledger from '../models/Ledger.js';
import mongoose from 'mongoose';

// Create new farmer with auto ledger creation
export const createFarmer = async (req, res) => {
  try {
    const farmerData = req.body;

    // Check for duplicate farmerNumber
    const existingFarmer = await Farmer.findOne({
      farmerNumber: farmerData.farmerNumber
    });

    if (existingFarmer) {
      return res.status(400).json({
        success: false,
        message: 'Farmer Number already exists'
      });
    }

    // Create farmer
    const farmer = new Farmer(farmerData);
    await farmer.save();

    // Auto-create ledger for farmer
    const ledger = new Ledger({
      ledgerName: `${farmerData.personalDetails.name} (${farmerData.farmerNumber})`,
      ledgerType: 'Party',
      linkedEntity: {
        entityType: 'Farmer',
        entityId: farmer._id
      },
      openingBalance: 0,
      openingBalanceType: 'Dr',
      currentBalance: 0,
      balanceType: 'Dr',
      parentGroup: 'Sundry Debtors',
      status: 'Active'
    });

    await ledger.save();

    // Link ledger to farmer
    farmer.ledgerId = ledger._id;
    await farmer.save();

    res.status(201).json({
      success: true,
      message: 'Farmer created successfully',
      data: farmer
    });
  } catch (error) {
    console.error('Error creating farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating farmer'
    });
  }
};

// Get all farmers with pagination, search, and filter
export const getAllFarmers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      farmerType = ''
    } = req.query;

    const query = {};

    // Search by farmer number, name, or phone
    if (search) {
      query.$or = [
        { farmerNumber: { $regex: search, $options: 'i' } },
        { 'personalDetails.name': { $regex: search, $options: 'i' } },
        { 'personalDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (farmerType) {
      query.farmerType = farmerType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const farmers = await Farmer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('ledgerId', 'ledgerName currentBalance balanceType');

    const total = await Farmer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: farmers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching farmers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmers'
    });
  }
};

// Get farmer by ID
export const getFarmerById = async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.params.id)
      .populate('ledgerId', 'ledgerName currentBalance balanceType');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: farmer
    });
  } catch (error) {
    console.error('Error fetching farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer'
    });
  }
};

// Update farmer
export const updateFarmer = async (req, res) => {
  try {
    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('ledgerId');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Update ledger name if farmer name changed
    if (req.body.personalDetails?.name && farmer.ledgerId) {
      await Ledger.findByIdAndUpdate(farmer.ledgerId, {
        ledgerName: `${req.body.personalDetails.name} (${farmer.farmerNumber})`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Farmer updated successfully',
      data: farmer
    });
  } catch (error) {
    console.error('Error updating farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating farmer'
    });
  }
};

// Delete/Deactivate farmer
export const deleteFarmer = async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.params.id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Soft delete by setting status to Inactive
    farmer.status = 'Inactive';
    await farmer.save();

    // Also deactivate associated ledger
    if (farmer.ledgerId) {
      await Ledger.findByIdAndUpdate(farmer.ledgerId, { status: 'Inactive' });
    }

    res.status(200).json({
      success: true,
      message: 'Farmer deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting farmer'
    });
  }
};

// Search farmer by farmer number or mobile
export const searchFarmer = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const farmers = await Farmer.find({
      $or: [
        { farmerNumber: { $regex: query, $options: 'i' } },
        { 'personalDetails.name': { $regex: query, $options: 'i' } },
        { 'personalDetails.phone': { $regex: query, $options: 'i' } }
      ],
      status: 'Active'
    }).populate('ledgerId', 'ledgerName currentBalance balanceType')
      .limit(10);

    res.status(200).json({
      success: true,
      data: farmers
    });
  } catch (error) {
    console.error('Error searching farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error searching farmer'
    });
  }
};

// Toggle farmer membership status
export const toggleMembership = async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.params.id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Toggle membership status
    farmer.isMembership = !farmer.isMembership;
    await farmer.save();

    res.status(200).json({
      success: true,
      message: `Farmer membership ${farmer.isMembership ? 'activated' : 'deactivated'} successfully`,
      data: farmer
    });
  } catch (error) {
    console.error('Error toggling membership:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error toggling membership'
    });
  }
};

export default {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
  searchFarmer,
  toggleMembership
};

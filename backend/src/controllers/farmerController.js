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
      parentGroup: 'Advance / Due',
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
      farmerType = '',
      cowType = '',
      village = '',
      panchayat = '',
      ward = '',
      isMembership = '',
      collectionCenter = '',
      admissionDateFrom = '',
      admissionDateTo = '',
      minShares = '',
      maxShares = ''
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

    // Basic filters
    if (status) {
      query.status = status;
    }

    if (farmerType) {
      query.farmerType = farmerType;
    }

    if (cowType) {
      query.cowType = cowType;
    }

    // Address filters
    if (village) {
      query['address.village'] = { $regex: village, $options: 'i' };
    }

    if (panchayat) {
      query['address.panchayat'] = { $regex: panchayat, $options: 'i' };
    }

    if (ward) {
      query['address.ward'] = { $regex: ward, $options: 'i' };
    }

    // Membership filter
    if (isMembership !== '') {
      query.isMembership = isMembership === 'true';
    }

    // Collection center filter
    if (collectionCenter) {
      query.collectionCenter = collectionCenter;
    }

    // Date range filter for admission date
    if (admissionDateFrom || admissionDateTo) {
      query.admissionDate = {};
      if (admissionDateFrom) {
        query.admissionDate.$gte = new Date(admissionDateFrom);
      }
      if (admissionDateTo) {
        query.admissionDate.$lte = new Date(admissionDateTo);
      }
    }

    // Share range filter
    if (minShares || maxShares) {
      query['financialDetails.totalShares'] = {};
      if (minShares) {
        query['financialDetails.totalShares'].$gte = parseInt(minShares);
      }
      if (maxShares) {
        query['financialDetails.totalShares'].$lte = parseInt(maxShares);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const farmers = await Farmer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('ledgerId', 'ledgerName currentBalance balanceType')
      .populate('collectionCenter', 'centerName centerType');

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
      .populate('ledgerId', 'ledgerName currentBalance balanceType')
      .populate('collectionCenter', 'centerName centerType');

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
      .populate('collectionCenter', 'centerName centerType')
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

// Add shares to farmer
export const addShareToFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shares,
      shareValue,
      resolutionNo,
      resolutionDate,
      transactionType,
      remarks
    } = req.body;

    // Validate required fields
    if (!shares || !shareValue || !resolutionNo || !resolutionDate || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'All fields (shares, shareValue, resolutionNo, resolutionDate, transactionType) are required'
      });
    }

    const farmer = await Farmer.findById(id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const oldTotal = farmer.financialDetails.totalShares || 0;
    let newTotal;

    // Calculate new total based on transaction type
    if (transactionType === 'Redemption') {
      if (shares > oldTotal) {
        return res.status(400).json({
          success: false,
          message: 'Cannot redeem more shares than available'
        });
      }
      newTotal = oldTotal - shares;
    } else {
      newTotal = oldTotal + shares;
    }

    // Create share history entry
    const shareHistoryEntry = {
      transactionType,
      shares,
      shareValue,
      totalValue: shares * shareValue,
      resolutionNo,
      resolutionDate,
      oldTotal,
      newTotal,
      remarks,
      transactionDate: new Date()
    };

    // Update farmer's share details
    if (transactionType === 'Allotment' && oldTotal === 0) {
      // Initial allotment
      farmer.financialDetails.oldShares = shares;
      farmer.financialDetails.newShares = 0;
      farmer.financialDetails.shareTakenDate = new Date();
      farmer.financialDetails.resolutionNo = resolutionNo;
      farmer.financialDetails.resolutionDate = resolutionDate;
    } else if (transactionType === 'Additional Allotment') {
      // Additional allotment
      farmer.financialDetails.newShares = (farmer.financialDetails.newShares || 0) + shares;
    } else if (transactionType === 'Redemption') {
      // Redemption - deduct from new shares first, then old shares
      let remainingToRedeem = shares;

      if (farmer.financialDetails.newShares > 0) {
        const deductFromNew = Math.min(farmer.financialDetails.newShares, remainingToRedeem);
        farmer.financialDetails.newShares -= deductFromNew;
        remainingToRedeem -= deductFromNew;
      }

      if (remainingToRedeem > 0) {
        farmer.financialDetails.oldShares -= remainingToRedeem;
      }
    }

    farmer.financialDetails.totalShares = newTotal;
    farmer.financialDetails.shareValue = shareValue;

    // Add to share history
    farmer.shareHistory.push(shareHistoryEntry);

    await farmer.save();

    res.status(200).json({
      success: true,
      message: 'Shares updated successfully',
      data: farmer
    });
  } catch (error) {
    console.error('Error adding shares:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding shares'
    });
  }
};

// Get share history for a farmer
export const getShareHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await Farmer.findById(id).select('shareHistory personalDetails.name farmerNumber');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        farmerName: farmer.personalDetails?.name,
        farmerNumber: farmer.farmerNumber,
        shareHistory: farmer.shareHistory.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
      }
    });
  } catch (error) {
    console.error('Error fetching share history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching share history'
    });
  }
};

// Terminate farmer membership
export const terminateFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      retirementDate,
      resolutionNumber,
      resolutionDate,
      refundDate,
      refundAmount,
      refundReason,
      description
    } = req.body;

    // Validate required fields
    if (!retirementDate || !resolutionNumber || !resolutionDate || !refundDate || !refundReason) {
      return res.status(400).json({
        success: false,
        message: 'All fields (retirementDate, resolutionNumber, resolutionDate, refundDate, refundReason) are required'
      });
    }

    const farmer = await Farmer.findById(id);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    if (farmer.termination?.isTerminated) {
      return res.status(400).json({
        success: false,
        message: 'Farmer membership is already terminated'
      });
    }

    // Store old share amount before termination
    const oldShareAmount = farmer.financialDetails?.totalShares || 0;
    const shareValue = farmer.financialDetails?.shareValue || 0;
    const calculatedRefundAmount = oldShareAmount * shareValue;

    // Update termination details
    farmer.termination = {
      isTerminated: true,
      retirementDate,
      resolutionNumber,
      resolutionDate,
      refundDate,
      refundAmount: refundAmount || calculatedRefundAmount,
      oldShareAmount,
      refundReason,
      description,
      terminatedAt: new Date()
    };

    // Remove membership status
    farmer.isMembership = false;

    // Optionally set status to Inactive
    farmer.status = 'Inactive';

    await farmer.save();

    res.status(200).json({
      success: true,
      message: 'Farmer membership terminated successfully',
      data: farmer
    });
  } catch (error) {
    console.error('Error terminating farmer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error terminating farmer'
    });
  }
};

// Bulk import farmers
export const bulkImportFarmers = async (req, res) => {
  try {
    const { farmers } = req.body;

    // Validate input
    if (!farmers || !Array.isArray(farmers) || farmers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Farmers array is required and cannot be empty'
      });
    }

    const results = {
      total: farmers.length,
      created: 0,
      updated: 0,
      errors: [],
      createdFarmers: [],
      updatedFarmers: []
    };

    // Process each farmer
    for (let i = 0; i < farmers.length; i++) {
      const farmerData = farmers[i];
      const rowNumber = i + 2; // Excel row (header is row 1)

      try {
        // Validate required fields
        if (!farmerData.farmerNumber || !farmerData.memberId ||
            !farmerData.name || !farmerData.phone) {
          results.errors.push({
            row: rowNumber,
            farmerNumber: farmerData.farmerNumber || 'N/A',
            message: 'Missing required fields (farmerNumber, memberId, name, or phone)'
          });
          continue;
        }

        // Validate and clean phone number
        const phoneStr = String(farmerData.phone).replace(/\D/g, '');
        if (phoneStr.length !== 10) {
          results.errors.push({
            row: rowNumber,
            farmerNumber: farmerData.farmerNumber,
            message: 'Phone number must be exactly 10 digits'
          });
          continue;
        }

        // Check if farmer exists
        const existingFarmer = await Farmer.findOne({
          farmerNumber: farmerData.farmerNumber
        });

        if (existingFarmer) {
          // UPDATE existing farmer
          existingFarmer.memberId = farmerData.memberId;
          existingFarmer.personalDetails.name = farmerData.name;
          existingFarmer.personalDetails.phone = phoneStr;

          await existingFarmer.save();

          // Update linked ledger name
          if (existingFarmer.ledgerId) {
            await Ledger.findByIdAndUpdate(existingFarmer.ledgerId, {
              ledgerName: `${farmerData.name} (${farmerData.farmerNumber})`
            });
          }

          results.updated++;
          results.updatedFarmers.push({
            farmerNumber: farmerData.farmerNumber,
            name: farmerData.name
          });
        } else {
          // CREATE new farmer
          const newFarmer = new Farmer({
            farmerNumber: farmerData.farmerNumber,
            memberId: farmerData.memberId,
            personalDetails: {
              name: farmerData.name,
              phone: phoneStr
            },
            status: 'Active',
            isMembership: false
          });

          await newFarmer.save();

          // Auto-create ledger for new farmer
          const ledger = new Ledger({
            ledgerName: `${farmerData.name} (${farmerData.farmerNumber})`,
            ledgerType: 'Party',
            linkedEntity: {
              entityType: 'Farmer',
              entityId: newFarmer._id
            },
            openingBalance: 0,
            openingBalanceType: 'Dr',
            currentBalance: 0,
            balanceType: 'Dr',
            parentGroup: 'Advance / Due',
            status: 'Active'
          });

          await ledger.save();

          // Link ledger to farmer
          newFarmer.ledgerId = ledger._id;
          await newFarmer.save();

          results.created++;
          results.createdFarmers.push({
            farmerNumber: farmerData.farmerNumber,
            name: farmerData.name
          });
        }
      } catch (error) {
        results.errors.push({
          row: rowNumber,
          farmerNumber: farmerData.farmerNumber || 'N/A',
          message: error.message || 'Failed to process farmer'
        });
      }
    }

    // Return results
    res.status(200).json({
      success: true,
      message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      data: results
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Bulk import failed'
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
  toggleMembership,
  addShareToFarmer,
  getShareHistory,
  terminateFarmer,
  bulkImportFarmers
};

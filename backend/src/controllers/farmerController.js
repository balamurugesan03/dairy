import Farmer from '../models/Farmer.js';
import Ledger from '../models/Ledger.js';
import MilkCollection from '../models/MilkCollection.js';
import mongoose from 'mongoose';
import { createShareCapitalVoucher, createAdmissionFeeVoucher } from '../utils/accountingHelper.js';

// Create new farmer with auto ledger creation
export const createFarmer = async (req, res) => {
  try {
    const companyId = req.companyId;
    const farmerData = { ...req.body, companyId };

    // Check for duplicate farmerNumber within this company
    const existingFarmer = await Farmer.findOne({
      farmerNumber: farmerData.farmerNumber,
      companyId
    });

    if (existingFarmer) {
      return res.status(400).json({
        success: false,
        message: 'Farmer Number already exists'
      });
    }

    // Extract share info from form (FarmerModal maps numberOfShares → oldShares/totalShares before API call)
    const numberOfShares = parseInt(
      farmerData.financialDetails?.numberOfShares ??
      farmerData.financialDetails?.totalShares ??
      farmerData.financialDetails?.oldShares
    ) || 0;
    const totalShareValue = parseFloat(farmerData.financialDetails?.shareValue) || 0;
    const perShareValue = numberOfShares > 0 ? totalShareValue / numberOfShares : 0;

    // Map form fields to Farmer model fields
    if (farmerData.financialDetails) {
      farmerData.financialDetails.totalShares = numberOfShares;
      farmerData.financialDetails.oldShares = numberOfShares;
      farmerData.financialDetails.newShares = 0;
      farmerData.financialDetails.shareValue = perShareValue;
      if (numberOfShares > 0) {
        farmerData.financialDetails.shareTakenDate = new Date();
      }
    }

    // Create farmer
    const farmer = new Farmer(farmerData);

    // Add initial share history entry if shares are given at creation
    if (numberOfShares > 0 && totalShareValue > 0) {
      farmer.shareHistory.push({
        transactionType: 'Allotment',
        shares: numberOfShares,
        shareValue: perShareValue,
        totalValue: totalShareValue,
        resolutionNo: farmerData.financialDetails?.resolutionNo || 'Initial',
        resolutionDate: farmerData.financialDetails?.resolutionDate || new Date(),
        oldTotal: 0,
        newTotal: numberOfShares,
        remarks: 'Initial allotment at registration',
        transactionDate: new Date()
      });
    }

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
      status: 'Active',
      companyId
    });

    await ledger.save();

    // Link ledger to farmer
    farmer.ledgerId = ledger._id;
    await farmer.save();

    // Post admission fee receipt voucher if applicable (cash received)
    const admissionFee = parseFloat(farmerData.financialDetails?.admissionFee) || 0;
    if (admissionFee > 0) {
      try {
        await createAdmissionFeeVoucher({
          farmerId: farmer._id,
          farmerLedgerName: ledger.ledgerName,
          admissionFee,
          companyId,
          voucherDate: new Date()
        });
      } catch (vErr) {
        console.error('Admission fee voucher error (non-fatal):', vErr.message);
      }
    }

    // Post share capital receipt voucher to day book (cash received)
    if (numberOfShares > 0 && totalShareValue > 0) {
      try {
        await createShareCapitalVoucher({
          farmerId: farmer._id,
          farmerLedgerName: ledger.ledgerName,
          totalValue: totalShareValue,
          transactionType: 'Allotment',
          resolutionNo: farmerData.financialDetails?.resolutionNo || 'Initial',
          companyId,
          voucherDate: new Date()
        });
      } catch (vErr) {
        console.error('Share capital voucher error (non-fatal):', vErr.message);
      }
    }

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
      place = '',
      post = '',
      isMembership = '',
      collectionCenter = '',
      gender = '',
      admissionDateFrom = '',
      admissionDateTo = '',
      minShares = '',
      maxShares = '',
      sortBy = 'farmerNumber',
      sortOrder = 'asc'
    } = req.query;

    const query = { companyId: req.companyId };

    // Search by farmer number, member ID, name, or phone
    if (search) {
      query.$or = [
        { farmerNumber: { $regex: search, $options: 'i' } },
        { memberId:     { $regex: search, $options: 'i' } },
        { 'personalDetails.name':  { $regex: search, $options: 'i' } },
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
    if (village)   query['address.village']   = { $regex: village,   $options: 'i' };
    if (panchayat) query['address.panchayat'] = { $regex: panchayat, $options: 'i' };
    if (ward)      query['address.ward']      = { $regex: ward,      $options: 'i' };
    if (place)     query['address.place']     = { $regex: place,     $options: 'i' };
    if (post)      query['address.post']      = { $regex: post,      $options: 'i' };

    // Membership filter
    if (isMembership !== '') {
      query.isMembership = isMembership === 'true';
    }

    // Collection center filter
    if (collectionCenter) {
      query.collectionCenter = collectionCenter;
    }

    // Gender filter
    if (gender) {
      query['personalDetails.gender'] = gender;
    }

    // Caste filter — 'casteFilter' param; empty string means "no caste assigned"
    if ('casteFilter' in req.query) {
      const casteVal = req.query.casteFilter;
      query['personalDetails.caste'] = casteVal === '' ? { $in: [null, ''] } : { $regex: casteVal, $options: 'i' };
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

    const allowedSortFields = { farmerNumber: 'farmerNumber', name: 'personalDetails.name', createdAt: 'createdAt' };
    const sortField = allowedSortFields[sortBy] || 'farmerNumber';
    const sortDir   = sortOrder === 'desc' ? -1 : 1;

    let farmers;
    if (sortField === 'farmerNumber') {
      // Numeric sort: convert farmerNumber string to integer before sorting
      farmers = await Farmer.aggregate([
        { $match: query },
        { $addFields: { _farmerNumInt: { $convert: { input: '$farmerNumber', to: 'int', onError: 999999, onNull: 999999 } } } },
        { $sort: { _farmerNumInt: sortDir, farmerNumber: sortDir } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledgerId' } },
        { $unwind: { path: '$ledgerId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'collectioncenters', localField: 'collectionCenter', foreignField: '_id', as: 'collectionCenter' } },
        { $unwind: { path: '$collectionCenter', preserveNullAndEmptyArrays: true } },
        { $project: { _farmerNumInt: 0 } }
      ]);
    } else {
      farmers = await Farmer.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('ledgerId', 'ledgerName currentBalance balanceType')
        .populate('collectionCenter', 'centerName centerType');
    }

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
    const farmer = await Farmer.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('ledgerId', 'ledgerName currentBalance balanceType')
      .populate('collectionCenter', 'centerName centerType')
      .populate('bankDetails.bankLedgerId', 'ledgerName');

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
    const farmer = await Farmer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
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
    const farmer = await Farmer.findOne({ _id: req.params.id, companyId: req.companyId });

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

    const isNumeric = /^\d+$/.test(query);
    const farmers = await Farmer.find({
      $or: isNumeric
        ? [
            { farmerNumber: query },   // exact match — typing 12 returns only 12, not 112/120
            { memberId: query }
          ]
        : [
            { 'personalDetails.name': { $regex: query, $options: 'i' } },
            { 'personalDetails.phone': { $regex: query, $options: 'i' } }
          ],
      status: 'Active',
      companyId: req.companyId
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
    const farmer = await Farmer.findOne({ _id: req.params.id, companyId: req.companyId });

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

    const farmer = await Farmer.findOne({ _id: id, companyId: req.companyId });

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

    // Post share capital journal voucher to day book
    try {
      const farmerLedger = await Ledger.findById(farmer.ledgerId);
      if (farmerLedger) {
        await createShareCapitalVoucher({
          farmerId: farmer._id,
          farmerLedgerName: farmerLedger.ledgerName,
          totalValue: shares * shareValue,
          transactionType,
          resolutionNo,
          companyId: req.companyId,
          voucherDate: new Date()
        });
      }
    } catch (vErr) {
      console.error('Share capital voucher error (non-fatal):', vErr.message);
    }

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

    const farmer = await Farmer.findOne({ _id: id, companyId: req.companyId }).select('shareHistory personalDetails.name farmerNumber');

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

    const farmer = await Farmer.findOne({ _id: id, companyId: req.companyId });

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
        // Only farmerNumber and name are truly required
        if (!farmerData.farmerNumber || !farmerData.name) {
          results.errors.push({
            row: rowNumber,
            farmerNumber: farmerData.farmerNumber || 'N/A',
            message: 'Missing required fields: farmerNumber (Supplier_No) and name are required'
          });
          continue;
        }

        // Phone is optional — store only if valid 10-digit number
        let phoneStr = undefined;
        if (farmerData.phone) {
          const digits = String(farmerData.phone).replace(/\D/g, '');
          if (digits.length === 10) phoneStr = digits;
          else if (digits.length === 12 && digits.startsWith('91')) phoneStr = digits.slice(2);
          // else: silently ignore invalid phone (Zibitt often has placeholder values)
        }

        // Check if farmer exists (within this company)
        const existingFarmer = await Farmer.findOne({
          farmerNumber: farmerData.farmerNumber,
          companyId: req.companyId
        });

        if (existingFarmer) {
          // UPDATE existing farmer
          // memberId: set if truthy, explicitly clear if null (Non-member from OpenLyssa)
          if (farmerData.memberId)        existingFarmer.memberId = farmerData.memberId;
          else if (farmerData.memberId === null) existingFarmer.memberId = undefined;
          existingFarmer.personalDetails.name = farmerData.name;
          if (phoneStr)                       existingFarmer.personalDetails.phone           = phoneStr;
          if (farmerData.fatherName)          existingFarmer.personalDetails.fatherName      = farmerData.fatherName;
          if (farmerData.gender)              existingFarmer.personalDetails.gender           = farmerData.gender;
          if (farmerData.dob)                 existingFarmer.personalDetails.dob              = new Date(farmerData.dob);
          if (farmerData.age)                 existingFarmer.personalDetails.age              = farmerData.age;
          if (farmerData.caste)               existingFarmer.personalDetails.caste            = farmerData.caste;
          if (farmerData.nomineeName)         existingFarmer.personalDetails.nomineeName      = farmerData.nomineeName;
          if (farmerData.nomineeRelation)     existingFarmer.personalDetails.nomineeRelation  = farmerData.nomineeRelation;
          if (farmerData.houseName)  existingFarmer.address.houseName  = farmerData.houseName;
          if (farmerData.ward)       existingFarmer.address.ward       = farmerData.ward;
          if (farmerData.place)      existingFarmer.address.place      = farmerData.place;
          if (farmerData.post)       existingFarmer.address.post       = farmerData.post;
          if (farmerData.village)    existingFarmer.address.village    = farmerData.village;
          if (farmerData.panchayat)  existingFarmer.address.panchayat  = farmerData.panchayat;
          if (farmerData.pin)        existingFarmer.address.pin        = farmerData.pin;
          if (farmerData.membershipDate)
            existingFarmer.membershipDate = new Date(farmerData.membershipDate);
          if (farmerData.isMembership !== undefined)
            existingFarmer.isMembership = farmerData.isMembership;
          else if (farmerData.membershipDate)
            existingFarmer.isMembership = true;
          if (farmerData.admissionDate)
            existingFarmer.admissionDate = new Date(farmerData.admissionDate);
          if (farmerData.admissionFee)
            existingFarmer.financialDetails.admissionFee = Number(farmerData.admissionFee) || 0;
          if (farmerData.totalShares) {
            const shares = Number(farmerData.totalShares);
            existingFarmer.financialDetails.totalShares = shares;
            existingFarmer.financialDetails.shareValue  = shares * 10;
          }
          if (farmerData.resolutionNo)
            existingFarmer.financialDetails.resolutionNo   = farmerData.resolutionNo;
          if (farmerData.resolutionDate)
            existingFarmer.financialDetails.resolutionDate = new Date(farmerData.resolutionDate);

          // Bank details (from Linzaa or other imports that supply them)
          if (!existingFarmer.bankDetails) existingFarmer.bankDetails = {};
          if (farmerData.bankName)      existingFarmer.bankDetails.bankName      = farmerData.bankName;
          if (farmerData.bankBranch)    existingFarmer.bankDetails.branch        = farmerData.bankBranch;
          if (farmerData.ifsc)          existingFarmer.bankDetails.ifsc          = farmerData.ifsc;
          if (farmerData.accountNumber) existingFarmer.bankDetails.accountNumber = farmerData.accountNumber;

          // Mark nested objects modified so Mongoose saves all changes
          existingFarmer.markModified('personalDetails');
          existingFarmer.markModified('address');
          existingFarmer.markModified('financialDetails');
          existingFarmer.markModified('bankDetails');

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
            memberId:     farmerData.memberId || undefined,
            personalDetails: {
              name:            farmerData.name,
              phone:           phoneStr,
              fatherName:      farmerData.fatherName      || undefined,
              gender:          farmerData.gender          || undefined,
              dob:             farmerData.dob             ? new Date(farmerData.dob) : undefined,
              age:             farmerData.age             || undefined,
              caste:           farmerData.caste           || undefined,
              nomineeName:     farmerData.nomineeName     || undefined,
              nomineeRelation: farmerData.nomineeRelation || undefined,
            },
            address: {
              houseName: farmerData.houseName  || undefined,
              ward:      farmerData.ward       || undefined,
              place:     farmerData.place      || undefined,
              post:      farmerData.post       || undefined,
              village:   farmerData.village    || undefined,
              panchayat: farmerData.panchayat  || undefined,
              pin:       farmerData.pin        || undefined,
            },
            admissionDate:  farmerData.admissionDate  ? new Date(farmerData.admissionDate)  : undefined,
            membershipDate: farmerData.membershipDate ? new Date(farmerData.membershipDate) : undefined,
            isMembership:   farmerData.isMembership !== undefined ? farmerData.isMembership : !!farmerData.membershipDate,
            financialDetails: {
              admissionFee:   Number(farmerData.admissionFee) || 0,
              totalShares:    Number(farmerData.totalShares)  || 0,
              shareValue:     (Number(farmerData.totalShares) || 0) * 10,
              resolutionNo:   farmerData.resolutionNo   || undefined,
              resolutionDate: farmerData.resolutionDate ? new Date(farmerData.resolutionDate) : undefined,
            },
            bankDetails: {
              bankName:      farmerData.bankName      || undefined,
              branch:        farmerData.bankBranch    || undefined,
              ifsc:          farmerData.ifsc          || undefined,
              accountNumber: farmerData.accountNumber || undefined,
            },
            status:    'Active',
            companyId: req.companyId
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
            status: 'Active',
            companyId: req.companyId
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

// Bulk import share transactions (Zibitt export)
export const bulkImportShares = async (req, res) => {
  try {
    const { shares } = req.body;

    if (!shares || !Array.isArray(shares) || shares.length === 0) {
      return res.status(400).json({ success: false, message: 'Shares array is required' });
    }

    const results = { total: shares.length, imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < shares.length; i++) {
      const row = shares[i];
      const rowNumber = i + 2;

      try {
        if (!row.memberNo) {
          results.errors.push({ row: rowNumber, memberNo: 'N/A', message: 'MemberNo is required' });
          results.skipped++;
          continue;
        }

        const farmer = await Farmer.findOne({
          farmerNumber: String(row.memberNo),
          companyId: req.companyId
        });

        if (!farmer) {
          results.errors.push({ row: rowNumber, memberNo: row.memberNo, message: `Farmer not found for MemberNo ${row.memberNo}` });
          results.skipped++;
          continue;
        }

        const shares    = Math.max(Number(row.noOfShares) || 0, 1); // 0 in Zibitt = 1 share
        const shareValue = Number(row.shareAmount) || 10;
        const oldTotal   = farmer.financialDetails?.totalShares || 0;
        const transactionType = oldTotal > 0 ? 'Additional Allotment' : 'Allotment';
        const newTotal   = oldTotal + shares;
        const transDate  = row.transDate ? new Date(row.transDate) : new Date();
        const resolutionNo = row.voucherNo
          ? `${row.voucherNo}/${row.fYear || ''}`.replace(/\/$/, '')
          : `IMP-${rowNumber}`;

        const resDate = row.resolutionDate ? new Date(row.resolutionDate) : transDate;

        farmer.shareHistory.push({
          transactionType,
          shares,
          shareValue,
          totalValue:     shares * shareValue,
          resolutionNo,
          resolutionDate: resDate,
          oldTotal,
          newTotal,
          remarks:        row.transType || 'Imported',
          transactionDate: transDate
        });

        farmer.financialDetails.totalShares = newTotal;
        farmer.financialDetails.shareValue  = shareValue;
        if (!farmer.financialDetails.shareTakenDate) {
          farmer.financialDetails.shareTakenDate = transDate;
        }
        if (!farmer.financialDetails.resolutionNo && row.voucherNo) {
          farmer.financialDetails.resolutionNo   = resolutionNo;
          farmer.financialDetails.resolutionDate = resDate;
        }

        farmer.isMembership = true;
        if (!farmer.membershipDate) {
          farmer.membershipDate = transDate;
        }

        farmer.markModified('financialDetails');
        await farmer.save();
        results.imported++;

      } catch (error) {
        results.errors.push({ row: rowNumber, memberNo: row.memberNo || 'N/A', message: error.message });
        results.skipped++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Share import completed: ${results.imported} imported, ${results.skipped} skipped`,
      data: results
    });

  } catch (error) {
    console.error('Bulk share import error:', error);
    res.status(500).json({ success: false, message: error.message || 'Share import failed' });
  }
};

// Bulk delete farmers
export const bulkDeleteFarmers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array is required' });
    }

    const result = await Farmer.deleteMany({ _id: { $in: ids }, companyId: req.companyId });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} farmer(s) deleted`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, message: error.message || 'Bulk delete failed' });
  }
};

// Farmer Report — member/non-member, caste, gender, centre aggregations
export const getFarmerReport = async (req, res) => {
  try {
    const companyId = new mongoose.Types.ObjectId(req.companyId);

    const [facetResult] = await Farmer.aggregate([
      { $match: { companyId } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                members: { $sum: { $cond: ['$isMembership', 1, 0] } },
                nonMembers: { $sum: { $cond: ['$isMembership', 0, 1] } },
                active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
                male: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Male'] }, 1, 0] } },
                female: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Female'] }, 1, 0] } }
              }
            }
          ],
          memberReport: [
            {
              $group: {
                _id: '$isMembership',
                count: { $sum: 1 },
                male: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Male'] }, 1, 0] } },
                female: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Female'] }, 1, 0] } },
                active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }
              }
            },
            { $sort: { _id: -1 } }
          ],
          casteReport: [
            {
              $group: {
                _id: '$personalDetails.caste',
                count: { $sum: 1 },
                members: { $sum: { $cond: ['$isMembership', 1, 0] } },
                nonMembers: { $sum: { $cond: ['$isMembership', 0, 1] } },
                male: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Male'] }, 1, 0] } },
                female: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Female'] }, 1, 0] } }
              }
            },
            { $sort: { count: -1 } }
          ],
          genderReport: [
            {
              $group: {
                _id: '$personalDetails.gender',
                count: { $sum: 1 },
                members: { $sum: { $cond: ['$isMembership', 1, 0] } },
                nonMembers: { $sum: { $cond: ['$isMembership', 0, 1] } }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    const centreReport = await Farmer.aggregate([
      { $match: { companyId } },
      {
        $lookup: {
          from: 'collectioncenters',
          localField: 'collectionCenter',
          foreignField: '_id',
          as: 'center'
        }
      },
      { $unwind: { path: '$center', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            centreId: '$collectionCenter',
            centreName: { $ifNull: ['$center.centerName', 'No Centre Assigned'] }
          },
          count: { $sum: 1 },
          members: { $sum: { $cond: ['$isMembership', 1, 0] } },
          nonMembers: { $sum: { $cond: ['$isMembership', 0, 1] } },
          male: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$personalDetails.gender', 'Female'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.centreName': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: facetResult?.summary?.[0] || { total: 0, members: 0, nonMembers: 0, active: 0, male: 0, female: 0 },
        memberReport: facetResult?.memberReport || [],
        casteReport: facetResult?.casteReport || [],
        genderReport: facetResult?.genderReport || [],
        centreReport
      }
    });
  } catch (error) {
    console.error('Error fetching farmer report:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching farmer report' });
  }
};

export const getProducerReport = async (req, res) => {
  try {
    const {
      collectionCenter = '',
      memberType = '',
      farmerNumberFrom = '',
      farmerNumberTo = '',
      activeOnly = '',
      gender = '',
      caste = '',
      farmerType = '',
      dbtHas = '',
      welfareHas = '',
      mobileHas = '',
      bankHas = '',
      localBody = '',
      ward = '',
      fromDate = '',
      toDate = '',
      daysCondition = '',
      daysValue = '',
      qtyCondition = '',
      qtyValue = '',
      daysQtyLogic = 'AND',
      page = 1,
      limit = 50,
    } = req.query;

    const companyId = new mongoose.Types.ObjectId(req.companyId);
    const query = { companyId };

    if (collectionCenter) query.collectionCenter = new mongoose.Types.ObjectId(collectionCenter);
    if (memberType === 'Member') query.isMembership = true;
    else if (memberType === 'NonMember') query.isMembership = false;
    if (activeOnly === 'true') query.status = 'Active';
    if (gender) query['personalDetails.gender'] = gender;
    if (caste) query['personalDetails.caste'] = { $regex: caste, $options: 'i' };
    if (farmerType) query.farmerType = farmerType;
    if (ward) query['address.ward'] = { $regex: ward, $options: 'i' };
    if (localBody) query['address.panchayat'] = { $regex: localBody, $options: 'i' };

    // Presence filters collected into $and
    const andConditions = [];
    if (dbtHas === 'yes') andConditions.push({ 'identityDetails.ksheerasreeId': { $exists: true, $nin: ['', null] } });
    else if (dbtHas === 'no') andConditions.push({ $or: [{ 'identityDetails.ksheerasreeId': { $exists: false } }, { 'identityDetails.ksheerasreeId': '' }, { 'identityDetails.ksheerasreeId': null }] });

    if (welfareHas === 'yes') andConditions.push({ 'identityDetails.welfareNo': { $exists: true, $nin: ['', null] } });
    else if (welfareHas === 'no') andConditions.push({ $or: [{ 'identityDetails.welfareNo': { $exists: false } }, { 'identityDetails.welfareNo': '' }, { 'identityDetails.welfareNo': null }] });

    if (mobileHas === 'yes') andConditions.push({ 'personalDetails.phone': { $exists: true, $nin: ['', null] } });
    else if (mobileHas === 'no') andConditions.push({ $or: [{ 'personalDetails.phone': { $exists: false } }, { 'personalDetails.phone': '' }, { 'personalDetails.phone': null }] });

    if (bankHas === 'yes') andConditions.push({ 'bankDetails.accountNumber': { $exists: true, $nin: ['', null] } });
    else if (bankHas === 'no') andConditions.push({ $or: [{ 'bankDetails.accountNumber': { $exists: false } }, { 'bankDetails.accountNumber': '' }, { 'bankDetails.accountNumber': null }] });

    if (andConditions.length > 0) query.$and = andConditions;

    // Aggregate pipeline with numeric farmerNumber sorting + range filter
    const pipeline = [
      { $match: query },
      { $addFields: { _farmerNum: { $convert: { input: '$farmerNumber', to: 'int', onError: 0, onNull: 0 } } } },
    ];

    if (farmerNumberFrom) pipeline.push({ $match: { _farmerNum: { $gte: parseInt(farmerNumberFrom) } } });
    if (farmerNumberTo) pipeline.push({ $match: { _farmerNum: { $lte: parseInt(farmerNumberTo) } } });

    pipeline.push(
      { $sort: { _farmerNum: 1 } },
      { $lookup: { from: 'collectioncenters', localField: 'collectionCenter', foreignField: '_id', as: '_center' } },
      { $unwind: { path: '$_center', preserveNullAndEmptyArrays: true } },
      { $project: { _farmerNum: 0 } }
    );

    let farmers = await Farmer.aggregate(pipeline);

    // Pouring days / quantity filter (requires MilkCollection join)
    const hasPouringFilter = fromDate && toDate && (
      (daysCondition && daysValue !== '') || (qtyCondition && qtyValue !== '')
    );

    if (hasPouringFilter) {
      const start = new Date(fromDate); start.setUTCHours(0, 0, 0, 0);
      const end = new Date(toDate); end.setUTCHours(23, 59, 59, 999);
      const farmerNumbers = farmers.map(f => f.farmerNumber);

      const pData = await MilkCollection.aggregate([
        { $match: { companyId, date: { $gte: start, $lte: end }, farmerNumber: { $in: farmerNumbers } } },
        { $group: { _id: '$farmerNumber', dates: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }, totalQty: { $sum: '$qty' } } },
        { $addFields: { pouringDays: { $size: '$dates' } } }
      ]);

      const pMap = {};
      pData.forEach(p => { pMap[p._id] = { days: p.pouringDays, qty: p.totalQty }; });

      const cmp = (val, cond, thresh) => {
        const t = parseFloat(thresh);
        if (cond === '>') return val > t;
        if (cond === '<') return val < t;
        if (cond === '>=') return val >= t;
        if (cond === '<=') return val <= t;
        if (cond === '=') return val === t;
        return true;
      };

      farmers = farmers.filter(f => {
        const p = pMap[f.farmerNumber] || { days: 0, qty: 0 };
        const hasDays = daysCondition && daysValue !== '';
        const hasQty  = qtyCondition  && qtyValue  !== '';
        const daysOk  = hasDays ? cmp(p.days, daysCondition, daysValue) : true;
        const qtyOk   = hasQty  ? cmp(p.qty,  qtyCondition,  qtyValue)  : true;
        if (hasDays && hasQty) return daysQtyLogic === 'OR' ? (daysOk || qtyOk) : (daysOk && qtyOk);
        return daysOk && qtyOk;
      });

      farmers = farmers.map(f => ({
        ...f,
        _pouringDays: pMap[f.farmerNumber]?.days || 0,
        _totalQty:    pMap[f.farmerNumber]?.qty  || 0,
      }));
    }

    const total    = farmers.length;
    const pageNum  = parseInt(page);
    const limitNum = parseInt(limit);
    const paginated = farmers.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.status(200).json({
      success: true,
      data: paginated,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum }
    });
  } catch (error) {
    console.error('Error fetching producer report:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching producer report' });
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
  bulkImportFarmers,
  bulkImportShares,
  bulkDeleteFarmers,
  getFarmerReport,
  getProducerReport
};

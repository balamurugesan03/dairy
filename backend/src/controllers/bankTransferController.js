import BankTransfer from '../models/BankTransfer.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import CollectionCenter from '../models/CollectionCenter.js';
import FarmerPayment from '../models/FarmerPayment.js';
import mongoose from 'mongoose';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// Retrieve producer balances for bank transfer
export const retrieveBalances = async (req, res) => {
  try {
    const {
      transferBasis,
      asOnDate,
      applyDate,
      collectionCenter,
      bank,
      roundDownAmount,
      dueByList
    } = req.body;

    const companyId = req.userCompany;

    // Build farmer filter
    const farmerFilter = {
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'Active'
    };

    if (collectionCenter && collectionCenter !== 'all') {
      farmerFilter.collectionCenter = new mongoose.Types.ObjectId(collectionCenter);
    }

    // Get all active farmers
    const farmers = await Farmer.find(farmerFilter)
      .select('farmerNumber personalDetails bankDetails collectionCenter')
      .lean();

    const balances = [];
    const roundDown = parseInt(roundDownAmount) || 10;

    for (const farmer of farmers) {
      // Calculate net payable based on transfer basis
      let netPayable = 0;

      if (transferBasis === 'As on Date Balance') {
        // Get all unpaid amounts up to asOnDate — only PaymentRegister source (not Ledger-direct)
        const paymentAgg = await FarmerPayment.aggregate([
          {
            $match: {
              companyId: new mongoose.Types.ObjectId(companyId),
              farmerId: farmer._id,
              paymentDate: { $lte: new Date(asOnDate) },
              status: { $in: ['Pending', 'Partial'] },
              $or: [{ paymentSource: 'PaymentRegister' }, { paymentSource: { $exists: false } }, { paymentSource: null }]
            }
          },
          {
            $group: {
              _id: null,
              totalNetPayable: { $sum: '$netPayable' }
            }
          }
        ]);

        const payment = paymentAgg[0] || { totalNetPayable: 0 };
        netPayable = payment.totalNetPayable || 0;
      } else {
        // Last processed period - get from last period with a balance (PaymentRegister source only)
        const lastPeriod = await FarmerPayment.findOne({
          companyId: new mongoose.Types.ObjectId(companyId),
          farmerId: farmer._id,
          status: { $in: ['Pending', 'Partial'] },
          $or: [{ paymentSource: 'PaymentRegister' }, { paymentSource: { $exists: false } }, { paymentSource: null }]
        }).sort({ paymentDate: -1 });

        if (lastPeriod) {
          netPayable = lastPeriod.netPayable || 0;
        }
      }

      // Filter by bank if specified
      const bankDetails = farmer.bankDetails || {};
      if (bank && bank !== 'all' && bankDetails.bankName !== bank) {
        continue;
      }

      // Apply due by list filter if enabled
      if (dueByList && netPayable <= 0) {
        continue;
      }

      // Calculate transfer amount with round down
      let transferAmount = 0;
      if (netPayable > 0) {
        transferAmount = Math.floor(netPayable / roundDown) * roundDown;
      }

      balances.push({
        farmerId: farmer._id,
        producerId: farmer.farmerNumber,
        producerName: farmer.personalDetails?.name || 'Unknown',
        netPayable: netPayable,
        transferAmount: transferAmount,
        approved: transferAmount > 0,
        bankDetails: {
          accountNumber: bankDetails.accountNumber || '-',
          bankName: bankDetails.bankName || '-',
          ifscCode: bankDetails.ifsc || bankDetails.ifscCode || '-',
          bankCode: bankDetails.branchCode || '-'
        }
      });
    }

    // Sort by producer ID
    balances.sort((a, b) => a.producerId?.localeCompare(b.producerId));

    // Calculate summary
    const summary = {
      totalProducers: balances.length,
      totalNetPayable: balances.reduce((sum, b) => sum + b.netPayable, 0),
      totalTransferAmount: balances.filter(b => b.approved).reduce((sum, b) => sum + b.transferAmount, 0),
      totalApproved: balances.filter(b => b.approved).length,
      negativeBalances: balances.filter(b => b.netPayable < 0).length
    };

    res.json({
      success: true,
      data: balances,
      summary,
      message: `Retrieved ${balances.length} producer balances`
    });
  } catch (error) {
    console.error('Error retrieving balances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving producer balances'
    });
  }
};

// Apply bank transfer
export const applyBankTransfer = async (req, res) => {
  try {
    const {
      transferBasis,
      asOnDate,
      applyDate,
      collectionCenter,
      collectionCenterName,
      bank,
      bankName,
      roundDownAmount,
      dueByList,
      transferDetails,
      remarks
    } = req.body;

    const companyId = req.userCompany;

    // Filter only approved transfers
    const approvedTransfers = transferDetails.filter(d => d.approved && d.transferAmount > 0);

    if (approvedTransfers.length === 0) {
      throw new Error('No approved transfers to process');
    }

    // Create bank transfer record
    const bankTransfer = new BankTransfer({
      companyId,
      transferBasis,
      asOnDate: new Date(asOnDate),
      applyDate: new Date(applyDate),
      collectionCenter: collectionCenter && collectionCenter !== 'all' ? collectionCenter : null,
      collectionCenterName: collectionCenterName || 'All',
      bank: bank && bank !== 'all' ? bank : null,
      bankName: bankName || 'All',
      roundDownAmount: parseInt(roundDownAmount) || 10,
      dueByList,
      transferDetails: approvedTransfers.map(d => ({
        farmerId: d.farmerId,
        producerId: d.producerId,
        producerName: d.producerName,
        netPayable: d.netPayable,
        transferAmount: d.transferAmount,
        approved: true,
        bankDetails: d.bankDetails,
        transferStatus: 'Pending'
      })),
      status: 'Applied',
      createdBy: req.user?._id,
      appliedBy: req.user?._id,
      appliedAt: new Date(),
      remarks
    });

    await bankTransfer.save();

    // Create payment voucher for bank transfer
    try {
      const voucher = await createBankTransferVoucher(bankTransfer, companyId);
      if (voucher) {
        bankTransfer.voucherId = voucher._id;
        await bankTransfer.save();
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
    }
    res.status(201).json({
      success: true,
      message: `Bank transfer applied successfully for ${approvedTransfers.length} producers`,
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error applying bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error applying bank transfer'
    });
  } finally {
  }
};

// Helper function to create voucher
const createBankTransferVoucher = async (bankTransfer, companyId) => {
  const entries = [];

  // Get or create Bank Transfer ledger
  let bankLedger = await Ledger.findOne({
    ledgerName: 'Bank Transfer Payable',
    companyId
  });

  if (!bankLedger) {
    bankLedger = new Ledger({
      ledgerName: 'Bank Transfer Payable',
      ledgerType: 'Current Liability',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Cr'
    });
    await bankLedger.save();
  }

  // Get or create Producer Payable ledger
  let producerLedger = await Ledger.findOne({
    ledgerName: 'Producer Payable',
    companyId
  });

  if (!producerLedger) {
    producerLedger = new Ledger({
      ledgerName: 'Producer Payable',
      ledgerType: 'Current Liability',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Cr'
    });
    await producerLedger.save();
  }

  // Debit Producer Payable
  entries.push({
    ledgerId: producerLedger._id,
    ledgerName: producerLedger.ledgerName,
    debitAmount: bankTransfer.totalTransferAmount,
    creditAmount: 0
  });

  // Credit Bank Transfer Payable
  entries.push({
    ledgerId: bankLedger._id,
    ledgerName: bankLedger.ledgerName,
    debitAmount: 0,
    creditAmount: bankTransfer.totalTransferAmount
  });

  const voucher = new Voucher({
    voucherType: 'Journal',
    voucherNumber: await generateVoucherNumber('Journal', companyId),
    voucherDate: bankTransfer.applyDate,
    companyId,
    entries,
    totalDebit: bankTransfer.totalTransferAmount,
    totalCredit: bankTransfer.totalTransferAmount,
    narration: `Bank Transfer - ${bankTransfer.transferNumber} - ${bankTransfer.totalApproved} producers`,
    referenceType: 'BankTransfer',
    referenceId: bankTransfer._id,
    createdBy: bankTransfer.appliedBy
  });

  await voucher.save();
  await updateLedgerBalances(entries);

  return voucher;
};

// Get all bank transfers
export const getAllBankTransfers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      fromDate,
      toDate,
      sortBy = 'applyDate',
      sortOrder = 'desc'
    } = req.query;

    const filter = { companyId: req.userCompany };

    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.applyDate = {};
      if (fromDate) filter.applyDate.$gte = new Date(fromDate);
      if (toDate) filter.applyDate.$lte = new Date(toDate);
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      BankTransfer.find(filter)
        .populate('createdBy', 'username name')
        .populate('appliedBy', 'username name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      BankTransfer.countDocuments(filter)
    ]);

    // Summary
    const summary = await BankTransfer.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(req.userCompany) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalTransferAmount' },
          totalProducers: { $sum: '$totalApproved' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data,
      summary: summary[0] || { totalAmount: 0, totalProducers: 0, count: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bank transfers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bank transfers'
    });
  }
};

// Get single bank transfer
export const getBankTransferById = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    })
    .populate('createdBy', 'username name')
    .populate('appliedBy', 'username name')
    .populate('transferDetails.farmerId', 'farmerNumber personalDetails');

    if (!bankTransfer) {
      return res.status(404).json({
        success: false,
        message: 'Bank transfer not found'
      });
    }

    res.json({
      success: true,
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error fetching bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bank transfer'
    });
  }
};

// Cancel bank transfer
export const cancelBankTransfer = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!bankTransfer) {
      throw new Error('Bank transfer not found');
    }

    if (bankTransfer.status === 'Completed') {
      throw new Error('Cannot cancel a completed transfer');
    }

    if (bankTransfer.status === 'Cancelled') {
      throw new Error('Transfer is already cancelled');
    }

    // Update status
    bankTransfer.status = 'Cancelled';
    bankTransfer.transferDetails.forEach(detail => {
      detail.transferStatus = 'Cancelled';
    });

    await bankTransfer.save();

    // Reverse voucher if exists
    if (bankTransfer.voucherId) {
      const voucher = await Voucher.findById(bankTransfer.voucherId);
      if (voucher) {
        // Create reversal entries
        const reversalEntries = voucher.entries.map(entry => ({
          ledgerId: entry.ledgerId,
          ledgerName: entry.ledgerName,
          debitAmount: entry.creditAmount,
          creditAmount: entry.debitAmount
        }));

        const reversalVoucher = new Voucher({
          voucherType: 'Journal',
          voucherNumber: await generateVoucherNumber('Journal', req.userCompany),
          voucherDate: new Date(),
          companyId: req.userCompany,
          entries: reversalEntries,
          totalDebit: voucher.totalCredit,
          totalCredit: voucher.totalDebit,
          narration: `Reversal of ${bankTransfer.transferNumber}`,
          referenceType: 'BankTransfer',
          referenceId: bankTransfer._id,
          createdBy: req.user?._id
        });

        await reversalVoucher.save();
        await updateLedgerBalances(reversalEntries);
      }
    }
    res.json({
      success: true,
      message: 'Bank transfer cancelled successfully',
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error cancelling bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling bank transfer'
    });
  } finally {
  }
};

// Mark transfer as completed
export const completeTransfer = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!bankTransfer) {
      return res.status(404).json({
        success: false,
        message: 'Bank transfer not found'
      });
    }

    if (bankTransfer.status !== 'Applied') {
      return res.status(400).json({
        success: false,
        message: 'Only applied transfers can be marked as completed'
      });
    }

    bankTransfer.status = 'Completed';
    bankTransfer.transferDetails.forEach(detail => {
      if (detail.approved) {
        detail.transferStatus = 'Transferred';
        detail.transferredAt = new Date();
      }
    });

    await bankTransfer.save();

    res.json({
      success: true,
      message: 'Bank transfer marked as completed',
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error completing transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing transfer'
    });
  }
};

// Get collection centers for dropdown
export const getCollectionCenters = async (req, res) => {
  try {
    const centers = await CollectionCenter.find({
      companyId: req.userCompany,
      status: 'Active'
    }).select('centerName centerType');

    res.json({
      success: true,
      data: centers
    });
  } catch (error) {
    console.error('Error fetching collection centers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching collection centers'
    });
  }
};

// Create BankTransfer record from Register-Ledger payments (Bank payMode rows)
export const createFromLedger = async (req, res) => {
  try {
    const { farmers, applyDate, fromDate, toDate, remarks } = req.body;
    const companyId = req.userCompany;

    if (!farmers || farmers.length === 0) {
      return res.status(400).json({ success: false, message: 'No farmers provided' });
    }

    // Fetch bank details for each farmer from DB
    const farmerIds = farmers.map(f => f.farmerId);
    const farmerDocs = await Farmer.find({ _id: { $in: farmerIds } })
      .select('farmerNumber personalDetails bankDetails')
      .lean();
    const farmerMap = {};
    farmerDocs.forEach(f => { farmerMap[f._id.toString()] = f; });

    const transferDetails = farmers.map(f => {
      const doc = farmerMap[f.farmerId?.toString()] || {};
      const bd  = doc.bankDetails || {};
      return {
        farmerId:       f.farmerId,
        producerId:     f.farmerNumber || doc.farmerNumber || '',
        producerName:   f.farmerName   || doc.personalDetails?.name || '',
        netPayable:     f.netPayable   || f.paidAmount || 0,
        transferAmount: f.paidAmount   || 0,
        approved:       true,
        bankDetails: {
          accountNumber: bd.accountNumber || '-',
          bankName:      bd.bankName      || '-',
          ifscCode:      bd.ifsc || bd.ifscCode || '-',
          bankCode:      bd.branchCode    || '-',
        },
        transferStatus: 'Pending',
      };
    });

    const bankTransfer = new BankTransfer({
      companyId,
      transferBasis:        'Register Ledger',
      asOnDate:             toDate   ? new Date(toDate)   : new Date(),
      applyDate:            applyDate ? new Date(applyDate) : new Date(),
      collectionCenterName: 'All',
      bankName:             'All',
      roundDownAmount:      1,
      dueByList:            false,
      transferDetails,
      status:               'Applied',
      appliedAt:            new Date(),
      createdBy:            req.user?._id,
      appliedBy:            req.user?._id,
      remarks:              remarks || `Register Ledger — ${fromDate ? new Date(fromDate).toLocaleDateString('en-IN') : ''} to ${toDate ? new Date(toDate).toLocaleDateString('en-IN') : ''}`,
    });

    await bankTransfer.save();
    res.json({ success: true, data: bankTransfer });
  } catch (error) {
    console.error('Error creating bank transfer from ledger:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating bank transfer' });
  }
};

// Get banks for dropdown
export const getBanks = async (req, res) => {
  try {
    // Get unique banks from farmer bank details
    const banks = await Farmer.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(req.userCompany) } },
      { $group: {
        _id: '$bankDetails.bankName',
        count: { $sum: 1 }
      }},
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $project: {
        name: '$_id',
        count: 1,
        _id: 0
      }},
      { $sort: { name: 1 } }
    ]);

    res.json({
      success: true,
      data: banks
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.json({
      success: true,
      data: []
    });
  }
};

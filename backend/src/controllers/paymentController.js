import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import { createPaymentVoucher } from '../utils/accountingHelper.js';
import mongoose from 'mongoose';

// ==================== FARMER PAYMENT FUNCTIONS ====================

// Create farmer payment
export const createFarmerPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentData = req.body;
    paymentData.companyId = req.companyId;
    paymentData.createdBy = req.user?._id;

    // Calculate total deduction from deductions array
    const deductionTotal = paymentData.deductions?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

    // Calculate total bonus
    const bonusTotal = paymentData.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
    paymentData.totalBonus = bonusTotal;

    // Calculate gross amount
    paymentData.grossAmount = (paymentData.milkAmount || 0) + bonusTotal;

    // Calculate total deduction including advance
    paymentData.totalDeduction = (paymentData.advanceAmount || 0) + deductionTotal + (paymentData.tdsAmount || 0);

    // Calculate net payable
    paymentData.netPayable = paymentData.grossAmount - paymentData.totalDeduction + (paymentData.previousBalance || 0);
    paymentData.balanceAmount = paymentData.netPayable - (paymentData.paidAmount || 0);

    // Determine status
    if (paymentData.paidAmount === 0) {
      paymentData.status = 'Pending';
    } else if (paymentData.balanceAmount === 0) {
      paymentData.status = 'Paid';
    } else {
      paymentData.status = 'Partial';
    }

    const payment = new FarmerPayment(paymentData);
    await payment.save({ session });

    // Adjust advances if advance amount is deducted
    if (paymentData.advanceAmount > 0 && paymentData.advancesAdjusted?.length > 0) {
      for (const adj of paymentData.advancesAdjusted) {
        await Advance.findByIdAndUpdate(
          adj.advanceId,
          {
            $push: {
              adjustments: {
                date: new Date(),
                amount: adj.amount,
                referenceType: 'Payment',
                referenceId: payment._id,
                paymentNumber: payment.paymentNumber,
                adjustedBy: req.user?._id
              }
            },
            $inc: {
              adjustedAmount: adj.amount,
              balanceAmount: -adj.amount
            }
          },
          { session }
        );

        // Update advance status
        const advance = await Advance.findById(adj.advanceId).session(session);
        if (advance && advance.balanceAmount <= 0) {
          advance.status = 'Adjusted';
          await advance.save({ session });
        } else if (advance && advance.balanceAmount > 0) {
          advance.status = 'Partially Adjusted';
          await advance.save({ session });
        }
      }
    }

    // Create accounting voucher
    if (paymentData.paidAmount > 0) {
      try {
        const voucher = await createPaymentVoucher(payment, session);
        if (voucher) {
          payment.voucherId = voucher._id;
          await payment.save({ session });
        }
      } catch (voucherError) {
        console.error('Voucher creation failed:', voucherError);
      }
    }

    await session.commitTransaction();

    // Populate farmer details for response
    await payment.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating payment'
    });
  } finally {
    session.endSession();
  }
};

// Get all payments with advanced filtering
export const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      status = '',
      paymentMode = '',
      fromDate = '',
      toDate = '',
      search = '',
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (req.companyId) query.companyId = req.companyId;
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;

    // Date range filter
    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const payments = await FarmerPayment.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails bankDetails')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    const total = await FarmerPayment.countDocuments(query);

    // Calculate summary
    const summary = await FarmerPayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMilkAmount: { $sum: '$milkAmount' },
          totalNetPayable: { $sum: '$netPayable' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      summary: summary[0] || { totalMilkAmount: 0, totalNetPayable: 0, totalPaid: 0, totalBalance: 0 },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payments'
    });
  }
};

// Get single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const payment = await FarmerPayment.findById(req.params.id)
      .populate('farmerId', 'farmerNumber personalDetails bankDetails contactDetails')
      .populate('advancesAdjusted.advanceId', 'advanceNumber advanceAmount')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('cancelledBy', 'name');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payment'
    });
  }
};

// Get farmer payment history
export const getFarmerPaymentHistory = async (req, res) => {
  try {
    const { fromDate, toDate, status, limit = 50 } = req.query;

    const query = { farmerId: req.params.farmerId };
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const payments = await FarmerPayment.find(query)
      .sort({ paymentDate: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    // Get summary
    const summary = await FarmerPayment.getFarmerPaymentSummary(
      req.params.farmerId,
      fromDate,
      toDate
    );

    res.status(200).json({
      success: true,
      data: payments,
      summary
    });
  } catch (error) {
    console.error('Error fetching farmer payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer payments'
    });
  }
};

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const payment = await FarmerPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === 'Paid' || payment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a paid or cancelled payment'
      });
    }

    const updateData = req.body;

    // Recalculate totals
    if (updateData.paidAmount !== undefined) {
      updateData.balanceAmount = payment.netPayable - updateData.paidAmount;
      if (updateData.balanceAmount === 0) {
        updateData.status = 'Paid';
      } else if (updateData.paidAmount > 0) {
        updateData.status = 'Partial';
      }
    }

    const updatedPayment = await FarmerPayment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating payment'
    });
  }
};

// Cancel payment
export const cancelPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cancellationReason } = req.body;
    const payment = await FarmerPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already cancelled'
      });
    }

    // Reverse advance adjustments
    if (payment.advancesAdjusted?.length > 0) {
      for (const adj of payment.advancesAdjusted) {
        await Advance.findByIdAndUpdate(
          adj.advanceId,
          {
            $inc: {
              adjustedAmount: -adj.amount,
              balanceAmount: adj.amount
            },
            $set: { status: 'Active' }
          },
          { session }
        );
      }
    }

    payment.status = 'Cancelled';
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.user?._id;
    payment.cancellationReason = cancellationReason;
    await payment.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: payment
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error cancelling payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling payment'
    });
  } finally {
    session.endSession();
  }
};

// Get payment statistics
export const getPaymentStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (req.companyId) query.companyId = req.companyId;

    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const stats = await FarmerPayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netPayable' },
          paidAmount: { $sum: '$paidAmount' },
          balanceAmount: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const paymentModeStats = await FarmerPayment.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$paymentMode',
          count: { $sum: 1 },
          totalPaid: { $sum: '$paidAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusWise: stats,
        paymentModeWise: paymentModeStats
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payment statistics'
    });
  }
};

// ==================== ADVANCE FUNCTIONS ====================

// Create advance
export const createAdvance = async (req, res) => {
  try {
    const advanceData = req.body;
    advanceData.companyId = req.companyId;
    advanceData.createdBy = req.user?._id;
    advanceData.balanceAmount = advanceData.advanceAmount;

    // Calculate interest if applicable
    if (advanceData.interestRate > 0) {
      advanceData.interestAmount = (advanceData.advanceAmount * advanceData.interestRate) / 100;
      advanceData.totalDue = advanceData.advanceAmount + advanceData.interestAmount;
      advanceData.balanceAmount = advanceData.totalDue;
    }

    // Check farmer's credit limit
    const farmerOutstanding = await Advance.getFarmerOutstanding(advanceData.farmerId);
    advanceData.availableLimit = (advanceData.farmerCreditLimit || 0) - farmerOutstanding.totalOutstanding;

    const advance = new Advance(advanceData);
    await advance.save();

    // Populate farmer details
    await advance.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Advance created successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error creating advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating advance'
    });
  }
};

// Get all advances with advanced filtering
export const getAllAdvances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      status = '',
      advanceType = '',
      fromDate = '',
      toDate = '',
      sortBy = 'advanceDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (req.companyId) query.companyId = req.companyId;
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;
    if (advanceType) query.advanceType = advanceType;

    if (fromDate || toDate) {
      query.advanceDate = {};
      if (fromDate) query.advanceDate.$gte = new Date(fromDate);
      if (toDate) query.advanceDate.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const advances = await Advance.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    const total = await Advance.countDocuments(query);

    // Calculate summary
    const summary = await Advance.aggregate([
      { $match: { ...query, status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] } } },
      {
        $group: {
          _id: null,
          totalAdvanced: { $sum: '$advanceAmount' },
          totalAdjusted: { $sum: '$adjustedAmount' },
          totalOutstanding: { $sum: '$balanceAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: advances,
      summary: summary[0] || { totalAdvanced: 0, totalAdjusted: 0, totalOutstanding: 0, count: 0 },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advances'
    });
  }
};

// Get single advance by ID
export const getAdvanceById = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id)
      .populate('farmerId', 'farmerNumber personalDetails bankDetails contactDetails')
      .populate('adjustments.adjustedBy', 'name')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('cancelledBy', 'name');

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    res.status(200).json({
      success: true,
      data: advance
    });
  } catch (error) {
    console.error('Error fetching advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advance'
    });
  }
};

// Get farmer advances
export const getFarmerAdvances = async (req, res) => {
  try {
    const { status = '', includeAdjusted = 'false' } = req.query;

    const query = { farmerId: req.params.farmerId };

    if (status) {
      query.status = status;
    } else if (includeAdjusted === 'false') {
      query.status = { $in: ['Active', 'Partially Adjusted', 'Overdue'] };
    }

    const advances = await Advance.find(query)
      .sort({ advanceDate: -1 })
      .populate('createdBy', 'name');

    // Get total outstanding
    const outstanding = await Advance.getFarmerOutstanding(req.params.farmerId);

    res.status(200).json({
      success: true,
      data: advances,
      outstanding
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advances'
    });
  }
};

// Update advance
export const updateAdvance = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status === 'Adjusted' || advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update an adjusted or cancelled advance'
      });
    }

    const updateData = req.body;

    // Don't allow changing amount if adjustments exist
    if (advance.adjustments.length > 0 && updateData.advanceAmount) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change amount after adjustments have been made'
      });
    }

    const updatedAdvance = await Advance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Advance updated successfully',
      data: updatedAdvance
    });
  } catch (error) {
    console.error('Error updating advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating advance'
    });
  }
};

// Adjust advance
export const adjustAdvance = async (req, res) => {
  try {
    const { adjustmentAmount, referenceType, referenceId, paymentNumber, remarks } = req.body;

    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status === 'Adjusted' || advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Advance is already adjusted or cancelled'
      });
    }

    if (advance.balanceAmount < adjustmentAmount) {
      return res.status(400).json({
        success: false,
        message: `Adjustment amount (${adjustmentAmount}) exceeds balance (${advance.balanceAmount})`
      });
    }

    // Add adjustment entry
    advance.adjustments.push({
      date: new Date(),
      amount: adjustmentAmount,
      referenceType,
      referenceId,
      paymentNumber,
      remarks,
      adjustedBy: req.user?._id
    });

    advance.adjustedAmount += adjustmentAmount;
    advance.balanceAmount -= adjustmentAmount;

    if (advance.balanceAmount === 0) {
      advance.status = 'Adjusted';
    } else {
      advance.status = 'Partially Adjusted';
    }

    await advance.save();

    res.status(200).json({
      success: true,
      message: 'Advance adjusted successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error adjusting advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adjusting advance'
    });
  }
};

// Cancel advance
export const cancelAdvance = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.adjustments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an advance with adjustments'
      });
    }

    if (advance.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Advance is already cancelled'
      });
    }

    advance.status = 'Cancelled';
    advance.cancelledAt = new Date();
    advance.cancelledBy = req.user?._id;
    advance.cancellationReason = cancellationReason;
    await advance.save();

    res.status(200).json({
      success: true,
      message: 'Advance cancelled successfully',
      data: advance
    });
  } catch (error) {
    console.error('Error cancelling advance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling advance'
    });
  }
};

// Get advance statistics
export const getAdvanceStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (req.companyId) query.companyId = req.companyId;

    if (fromDate || toDate) {
      query.advanceDate = {};
      if (fromDate) query.advanceDate.$gte = new Date(fromDate);
      if (toDate) query.advanceDate.$lte = new Date(toDate);
    }

    const stats = await Advance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$advanceAmount' },
          adjustedAmount: { $sum: '$adjustedAmount' },
          balanceAmount: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const typeStats = await Advance.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$advanceType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$advanceAmount' },
          outstanding: { $sum: '$balanceAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusWise: stats,
        typeWise: typeStats
      }
    });
  } catch (error) {
    console.error('Error fetching advance stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advance statistics'
    });
  }
};

// Bulk create payments (for batch processing)
export const bulkCreatePayments = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { payments } = req.body;
    const results = [];
    const errors = [];

    for (const paymentData of payments) {
      try {
        paymentData.companyId = req.companyId;
        paymentData.createdBy = req.user?._id;

        const payment = new FarmerPayment(paymentData);
        await payment.save({ session });
        results.push({ success: true, data: payment });
      } catch (err) {
        errors.push({ farmerId: paymentData.farmerId, error: err.message });
      }
    }

    if (errors.length === 0) {
      await session.commitTransaction();
      res.status(201).json({
        success: true,
        message: `${results.length} payments created successfully`,
        data: results
      });
    } else if (results.length > 0) {
      await session.commitTransaction();
      res.status(207).json({
        success: true,
        message: `${results.length} payments created, ${errors.length} failed`,
        data: results,
        errors
      });
    } else {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: 'All payments failed',
        errors
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in bulk payment creation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating payments'
    });
  } finally {
    session.endSession();
  }
};

export default {
  // Payment functions
  createFarmerPayment,
  getAllPayments,
  getPaymentById,
  getFarmerPaymentHistory,
  updatePayment,
  cancelPayment,
  getPaymentStats,
  bulkCreatePayments,
  // Advance functions
  createAdvance,
  getAllAdvances,
  getAdvanceById,
  getFarmerAdvances,
  updateAdvance,
  adjustAdvance,
  cancelAdvance,
  getAdvanceStats
};

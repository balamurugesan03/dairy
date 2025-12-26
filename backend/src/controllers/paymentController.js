import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import { createPaymentVoucher } from '../utils/accountingHelper.js';
import mongoose from 'mongoose';

// Create farmer payment
export const createFarmerPayment = async (req, res) => {
  try {
    const paymentData = req.body;

    // Calculate total deduction
    const totalDeduction = paymentData.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
    paymentData.totalDeduction = totalDeduction;

    // Calculate net payable
    paymentData.netPayable = (paymentData.milkAmount || 0) - totalDeduction;
    paymentData.balanceAmount = paymentData.netPayable - (paymentData.paidAmount || 0);

    // Determine status
    paymentData.status = paymentData.balanceAmount === 0 ? 'Paid' : 'Pending';

    const payment = new FarmerPayment(paymentData);
    await payment.save();

    // Create accounting voucher
    if (paymentData.paidAmount > 0) {
      const voucher = await createPaymentVoucher(payment);
      payment.voucherId = voucher._id;
      await payment.save();
    }

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating payment'
    });
  }
};

// Get all payments
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, farmerId = '', status = '' } = req.query;

    const query = {};
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await FarmerPayment.find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerId farmerNumber personalDetails');

    const total = await FarmerPayment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
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

// Get farmer payment history
export const getFarmerPaymentHistory = async (req, res) => {
  try {
    const payments = await FarmerPayment.find({ farmerId: req.params.farmerId })
      .sort({ paymentDate: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching farmer payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer payments'
    });
  }
};

// Create advance
export const createAdvance = async (req, res) => {
  try {
    const advanceData = req.body;
    advanceData.balanceAmount = advanceData.advanceAmount;

    const advance = new Advance(advanceData);
    await advance.save();

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

// Get all advances
export const getAllAdvances = async (req, res) => {
  try {
    const { page = 1, limit = 10, farmerId = '', status = '' } = req.query;

    const query = {};
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const advances = await Advance.find(query)
      .sort({ advanceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerId farmerNumber personalDetails');

    const total = await Advance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: advances,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
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

// Get farmer advances
export const getFarmerAdvances = async (req, res) => {
  try {
    const { status = 'Active' } = req.query;

    const query = { farmerId: req.params.farmerId };
    if (status) query.status = status;

    const advances = await Advance.find(query)
      .sort({ advanceDate: -1 });

    res.status(200).json({
      success: true,
      data: advances
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching advances'
    });
  }
};

// Adjust advance
export const adjustAdvance = async (req, res) => {
  try {
    const { adjustmentAmount, referenceType, referenceId } = req.body;

    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.balanceAmount < adjustmentAmount) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment amount exceeds balance'
      });
    }

    // Add adjustment entry
    advance.adjustments.push({
      date: new Date(),
      amount: adjustmentAmount,
      referenceType,
      referenceId
    });

    advance.adjustedAmount += adjustmentAmount;
    advance.balanceAmount -= adjustmentAmount;

    if (advance.balanceAmount === 0) {
      advance.status = 'Adjusted';
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

export default {
  createFarmerPayment,
  getAllPayments,
  getFarmerPaymentHistory,
  createAdvance,
  getAllAdvances,
  getFarmerAdvances,
  adjustAdvance
};

import mongoose from 'mongoose';
import ProducerPayment from '../models/ProducerPayment.js';
import Farmer from '../models/Farmer.js';
import FarmerPayment from '../models/FarmerPayment.js';

// ─── Create Payment ────────────────────────────────────────────────────────────
export const createPayment = async (req, res) => {
  try {
    const {
      farmerId,
      amountPaid,
      processingPeriod,
      paymentDate,
      isPartialPayment,
      paymentCenter,
      paymentCenterName,
      producerNumber,
      producerName,
      refNo,
      lastAbstractBalance,
      printSlip,
      paymentMode,
      remarks
    } = req.body;

    // Validate required fields
    if (!farmerId) {
      return res.status(400).json({ success: false, message: 'farmerId is required' });
    }
    if (amountPaid === undefined || amountPaid === null || amountPaid < 0) {
      return res.status(400).json({ success: false, message: 'amountPaid must be a non-negative number' });
    }
    if (!processingPeriod || !processingPeriod.fromDate || !processingPeriod.toDate) {
      return res.status(400).json({ success: false, message: 'processingPeriod (fromDate and toDate) is required' });
    }
    if (!paymentDate) {
      return res.status(400).json({ success: false, message: 'paymentDate is required' });
    }

    const payment = new ProducerPayment({
      companyId: req.userCompany,
      farmerId,
      amountPaid,
      processingPeriod: {
        fromDate: new Date(processingPeriod.fromDate),
        toDate: new Date(processingPeriod.toDate)
      },
      paymentDate: new Date(paymentDate),
      isPartialPayment: isPartialPayment || false,
      paymentCenter: paymentCenter || null,
      paymentCenterName: paymentCenterName || 'All',
      producerNumber: producerNumber || '',
      producerName: producerName || '',
      refNo: refNo || '',
      lastAbstractBalance: lastAbstractBalance || 0,
      printSlip: printSlip || false,
      paymentMode: paymentMode || 'Cash',
      remarks: remarks || '',
      createdBy: req.user?._id
    });

    await payment.save();

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('Error creating producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error creating payment' });
  }
};

// ─── Get Payments ──────────────────────────────────────────────────────────────
export const getPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      last5Days,
      fromDate,
      toDate,
      centerId,
      search
    } = req.query;

    const companyId = req.userCompany;
    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };

    // Date filters
    if (last5Days === 'true') {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fiveDaysAgo.setHours(0, 0, 0, 0);
      filter.paymentDate = { $gte: fiveDaysAgo };
    } else {
      if (fromDate || toDate) {
        filter.paymentDate = {};
        if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          filter.paymentDate.$lte = end;
        }
      }
    }

    // Collection center filter
    if (centerId && centerId !== 'all') {
      filter.paymentCenter = new mongoose.Types.ObjectId(centerId);
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { producerNumber: searchRegex },
        { producerName: searchRegex },
        { refNo: searchRegex }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      ProducerPayment.find(filter)
        .populate('farmerId', 'farmerNumber personalDetails')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProducerPayment.countDocuments(filter)
    ]);

    // Summary aggregate (all matching records, not just current page)
    const summaryAgg = await ProducerPayment.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryAgg[0] || { totalAmount: 0, count: 0 };

    return res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalAmount: summary.totalAmount,
        count: summary.count
      }
    });
  } catch (error) {
    console.error('Error fetching producer payments:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error fetching payments' });
  }
};

// ─── Get Producer Balance ──────────────────────────────────────────────────────
export const getProducerBalance = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const companyId = req.userCompany;

    if (!farmerId || !mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({ success: false, message: 'Valid farmerId is required' });
    }

    // Get farmer info
    const farmer = await Farmer.findOne({
      _id: new mongoose.Types.ObjectId(farmerId),
      companyId: new mongoose.Types.ObjectId(companyId)
    })
      .select('farmerNumber personalDetails bankDetails')
      .lean();

    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }

    // Aggregate balance from FarmerPayment
    const balanceAgg = await FarmerPayment.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          farmerId: new mongoose.Types.ObjectId(farmerId),
          status: { $in: ['Pending', 'Partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const balance = balanceAgg[0]?.totalBalance || 0;

    return res.json({
      success: true,
      data: {
        balance,
        farmer: {
          _id: farmer._id,
          number: farmer.farmerNumber,
          name: farmer.personalDetails?.name || '',
          bankName: farmer.bankDetails?.bankName || '',
          accountNumber: farmer.bankDetails?.accountNumber || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching producer balance:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error fetching balance' });
  }
};

// ─── Update Payment ────────────────────────────────────────────────────────────
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const payment = await ProducerPayment.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled payment' });
    }

    const allowedFields = ['refNo', 'amountPaid', 'printSlip', 'paymentMode', 'remarks'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    }

    await payment.save();

    return res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error updating producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error updating payment' });
  }
};

// ─── Cancel Payment ────────────────────────────────────────────────────────────
export const cancelPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const payment = await ProducerPayment.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Payment is already cancelled' });
    }

    payment.status = 'Cancelled';
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.user?._id;

    await payment.save();

    return res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error cancelling producer payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error cancelling payment' });
  }
};

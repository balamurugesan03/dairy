import Farmer        from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import FarmerPayment  from '../models/FarmerPayment.js';
import mongoose       from 'mongoose';

/**
 * GET /api/milk-bill/:farmerId?month=3&year=2020
 * Returns per-day (AM/PM) milk data + opening balance + cattle feed + payment totals
 */
export const getMilkBill = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { month, year } = req.query;
    const companyId = req.companyId;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month or year' });
    }

    const startDate = new Date(y, m - 1, 1);
    const endDate   = new Date(y, m,     0, 23, 59, 59, 999); // last day of month

    // ── Validate farmer ────────────────────────────────────────────────────────
    const farmer = await Farmer.findOne({ _id: farmerId, companyId }).lean();
    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }

    // ── Raw milk collections for the month (all shifts) ───────────────────────
    const collections = await MilkCollection.find({
      farmer:    new mongoose.Types.ObjectId(farmerId),
      companyId,
      date:      { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1, shift: 1 })
      .lean();

    // ── Build per-day map ──────────────────────────────────────────────────────
    const daysInMonth = endDate.getDate();
    const dayMap = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dayMap[d] = { am: null, pm: null };
    }

    collections.forEach((c) => {
      const day   = new Date(c.date).getDate();
      const entry = {
        qty:    +(c.qty    || 0),
        clr:    +(c.clr    || 0),
        fat:    +(c.fat    || 0),
        snf:    +(c.snf    || 0),
        rate:   +(c.rate   || 0),
        amount: +(c.amount || 0),
      };
      if (c.shift === 'AM') dayMap[day].am = entry;
      else                   dayMap[day].pm = entry;
    });

    // ── Opening Balance (FarmerPayments settled BEFORE this month) ─────────────
    // openingBalance = (milk earned) - (deductions) - (paid) before startDate
    const prevAgg = await FarmerPayment.aggregate([
      {
        $match: {
          farmerId:    new mongoose.Types.ObjectId(farmerId),
          companyId,
          paymentDate: { $lt: startDate },
          status:      { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id:              null,
          totalMilkAmount:  { $sum: '$milkAmount'     },
          totalDeduction:   { $sum: '$totalDeduction' },
          totalPaid:        { $sum: '$paidAmount'     },
        },
      },
    ]);
    const pp = prevAgg[0] || { totalMilkAmount: 0, totalDeduction: 0, totalPaid: 0 };
    const openingBalance = pp.totalMilkAmount - pp.totalDeduction - pp.totalPaid;

    // ── Cattle Feed deductions for this month ──────────────────────────────────
    const cattleAgg = await FarmerPayment.aggregate([
      {
        $match: {
          farmerId:    new mongoose.Types.ObjectId(farmerId),
          companyId,
          paymentDate: { $gte: startDate, $lte: endDate },
          status:      { $ne: 'Cancelled' },
        },
      },
      { $unwind: '$deductions' },
      {
        $match: {
          'deductions.type': {
            $in: ['Cattle Feed', 'Milma Feeds', 'Feed', 'Mineral Mixture', 'MDI'],
          },
        },
      },
      { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
    ]);
    const cattleFeed = cattleAgg[0]?.total || 0;

    // ── Payment / Bank total for this month ────────────────────────────────────
    const payAgg = await FarmerPayment.aggregate([
      {
        $match: {
          farmerId:    new mongoose.Types.ObjectId(farmerId),
          companyId,
          paymentDate: { $gte: startDate, $lte: endDate },
          status:      { $ne: 'Cancelled' },
        },
      },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]);
    const paymentBank = payAgg[0]?.total || 0;

    // ── Build days array ───────────────────────────────────────────────────────
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return { day: d, am: dayMap[d].am, pm: dayMap[d].pm };
    });

    res.json({
      success: true,
      farmer: {
        _id:      farmer._id,
        number:   farmer.farmerNumber,
        name:     farmer.personalDetails?.name || '',
        memberId: farmer.memberId || farmer.farmerNumber,
        house:    farmer.address?.ward  || '',
        village:  farmer.address?.village || '',
        phone:    farmer.personalDetails?.phone || '',
      },
      period:         { month: m, year: y, startDate, endDate, daysInMonth },
      days,
      openingBalance: Math.round(openingBalance * 100) / 100,
      cattleFeed:     Math.round(cattleFeed     * 100) / 100,
      paymentBank:    Math.round(paymentBank    * 100) / 100,
    });
  } catch (err) {
    console.error('getMilkBill error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

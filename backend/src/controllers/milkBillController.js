import Farmer                    from '../models/Farmer.js';
import MilkCollection             from '../models/MilkCollection.js';
import FarmerPayment              from '../models/FarmerPayment.js';
import Sales                      from '../models/Sales.js';
import ProducerPayment            from '../models/ProducerPayment.js';
import PaymentRegister            from '../models/PaymentRegister.js';
import ProducerOpening            from '../models/ProducerOpening.js';
import IndividualDeductionEarning from '../models/IndividualDeductionEarning.js';
import mongoose                   from 'mongoose';

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

const r2 = (v) => Math.round((+(v || 0)) * 100) / 100;
const fmt = (d) => new Date(d).toISOString().split('T')[0];

/**
 * GET /api/milk-bill/:farmerId/cycle?fromDate=&toDate=
 * Full cycle-based milk bill: milk collections + cattle feed + deductions + payments
 */
export const getMilkBillByCycle = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const farmerObjId = new mongoose.Types.ObjectId(farmerId);

    // ── Farmer ────────────────────────────────────────────────────────────────
    const farmer = await Farmer.findOne({ _id: farmerId, companyId }).lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });

    // ── Milk Collections ─────────────────────────────────────────────────────
    const collections = await MilkCollection.find({
      farmer: farmerObjId,
      companyId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1, shift: 1 }).lean();

    const dayMap = {};
    collections.forEach((c) => {
      const key = fmt(c.date);
      if (!dayMap[key]) dayMap[key] = { date: key, am: null, pm: null };
      const entry = {
        qty:    +(c.qty    || 0),
        clr:    +(c.clr    || 0),
        fat:    +(c.fat    || 0),
        snf:    +(c.snf    || 0),
        rate:   +(c.rate   || 0),
        amount: +(c.amount || 0),
      };
      if (c.shift === 'AM') dayMap[key].am = entry;
      else                   dayMap[key].pm = entry;
    });
    const days = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // ── Cattle Feed Sales (Sales model, customerType=Farmer) ─────────────────
    const cattleSales = await Sales.find({
      companyId,
      customerId:   farmerObjId,
      customerType: 'Farmer',
      billDate:     { $gte: start, $lte: end },
    }).sort({ billDate: 1 }).lean();

    const cattleFeedRows = [];
    let totalCattleFeed = 0;
    cattleSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        cattleFeedRows.push({
          date:       fmt(sale.billDate),
          billNumber: sale.billNumber || '',
          itemName:   item.itemName   || '',
          quantity:   item.quantity   || 0,
          rate:       item.rate       || 0,
          amount:     item.amount     || 0,
        });
        totalCattleFeed += item.amount || 0;
      });
    });

    // ── Previous Balance — from last saved cycle's entry ──────────────────────
    let previousBalance = 0;
    const prevCycle = await PaymentRegister.findOne({
      companyId,
      registerType: 'Producers',
      status:       { $in: ['Saved', 'Printed'] },
      toDate:       { $lt: start },
    }).sort({ toDate: -1 }).lean();

    if (prevCycle) {
      const prevEntry = (prevCycle.entries || []).find(
        (e) => e.farmerId?.toString() === farmerId
      );
      if (prevEntry) previousBalance = prevEntry.netPay || 0;
    } else {
      const opening = await ProducerOpening.findOne({ companyId, farmerId: farmerObjId }).lean();
      previousBalance = opening?.dueAmount || 0;
    }

    // ── Individual Deductions for this period ────────────────────────────────
    const deductionDocs = await IndividualDeductionEarning.find({
      companyId,
      producerId: farmerObjId,
      type:       'DEDUCTION',
      date:       { $gte: start, $lte: end },
    }).sort({ date: 1 }).lean();

    const deductionRows = deductionDocs.map((d) => ({
      date:     fmt(d.date),
      itemName: d.itemName   || d.description || '',
      amount:   d.amount     || 0,
    }));
    const totalDeductions = deductionDocs.reduce((s, d) => s + (d.amount || 0), 0);

    // ── Producer Payments (Bank/Cash) for this period ────────────────────────
    const paymentDocs = await ProducerPayment.find({
      companyId,
      farmerId:    farmerObjId,
      status:      { $ne: 'Cancelled' },
      paymentDate: { $gte: start, $lte: end },
    }).sort({ paymentDate: 1 }).lean();

    const paymentRows = paymentDocs.map((p) => ({
      date:   fmt(p.paymentDate),
      mode:   p.paymentMode || 'Cash',
      refNo:  p.refNo       || p.paymentNumber || '',
      amount: p.amountPaid  || 0,
    }));
    const totalBankPay = paymentDocs.filter((p) => p.paymentMode !== 'Cash').reduce((s, p) => s + (p.amountPaid || 0), 0);
    const totalCashPay = paymentDocs.filter((p) => p.paymentMode === 'Cash').reduce((s, p) => s + (p.amountPaid || 0), 0);
    const totalPayments = totalBankPay + totalCashPay;

    // ── Milk totals ───────────────────────────────────────────────────────────
    let amQty = 0, amAmt = 0, pmQty = 0, pmAmt = 0;
    days.forEach(({ am, pm }) => {
      if (am) { amQty += am.qty; amAmt += am.amount; }
      if (pm) { pmQty += pm.qty; pmAmt += pm.amount; }
    });
    const totalMilkQty = amQty + pmQty;
    const totalMilkAmt = amAmt + pmAmt;

    // ── Net payable = milkAmt + previousBalance - cattleFeed - deductions - payments ──
    const netAmount = totalMilkAmt + previousBalance - totalCattleFeed - totalDeductions - totalPayments;

    res.json({
      success: true,
      farmer: {
        _id:      farmer._id,
        number:   farmer.farmerNumber,
        name:     farmer.personalDetails?.name || '',
        memberId: farmer.memberId || farmer.farmerNumber,
        village:  farmer.address?.village || '',
        ward:     farmer.address?.ward    || '',
        phone:    farmer.personalDetails?.phone || '',
      },
      period: { fromDate: start.toISOString(), toDate: end.toISOString() },
      days,
      cattleFeedRows,
      deductionRows,
      paymentRows,
      summary: {
        amQty:            r2(amQty),
        amAmt:            r2(amAmt),
        pmQty:            r2(pmQty),
        pmAmt:            r2(pmAmt),
        totalMilkQty:     r2(totalMilkQty),
        totalMilkAmt:     r2(totalMilkAmt),
        previousBalance:  r2(previousBalance),
        totalCattleFeed:  r2(totalCattleFeed),
        totalDeductions:  r2(totalDeductions),
        totalBankPay:     r2(totalBankPay),
        totalCashPay:     r2(totalCashPay),
        totalPayments:    r2(totalPayments),
        netAmount:        r2(netAmount),
      },
    });
  } catch (err) {
    console.error('getMilkBillByCycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

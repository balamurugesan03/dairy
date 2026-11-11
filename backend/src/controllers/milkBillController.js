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
// ── Cycle data, loaded once for one farmer or for every farmer of the cycle ──
// Five bulk queries (+ the previous register) instead of five per farmer, so
// "All Farmers" stays fast. `farmerIds` = ObjectId[] to restrict, or null = all.
const loadCycleData = async (companyId, start, end, farmerIds) => {
  const only = (field) => (farmerIds ? { [field]: { $in: farmerIds } } : {});
  const [collections, cattleSales, deductionDocs, paymentDocs, prevCycle] = await Promise.all([
    MilkCollection.find({ companyId, date: { $gte: start, $lte: end }, ...only('farmer') })
      .sort({ date: 1, shift: 1 }).lean(),
    Sales.find({ companyId, customerType: 'Farmer', billDate: { $gte: start, $lte: end }, ...only('customerId') })
      .sort({ billDate: 1 }).lean(),
    IndividualDeductionEarning.find({ companyId, type: 'DEDUCTION', date: { $gte: start, $lte: end }, ...only('producerId') })
      .sort({ date: 1 }).lean(),
    ProducerPayment.find({ companyId, status: { $ne: 'Cancelled' }, paymentDate: { $gte: start, $lte: end }, ...only('farmerId') })
      .sort({ paymentDate: 1 }).lean(),
    PaymentRegister.findOne({
      companyId, registerType: 'Producers', status: { $in: ['Saved', 'Printed'] }, toDate: { $lt: start },
    }).sort({ toDate: -1 }).lean(),
  ]);
  const group = (docs, key) => {
    const m = new Map();
    docs.forEach((d) => {
      const k = d[key] ? String(d[key]) : '';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    });
    return m;
  };
  // Previous balance — last saved cycle's entry, else the producer's opening due
  const prevNet = new Map();
  (prevCycle?.entries || []).forEach((e) => { if (e.farmerId) prevNet.set(String(e.farmerId), e.netPay || 0); });
  const openings = prevCycle ? new Map() : new Map(
    (await ProducerOpening.find({ companyId, ...only('farmerId') }).lean()).map((o) => [String(o.farmerId), o.dueAmount || 0])
  );
  return {
    collections: group(collections, 'farmer'),
    sales: group(cattleSales, 'customerId'),
    deductions: group(deductionDocs, 'producerId'),
    payments: group(paymentDocs, 'farmerId'),
    previousBalanceOf: (id) => (prevCycle ? (prevNet.get(id) || 0) : (openings.get(id) || 0)),
  };
};

// One producer's bill from the loaded cycle data (same response shape as before)
const buildBill = (farmer, data, start, end, centreName = '') => {
  const id = String(farmer._id);

  // ── Milk Collections ─────────────────────────────────────────────────────
  const dayMap = {};
  (data.collections.get(id) || []).forEach((c) => {
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
  const cattleFeedRows = [];
  let totalCattleFeed = 0;
  (data.sales.get(id) || []).forEach((sale) => {
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

  const previousBalance = data.previousBalanceOf(id);

  // ── Individual Deductions for this period ────────────────────────────────
  const deductionDocs = data.deductions.get(id) || [];
  const deductionRows = deductionDocs.map((d) => ({
    date:     fmt(d.date),
    itemName: d.itemName   || d.description || '',
    amount:   d.amount     || 0,
  }));
  const totalDeductions = deductionDocs.reduce((s, d) => s + (d.amount || 0), 0);

  // ── Producer Payments (Bank/Cash) for this period ────────────────────────
  const paymentDocs = data.payments.get(id) || [];
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

  return {
    success: true,
    farmer: {
      _id:      farmer._id,
      number:   farmer.farmerNumber,
      name:     farmer.personalDetails?.name || '',
      memberId: farmer.memberId || farmer.farmerNumber,
      village:  farmer.address?.village || '',
      ward:     farmer.address?.ward    || '',
      phone:    farmer.personalDetails?.phone || '',
      centre:   centreName,
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
  };
};

const cycleRange = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end   = new Date(toDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// GET /api/milk-bill/:farmerId/cycle?fromDate=&toDate=
export const getMilkBillByCycle = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const { start, end } = cycleRange(fromDate, toDate);

    const farmer = await Farmer.findOne({ _id: farmerId, companyId }).populate('collectionCenter', 'centerName').lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });

    const data = await loadCycleData(companyId, start, end, [new mongoose.Types.ObjectId(farmerId)]);
    res.json(buildBill(farmer, data, start, end, farmer.collectionCenter?.centerName || ''));
  } catch (err) {
    console.error('getMilkBillByCycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/milk-bill/all/cycle?fromDate=&toDate=&centerId=
// Every producer who poured milk in the cycle, one bill each, ordered by centre
// then producer number (producer numbers repeat per centre).
export const getAllMilkBillsByCycle = async (req, res) => {
  try {
    const { fromDate, toDate, centerId } = req.query;
    const companyId = req.companyId;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const { start, end } = cycleRange(fromDate, toDate);

    const ids = await MilkCollection.distinct('farmer', { companyId, date: { $gte: start, $lte: end } });
    const farmerFilter = { companyId, _id: { $in: ids } };
    if (centerId && centerId !== 'all') farmerFilter.collectionCenter = new mongoose.Types.ObjectId(centerId);
    const farmers = await Farmer.find(farmerFilter).populate('collectionCenter', 'centerName').lean();
    if (!farmers.length) return res.json({ success: true, bills: [] });

    const data = await loadCycleData(companyId, start, end, farmers.map((f) => f._id));
    const num = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? Infinity : n; };
    farmers.sort((a, b) =>
      String(a.collectionCenter?.centerName || '').localeCompare(String(b.collectionCenter?.centerName || ''))
      || (num(a.farmerNumber) - num(b.farmerNumber))
      || String(a.farmerNumber).localeCompare(String(b.farmerNumber)));

    const bills = farmers.map((f) => buildBill(f, data, start, end, f.collectionCenter?.centerName || ''));
    res.json({ success: true, bills });
  } catch (err) {
    console.error('getAllMilkBillsByCycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  Milk Bill (Karur, Tamil Nadu) — Producer Dues → Regional Reports
//  Same bill data as Milk Bill (Producers) (loadCycleData / buildBill above),
//  without the deduction detail. Previous balance and Net Payable come from the
//  cycle's saved Payment Register (settled) entry — the Producer Dues figures —
//  so the bill agrees with the settled register and Payment Register (Karur).
// ═════════════════════════════════════════════════════════════════════════════
const DAY_MS = 86400000;
const around = (d) => { const t = new Date(d).getTime(); return { $gte: new Date(t - 2 * DAY_MS), $lte: new Date(t + 2 * DAY_MS) }; };
const karurProducerId = (centerCode, farmerNumber) => {
  const num = String(farmerNumber || '').trim();
  const padded = /^\d+$/.test(num) ? num.padStart(3, '0') : num;
  return centerCode ? `${centerCode}-${padded}` : padded;
};
const byFarmerNumber = (a, b) => String(a.farmerNumber || '').localeCompare(String(b.farmerNumber || ''), undefined, { numeric: true });

// GET /api/milk-bill/karur/producers?centerId=  — producers of one centre (search list)
export const getKarurProducers = async (req, res) => {
  try {
    const { centerId } = req.query;
    if (!mongoose.isValidObjectId(centerId)) return res.status(400).json({ success: false, message: 'Select a center' });
    const farmers = await Farmer.find({ companyId: req.companyId, collectionCenter: centerId })
      .select('farmerNumber personalDetails.name status collectionCenter')
      .populate('collectionCenter', 'centerCode centerName').lean();
    farmers.sort(byFarmerNumber);
    res.json({
      success: true,
      data: farmers.map((f) => ({
        _id: f._id,
        farmerNumber: f.farmerNumber || '',
        producerId: karurProducerId(f.collectionCenter?.centerCode, f.farmerNumber),
        name: f.personalDetails?.name || '',
        status: f.status || '',
      })),
    });
  } catch (err) {
    console.error('getKarurProducers error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/milk-bill/karur/bills?fromDate=&toDate=&centerId=&farmerIds=id1,id2
//   farmerIds empty → every producer of the centre in the cycle (settled or poured milk)
export const getKarurMilkBills = async (req, res) => {
  try {
    const { fromDate, toDate, centerId } = req.query;
    const companyId = req.companyId;
    if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'Select the payment cycle' });
    if (!mongoose.isValidObjectId(centerId)) return res.status(400).json({ success: false, message: 'Select a center' });
    const wanted = String(req.query.farmerIds || '').split(',').map((s) => s.trim()).filter((s) => mongoose.isValidObjectId(s));
    const { start, end } = cycleRange(fromDate, toDate);

    const settled = await PaymentRegister.findOne({
      companyId, registerType: { $in: ['Producers', 'Ledger'] }, status: { $in: ['Saved', 'Printed'] },
      fromDate: around(fromDate), toDate: around(toDate),
    }).sort({ updatedAt: -1 }).lean();
    const entryOf = new Map((settled?.entries || []).filter((e) => e.farmerId).map((e) => [String(e.farmerId), e]));

    let ids;
    if (wanted.length) {
      ids = wanted.map((s) => new mongoose.Types.ObjectId(s));
    } else {
      const poured = await MilkCollection.distinct('farmer', { companyId, date: { $gte: start, $lte: end } });
      ids = [...new Set([...poured.map(String), ...entryOf.keys()])].map((s) => new mongoose.Types.ObjectId(s));
    }
    // Only producers of the selected centre — never another centre's
    const farmers = await Farmer.find({ companyId, _id: { $in: ids }, collectionCenter: centerId })
      .populate('collectionCenter', 'centerCode centerName').lean();
    if (!farmers.length) return res.json({ success: true, settled: !!settled, bills: [] });
    farmers.sort(byFarmerNumber);

    const data = await loadCycleData(companyId, start, end, farmers.map((f) => f._id));
    const bills = farmers.map((f) => {
      const bill = buildBill(f, data, start, end, f.collectionCenter?.centerName || '');
      const s = bill.summary;
      const e = entryOf.get(String(f._id));
      let karur;
      if (e) {
        const prev = r2(e.previousBalance);
        const net = r2(e.netPay);
        karur = {
          source: 'settled',
          previousBalance: prev,
          recoveries: r2((e.milkValue || 0) + prev - net),
          netPayable: net,
          milkChanged: Math.abs(r2(e.milkValue) - s.totalMilkAmt) > 0.01,
        };
      } else {
        // Not in the settled register — same figures as Milk Bill (Producers)
        karur = {
          source: 'milkBill',
          previousBalance: s.previousBalance,
          recoveries: r2(s.totalMilkAmt + s.previousBalance - s.netAmount),
          netPayable: s.netAmount,
          milkChanged: false,
        };
      }
      return {
        ...bill,
        cattleFeedRows: undefined, deductionRows: undefined, paymentRows: undefined,
        farmer: {
          ...bill.farmer,
          producerId: karurProducerId(f.collectionCenter?.centerCode, f.farmerNumber),
          centerCode: f.collectionCenter?.centerCode || '',
          centerName: f.collectionCenter?.centerName || '',
        },
        karur,
      };
    });
    res.json({ success: true, settled: !!settled, bills });
  } catch (err) {
    console.error('getKarurMilkBills error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

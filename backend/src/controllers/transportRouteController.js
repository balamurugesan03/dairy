import mongoose from 'mongoose';
import TransportRoute from '../models/TransportRoute.js';
import TransportBill from '../models/TransportBill.js';
import CollectionCenter from '../models/CollectionCenter.js';
import MilkCollection from '../models/MilkCollection.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import {
  generateVoucherNumber,
  updateLedgerBalances,
  reverseLedgerBalances,
  findOrCreateLedger,
} from '../utils/accountingHelper.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Copies centre names onto stops/destination so lists and prints don't need populate
const resolveCentreNames = async (body, companyId) => {
  const ids = [
    ...(body.stops || []).map(s => s.centre),
    body.destination
  ].filter(Boolean);
  const centres = await CollectionCenter.find({ _id: { $in: ids }, companyId }).select('centerName').lean();
  const nameOf = Object.fromEntries(centres.map(c => [String(c._id), c.centerName]));

  body.stops = (body.stops || [])
    .filter(s => s.centre)
    .map(s => ({ centre: s.centre, centreName: nameOf[String(s.centre)] || '', km: Number(s.km) || 0 }));
  body.destination = body.destination || undefined;
  body.destinationName = body.destination ? (nameOf[String(body.destination)] || '') : '';
  return body;
};

// ════════════════════════════════════════════════════════════════
//  GET ALL (paginated + search + filter)
// ════════════════════════════════════════════════════════════════
export const getTransportRoutes = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', chargeType, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId: req.companyId };
    if (search) {
      filter.$or = [
        { routeName: { $regex: search, $options: 'i' } },
        { routeCode: { $regex: search, $options: 'i' } },
        { vehicleNumber: { $regex: search, $options: 'i' } },
        { driverName: { $regex: search, $options: 'i' } }
      ];
    }
    if (chargeType) filter.chargeType = chargeType;
    if (status) filter.status = status;

    const [routes, total] = await Promise.all([
      TransportRoute.find(filter).sort({ routeName: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      TransportRoute.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: routes,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTransportRouteById = async (req, res) => {
  try {
    const route = await TransportRoute.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const validateBody = (body) => {
  if (!body.stops || !body.stops.some(s => s.centre)) return 'Add at least one sub centre to the route';
  if (body.chargeType === 'KM' && !(Number(body.ratePerKm) > 0)) return 'Enter rate per KM';
  if (body.chargeType === 'Litre' && !(Number(body.ratePerLitre) > 0)) return 'Enter rate per litre';
  return null;
};

export const createTransportRoute = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body._id;
    const error = validateBody(body);
    if (error) return res.status(400).json({ success: false, message: error });

    await resolveCentreNames(body, req.companyId);
    const route = await TransportRoute.create({ ...body, companyId: req.companyId });
    res.status(201).json({ success: true, data: route, message: 'Route created' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateTransportRoute = async (req, res) => {
  try {
    const route = await TransportRoute.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    const body = { ...req.body };
    delete body._id;
    delete body.companyId;
    const error = validateBody(body);
    if (error) return res.status(400).json({ success: false, message: error });

    await resolveCentreNames(body, req.companyId);
    route.set(body);
    await route.save(); // save (not findOneAndUpdate) so totalKm is recomputed
    res.json({ success: true, data: route, message: 'Route updated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteTransportRoute = async (req, res) => {
  try {
    const billCount = await TransportBill.countDocuments({ routeId: req.params.id, companyId: req.companyId });
    if (billCount) {
      return res.status(400).json({
        success: false,
        message: `Route has ${billCount} posted bill(s). Reverse them first, or set the route Inactive.`
      });
    }
    const route = await TransportRoute.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  TRANSPORT CHARGES for a period
//  KM    → trips × totalKm × ratePerKm. A trip = one date+shift on
//          which milk was collected at any of the route's sub centres.
//  Litre → litres collected at the route's sub centres × ratePerLitre.
//  Only dates on/after the route's W.E.F date and the route's shifts count.
// ════════════════════════════════════════════════════════════════
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

const computeCharges = async (companyId, start, end, { routeId, routeIds } = {}) => {
  const routeFilter = { companyId, status: 'Active' };
  if (routeId) { routeFilter._id = routeId; delete routeFilter.status; }
  if (routeIds?.length) { routeFilter._id = { $in: routeIds }; delete routeFilter.status; }
  const routes = await TransportRoute.find(routeFilter).sort({ routeName: 1 }).lean();

  // Bills already posted for these routes that overlap the period
  const posted = await TransportBill.find({
    companyId,
    routeId: { $in: routes.map(r => r._id) },
    fromDate: { $lte: end },
    toDate: { $gte: start }
  }).sort({ fromDate: 1 }).lean();
  const postedByRoute = {};
  for (const b of posted) (postedByRoute[String(b.routeId)] ||= []).push(b);

  const rows = [];
  for (const route of routes) {
    const centreIds = route.stops.map(s => toObjectId(s.centre));
    const wef = dayStart(route.wefDate);
    const from = wef > start ? wef : start;
    const shifts = route.shifts?.length ? route.shifts : ['AM', 'PM'];

    let slots = [];
    if (centreIds.length && from <= end) {
      slots = await MilkCollection.aggregate([
        {
          $match: {
            companyId: toObjectId(companyId),
            collectionCenter: { $in: centreIds },
            shift: { $in: shifts },
            date: { $gte: from, $lte: end }
          }
        },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
              shift: '$shift',
              centre: '$collectionCenter'
            },
            qty: { $sum: '$qty' }
          }
        }
      ]);
    }

    const tripKeys = new Set(slots.map(s => `${s._id.day}|${s._id.shift}`));
    const litresByCentre = {};
    for (const s of slots) {
      const k = String(s._id.centre);
      litresByCentre[k] = (litresByCentre[k] || 0) + s.qty;
    }
    const litres = Object.values(litresByCentre).reduce((a, b) => a + b, 0);
    const trips = tripKeys.size;
    const km = trips * (route.totalKm || 0);
    const amount = route.chargeType === 'KM'
      ? km * (route.ratePerKm || 0)
      : litres * (route.ratePerLitre || 0);

    rows.push({
      routeId: route._id,
      routeCode: route.routeCode,
      routeName: route.routeName,
      vehicleNumber: route.vehicleNumber,
      driverName: route.driverName,
      ownerName: route.ownerName,
      destinationName: route.destinationName,
      chargeType: route.chargeType,
      rate: route.chargeType === 'KM' ? route.ratePerKm : route.ratePerLitre,
      totalKm: route.totalKm,
      trips,
      km: Number(km.toFixed(2)),
      litres: Number(litres.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      centres: route.stops.map(s => ({
        centreName: s.centreName,
        km: s.km,
        litres: Number((litresByCentre[String(s.centre)] || 0).toFixed(2))
      })),
      postedBills: (postedByRoute[String(route._id)] || []).map(b => ({
        _id: b._id,
        fromDate: b.fromDate,
        toDate: b.toDate,
        amount: b.amount,
        voucherNumber: b.voucherNumber
      }))
    });
  }

  const totals = rows.reduce((t, r) => ({
    trips: t.trips + r.trips,
    km: t.km + r.km,
    litres: t.litres + r.litres,
    amount: t.amount + r.amount
  }), { trips: 0, km: 0, litres: 0, amount: 0 });

  return { rows, totals };
};

export const getTransportCharges = async (req, res) => {
  try {
    const { fromDate, toDate, routeId } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const data = await computeCharges(req.companyId, dayStart(fromDate), dayEnd(toDate), { routeId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  LEDGER POSTING
//  Cash   → Payment: Dr TRANSPORT CHARGES / Cr Cash in Hand
//  Bank   → Payment: Dr TRANSPORT CHARGES / Cr selected bank ledger
//  Credit → Journal: Dr TRANSPORT CHARGES / Cr TRANSPORT CHARGES PAYABLE
//           (settle later with a normal Payment voucher on the payable ledger)
// ════════════════════════════════════════════════════════════════

// Resolve by name from the user's Ledger Management (case-insensitive) before creating
async function resolveLedger(name, ledgerType, parentGroup, balanceType, companyId) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Ledger.findOne({
    companyId,
    ledgerName: { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' },
  });
  if (existing) return existing;
  return findOrCreateLedger(name, ledgerType, parentGroup, balanceType, companyId);
}

async function resolveCreditLedger(payMode, bankLedgerId, companyId) {
  if (payMode === 'Credit') {
    return resolveLedger('TRANSPORT CHARGES PAYABLE', 'Other Payable', 'LIABILITY', 'Cr', companyId);
  }
  if (payMode === 'Bank') {
    const bank = bankLedgerId ? await Ledger.findOne({ _id: bankLedgerId, companyId }) : null;
    if (!bank) throw new Error('Select a bank ledger');
    return bank;
  }
  const cash = await Ledger.findOne({ ledgerType: 'Cash', companyId });
  return cash || findOrCreateLedger('Cash in Hand', 'Cash', 'Cash', 'Dr', companyId);
}

const fmtD = (d) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });

async function createTransportVoucher(bill, expenseLedger, creditLedger, companyId) {
  const amount = bill.amount;
  const voucherType = bill.payMode === 'Credit' ? 'Journal' : 'Payment';
  const basis = bill.chargeType === 'KM'
    ? `${bill.trips} trips, ${bill.km} KM @ ₹${bill.rate}/KM`
    : `${bill.litres} L @ ₹${bill.rate}/L`;
  const narration = `Transport Charges — ${bill.routeName} (${bill.vehicleNumber}) ${fmtD(bill.fromDate)} to ${fmtD(bill.toDate)} | ${basis}`;

  const entries = [
    { ledgerId: expenseLedger._id, ledgerName: expenseLedger.ledgerName, debitAmount: amount, creditAmount: 0, narration },
    { ledgerId: creditLedger._id, ledgerName: creditLedger.ledgerName, debitAmount: 0, creditAmount: amount, narration },
  ];
  const voucher = new Voucher({
    voucherType,
    voucherNumber: await generateVoucherNumber(voucherType, companyId),
    voucherDate: bill.voucherDate,
    entries,
    totalDebit: amount,
    totalCredit: amount,
    narration,
    referenceType: 'TransportCharges',
    referenceId: bill._id,
    referenceNumber: bill.vehicleNumber,
    companyId,
  });
  await voucher.save();
  await updateLedgerBalances(entries, null, companyId);
  return voucher;
}

export const postTransportCharges = async (req, res) => {
  try {
    const { fromDate, toDate, voucherDate, payMode = 'Credit', bankLedgerId, routeIds } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    if (!['Cash', 'Bank', 'Credit'].includes(payMode)) {
      return res.status(400).json({ success: false, message: 'Invalid pay mode' });
    }
    const start = dayStart(fromDate);
    const end = dayEnd(toDate);
    const companyId = req.companyId;

    const [expenseLedger, creditLedger] = await Promise.all([
      resolveLedger('TRANSPORT CHARGES', 'Trade Expenses', 'EXPENSE', 'Dr', companyId),
      resolveCreditLedger(payMode, bankLedgerId, companyId),
    ]);

    const { rows } = await computeCharges(companyId, start, end, { routeIds });
    const posted = [];
    const skipped = [];

    for (const row of rows) {
      if (row.postedBills.length) {
        skipped.push({ routeName: row.routeName, reason: 'Already posted for an overlapping period' });
        continue;
      }
      if (!(row.amount > 0)) {
        skipped.push({ routeName: row.routeName, reason: 'No charges for the period' });
        continue;
      }

      const bill = await TransportBill.create({
        routeId: row.routeId,
        routeName: row.routeName,
        vehicleNumber: row.vehicleNumber,
        fromDate: start,
        toDate: end,
        voucherDate: voucherDate ? dayStart(voucherDate) : dayStart(toDate),
        chargeType: row.chargeType,
        rate: row.rate,
        trips: row.trips,
        km: row.km,
        litres: row.litres,
        amount: row.amount,
        payMode,
        bankLedgerId: payMode === 'Bank' ? creditLedger._id : undefined,
        companyId,
      });
      try {
        const voucher = await createTransportVoucher(bill, expenseLedger, creditLedger, companyId);
        bill.voucherId = voucher._id;
        bill.voucherNumber = voucher.voucherNumber;
        await bill.save();
        posted.push({ routeName: row.routeName, amount: row.amount, voucherNumber: voucher.voucherNumber });
      } catch (vErr) {
        await bill.deleteOne(); // don't leave a bill without its voucher
        skipped.push({ routeName: row.routeName, reason: vErr.message });
      }
    }

    res.json({
      success: true,
      data: { posted, skipped },
      message: `${posted.length} route(s) posted to ledger${skipped.length ? `, ${skipped.length} skipped` : ''}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTransportBills = async (req, res) => {
  try {
    const { fromDate, toDate, routeId } = req.query;
    const filter = { companyId: req.companyId };
    if (fromDate || toDate) {
      filter.voucherDate = {};
      if (fromDate) filter.voucherDate.$gte = dayStart(fromDate);
      if (toDate) filter.voucherDate.$lte = dayEnd(toDate);
    }
    if (routeId) filter.routeId = routeId;
    const bills = await TransportBill.find(filter)
      .populate('bankLedgerId', 'ledgerName')
      .sort({ voucherDate: -1, routeName: 1 })
      .lean();
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Un-post: reverse ledger balances, delete the voucher and the bill
export const deleteTransportBill = async (req, res) => {
  try {
    const bill = await TransportBill.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!bill) return res.status(404).json({ success: false, message: 'Posted bill not found' });

    if (bill.voucherId) {
      const voucher = await Voucher.findOne({ _id: bill.voucherId, companyId: req.companyId });
      if (voucher) {
        await reverseLedgerBalances(voucher.entries, null, req.companyId);
        await voucher.deleteOne();
      }
    }
    await bill.deleteOne();
    res.json({ success: true, message: 'Posting reversed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


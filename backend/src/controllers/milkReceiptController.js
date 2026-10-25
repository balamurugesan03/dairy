import mongoose from 'mongoose';
import MilkReceipt from '../models/MilkReceipt.js';
import TransportRoute from '../models/TransportRoute.js';
import MilkCollection from '../models/MilkCollection.js';

// ════════════════════════════════════════════════════════════════
//  Main-centre milk receipt vs sub-centre collections (shortage)
//
//  Expected = sub centres' own collections (Daily Collection List)
//             for the route's stops, same date + shift.
//  Received = what the main centre weighed/tested off the van.
//  FAT kg = qty × FAT / 100, SNF kg = qty × SNF / 100.
//  Averages are qty-weighted.
// ════════════════════════════════════════════════════════════════

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const r2 = (n) => Number((Number(n) || 0).toFixed(2));
const r3 = (n) => Number((Number(n) || 0).toFixed(3));

// SNF from CLR when not entered — same formula as Milk Purchase
const autoSnf = (fat, clr) => (clr ? r2(clr / 4 + 0.20 * fat + 0.50) : 0);

// Sum of { qty, fatQty, snfQty, clrQty } → display figures
const finalise = (a) => {
  const qty = a.qty || 0;
  return {
    qty: r2(qty),
    fat: qty ? r2(a.fatQty / qty) : 0,
    snf: qty ? r2(a.snfQty / qty) : 0,
    clr: qty ? r2(a.clrQty / qty) : 0,
    fatKg: r3(a.fatQty / 100),
    snfKg: r3(a.snfQty / 100),
    farmers: a.farmers || 0
  };
};

const fromReading = ({ qty = 0, fat = 0, snf = 0, clr = 0 }) =>
  finalise({ qty, fatQty: qty * fat, snfQty: qty * snf, clrQty: qty * clr });

const diffOf = (received, expected) => ({
  qty: r2(received.qty - expected.qty),
  fatKg: r3(received.fatKg - expected.fatKg),
  snfKg: r3(received.snfKg - expected.snfKg),
  fat: r2(received.fat - expected.fat),
  snf: r2(received.snf - expected.snf)
});

// Main-centre receipt entered, but the sub centre Excel (Daily Collection List) isn't imported yet
const AWAITING = 'Awaiting Data';

const statusOf = (diff, tol) => {
  if (diff.qty < -tol.qty || diff.fatKg < -tol.kg || diff.snfKg < -tol.kg) return 'Shortage';
  if (diff.qty > tol.qty || diff.fatKg > tol.kg || diff.snfKg > tol.kg) return 'Excess';
  return 'OK';
};

// Collections grouped by day + shift + centre
const aggregateCollections = (companyId, start, end, centreIds, shift) => {
  const match = {
    companyId: toObjectId(companyId),
    collectionCenter: { $in: centreIds.map(toObjectId) },
    date: { $gte: start, $lte: end }
  };
  if (shift) match.shift = shift;
  return MilkCollection.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
          shift: '$shift',
          centre: '$collectionCenter'
        },
        qty: { $sum: '$qty' },
        fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
        snfQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$snf', 0] }] } },
        clrQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$clr', 0] }] } },
        farmerSet: { $addToSet: '$farmerNumber' }
      }
    },
    { $addFields: { farmers: { $size: '$farmerSet' } } },
    { $project: { farmerSet: 0 } }
  ]);
};

// Clean incoming readings; fill SNF from CLR when blank
const cleanReading = (src = {}) => {
  const qty = Number(src.qty) || 0;
  const fat = Number(src.fat) || 0;
  const clr = Number(src.clr) || 0;
  const snf = Number(src.snf) || autoSnf(fat, clr);
  return { qty, fat, clr, snf };
};

const buildReceiptBody = async (body, companyId) => {
  const route = await TransportRoute.findOne({ _id: body.routeId, companyId }).lean();
  if (!route) throw new Error('Route not found');

  const out = {
    date: dayStart(body.date),
    shift: body.shift,
    routeId: route._id,
    routeName: route.routeName,
    vehicleNumber: body.vehicleNumber || route.vehicleNumber,
    driverName: body.driverName || route.driverName,
    entryMode: body.entryMode === 'Centre' ? 'Centre' : 'Total',
    remarks: body.remarks
  };

  if (out.entryMode === 'Centre') {
    const nameOf = Object.fromEntries(route.stops.map(s => [String(s.centre), s.centreName]));
    out.lines = (body.lines || [])
      .filter(l => l.centre && nameOf[String(l.centre)] !== undefined)
      .map(l => ({ centre: l.centre, centreName: nameOf[String(l.centre)], ...cleanReading(l) }));
    if (!out.lines.some(l => l.qty > 0)) throw new Error('Enter received qty for at least one sub centre');
  } else {
    Object.assign(out, cleanReading(body));
    if (!(out.qty > 0)) throw new Error('Enter received qty');
    out.lines = [];
  }
  return out;
};

// ════════════════════════════════════════════════════════════════
//  GET EXPECTED — sub-centre bills for one route/date/shift (+ existing receipt)
// ════════════════════════════════════════════════════════════════
export const getExpected = async (req, res) => {
  try {
    const { date, shift, routeId } = req.query;
    if (!date || !shift || !routeId) {
      return res.status(400).json({ success: false, message: 'date, shift and routeId are required' });
    }
    const route = await TransportRoute.findOne({ _id: routeId, companyId: req.companyId }).lean();
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    const centreIds = route.stops.map(s => s.centre);
    const [groups, receipt] = await Promise.all([
      aggregateCollections(req.companyId, dayStart(date), dayEnd(date), centreIds, shift),
      MilkReceipt.findOne({ companyId: req.companyId, date: dayStart(date), shift, routeId }).lean()
    ]);

    const byCentre = Object.fromEntries(groups.map(g => [String(g._id.centre), g]));
    const sum = { qty: 0, fatQty: 0, snfQty: 0, clrQty: 0, farmers: 0 };
    const centres = route.stops.map(s => {
      const g = byCentre[String(s.centre)] || { qty: 0, fatQty: 0, snfQty: 0, clrQty: 0, farmers: 0 };
      for (const k of Object.keys(sum)) sum[k] += g[k] || 0;
      return { centre: s.centre, centreName: s.centreName, ...finalise(g) };
    });

    res.json({
      success: true,
      data: {
        route: {
          _id: route._id,
          routeName: route.routeName,
          vehicleNumber: route.vehicleNumber,
          driverName: route.driverName,
          destinationName: route.destinationName
        },
        centres,
        total: finalise(sum),
        receipt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════════
export const getMilkReceipts = async (req, res) => {
  try {
    const { fromDate, toDate, shift, routeId } = req.query;
    const filter = { companyId: req.companyId };
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = dayStart(fromDate);
      if (toDate) filter.date.$lte = dayEnd(toDate);
    }
    if (shift) filter.shift = shift;
    if (routeId) filter.routeId = routeId;
    const receipts = await MilkReceipt.find(filter).sort({ date: -1, shift: 1, routeName: 1 }).lean();
    res.json({ success: true, data: receipts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMilkReceipt = async (req, res) => {
  try {
    const body = await buildReceiptBody(req.body, req.companyId);
    const receipt = await MilkReceipt.create({ ...body, companyId: req.companyId });
    res.status(201).json({ success: true, data: receipt, message: 'Receipt saved' });
  } catch (err) {
    const message = err.code === 11000 ? 'Receipt already entered for this route, date and shift' : err.message;
    res.status(400).json({ success: false, message });
  }
};

export const updateMilkReceipt = async (req, res) => {
  try {
    const receipt = await MilkReceipt.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
    const body = await buildReceiptBody(req.body, req.companyId);
    receipt.set(body);
    await receipt.save(); // save so Centre-mode totals are recomputed
    res.json({ success: true, data: receipt, message: 'Receipt updated' });
  } catch (err) {
    const message = err.code === 11000 ? 'Receipt already entered for this route, date and shift' : err.message;
    res.status(400).json({ success: false, message });
  }
};

export const deleteMilkReceipt = async (req, res) => {
  try {
    const receipt = await MilkReceipt.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
    res.json({ success: true, message: 'Receipt deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  SHORTAGE REPORT
//  One row per date + shift + route where sub centres collected milk
//  or a receipt was entered. Centre-wise receipts attribute shortage to
//  each sub centre; Total receipts attribute it to the route/van only.
// ════════════════════════════════════════════════════════════════
export const getShortageReport = async (req, res) => {
  try {
    const { fromDate, toDate, shift, routeId, qtyTolerance = 0, kgTolerance = 0 } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const start = dayStart(fromDate);
    const end = dayEnd(toDate);
    const tol = { qty: Number(qtyTolerance) || 0, kg: Number(kgTolerance) || 0 };

    const receiptFilter = { companyId: req.companyId, date: { $gte: start, $lte: end } };
    if (shift) receiptFilter.shift = shift;
    if (routeId) receiptFilter.routeId = routeId;
    const receipts = await MilkReceipt.find(receiptFilter).lean();

    // Routes: active ones + any that have receipts in the period
    const routeFilter = routeId
      ? { companyId: req.companyId, _id: routeId }
      : { companyId: req.companyId, $or: [{ status: 'Active' }, { _id: { $in: receipts.map(r => r.routeId) } }] };
    const routes = await TransportRoute.find(routeFilter).sort({ routeName: 1 }).lean();

    // Each centre belongs to one route (first match) so its milk is not counted twice
    const routeOfCentre = {};
    for (const rt of routes) {
      for (const s of rt.stops) {
        const k = String(s.centre);
        if (!routeOfCentre[k]) routeOfCentre[k] = rt;
      }
    }
    const centreIds = Object.keys(routeOfCentre);
    const groups = centreIds.length ? await aggregateCollections(req.companyId, start, end, centreIds, shift) : [];

    // slotKey = day|shift|routeId
    const slots = {};
    const slotFor = (day, sh, rt) => {
      const key = `${day}|${sh}|${rt._id}`;
      if (!slots[key]) slots[key] = { day, shift: sh, route: rt, centres: {}, receipt: null };
      return slots[key];
    };
    for (const g of groups) {
      const rt = routeOfCentre[String(g._id.centre)];
      if (!rt) continue;
      slotFor(g._id.day, g._id.shift, rt).centres[String(g._id.centre)] = g;
    }
    const routeById = Object.fromEntries(routes.map(r => [String(r._id), r]));
    for (const rc of receipts) {
      const rt = routeById[String(rc.routeId)];
      if (!rt) continue;
      slotFor(ymd(rc.date), rc.shift, rt).receipt = rc;
    }

    const empty = { qty: 0, fatQty: 0, snfQty: 0, clrQty: 0, farmers: 0 };
    const rows = Object.values(slots).map(slot => {
      const rt = slot.route;
      const rc = slot.receipt;
      const lineOf = Object.fromEntries((rc?.entryMode === 'Centre' ? rc.lines : []).map(l => [String(l.centre), l]));

      const sum = { ...empty };
      const centres = rt.stops
        .filter(s => routeOfCentre[String(s.centre)] === rt)
        .map(s => {
          const g = slot.centres[String(s.centre)] || empty;
          for (const k of Object.keys(sum)) sum[k] += g[k] || 0;
          const expected = finalise(g);
          const line = lineOf[String(s.centre)];
          const received = line ? fromReading(line) : null;
          // Tested at main centre but the sub centre's Excel isn't imported yet → wait, don't compare
          const awaiting = !!received && expected.qty <= 0;
          const diff = received && !awaiting ? diffOf(received, expected) : null;
          return {
            centreId: s.centre,
            centreName: s.centreName,
            expected,
            received,
            diff,
            status: awaiting ? AWAITING : diff ? statusOf(diff, tol) : null
          };
        });

      const expected = finalise(sum);
      const received = rc ? fromReading(rc) : null;
      const awaiting = !!received && (
        expected.qty <= 0 || (rc.entryMode === 'Centre' && centres.some(c => c.status === AWAITING))
      );
      const diff = received && !awaiting ? diffOf(received, expected) : null;
      // Van-total trips: centres with no imported milk may just be not imported yet
      const noDataCentres = centres.filter(c => c.expected.qty <= 0).map(c => c.centreName);
      return {
        date: slot.day,
        shift: slot.shift,
        routeId: rt._id,
        routeName: rt.routeName,
        vehicleNumber: rc?.vehicleNumber || rt.vehicleNumber,
        driverName: rc?.driverName || rt.driverName,
        receiptId: rc?._id || null,
        entryMode: rc?.entryMode || null,
        remarks: rc?.remarks || '',
        expected,
        received,
        diff,
        status: !received ? 'Not Received' : awaiting ? AWAITING : statusOf(diff, tol),
        noDataCentres,
        centres
      };
    })
      .filter(r => r.expected.qty > 0 || r.received)
      .sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.routeName.localeCompare(b.routeName));

    // ── Summaries ──────────────────────────────────────────────
    const shortOf = (d) => ({
      qty: d && d.qty < 0 ? -d.qty : 0,
      fatKg: d && d.fatKg < 0 ? -d.fatKg : 0,
      snfKg: d && d.snfKg < 0 ? -d.snfKg : 0
    });

    const byRouteMap = {};
    const byCentreMap = {};
    const totals = { expectedQty: 0, receivedQty: 0, expectedFatKg: 0, receivedFatKg: 0, expectedSnfKg: 0, receivedSnfKg: 0, shortQty: 0, shortFatKg: 0, shortSnfKg: 0, shortageCount: 0, notReceivedCount: 0, awaitingCount: 0 };

    for (const r of rows) {
      const key = String(r.routeId);
      const br = byRouteMap[key] ||= {
        routeName: r.routeName, vehicleNumber: r.vehicleNumber, trips: 0, received: 0,
        expectedQty: 0, receivedQty: 0, shortQty: 0, shortFatKg: 0, shortSnfKg: 0, shortageTrips: 0, notReceived: 0, awaiting: 0
      };
      br.trips += 1;
      if (r.status === 'Not Received') {
        br.notReceived += 1;
        totals.notReceivedCount += 1;
      } else if (r.status === AWAITING) {
        br.awaiting += 1;
        totals.awaitingCount += 1;
      } else {
        // Only compare trips that have a receipt, so missing entries don't look like shortage
        const s = shortOf(r.diff);
        br.received += 1;
        br.expectedQty += r.expected.qty;
        br.receivedQty += r.received.qty;
        br.shortQty += s.qty; br.shortFatKg += s.fatKg; br.shortSnfKg += s.snfKg;
        if (r.status === 'Shortage') { br.shortageTrips += 1; totals.shortageCount += 1; }

        totals.expectedQty += r.expected.qty;
        totals.receivedQty += r.received.qty;
        totals.expectedFatKg += r.expected.fatKg;
        totals.receivedFatKg += r.received.fatKg;
        totals.expectedSnfKg += r.expected.snfKg;
        totals.receivedSnfKg += r.received.snfKg;
        totals.shortQty += s.qty; totals.shortFatKg += s.fatKg; totals.shortSnfKg += s.snfKg;
      }

      for (const c of r.centres) {
        const bc = byCentreMap[String(c.centreId)] ||= {
          centreName: c.centreName, routeName: r.routeName, vehicleNumber: r.vehicleNumber,
          expectedQty: 0, tested: 0, vanTotalOnly: 0, awaiting: 0, shortQty: 0, shortFatKg: 0, shortSnfKg: 0, shortageTrips: 0
        };
        if (c.expected.qty <= 0 && !c.received) continue;
        if (c.status === AWAITING) { bc.awaiting += 1; continue; }
        bc.expectedQty += c.expected.qty;
        if (c.received) {
          const s = shortOf(c.diff);
          bc.tested += 1;
          bc.shortQty += s.qty; bc.shortFatKg += s.fatKg; bc.shortSnfKg += s.snfKg;
          if (c.status === 'Shortage') bc.shortageTrips += 1;
        } else if (r.received) {
          bc.vanTotalOnly += 1;
        }
      }
    }

    const roundObj = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, typeof v === 'number' ? (/Kg$/.test(k) ? r3(v) : r2(v)) : v]));

    res.json({
      success: true,
      data: {
        rows,
        byRoute: Object.values(byRouteMap).map(roundObj),
        byCentre: Object.values(byCentreMap).filter(c => c.expectedQty > 0 || c.tested || c.awaiting).map(roundObj),
        totals: roundObj(totals)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

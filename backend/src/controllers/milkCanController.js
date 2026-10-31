import MilkCan from '../models/MilkCan.js';
import MilkReceipt from '../models/MilkReceipt.js';
import TransportRoute from '../models/TransportRoute.js';
import CollectionCenter from '../models/CollectionCenter.js';
import {
  dayStart, dayEnd, finalise, fromReading, diffOf, statusOf, AWAITING,
  aggregateCollections, cleanReading
} from './milkReceiptController.js';

// ════════════════════════════════════════════════════════════════
//  Milk Purchase → Can No
//
//  Sub centres bring their milk to the main centre in cans; the main
//  centre enters each can by Can No (not Farmer No). A can is NOT a
//  farmer bill — the sub centre's farmers are billed from their own
//  collections (Daily Collection List) — so cans never touch milk
//  purchase totals, producer dues or union send qty.
//
//  The cans of a date + shift become that route's Milk Receipt
//  (Centre mode, source 'Cans'), so Milk Receipt & Shortage compares
//  them with the sub centres' bills without a second entry.
// ════════════════════════════════════════════════════════════════

const r2 = (n) => Number((Number(n) || 0).toFixed(2));

// Each centre belongs to its first active route by name — same rule as the shortage report
const routeOfCentres = async (companyId) => {
  const routes = await TransportRoute.find({ companyId, status: 'Active' }).sort({ routeName: 1 }).lean();
  const map = {};
  for (const rt of routes) for (const s of rt.stops) if (!map[String(s.centre)]) map[String(s.centre)] = rt;
  return map;
};

// Qty-weighted average of cans
const combine = (cans) => {
  const qty = cans.reduce((s, c) => s + (c.qty || 0), 0);
  const w = (k) => (qty ? cans.reduce((s, c) => s + (c.qty || 0) * (c[k] || 0), 0) / qty : 0);
  return { qty: r2(qty), fat: r2(w('fat')), clr: r2(w('clr')), snf: r2(w('snf')) };
};

// Rebuild the route's receipt from its cans. Returns a warning when the cans can't be applied.
const syncRouteReceipt = async (companyId, date, shift, route, routeMap) => {
  const centreIds = route.stops.map(s => String(s.centre)).filter(id => routeMap[id] === route);
  const [cans, existing] = await Promise.all([
    MilkCan.find({ companyId, date: dayStart(date), shift, centre: { $in: centreIds } }).lean(),
    MilkReceipt.findOne({ companyId, date: dayStart(date), shift, routeId: route._id })
  ]);

  if (existing && existing.source !== 'Cans') {
    return cans.length
      ? `A Milk Receipt for route ${route.routeName} (${shift}) was already entered by hand on Milk Receipt & Shortage — delete it there to use these cans`
      : null;
  }
  if (!cans.length) {
    if (existing) await existing.deleteOne();
    return null;
  }

  const nameOf = Object.fromEntries(route.stops.map(s => [String(s.centre), s.centreName]));
  const lines = centreIds
    .map(id => ({ id, cans: cans.filter(c => String(c.centre) === id) }))
    .filter(g => g.cans.length)
    .map(g => ({ centre: g.id, centreName: nameOf[g.id], ...combine(g.cans) }));

  const receipt = existing || new MilkReceipt({
    companyId, date: dayStart(date), shift, routeId: route._id, source: 'Cans'
  });
  receipt.set({
    routeName: route.routeName,
    vehicleNumber: receipt.vehicleNumber || route.vehicleNumber,
    driverName: receipt.driverName || route.driverName,
    entryMode: 'Centre',
    source: 'Cans',
    lines
  });
  await receipt.save(); // pre-save derives the totals from the lines
  return null;
};

// Sync the receipts touched by a can change ({ date, shift, centre } before and after)
const syncCans = async (companyId, slots) => {
  const routeMap = await routeOfCentres(companyId);
  const warnings = [];
  const done = new Set();
  for (const { date, shift, centre } of slots) {
    const route = routeMap[String(centre)];
    if (!route) continue;
    const key = `${dayStart(date).getTime()}|${shift}|${route._id}`;
    if (done.has(key)) continue;
    done.add(key);
    const w = await syncRouteReceipt(companyId, date, shift, route, routeMap);
    if (w) warnings.push(w);
  }
  return warnings;
};

const buildCan = async (body, companyId) => {
  const canNumber = String(body.canNumber || '').trim().toUpperCase();
  if (!canNumber) throw new Error('Enter Can No');
  if (!body.date || !['AM', 'PM'].includes(body.shift)) throw new Error('Date and shift are required');
  const centre = await CollectionCenter.findOne({ _id: body.centre, companyId }).select('centerName').lean();
  if (!centre) throw new Error('Select the Sub Centre this can came from');
  const reading = cleanReading(body);
  if (!(reading.qty > 0)) throw new Error('Enter can qty');
  return {
    date: dayStart(body.date),
    shift: body.shift,
    canNumber,
    centre: centre._id,
    centreName: centre.centerName,
    ...reading,
    remarks: body.remarks
  };
};

// Same can twice in one date + shift (the unique index also enforces this)
const assertNotDuplicate = async (companyId, body, exceptId) => {
  const clash = await MilkCan.exists({
    companyId, date: body.date, shift: body.shift, canNumber: body.canNumber,
    ...(exceptId ? { _id: { $ne: exceptId } } : {})
  });
  if (clash) throw Object.assign(new Error(), { code: 11000 });
};

const dupMessage = (err, body) => (err.code === 11000
  ? `Can ${String(body.canNumber || '').toUpperCase()} is already entered for this date and shift`
  : err.message);

// ════════════════════════════════════════════════════════════════
//  GET /milk-cans?date&shift — cans + sub-centre comparison with bills
// ════════════════════════════════════════════════════════════════
export const getMilkCans = async (req, res) => {
  try {
    const { date, shift } = req.query;
    if (!date || !shift) return res.status(400).json({ success: false, message: 'date and shift are required' });

    const cans = await MilkCan.find({ companyId: req.companyId, date: dayStart(date), shift })
      .sort({ createdAt: 1 }).lean();

    const centreIds = [...new Set(cans.map(c => String(c.centre)))];
    const [groups, routeMap] = await Promise.all([
      centreIds.length ? aggregateCollections(req.companyId, dayStart(date), dayEnd(date), centreIds, shift) : [],
      routeOfCentres(req.companyId)
    ]);
    const billsOf = Object.fromEntries(groups.map(g => [String(g._id.centre), g]));

    const manualReceipts = await MilkReceipt.find({
      companyId: req.companyId, date: dayStart(date), shift, source: { $ne: 'Cans' }
    }).select('routeId').lean();
    const manualRoute = new Set(manualReceipts.map(r => String(r.routeId)));

    const empty = { qty: 0, fatQty: 0, snfQty: 0, clrQty: 0, farmers: 0 };
    const centres = centreIds.map(id => {
      const own = cans.filter(c => String(c.centre) === id);
      const received = fromReading(combine(own));
      const expected = finalise(billsOf[id] || empty);
      const awaiting = expected.qty <= 0;
      const diff = awaiting ? null : diffOf(received, expected);
      const route = routeMap[id];
      return {
        centreId: id,
        centreName: own[0].centreName,
        cans: own.length,
        received,
        expected,
        diff,
        status: awaiting ? AWAITING : statusOf(diff, { qty: 0, kg: 0 }),
        routeName: route?.routeName || null,
        // Not shown in Milk Receipt & Shortage: no route, or a hand-entered receipt wins
        note: !route
          ? 'Not on any Transport route'
          : manualRoute.has(String(route._id)) ? 'Hand-entered Milk Receipt exists for this route' : null
      };
    }).sort((a, b) => a.centreName.localeCompare(b.centreName));

    res.json({
      success: true,
      data: {
        cans: cans.map(c => {
          const { fatKg, snfKg } = fromReading(c);
          return { ...c, fatKg, snfKg };
        }),
        centres,
        total: fromReading(combine(cans))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /milk-cans/lookup?canNumber — the sub centre this can last came from
export const lookupCan = async (req, res) => {
  try {
    const canNumber = String(req.query.canNumber || '').trim().toUpperCase();
    if (!canNumber) return res.json({ success: true, data: null });
    const last = await MilkCan.findOne({ companyId: req.companyId, canNumber })
      .sort({ date: -1, createdAt: -1 }).select('centre centreName').lean();
    res.json({ success: true, data: last ? { centre: last.centre, centreName: last.centreName } : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMilkCan = async (req, res) => {
  try {
    const body = await buildCan(req.body, req.companyId);
    await assertNotDuplicate(req.companyId, body);
    const can = await MilkCan.create({ ...body, companyId: req.companyId, createdBy: req.user?._id });
    const warnings = await syncCans(req.companyId, [can]);
    res.status(201).json({ success: true, data: can, warnings, message: `Can ${can.canNumber} saved` });
  } catch (err) {
    res.status(400).json({ success: false, message: dupMessage(err, req.body) });
  }
};

export const updateMilkCan = async (req, res) => {
  try {
    const can = await MilkCan.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!can) return res.status(404).json({ success: false, message: 'Can entry not found' });
    const before = { date: can.date, shift: can.shift, centre: can.centre };
    const body = await buildCan(req.body, req.companyId);
    await assertNotDuplicate(req.companyId, body, can._id);
    can.set(body);
    await can.save();
    const warnings = await syncCans(req.companyId, [before, can]);
    res.json({ success: true, data: can, warnings, message: `Can ${can.canNumber} updated` });
  } catch (err) {
    res.status(400).json({ success: false, message: dupMessage(err, req.body) });
  }
};

export const deleteMilkCan = async (req, res) => {
  try {
    const can = await MilkCan.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!can) return res.status(404).json({ success: false, message: 'Can entry not found' });
    await syncCans(req.companyId, [can]);
    res.json({ success: true, message: `Can ${can.canNumber} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

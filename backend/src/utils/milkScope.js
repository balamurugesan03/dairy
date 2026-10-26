import mongoose from 'mongoose';
import Agent from '../models/Agent.js';
import Farmer from '../models/Farmer.js';
import CollectionCenter from '../models/CollectionCenter.js';
import MilkCollection from '../models/MilkCollection.js';
import MilkSales from '../models/MilkSales.js';

const toId = (v) => {
  if (!v) return null;
  const raw = v._id ?? v;
  try { return new mongoose.Types.ObjectId(raw.toString()); } catch { return null; }
};

// ── Centre / Agent assignment for imported records ────────────────────────────
// Zibitt / LinZA / OpenLyssa / Dairysoft imports carry no centre or agent, so
// the centre-filtered Milk Purchase grid never showed them. Fill the gaps from
// the admin's own configuration, in this order — never an arbitrary pick:
//   centre ← record's agent's centre → farmer's assigned centre → the Head Office
//            (only when exactly one exists, or the company has a single centre)
//   agent  ← the only active agent of that centre (left empty when there are several)
const lastHeal = new Map(); // companyId → ms; keeps the read paths cheap
const HEAL_EVERY_MS = 60 * 1000;

export async function healMilkAssignments(companyId, { force = false } = {}) {
  const cid = toId(companyId);
  if (!cid) return;
  const key = cid.toString();
  if (!force && Date.now() - (lastHeal.get(key) || 0) < HEAL_EVERY_MS) return;
  lastHeal.set(key, Date.now());

  try {
    const [mcGap, msGap] = await Promise.all([
      MilkCollection.exists({ companyId: cid, $or: [{ collectionCenter: null }, { agent: null }] }),
      MilkSales.exists({ companyId: cid, $or: [{ centerId: null }, { agentId: null }] }),
    ]);
    if (!mcGap && !msGap) return;

    const [centres, agents] = await Promise.all([
      CollectionCenter.find({ companyId: cid }).select('centerName centerType status').lean(),
      Agent.find({ companyId: cid }).select('agentName collectionCenterId status').lean(),
    ]);
    const centreName = new Map(centres.map(c => [c._id.toString(), c.centerName]));
    const headOffices = centres.filter(c => c.centerType === 'Head Office');
    const fallbackCentre = headOffices.length === 1 ? headOffices[0]._id
      : centres.length === 1 ? centres[0]._id : null;

    // Agents per centre, and the sole active agent of each centre
    const agentsByCentre = new Map();
    for (const a of agents) {
      const c = a.collectionCenterId?.toString();
      if (!c) continue;
      if (!agentsByCentre.has(c)) agentsByCentre.set(c, []);
      agentsByCentre.get(c).push(a);
    }
    const soleAgent = new Map();
    for (const [c, list] of agentsByCentre) {
      const active = list.filter(a => (a.status || 'Active').toLowerCase() === 'active');
      if (active.length === 1) soleAgent.set(c, active[0]);
    }

    // ── Milk Purchase (MilkCollection) ──
    if (mcGap) {
      for (const [c, list] of agentsByCentre) {
        await MilkCollection.updateMany(
          { companyId: cid, collectionCenter: null, agent: { $in: list.map(a => a._id) } },
          { $set: { collectionCenter: new mongoose.Types.ObjectId(c) } },
        );
      }
      const farmers = await Farmer.find({ companyId: cid, collectionCenter: { $ne: null } }).select('collectionCenter').lean();
      const farmersByCentre = new Map();
      for (const f of farmers) {
        const c = f.collectionCenter.toString();
        if (!farmersByCentre.has(c)) farmersByCentre.set(c, []);
        farmersByCentre.get(c).push(f._id);
      }
      for (const [c, ids] of farmersByCentre) {
        await MilkCollection.updateMany(
          { companyId: cid, collectionCenter: null, farmer: { $in: ids } },
          { $set: { collectionCenter: new mongoose.Types.ObjectId(c) } },
        );
      }
      if (fallbackCentre) {
        await MilkCollection.updateMany({ companyId: cid, collectionCenter: null }, { $set: { collectionCenter: fallbackCentre } });
      }
      for (const [c, a] of soleAgent) {
        await MilkCollection.updateMany(
          { companyId: cid, collectionCenter: new mongoose.Types.ObjectId(c), agent: null },
          { $set: { agent: a._id } },
        );
      }
    }

    // ── Milk Sales ──
    if (msGap) {
      for (const [c, list] of agentsByCentre) {
        await MilkSales.updateMany(
          { companyId: cid, centerId: null, agentId: { $in: list.map(a => a._id) } },
          { $set: { centerId: new mongoose.Types.ObjectId(c), centerName: centreName.get(c) || '' } },
        );
      }
      if (fallbackCentre) {
        await MilkSales.updateMany(
          { companyId: cid, centerId: null },
          { $set: { centerId: fallbackCentre, centerName: centreName.get(fallbackCentre.toString()) || '' } },
        );
      }
      for (const [c, a] of soleAgent) {
        await MilkSales.updateMany(
          { companyId: cid, centerId: new mongoose.Types.ObjectId(c), agentId: null },
          { $set: { agentId: a._id, agentName: a.agentName || '' } },
        );
      }
    }
  } catch (err) {
    console.warn('[milkScope] assignment heal failed (non-fatal):', err.message);
  }
}

// Call after an import so the new rows are assigned before the next read.
export const healAfterImport = (companyId) => healMilkAssignments(companyId, { force: true });

// ── Login scope ───────────────────────────────────────────────────────────────
// Company / centre logins and admin users see everything in the company.
// A regular staff user sees their own agent's and centre's records — imported
// rows included — plus anything they entered themselves.
// Returns a condition to AND into the query, or null for unrestricted.

// Admin = admin-role account, or a User Management user of type Admin / Superuser.
// Their own centre / agent is only the default selection, not a restriction.
export const ADMIN_USER_TYPES = ['admin', 'superuser'];
export const isAdminUser = (u = {}) =>
  u.role === 'admin' || u.role === 'superadmin' || ADMIN_USER_TYPES.includes(u.userType);

export async function staffScope(req, { centreField, agentField }) {
  if (req.userType !== 'user') return null;
  const u = req.user || {};
  if (isAdminUser(u)) return null;

  const or = [{ createdBy: u._id }];
  const agentId = toId(u.agentId);
  let centreId = toId(u.collectionCenter);
  if (agentId) {
    if (!centreId) {
      const a = await Agent.findById(agentId).select('collectionCenterId').lean();
      centreId = toId(a?.collectionCenterId);
    }
    or.push({ [agentField]: agentId });
    // Rows of their centre not tied to any agent (e.g. imports)
    if (centreId) or.push({ [centreField]: centreId, [agentField]: null });
  } else if (centreId) {
    or.push({ [centreField]: centreId });
  }
  return { $or: or };
}

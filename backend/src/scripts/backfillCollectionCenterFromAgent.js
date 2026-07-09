import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MilkCollection from '../models/MilkCollection.js';
import MilkSales from '../models/MilkSales.js';
import Agent from '../models/Agent.js';
import CollectionCenter from '../models/CollectionCenter.js';

dotenv.config();

// One-time backfill: mobile-app milk purchase/sales entries are submitted
// agent-wise and historically didn't carry collectionCenter/centerId, so
// they were invisible whenever a specific Center was selected (only
// "All Centers" showed them). This derives the missing center from each
// record's agent (Agent.collectionCenterId) and fills it in. Safe to re-run.
async function backfill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const agents = await Agent.find({}, 'collectionCenterId').lean();
    const agentCenterMap = new Map(agents.map(a => [String(a._id), a.collectionCenterId]));

    const centers = await CollectionCenter.find({}, 'centerName').lean();
    const centerNameMap = new Map(centers.map(c => [String(c._id), c.centerName]));

    // ── MilkCollection ──────────────────────────────────────────────────────
    const collections = await MilkCollection.find(
      { agent: { $exists: true, $ne: null }, $or: [{ collectionCenter: { $exists: false } }, { collectionCenter: null }] },
      '_id agent'
    ).lean();

    let mcUpdated = 0;
    for (const rec of collections) {
      const centerId = agentCenterMap.get(String(rec.agent));
      if (!centerId) continue;
      await MilkCollection.updateOne({ _id: rec._id }, { $set: { collectionCenter: centerId } });
      mcUpdated++;
    }
    console.log(`✓ MilkCollection: backfilled collectionCenter for ${mcUpdated}/${collections.length} agent-linked record(s)`);

    // ── MilkSales ────────────────────────────────────────────────────────────
    const sales = await MilkSales.find(
      { agentId: { $exists: true, $ne: null }, $or: [{ centerId: { $exists: false } }, { centerId: null }] },
      '_id agentId centerName'
    ).lean();

    let msUpdated = 0;
    for (const rec of sales) {
      const centerId = agentCenterMap.get(String(rec.agentId));
      if (!centerId) continue;
      const update = { centerId };
      if (!rec.centerName) update.centerName = centerNameMap.get(String(centerId)) || undefined;
      await MilkSales.updateOne({ _id: rec._id }, { $set: update });
      msUpdated++;
    }
    console.log(`✓ MilkSales: backfilled centerId for ${msUpdated}/${sales.length} agent-linked record(s)`);

    process.exit(0);
  } catch (error) {
    console.error('Error backfilling collection center from agent:', error);
    process.exit(1);
  }
}

backfill();

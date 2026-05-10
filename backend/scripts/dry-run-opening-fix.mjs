// Dry-run: show what the opening-balance migration WOULD change.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const coll = mongoose.connection.collection('paymentregisters');

const ledgers = await coll.find({ registerType: 'Ledger' }).sort({ companyId: 1, fromDate: 1 }).toArray();
const byCo = new Map();
for (const r of ledgers) {
  const k = String(r.companyId);
  if (!byCo.has(k)) byCo.set(k, []);
  byCo.get(k).push(r);
}

const targetCo = '69db29286b5851d0478bb464';
const regs = byCo.get(targetCo);
console.log(`Target company: ${targetCo}, ${regs?.length} registers`);
if (regs) {
  for (const [i, r] of regs.entries()) {
    console.log(`  [${i}] ${r.fromDate.toISOString().slice(0,10)} → ${r.toDate.toISOString().slice(0,10)} entries=${r.entries?.length || 0}`);
    for (const e of (r.entries || [])) {
      console.log(`      farmer=${e.farmerId} cfAdv=${e.cfAdv} cfRec=${e.cfRec}`);
    }
  }
}

console.log('\n=== Migration trace for target company ===');
for (let i = 1; i < (regs?.length || 0); i++) {
  const prev = regs[i - 1];
  const curr = regs[i];
  console.log(`\ni=${i}: prev period=${prev.fromDate.toISOString().slice(0,10)}→${prev.toDate.toISOString().slice(0,10)}, curr period=${curr.fromDate.toISOString().slice(0,10)}→${curr.toDate.toISOString().slice(0,10)}`);
  const carryMap = {};
  (prev.entries || []).forEach(e => {
    const fid = e.farmerId?.toString();
    if (!fid) return;
    carryMap[fid] = {
      cfAdv:   Math.max(0, (e.cfAdv   || 0) - (e.cfRec   || 0)),
    };
  });
  console.log(`  carryMap:`, carryMap);
  for (const e of (curr.entries || [])) {
    const fid = e.farmerId?.toString();
    const carry = fid ? carryMap[fid] : null;
    const cfNew = carry ? carry.cfAdv : 0;
    const cfCurr = e.cfAdv ?? 0;
    console.log(`  farmer=${fid} curr.cfAdv=${cfCurr} (typeof ${typeof e.cfAdv}) computed=${cfNew} diff=${cfCurr !== cfNew}`);
  }
}

await mongoose.disconnect();

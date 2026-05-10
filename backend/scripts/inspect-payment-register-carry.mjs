// Diagnose: trace one farmer's CF/Cash/Loan across consecutive cycles to see
// if carry-forward is happening.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const coll = mongoose.connection.collection('paymentregisters');

// Find companies with ≥2 Ledger registers in adjacent periods
const all = await coll.find({ registerType: 'Ledger' }).sort({ companyId: 1, fromDate: 1 }).toArray();
const byCo = {};
for (const r of all) {
  const k = String(r.companyId);
  (byCo[k] ||= []).push(r);
}

for (const [coId, regs] of Object.entries(byCo)) {
  if (regs.length < 2) continue;
  console.log(`\n=== Company ${coId} ===`);
  // For each pair of consecutive cycles, trace the same farmer
  for (let i = 0; i < regs.length - 1; i++) {
    const prev = regs[i], next = regs[i+1];
    console.log(`Cycle ${i+1}: ${prev.fromDate?.toISOString().slice(0,10)} → ${prev.toDate?.toISOString().slice(0,10)}`);
    console.log(`Cycle ${i+2}: ${next.fromDate?.toISOString().slice(0,10)} → ${next.toDate?.toISOString().slice(0,10)}`);
    const prevByFid = {};
    (prev.entries || []).forEach(e => { if (e.farmerId) prevByFid[String(e.farmerId)] = e; });
    for (const e of (next.entries || [])) {
      const fid = String(e.farmerId);
      const p = prevByFid[fid];
      const carryCF   = p ? Math.max(0, (p.cfAdv   || 0) - (p.cfRec   || 0)) : null;
      const carryCash = p ? Math.max(0, (p.cashAdv || 0) - (p.cashRec || 0)) : null;
      const carryLoan = p ? Math.max(0, (p.loanAdv || 0) - (p.loanRec || 0)) : null;
      const okCF   = carryCF   == null ? '—'  : (carryCF   === (e.cfAdv   || 0) ? '✓' : '✗');
      const okCash = carryCash == null ? '—'  : (carryCash === (e.cashAdv || 0) ? '✓' : '✗');
      const okLoan = carryLoan == null ? '—'  : (carryLoan === (e.loanAdv || 0) ? '✓' : '✗');
      console.log(`  farmer=${fid}`);
      console.log(`    prev: cfAdv=${p?.cfAdv||0} cfRec=${p?.cfRec||0}  cashAdv=${p?.cashAdv||0} cashRec=${p?.cashRec||0}  loanAdv=${p?.loanAdv||0} loanRec=${p?.loanRec||0}`);
      console.log(`    next: cfAdv=${e.cfAdv||0} ${okCF} expected ${carryCF}  |  cashAdv=${e.cashAdv||0} ${okCash} expected ${carryCash}  |  loanAdv=${e.loanAdv||0} ${okLoan} expected ${carryLoan}`);
    }
  }
}

await mongoose.disconnect();

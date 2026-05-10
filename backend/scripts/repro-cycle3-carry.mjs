// Repro the backend's lastRegister + carry logic for cycle 3 (May 1-15)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const coll = mongoose.connection.collection('paymentregisters');

const companyId = new mongoose.Types.ObjectId('69db29286b5851d0478bb464');
const farmerTarget = '69db29d66b5851d0478bb56f';

// Simulate cycle 3 generate: fromDate='2026-05-01', toDate='2026-05-15'
const start = new Date('2026-05-01');
const end   = new Date('2026-05-15'); end.setHours(23, 59, 59, 999);

console.log(`start=${start.toISOString()}`);
console.log(`end=${end.toISOString()}`);

// EXACT same query the controller runs
const lastRegister = await coll.findOne(
  { companyId, registerType: 'Ledger', toDate: { $lt: start } },
  { sort: { toDate: -1 } }
);

console.log(`\nlastRegister found: ${!!lastRegister}`);
if (lastRegister) {
  console.log(`  type=${lastRegister.registerType} period=${lastRegister.fromDate.toISOString().slice(0,10)} → ${lastRegister.toDate.toISOString().slice(0,10)}`);
  for (const e of lastRegister.entries) {
    if (String(e.farmerId) === farmerTarget) {
      console.log(`  TARGET FARMER: cfAdv=${e.cfAdv} cfRec=${e.cfRec}  cashAdv=${e.cashAdv} cashRec=${e.cashRec}  loanAdv=${e.loanAdv} loanRec=${e.loanRec}`);
      console.log(`  carry would be: cfAdv=${Math.max(0, (e.cfAdv||0) - (e.cfRec||0))}  cashAdv=${Math.max(0, (e.cashAdv||0) - (e.cashRec||0))}  loanAdv=${Math.max(0, (e.loanAdv||0) - (e.loanRec||0))}`);
    }
  }
}

await mongoose.disconnect();

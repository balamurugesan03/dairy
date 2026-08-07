import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProducerOpening from '../models/ProducerOpening.js';
import Ledger from '../models/Ledger.js';
import { findOrCreateLedger } from '../utils/accountingHelper.js';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────
// One-time data fix for the "Producer Openings → dueAmount" bug.
//
// Root cause (fixed in accountingHelper.js's applyProducerOpeningLedgers):
// every Producer Opening's "Producers Due Amount" was being posted onto that
// individual farmer's own auto-created Party ledger (linkedEntity) instead
// of the single shared PRODUCERS DUES ledger. Under the old buggy math, a
// farmer's Party ledger that has ONLY ever been touched by this bug ends up
// holding exactly:
//     openingBalance === -dueAmount   (negative!)
//     openingBalanceType === 'Dr'
//     currentBalance === -dueAmount
//     balanceType === 'Dr'
// (same for currentBalance/balanceType). This script:
//   1. Finds every ProducerOpening with dueAmount > 0
//   2. Finds that farmer's linked Party ledger
//   3. Verifies its balance still matches the exact corruption pattern above
//      (skips + logs anything that doesn't match, e.g. a farmer ledger that
//      was also used for something else — never touches those)
//   4. Resets that farmer ledger back to its clean default (0 / Dr)
//   5. Adds dueAmount onto the shared PRODUCERS DUES ledger (Cr-normal)
//
// DRY RUN BY DEFAULT — prints exactly what it would change, writes nothing.
// Usage:
//   node migrateProducerDuesLedger.js                     # dry run, all companies
//   COMPANY_ID=<id> node migrateProducerDuesLedger.js      # dry run, one company
//   APPLY=true node migrateProducerDuesLedger.js           # apply, all companies
//   APPLY=true COMPANY_ID=<id> node migrateProducerDuesLedger.js
// ─────────────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const APPLY = process.env.APPLY === 'true';
const COMPANY_ID = process.env.COMPANY_ID || null;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB. Mode: ${APPLY ? 'APPLY (will write changes)' : 'DRY RUN (no writes)'}`);
  if (COMPANY_ID) console.log(`Scoped to companyId: ${COMPANY_ID}`);

  const filter = { dueAmount: { $gt: 0 } };
  if (COMPANY_ID) filter.companyId = new mongoose.Types.ObjectId(COMPANY_ID);

  const openings = await ProducerOpening.find(filter).lean();
  console.log(`Found ${openings.length} Producer Opening record(s) with a due amount > 0.\n`);

  let fixed = 0, skippedNoLedger = 0, skippedMismatch = 0, totalDueMoved = 0;
  const byCompany = {}; // companyId -> total dueAmount to add to PRODUCERS DUES

  for (const opening of openings) {
    const { companyId, farmerId, dueAmount, producerName, producerNumber } = opening;
    const dueAmt = round2(dueAmount);

    const farmerLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Farmer',
      'linkedEntity.entityId': farmerId,
      companyId,
    });

    if (!farmerLedger) {
      console.log(`SKIP (no linked ledger): ${producerNumber} ${producerName} — due ₹${dueAmt}`);
      skippedNoLedger++;
      continue;
    }

    const matchesCorruption =
      farmerLedger.openingBalanceType === 'Dr' &&
      farmerLedger.balanceType === 'Dr' &&
      Math.abs((farmerLedger.openingBalance || 0) - (-dueAmt)) < 0.01 &&
      Math.abs((farmerLedger.currentBalance || 0) - (-dueAmt)) < 0.01;

    if (!matchesCorruption) {
      console.log(
        `SKIP (balance doesn't match expected corruption — needs manual review): ` +
        `${producerNumber} ${producerName} — due ₹${dueAmt}, ledger "${farmerLedger.ledgerName}" ` +
        `has openingBalance=${farmerLedger.openingBalance} (${farmerLedger.openingBalanceType}), ` +
        `currentBalance=${farmerLedger.currentBalance} (${farmerLedger.balanceType})`
      );
      skippedMismatch++;
      continue;
    }

    console.log(`FIX: ${producerNumber} ${producerName} — due ₹${dueAmt} moves from "${farmerLedger.ledgerName}" to PRODUCERS DUES`);
    fixed++;
    totalDueMoved += dueAmt;
    byCompany[companyId.toString()] = (byCompany[companyId.toString()] || 0) + dueAmt;

    if (APPLY) {
      farmerLedger.openingBalance = 0;
      farmerLedger.openingBalanceType = 'Dr';
      farmerLedger.currentBalance = 0;
      farmerLedger.balanceType = 'Dr';
      await farmerLedger.save();
    }
  }

  console.log(`\n${fixed} farmer ledger(s) to correct, ${skippedNoLedger} with no linked ledger, ${skippedMismatch} skipped for manual review.`);
  console.log(`Total due amount to move onto PRODUCERS DUES: ₹${round2(totalDueMoved)}`);

  if (fixed > 0) {
    console.log('\nPer-company PRODUCERS DUES adjustment:');
    for (const [cid, amt] of Object.entries(byCompany)) {
      console.log(`  companyId ${cid}: +₹${round2(amt)}`);
      if (APPLY) {
        const producersDuesLedger = await findOrCreateLedger(
          'PRODUCERS DUES', 'Other Payable', 'LIABILITY', 'Cr', cid, null
        );
        const normalType = 'Cr', oppositeType = 'Dr';
        const toSigned = (v, t) => (t === oppositeType ? -v : v);
        const signed = toSigned(producersDuesLedger.openingBalance || 0, producersDuesLedger.openingBalanceType || normalType) + amt;
        const currentSigned = toSigned(producersDuesLedger.currentBalance || 0, producersDuesLedger.balanceType || normalType) + amt;
        producersDuesLedger.openingBalance = Math.abs(signed);
        producersDuesLedger.openingBalanceType = signed >= 0 ? normalType : oppositeType;
        producersDuesLedger.currentBalance = Math.abs(currentSigned);
        producersDuesLedger.balanceType = currentSigned >= 0 ? normalType : oppositeType;
        await producersDuesLedger.save();
      }
    }
  }

  if (!APPLY) {
    console.log('\nThis was a DRY RUN — nothing was written. Re-run with APPLY=true to commit these changes.');
  } else {
    console.log('\nChanges applied.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

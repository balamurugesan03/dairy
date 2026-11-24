// READ-ONLY diagnostic: shows exactly which rows Cash Book Entry and
// Adjustment Entry get for one date, and where each row comes from.
//
//   node src/scripts/diagnoseBooks.js 2025-10-10
//
// Changes nothing in the database.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Voucher from '../models/Voucher.js';
import Company from '../models/Company.js';
import '../models/Ledger.js';
import '../models/Farmer.js';
import { getCashAdvanceVoucherRows } from '../utils/cashAdvanceVoucherRows.js';
import { tagVoucher } from '../utils/voucherSource.js';
import { getCashBankLedgerIds } from '../utils/cashAdjustmentClassifier.js';

dotenv.config();

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.log('Usage: node src/scripts/diagnoseBooks.js YYYY-MM-DD');
  process.exit(1);
}
const start = new Date(`${date}T00:00:00.000Z`);
const end = new Date(`${date}T23:59:59.999Z`);

await mongoose.connect(process.env.MONGODB_URI);

const companies = await Company.find().select('_id companyName').lean();
for (const c of companies) {
  const ids = await getCashBankLedgerIds(c._id);
  const stored = await Voucher.find({
    companyId: c._id, status: { $ne: 'Cancelled' },
    voucherDate: { $gte: start, $lte: end }
  }).populate('entries.ledgerId', 'ledgerName ledgerType').lean();
  const virtual = await getCashAdvanceVoucherRows(c._id, { startDate: date, endDate: date });
  const rows = [...stored, ...virtual].map(v => tagVoucher(v, ids));
  if (!rows.length) continue;

  console.log(`\n=== ${c.companyName} (${c._id}) — ${date} ===`);
  for (const v of rows) {
    const legs = (v.entries || []).map(e =>
      `${e.ledgerName || e.ledgerId?.ledgerName} [${e.ledgerId?.ledgerType || '?'}] Dr ${e.debitAmount || 0} Cr ${e.creditAmount || 0}`
    ).join(' | ');
    console.log([
      `BOOK=${v.book.toUpperCase()}`, `mode=${v.mode}`, `src=${v.entrySource}`,
      `${v.voucherType} ${v.voucherNumber}`, `ref=${v.referenceType || '-'}:${v.referenceId || '-'}`,
      `"${v.narration || ''}"`
    ].join('  '));
    console.log(`    ${legs}`);
  }
}

await mongoose.disconnect();

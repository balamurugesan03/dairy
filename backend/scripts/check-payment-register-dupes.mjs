// One-shot check: report any remaining PaymentRegister duplicates
// (same companyId + registerType + fromDate-day + toDate-day).
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI missing'); process.exit(1); }

await mongoose.connect(uri);
const coll = mongoose.connection.collection('paymentregisters');

const total = await coll.countDocuments({});
const dups = await coll.aggregate([
  {
    $group: {
      _id: {
        companyId: '$companyId',
        registerType: '$registerType',
        fromDay: { $dateToString: { format: '%Y-%m-%d', date: '$fromDate' } },
        toDay:   { $dateToString: { format: '%Y-%m-%d', date: '$toDate' } },
      },
      ids: { $push: '$_id' },
      count: { $sum: 1 },
    },
  },
  { $match: { count: { $gt: 1 } } },
]).toArray();

console.log(`Total PaymentRegister rows: ${total}`);
console.log(`Duplicate groups: ${dups.length}`);
if (dups.length > 0) {
  for (const g of dups) {
    console.log(`  ${g._id.registerType} ${g._id.fromDay}→${g._id.toDay} company=${g._id.companyId}: ${g.count} rows`);
  }
}

await mongoose.disconnect();

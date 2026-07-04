import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import dotenv from 'dotenv';

dotenv.config();

// One-time backfill: existing members activated before memberId was recorded
// at activation time never got a Member ID saved. Their current farmerNumber
// is the number that was assigned to them at activation, so use that.
async function backfillMemberId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const farmers = await Farmer.find(
      {
        isMembership: true,
        $or: [{ memberId: { $exists: false } }, { memberId: null }, { memberId: '' }]
      },
      'farmerNumber'
    );

    for (const farmer of farmers) {
      await Farmer.updateOne({ _id: farmer._id }, { $set: { memberId: farmer.farmerNumber } });
    }

    console.log(`✓ Backfilled memberId for ${farmers.length} member(s)`);
    process.exit(0);
  } catch (error) {
    console.error('Error backfilling memberId:', error);
    process.exit(1);
  }
}

backfillMemberId();

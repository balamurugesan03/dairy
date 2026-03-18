import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Atomically get the next sequence number for a given key.
 * Seeds from seedValue on first use (only applied on insert via $setOnInsert).
 * Safe under concurrent access — no race conditions.
 */
export const getNextSequence = async (key, seedValue = 0) => {
  // Ensure counter document exists. $setOnInsert only fires on initial insert,
  // so concurrent calls all resolve safely — one inserts, rest are no-ops.
  await Counter.updateOne(
    { _id: key },
    { $setOnInsert: { seq: seedValue } },
    { upsert: true }
  );
  // Atomic increment — always returns a unique value
  const result = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true }
  );
  return result.seq;
};

export default Counter;

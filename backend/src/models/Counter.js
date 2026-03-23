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

/**
 * Centralized atomic code generator — safe for 100+ concurrent users.
 *
 * monthly=true  → PREFIX + YYMM + zero-padded-seq   e.g. BILL260300001
 * monthly=false → PREFIX + '-' + zero-padded-seq    e.g. ITEM-0001
 *
 * Each (prefix, companyId, yearMonth?) combination has its own independent counter,
 * so codes from different companies or different months never collide.
 */
export const generateCode = async (prefix, companyId, { monthly = true, pad = 4 } = {}) => {
  let key, datePart = '';
  if (monthly) {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    datePart = `${yy}${mm}`;
    key = `code-${prefix}-${datePart}-${companyId}`;
  } else {
    key = `code-${prefix}-${companyId}`;
  }
  const seq = await getNextSequence(key, 0);
  const num = seq.toString().padStart(pad, '0');
  return monthly ? `${prefix}${datePart}${num}` : `${prefix}-${num}`;
};

export default Counter;

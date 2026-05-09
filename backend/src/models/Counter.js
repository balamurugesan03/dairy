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

/**
 * Save a Mongoose doc that auto-generates a unique sequential code (via the
 * pre-save hook calling `generateCode`). Retries on duplicate-key collisions
 * — the atomic counter increments on each retry, so the next attempt always
 * gets a strictly higher seq. On the 3rd attempt, force-resync the counter to
 * MAX(existing) for the current month so a stale counter (post DB restore /
 * manual seed / out-of-band insert) catches up in one shot.
 *
 *   Model       — the Mongoose model (e.g. BankTransfer, ProducerPayment)
 *   companyId   — used to scope the counter key
 *   prefix      — code prefix (e.g. 'BT', 'PTP'); must match the prefix passed
 *                 to generateCode in the model's pre-save hook
 *   numberField — the unique field on the model (e.g. 'transferNumber')
 *   build       — factory that returns a fresh model instance with the unique
 *                 number field LEFT UNSET so the pre-save hook fills it on
 *                 every retry
 */
export const saveWithUniqueNumber = async ({ Model, companyId, prefix, numberField, build }) => {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const doc = build();
      await doc.save();
      return doc;
    } catch (err) {
      lastErr = err;
      const isDup = err?.code === 11000 && (
        err?.keyPattern?.[numberField] ||
        new RegExp(numberField, 'i').test(err?.message || '')
      );
      if (!isDup) throw err;
      if (attempt === 3) {
        try {
          const now = new Date();
          const yy = now.getFullYear().toString().slice(-2);
          const mm = (now.getMonth() + 1).toString().padStart(2, '0');
          const codePrefix = `${prefix}${yy}${mm}`;
          const latest = await Model.findOne({
            [numberField]: { $regex: `^${codePrefix}` },
            companyId,
          })
            .sort({ [numberField]: -1 })
            .select(numberField)
            .lean();
          if (latest?.[numberField]) {
            const maxSeq = parseInt(latest[numberField].replace(codePrefix, ''), 10) || 0;
            await Counter.updateOne(
              { _id: `code-${prefix}-${yy}${mm}-${companyId}` },
              { $set: { seq: maxSeq } },
              { upsert: true }
            );
          }
        } catch (resyncErr) {
          console.warn(`${prefix} counter resync failed:`, resyncErr.message);
        }
      }
    }
  }
  throw lastErr;
};

export default Counter;

import MilkCollection from '../models/MilkCollection.js';
import Farmer from '../models/Farmer.js';

const ELIGIBLE_QTY_THRESHOLD = 500; // liters
const ELIGIBLE_TENURE_DAYS = 180;

// Recomputes a single farmer's membership-eligibility snapshot from their MilkCollection
// history. Whichever condition (500L total or 180 days tenure) is met earliest wins.
export async function recomputeFarmerEligibility(farmerId, companyId) {
  if (!farmerId || !companyId) return;

  const farmer = await Farmer.findOne({ _id: farmerId, companyId });
  if (!farmer || farmer.isMembership) return; // already a member, nothing to flag

  const records = await MilkCollection.find(
    { farmer: farmerId, companyId },
    { qty: 1, date: 1 }
  ).sort({ date: 1 }).lean();

  if (!records.length) {
    farmer.eligibility = {
      totalQtySupplied: 0,
      firstCollectionDate: undefined,
      isEligible: false,
      eligibleSince: undefined,
      eligibleReason: undefined
    };
    await farmer.save();
    return;
  }

  const firstCollectionDate = records[0].date;
  let cumulative = 0;
  let quantityCrossingDate = null;
  for (const rec of records) {
    cumulative += rec.qty || 0;
    if (quantityCrossingDate === null && cumulative >= ELIGIBLE_QTY_THRESHOLD) {
      quantityCrossingDate = rec.date;
    }
  }

  const tenureEligibleDate = new Date(firstCollectionDate);
  tenureEligibleDate.setDate(tenureEligibleDate.getDate() + ELIGIBLE_TENURE_DAYS);
  const tenureEligibleNow = tenureEligibleDate <= new Date();

  let isEligible = false;
  let eligibleSince = null;
  let eligibleReason = null;

  if (quantityCrossingDate && tenureEligibleNow) {
    // Both conditions are already met — credit whichever happened first chronologically.
    if (quantityCrossingDate <= tenureEligibleDate) {
      isEligible = true; eligibleSince = quantityCrossingDate; eligibleReason = 'Quantity';
    } else {
      isEligible = true; eligibleSince = tenureEligibleDate; eligibleReason = 'Tenure';
    }
  } else if (quantityCrossingDate) {
    isEligible = true; eligibleSince = quantityCrossingDate; eligibleReason = 'Quantity';
  } else if (tenureEligibleNow) {
    isEligible = true; eligibleSince = tenureEligibleDate; eligibleReason = 'Tenure';
  }

  farmer.eligibility = {
    totalQtySupplied: cumulative,
    firstCollectionDate,
    isEligible,
    eligibleSince: eligibleSince || undefined,
    eligibleReason: eligibleReason || undefined
  };
  await farmer.save();
}

// Batch helper for bulk-import endpoints — recomputes eligibility for a de-duplicated
// set of farmer IDs touched by the import, best-effort per farmer.
export async function recomputeFarmersEligibility(farmerIds, companyId) {
  const uniqueIds = [...new Set((farmerIds || []).filter(Boolean).map(String))];
  for (const id of uniqueIds) {
    try {
      await recomputeFarmerEligibility(id, companyId);
    } catch (err) {
      console.error(`Eligibility recompute failed for farmer ${id}:`, err.message);
    }
  }
}

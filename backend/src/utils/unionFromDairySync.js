import mongoose from 'mongoose';
import MilkCollection from '../models/MilkCollection.js';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import UnionSaleSettings from '../models/UnionSaleSettings.js';
import {
  createUnionSalesVoucher,
  reverseUnionSalesVoucher,
  generateSlipNo,
} from '../controllers/unionSalesSlipController.js';

// ══════════════════════════════════════════════════════════════════════════════
//  Union Sales — automatic entries from From Dairy (Union Sales → Settings)
//
//  With From Dairy TS Rate Settings enabled, every date + session (AM / PM) of milk
//  purchase on/after the From Dairy From Date gets one Union Sales slip:
//    Qty = Σ purchase qty,  FAT / SNF = qty-weighted averages,
//    Rate = (FAT + SNF) × From Dairy TS rate of that date ÷ 100  (the TS formula),
//    Amount = Qty × Rate — with the same Day Book voucher as a manual slip.
//  Slips are marked source 'FromDairy' and kept in step with the purchase data
//  (created / updated / removed). A Manual slip (typed, imported, or an auto slip
//  edited by hand) for that date + session is never overwritten. Re-running is safe:
//  a date + session can hold only one slip (unique index), so nothing is duplicated.
// ══════════════════════════════════════════════════════════════════════════════

const ymdIST = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const slipDate = (day) => new Date(`${day}T00:00:00.000Z`);   // slips are stored at UTC midnight
const r2 = (n) => Number((Number(n) || 0).toFixed(2));
const r3 = (n) => Number((Number(n) || 0).toFixed(3));
const addDays = (day, n) => { const d = slipDate(day); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const SHIFTS = ['AM', 'PM'];

// Period in force on a YYYY-MM-DD day (fromDate ≤ day ≤ toDate; no toDate = open)
const rateOn = (periods, day) => (periods || [])
  .filter(p => ymdIST(p.fromDate) <= day && (!p.toDate || ymdIST(p.toDate) >= day))
  .sort((a, b) => ymdIST(b.fromDate).localeCompare(ymdIST(a.fromDate)))[0]?.tsRate ?? null;

const sameFigures = (slip, want) =>
  r3(slip.qty) === want.qty && r2(slip.fat) === want.fat && r2(slip.snf) === want.snf &&
  r2(slip.rate) === want.rate && r2(slip.amount) === want.amount;

/**
 * Sync the From Dairy slips of a company.
 *   days: ['YYYY-MM-DD', …]  — only these dates, or
 *   from / to: 'YYYY-MM-DD'  — every date in the range (defaults: From Dairy From Date → today)
 * Returns { created, updated, removed, skippedManual }.
 */
export async function syncFromDairySlips(companyId, { days, from, to } = {}) {
  const result = { created: 0, updated: 0, removed: 0, skippedManual: 0 };
  const settings = await UnionSaleSettings.findOne({ companyId }).lean();
  const fd = settings?.fromDairy;
  // Only while From Dairy is enabled. Disabling it leaves the slips already generated
  // (they carry Day Book vouchers) — nothing is created, changed or removed.
  if (!(fd?.tsEnabled && fd.fromDate)) return { ...result, disabled: true };
  const startDay = ymdIST(fd.fromDate);

  // Which dates to look at
  let dayList;
  if (Array.isArray(days) && days.length) {
    dayList = [...new Set(days.filter(Boolean))].sort();
  } else {
    const lo = from || startDay || ymdIST(new Date());
    const hi = to || ymdIST(new Date());
    dayList = [];
    for (let d = lo; d <= hi && dayList.length < 3700; d = addDays(d, 1)) dayList.push(d);
  }
  if (!dayList.length) return result;
  const lo = dayList[0], hi = dayList[dayList.length - 1];
  const daySet = new Set(dayList);

  const cid = new mongoose.Types.ObjectId(String(companyId));
  const startLocal = new Date(`${lo}T00:00:00+05:30`);
  const endLocal = new Date(`${hi}T23:59:59.999+05:30`);
  const [groups, slips] = await Promise.all([
    MilkCollection.aggregate([
      { $match: { companyId: cid, date: { $gte: startLocal, $lte: endLocal } } },
      { $group: {
        _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } }, shift: '$shift' },
        qty: { $sum: '$qty' },
        fatQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$fat', 0] }] } },
        snfQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$snf', 0] }] } },
      } },
    ]),
    UnionSalesSlip.find({ companyId: cid, date: { $gte: slipDate(lo), $lt: slipDate(addDays(hi, 1)) } }),
  ]);

  const purchase = new Map(groups.map(g => [`${g._id.day}|${g._id.shift}`, g]));
  const slipAt = new Map(slips.map(s => [`${s.date.toISOString().slice(0, 10)}|${s.time}`, s]));

  for (const day of dayList) {
    for (const shift of SHIFTS) {
      const key = `${day}|${shift}`;
      const slip = slipAt.get(key);

      // What the From Dairy slip should be (null = no slip)
      let want = null;
      const g = purchase.get(key);
      const tsRate = day >= startDay ? rateOn(fd.tsRates, day) : null;
      if (g && g.qty > 0 && tsRate !== null) {
        const fat = g.fatQty / g.qty, snf = g.snfQty / g.qty;
        const rate = r2(((fat + snf) * tsRate) / 100);
        const qty = r3(g.qty);
        want = { qty, fat: r2(fat), snf: r2(snf), rate, amount: r2(qty * rate) };
      }

      if (slip && slip.source !== 'FromDairy') {
        if (want) result.skippedManual++;
        continue;                                   // manual slip wins
      }

      try {
        if (want && !slip) {
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const created = new UnionSalesSlip({
                slipNo: await generateSlipNo(companyId),
                date: slipDate(day), time: shift, ...want,
                source: 'FromDairy', companyId,
              });
              await created.save();
              const voucher = await createUnionSalesVoucher(created, companyId);
              if (voucher) { created.voucherId = voucher._id; await created.save(); }
              result.created++;
              break;
            } catch (err) {
              if (err.code !== 11000 || attempt === 4) throw err;
              // slipNo race → retry; a slip for this date + session appeared meanwhile → stop
              if (await UnionSalesSlip.exists({ companyId: cid, date: slipDate(day), time: shift })) break;
            }
          }
        } else if (want && slip && !sameFigures(slip, want)) {
          await reverseUnionSalesVoucher(slip);
          Object.assign(slip, want);
          slip.voucherId = undefined;
          await slip.save();
          const voucher = await createUnionSalesVoucher(slip, companyId);
          if (voucher) { slip.voucherId = voucher._id; await slip.save(); }
          result.updated++;
        } else if (!want && slip && daySet.has(day)) {
          await reverseUnionSalesVoucher(slip);
          await slip.deleteOne();
          result.removed++;
        }
      } catch (err) {
        console.warn(`[UnionFromDairy] ${day} ${shift} failed (non-fatal):`, err.message);
      }
    }
  }
  return result;
}

// ── Background trigger after milk purchase changes ────────────────────────────
// Collects the touched dates per company and syncs them shortly after, one run per
// company at a time, so a burst of entries / an import costs one sync.
const pending = new Map();   // companyId → { days:Set, timer }
const running = new Map();   // companyId → Promise

export function queueFromDairySync(companyId, dates = []) {
  if (!companyId) return;
  const key = String(companyId);
  const entry = pending.get(key) || { days: new Set(), timer: null };
  for (const d of dates) if (d) entry.days.add(typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ymdIST(d));
  if (!entry.days.size) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    pending.delete(key);
    const days = [...entry.days];
    const prev = running.get(key) || Promise.resolve();
    const next = prev
      .then(async () => {
        const fd = (await UnionSaleSettings.findOne({ companyId: key }).select('fromDairy.tsEnabled').lean())?.fromDairy;
        if (fd?.tsEnabled) await syncFromDairySlips(key, { days });
      })
      .catch(err => console.warn('[UnionFromDairy] queued sync failed (non-fatal):', err.message));
    running.set(key, next);
    next.finally(() => { if (running.get(key) === next) running.delete(key); });
  }, 1500);
  pending.set(key, entry);
}

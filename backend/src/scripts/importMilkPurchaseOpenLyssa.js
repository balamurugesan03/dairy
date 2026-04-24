/**
 * OpenLyssa Milk Purchase Import Script
 *
 * Joins mc_proc_master (date + shift) with mc_proc_detail (per-producer records)
 * on mc_id, then upserts into MilkCollection.
 *
 * Usage:
 *   node src/scripts/importMilkPurchaseOpenLyssa.js \
 *     --master=./data/mc_proc_master.xlsx \
 *     --detail=./data/mc_proc_detail.xlsx \
 *     --company=<MongoDB ObjectId>
 *
 * Both files can also be two sheets in one Excel workbook:
 *   node src/scripts/importMilkPurchaseOpenLyssa.js \
 *     --file=./data/milk_purchase.xlsx \
 *     --sheet-master=mc_proc_master \
 *     --sheet-detail=mc_proc_detail \
 *     --company=<MongoDB ObjectId>
 *
 * Optional flags:
 *   --dry-run             Validate only, do not insert
 *   --batch=500           Batch size for upserts (default: 500)
 *   --skip-unknown        Skip records whose producer_id has no matching Farmer
 *                         (default: abort if any farmer is missing)
 *
 * OpenLyssa field mapping:
 *   mc_proc_master:
 *     mc_id         → join key
 *     mc_date       → date          (DD-MM-YYYY)
 *     mc_time       → shift         (AM / PM)
 *     shift_id      → shift fallback (1=AM, 2=PM) when mc_time absent
 *
 *   mc_proc_detail:
 *     mc_id         → join key
 *     producer_id   → farmerNumber  (looked up in Farmer collection)
 *     slno          → part of billNo
 *     qty           → qty
 *     clr           → clr
 *     fat           → fat
 *     snf           → snf
 *     rate          → rate
 *     amount        → amount
 *     incentive     → incentive
 *
 * Generated billNo format: OL-{dcs_id}-{mc_id}-{slno}
 * (unique per dairy society session entry)
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import MilkCollection from '../models/MilkCollection.js';
import Farmer from '../models/Farmer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── CLI argument parser ──────────────────────────────────────────────────────
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const eq = arg.indexOf('=');
    if (eq === -1) {
      args[arg.replace(/^--/, '')] = true;
    } else {
      const key = arg.slice(2, eq);
      args[key] = arg.slice(eq + 1);
    }
  });
  return args;
}

// ─── Excel serial date → JS Date ─────────────────────────────────────────────
function excelSerialToDate(serial) {
  const num = Number(serial);
  if (!serial || isNaN(num) || num <= 0) return null;
  return new Date(Math.round((num - 25569) * 86400 * 1000));
}

// ─── Parse any date value ─────────────────────────────────────────────────────
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return excelSerialToDate(val);

  const str = String(val).trim();
  if (!str || str === '0000-00-00' || str.startsWith('#')) return null;

  // DD-MM-YYYY (most common OpenLyssa date format)
  const m1 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    const d = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const d = new Date(str.slice(0, 10));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Resolve shift string ─────────────────────────────────────────────────────
function parseShift(mcTime, shiftId) {
  const t = String(mcTime ?? '').trim().toUpperCase();
  if (t === 'AM') return 'AM';
  if (t === 'PM') return 'PM';
  const id = Number(shiftId);
  if (id === 1) return 'AM';
  if (id === 2) return 'PM';
  return null;
}

// ─── Safe number ──────────────────────────────────────────────────────────────
function num(val, def = 0) {
  const n = Number(val);
  return isNaN(n) ? def : n;
}

// ─── Load sheet rows from file ────────────────────────────────────────────────
function loadSheet(filePath, sheetName) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw    = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? []);
  }

  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    const workbook = XLSX.readFile(filePath);
    const sheet    = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw new Error(
        `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`
      );
    }
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  throw new Error(`Unsupported file type: ${ext}. Use .xlsx, .xls, .json, or .csv`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args        = parseArgs();
  const companyArg  = args.company;
  const isDry       = args['dry-run'] === true || args['dry-run'] === 'true';
  const skipUnknown = args['skip-unknown'] === true || args['skip-unknown'] === 'true';
  const batchSize   = parseInt(args.batch ?? '500', 10);

  // ── File resolution ──────────────────────────────────────────────────────
  let masterPath, detailPath, masterSheet, detailSheet;

  if (args.file) {
    // Single workbook, two sheets
    masterPath  = path.resolve(args.file);
    detailPath  = masterPath;
    masterSheet = args['sheet-master'] ?? 'mc_proc_master';
    detailSheet = args['sheet-detail'] ?? 'mc_proc_detail';
  } else {
    masterPath  = args.master ? path.resolve(args.master) : null;
    detailPath  = args.detail ? path.resolve(args.detail) : null;
    masterSheet = args['sheet-master'] ?? null;
    detailSheet = args['sheet-detail'] ?? null;
  }

  // ── Validate CLI args ────────────────────────────────────────────────────
  if (!masterPath || !detailPath) {
    console.error(
      'ERROR: Provide either --file=<workbook> or both --master=<file> --detail=<file>'
    );
    process.exit(1);
  }
  if (!companyArg) {
    console.error('ERROR: --company=<MongoDB ObjectId> is required');
    process.exit(1);
  }
  if (!mongoose.Types.ObjectId.isValid(companyArg)) {
    console.error(`ERROR: "${companyArg}" is not a valid MongoDB ObjectId`);
    process.exit(1);
  }
  if (!fs.existsSync(masterPath)) {
    console.error(`ERROR: File not found: ${masterPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(detailPath)) {
    console.error(`ERROR: File not found: ${detailPath}`);
    process.exit(1);
  }

  const companyId = new mongoose.Types.ObjectId(companyArg);

  console.log('\n[OpenLyssa Milk Purchase Import]');
  console.log(`Master file : ${masterPath}${masterSheet ? ' → sheet: ' + masterSheet : ''}`);
  console.log(`Detail file : ${detailPath}${detailSheet ? ' → sheet: ' + detailSheet : ''}`);
  console.log(`Company ID  : ${companyArg}`);

  // ── Load rows ────────────────────────────────────────────────────────────
  let masterRows, detailRows;
  try {
    masterRows = loadSheet(masterPath, masterSheet);
    detailRows = loadSheet(detailPath, detailSheet);
  } catch (err) {
    console.error(`ERROR reading file: ${err.message}`);
    process.exit(1);
  }

  console.log(`Master rows : ${masterRows.length}`);
  console.log(`Detail rows : ${detailRows.length}`);

  // ── Build mc_id → { date, shift } lookup from master ────────────────────
  const masterMap = new Map();
  const masterErrors = [];

  masterRows.forEach((row, i) => {
    const mcId = String(row.mc_id ?? '').trim();
    if (!mcId || mcId === '0') return;

    const date  = parseDate(row.mc_date);
    const shift = parseShift(row.mc_time, row.shift_id);

    if (!date) {
      masterErrors.push(`Master row ${i + 2}: mc_id=${mcId} — invalid mc_date "${row.mc_date}"`);
      return;
    }
    if (!shift) {
      masterErrors.push(`Master row ${i + 2}: mc_id=${mcId} — unrecognised shift "${row.mc_time}" / shift_id="${row.shift_id}"`);
      return;
    }

    masterMap.set(mcId, { date, shift });
  });

  if (masterErrors.length) {
    console.warn(`\nMaster parse warnings (${masterErrors.length}):`);
    masterErrors.forEach(e => console.warn('  ' + e));
  }

  console.log(`Master sessions mapped : ${masterMap.size}`);

  // ── Connect to MongoDB ───────────────────────────────────────────────────
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  // ── Load all farmers for this company (producer_id → Farmer doc) ─────────
  console.log('Loading farmers...');
  const farmerDocs = await Farmer.find(
    { companyId },
    { _id: 1, farmerNumber: 1, personalDetails: 1 }
  ).lean();

  const farmerMap = new Map();
  farmerDocs.forEach(f => farmerMap.set(String(f.farmerNumber).trim(), f));
  console.log(`Farmers loaded : ${farmerMap.size}`);

  // ── Transform detail rows → MilkCollection documents ────────────────────
  const valid        = [];
  const skipped      = [];
  const unknownFarmers = new Set();

  detailRows.forEach((row, i) => {
    const rowNum     = i + 2;
    const mcId       = String(row.mc_id ?? '').trim();
    const producerId = String(row.producer_id ?? '').trim();
    const dcsId      = String(row.dcs_id ?? '').trim();
    const slno       = String(row.slno ?? row.sl_no ?? '').trim();

    if (!mcId || mcId === '0') {
      skipped.push({ row: rowNum, reason: 'Missing mc_id' });
      return;
    }
    if (!producerId || producerId === '0') {
      skipped.push({ row: rowNum, mcId, reason: 'Missing producer_id' });
      return;
    }

    // Join with master
    const session = masterMap.get(mcId);
    if (!session) {
      skipped.push({ row: rowNum, mcId, producerId, reason: `mc_id=${mcId} not found in master` });
      return;
    }

    // Look up farmer
    const farmer = farmerMap.get(producerId);
    if (!farmer) {
      unknownFarmers.add(producerId);
      if (!skipUnknown) {
        skipped.push({ row: rowNum, mcId, producerId, reason: `No Farmer with farmerNumber="${producerId}"` });
        return;
      }
      skipped.push({ row: rowNum, mcId, producerId, reason: `No Farmer with farmerNumber="${producerId}" (skipped)` });
      return;
    }

    const qty      = num(row.qty);
    const fat      = num(row.fat);
    const clr      = num(row.clr);
    const snf      = num(row.snf);
    const rate     = num(row.rate);
    const amount   = num(row.amount);
    const incentive = num(row.incentive);

    if (qty <= 0) {
      skipped.push({ row: rowNum, mcId, producerId, reason: 'qty=0 — skipped zero-quantity record' });
      return;
    }

    // billNo uniquely identifies one detail row within one DCS across all imports
    const billNo = `OL-${dcsId || 'X'}-${mcId}-${slno || producerId}`;

    valid.push({
      billNo,
      date:      session.date,
      shift:     session.shift,
      farmer:    farmer._id,
      farmerNumber: farmer.farmerNumber,
      farmerName:   farmer.personalDetails?.name ?? '',
      qty,
      fat,
      clr,
      snf,
      rate,
      amount,
      incentive,
      companyId,
    });
  });

  console.log(`Valid documents   : ${valid.length}`);
  console.log(`Skipped rows      : ${skipped.length}`);
  if (unknownFarmers.size) {
    console.warn(`Unknown producer_ids (${unknownFarmers.size}): ${[...unknownFarmers].join(', ')}`);
  }

  if (skipped.length) {
    console.log('\n── SKIPPED ROWS ──────────────────────────────────────────────────────');
    skipped.forEach(s =>
      console.log(`  Row ${s.row} [mc_id=${s.mcId ?? '?'}, producer_id=${s.producerId ?? '?'}] → ${s.reason}`)
    );
  }

  if (isDry) {
    console.log('\n[DRY RUN] No data written. Remove --dry-run to perform actual import.');
    if (valid.length) {
      console.log('\nSample of first mapped document:');
      console.dir(valid[0], { depth: null });
    }
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!valid.length) {
    console.log('\nNothing to insert. Exiting.');
    await mongoose.disconnect();
    process.exit(skipped.length > 0 ? 1 : 0);
  }

  // ── Bulk upsert ──────────────────────────────────────────────────────────
  let inserted   = 0;
  let updated    = 0;
  const dbErrors = [];

  for (let start = 0; start < valid.length; start += batchSize) {
    const chunk   = valid.slice(start, start + batchSize);
    const batchNo = Math.floor(start / batchSize) + 1;

    const ops = chunk.map(doc => ({
      updateOne: {
        filter: { billNo: doc.billNo, companyId: doc.companyId },
        update: { $set: doc },
        upsert: true,
      },
    }));

    try {
      const result = await MilkCollection.bulkWrite(ops, { ordered: false });
      inserted += result.upsertedCount;
      updated  += result.modifiedCount;
      console.log(
        `  Batch ${batchNo}: inserted ${result.upsertedCount}, updated ${result.modifiedCount}/${chunk.length}`
      );
    } catch (err) {
      if (err.result) {
        inserted += err.result.upsertedCount ?? 0;
        updated  += err.result.modifiedCount ?? 0;
        console.warn(`  Batch ${batchNo}: partial success — ${err.message}`);
      }
      (err.writeErrors ?? []).forEach(we => {
        const doc = chunk[we.index];
        dbErrors.push({
          billNo:    doc?.billNo,
          farmerNo:  doc?.farmerNumber,
          reason:    we.errmsg ?? we.err?.message ?? 'Unknown write error',
        });
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('   OPENLYSSA MILK PURCHASE IMPORT SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  Total detail rows in file : ${detailRows.length}`);
  console.log(`  Valid (attempted)         : ${valid.length}`);
  console.log(`  New inserts               : ${inserted}`);
  console.log(`  Updated existing          : ${updated}`);
  console.log(`  Skipped rows              : ${skipped.length}`);
  console.log(`  DB write errors           : ${dbErrors.length}`);

  if (dbErrors.length) {
    console.log('\n── DB WRITE ERRORS ───────────────────────────────────────────────────');
    dbErrors.forEach(e =>
      console.log(`  billNo=${e.billNo} [farmerNo=${e.farmerNo}] → ${e.reason}`)
    );
  }

  const report = {
    runAt:         new Date().toISOString(),
    source:        'OpenLyssa',
    companyId:     companyArg,
    masterRows:    masterRows.length,
    detailRows:    detailRows.length,
    newInserts:    inserted,
    updated,
    skippedRows:   skipped,
    unknownFarmerIds: [...unknownFarmers],
    dbErrors,
  };

  const reportDir  = path.dirname(masterPath);
  const reportPath = path.join(reportDir, 'import-milk-purchase-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  Report saved : ${reportPath}`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(dbErrors.length + skipped.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

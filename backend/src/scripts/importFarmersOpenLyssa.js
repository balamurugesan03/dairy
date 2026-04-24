/**
 * OpenLyssa Producer Master → MongoDB Farmer Import Script
 *
 * Usage:
 *   node src/scripts/importFarmersOpenLyssa.js --file=./data/producers.xlsx --company=<companyId>
 *   node src/scripts/importFarmersOpenLyssa.js --file=./data/producers.json --company=<companyId>
 *
 * Optional flags:
 *   --sheet=Sheet1        Excel sheet name (default: first sheet)
 *   --dry-run             Validate only, do not insert
 *   --batch=200           Batch size for upserts (default: 200)
 *
 * OpenLyssa producer_master field mapping:
 *   producer_id       → farmerNumber
 *   pro_name          → personalDetails.name
 *   father_hus_name   → personalDetails.fatherName
 *   date_of_birth     → personalDetails.dob
 *   sex               → personalDetails.gender  (M/F)
 *   mobile_no/phone_no→ personalDetails.phone
 *   caste_id          → personalDetails.caste   (1=SC,2=ST,3=OBC)
 *   nominee           → personalDetails.nomineeName
 *   rel_id            → personalDetails.nomineeRelation
 *   house_name        → address.houseName
 *   ward_no           → address.ward
 *   place             → address.village
 *   post              → address.panchayat
 *   pin_code          → address.pin
 *   date_join         → admissionDate
 *   member_status=Y   → isMembership=true
 *   member_no         → memberId
 *   mem_doa           → membershipDate
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import Farmer from '../models/Farmer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── CLI argument parser ─────────────────────────────────────────────────────
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    args[key] = value ?? true;
  });
  return args;
}

// ─── Excel serial date → JS Date ─────────────────────────────────────────────
function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const num = Number(serial);
  if (num <= 0) return null;
  return new Date(Math.round((num - 25569) * 86400 * 1000));
}

// ─── Parse any date value ─────────────────────────────────────────────────────
// Handles: null, '0000-00-00', '########', Excel serials, DD-MM-YYYY, ISO strings
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return excelSerialToDate(val);

  const str = String(val).trim();
  if (!str || str === '0000-00-00' || str.startsWith('#')) return null;

  // DD-MM-YYYY  (most common OpenLyssa date format)
  const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Gender normaliser ────────────────────────────────────────────────────────
function parseGender(val) {
  if (!val) return 'Other';
  const v = String(val).trim().toUpperCase();
  if (v === 'M' || v === 'MALE')   return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  return 'Other';
}

// ─── Phone validator ──────────────────────────────────────────────────────────
function parsePhone(val) {
  if (!val) return undefined;
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return undefined;
}

// ─── Safe string cleaner ──────────────────────────────────────────────────────
function clean(val) {
  if (val === null || val === undefined) return undefined;
  const s = String(val).trim();
  return s === '' || s === '0' ? undefined : s;
}

// ─── Safe number ─────────────────────────────────────────────────────────────
function parseNum(val, defaultVal = 0) {
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

// ─── caste_id → caste name ────────────────────────────────────────────────────
const CASTE_MAP = { '1': 'SC', '2': 'ST', '3': 'OBC' };
function parseCaste(val) {
  if (!val) return undefined;
  const key = String(val).trim();
  return CASTE_MAP[key] ?? (key === '0' ? undefined : key);
}

// ─── OpenLyssa row → Farmer document mapper ───────────────────────────────────
function mapRow(row, companyId) {
  const isMember = String(row.member_status ?? '').trim().toUpperCase() === 'Y';

  return {
    farmerNumber: String(row.producer_id ?? '').trim(),

    memberId: isMember ? clean(row.member_no) : null,

    personalDetails: {
      name:            clean(row.pro_name) ?? '',
      fatherName:      clean(row.father_hus_name),
      dob:             parseDate(row.date_of_birth),
      gender:          parseGender(row.sex),
      phone:           parsePhone(row.mobile_no ?? row.phone_no),
      caste:           parseCaste(row.caste_id),
      nomineeName:     clean(row.nominee),
      nomineeRelation: clean(row.rel_id),
    },

    address: {
      houseName: clean(row.house_name),
      ward:      clean(row.ward_no),
      village:   clean(row.place),
      panchayat: clean(row.post),
      pin:       clean(row.pin_code),
    },

    admissionDate:  parseDate(row.date_join),
    isMembership:   isMember,
    membershipDate: isMember ? parseDate(row.mem_doa) : null,

    status:    'Active',
    companyId: new mongoose.Types.ObjectId(companyId),
  };
}

// ─── Validate a mapped document ───────────────────────────────────────────────
function validate(doc) {
  const errors = [];
  if (!doc.farmerNumber)          errors.push('farmerNumber (producer_id) is missing');
  if (!doc.personalDetails?.name) errors.push('personalDetails.name (pro_name) is missing');
  return errors;
}

// ─── Load rows from file ──────────────────────────────────────────────────────
function loadRows(filePath, sheetName) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw    = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? []);
  }

  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
    const workbook = XLSX.readFile(filePath);
    const sheet    = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  throw new Error(`Unsupported file type: ${ext}. Use .xlsx, .xls, .json, or .csv`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args    = parseArgs();
  const file    = args.file;
  const company = args.company;
  const isDry   = args['dry-run'] === true || args['dry-run'] === 'true';
  const batch   = parseInt(args.batch ?? '200', 10);
  const sheet   = args.sheet;

  if (!file) {
    console.error('ERROR: --file=<path> is required');
    console.error('Example: node src/scripts/importFarmersOpenLyssa.js --file=./data/producers.xlsx --company=66abc123...');
    process.exit(1);
  }
  if (!company) {
    console.error('ERROR: --company=<MongoDB ObjectId> is required');
    process.exit(1);
  }
  if (!mongoose.Types.ObjectId.isValid(company)) {
    console.error(`ERROR: "${company}" is not a valid MongoDB ObjectId`);
    process.exit(1);
  }

  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`ERROR: File not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`\n[OpenLyssa Farmer Import]`);
  console.log(`Loading data from : ${absPath}`);

  let rows;
  try {
    rows = loadRows(absPath, sheet);
  } catch (err) {
    console.error(`ERROR reading file: ${err.message}`);
    process.exit(1);
  }
  console.log(`Rows loaded       : ${rows.length}`);

  // ── Transform + Validate ─────────────────────────────────────────────────
  const valid   = [];
  const skipped = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    let doc;
    try {
      doc = mapRow(row, company);
    } catch (err) {
      skipped.push({ row: rowNum, id: row.producer_id ?? '?', reason: `Transform error: ${err.message}` });
      return;
    }

    const errors = validate(doc);
    if (errors.length) {
      skipped.push({ row: rowNum, id: row.producer_id ?? '?', reason: errors.join('; ') });
    } else {
      valid.push(doc);
    }
  });

  console.log(`Valid documents   : ${valid.length}`);
  console.log(`Skipped rows      : ${skipped.length}`);

  if (skipped.length) {
    console.log('\n── SKIPPED ROWS ──────────────────────────────────────────────────────');
    skipped.forEach(s => console.log(`  Row ${s.row} [producer_id=${s.id}] → ${s.reason}`));
  }

  if (isDry) {
    console.log('\n[DRY RUN] No data written. Remove --dry-run to perform actual import.');
    if (valid.length) {
      console.log('\nSample of first mapped document:');
      console.dir(valid[0], { depth: null });
    }
    process.exit(0);
  }

  if (!valid.length) {
    console.log('\nNothing to insert. Exiting.');
    process.exit(0);
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  // ── Bulk upsert (safe to re-run — no duplicates) ──────────────────────────
  let upserted = 0;
  let updated  = 0;
  const writeErrors = [];

  for (let start = 0; start < valid.length; start += batch) {
    const chunk   = valid.slice(start, start + batch);
    const batchNo = Math.floor(start / batch) + 1;

    const ops = chunk.map(doc => ({
      updateOne: {
        filter: { farmerNumber: doc.farmerNumber, companyId: doc.companyId },
        update: { $set: doc },
        upsert: true,
      },
    }));

    try {
      const result = await Farmer.bulkWrite(ops, { ordered: false });
      upserted += result.upsertedCount;
      updated  += result.modifiedCount;
      console.log(
        `  Batch ${batchNo}: inserted ${result.upsertedCount}, updated ${result.modifiedCount}/${chunk.length}`
      );
    } catch (err) {
      if (err.result) {
        upserted += err.result.upsertedCount ?? 0;
        updated  += err.result.modifiedCount ?? 0;
        console.warn(`  Batch ${batchNo}: partial success — ${err.message}`);
      }
      (err.writeErrors ?? []).forEach(we => {
        const doc = chunk[we.index];
        writeErrors.push({
          farmerNumber: doc?.farmerNumber,
          name:         doc?.personalDetails?.name,
          reason:       we.errmsg ?? we.err?.message ?? 'Unknown write error',
        });
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('     OPENLYSSA FARMER IMPORT SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  Total rows in file : ${rows.length}`);
  console.log(`  Valid (attempted)  : ${valid.length}`);
  console.log(`  ✓ New inserts      : ${upserted}`);
  console.log(`  ✓ Updated existing : ${updated}`);
  console.log(`  ✗ Skipped (invalid): ${skipped.length}`);
  console.log(`  ✗ DB write errors  : ${writeErrors.length}`);

  if (writeErrors.length) {
    console.log('\n── DB WRITE ERRORS ───────────────────────────────────────────────────');
    writeErrors.forEach(e =>
      console.log(`  FarmerNo=${e.farmerNumber} [${e.name}] → ${e.reason}`)
    );
  }

  const report = {
    runAt:       new Date().toISOString(),
    source:      'OpenLyssa',
    file:        absPath,
    companyId:   company,
    totalRows:   rows.length,
    newInserts:  upserted,
    updated,
    skippedRows: skipped,
    dbErrors:    writeErrors,
  };
  const reportPath = path.resolve(path.dirname(absPath), 'import-report-openlyssa.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  Report saved : ${reportPath}`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(writeErrors.length + skipped.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

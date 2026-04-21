/**
 * Zibitt MS Access → MongoDB Farmer Import Script
 *
 * Usage:
 *   node src/scripts/importFarmers.js --file=./data/farmers.xlsx --company=<companyId>
 *   node src/scripts/importFarmers.js --file=./data/farmers.json --company=<companyId>
 *
 * Optional flags:
 *   --sheet=Sheet1        Excel sheet name (default: first sheet)
 *   --dry-run             Validate only, do not insert
 *   --batch=200           Batch size for insertMany (default: 200)
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
const __dirname = path.dirname(__filename);

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
// Excel epoch: Dec 30, 1899  (with the 1900 leap-year bug offset baked in)
function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const num = Number(serial);
  if (num <= 0) return null;
  // Days since Dec 30, 1899 → milliseconds
  return new Date(Math.round((num - 25569) * 86400 * 1000));
}

// ─── Parse any date value (serial number OR date string) ─────────────────────
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return excelSerialToDate(val);
  const d = new Date(val);
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
  // Accept 10-digit Indian numbers (optionally prefixed with 91)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return undefined; // too short / invalid → omit
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

// ─── Row → Farmer document mapper ────────────────────────────────────────────
function mapRow(row, companyId) {
  return {
    farmerNumber:    String(row.Supplier_No ?? row.farmerNumber ?? '').trim(),
    memberId:        clean(row.RefMemberNo ?? row.memberId),

    personalDetails: {
      name:       clean(row.Name ?? row.name) ?? '',
      fatherName: clean(row.FatherName ?? row.fatherName),
      dob:        parseDate(row.DateOfBirth ?? row.dob),
      gender:     parseGender(row.Gender ?? row.gender),
      phone:      parsePhone(row.Phone ?? row.phone ?? row.Mobile),
      caste:      clean(row.Cast1 ?? row.Caste ?? row.caste),
    },

    address: {
      village: clean(row.Place ?? row.City ?? row.village),
      pin:     clean(row.Pin ?? row.pin),
    },

    identityDetails: {
      aadhaar:      clean(row.AadhaarNo ?? row.aadhaar),
      pan:          clean(row.PANNo ?? row.pan),
      welfareNo:    clean(row.WelfareNo ?? row.welfareNo),
      ksheerasreeId:clean(row.KsheerasreeId ?? row.ksheerasreeId),
      idCardNumber: clean(row.IDCardNo ?? row.idCardNumber),
    },

    bankDetails: {
      accountNumber: clean(row.AccountNo ?? row.accountNumber),
      bankName:      clean(row.BankName ?? row.bankName),
      branch:        clean(row.BranchName ?? row.branch),
      ifsc:          clean(row.IFSC ?? row.ifsc),
    },

    financialDetails: {
      admissionFee: parseNum(row.AdmissionFee ?? row.admissionFee, 0),
      oldShares:    parseNum(row.OldShares ?? row.oldShares, 0),
      newShares:    parseNum(row.NewShares ?? row.newShares, 0),
      totalShares:  parseNum(row.TotalShares ?? row.totalShares, 0),
      shareValue:   parseNum(row.ShareValue ?? row.shareValue, 0),
    },

    membershipDate: parseDate(row.MembershipDate ?? row.membershipDate),
    admissionDate:  parseDate(row.AdmissionDate ?? row.admissionDate),
    isMembership:   !!(row.MembershipDate ?? row.membershipDate),
    status:         'Active',
    companyId:      new mongoose.Types.ObjectId(companyId),
  };
}

// ─── Validate a mapped document ───────────────────────────────────────────────
function validate(doc, rowIndex) {
  const errors = [];
  if (!doc.farmerNumber) errors.push('farmerNumber (Supplier_No) is missing');
  if (!doc.personalDetails?.name) errors.push('personalDetails.name (Name) is missing');
  if (!doc.companyId)   errors.push('companyId is missing');
  return errors;
}

// ─── Load rows from file ──────────────────────────────────────────────────────
function loadRows(filePath, sheetName) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Support both array-of-rows and { data: [...] }
    return Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? []);
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheet    = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  if (ext === '.csv') {
    const workbook = XLSX.readFile(filePath);
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
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

  // ── Guard: required args ─────────────────────────────────────────────────
  if (!file) {
    console.error('ERROR: --file=<path> is required');
    console.error('Example: node src/scripts/importFarmers.js --file=./data/farmers.xlsx --company=66abc123...');
    process.exit(1);
  }
  if (!company) {
    console.error('ERROR: --company=<MongoDB ObjectId> is required');
    console.error('Tip: Run the app, go to Company settings, copy the company _id from the URL or DB.');
    process.exit(1);
  }
  if (!mongoose.Types.ObjectId.isValid(company)) {
    console.error(`ERROR: "${company}" is not a valid MongoDB ObjectId`);
    process.exit(1);
  }

  // ── Load rows ────────────────────────────────────────────────────────────
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`ERROR: File not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`\nLoading data from: ${absPath}`);
  let rows;
  try {
    rows = loadRows(absPath, sheet);
  } catch (err) {
    console.error(`ERROR reading file: ${err.message}`);
    process.exit(1);
  }
  console.log(`Rows loaded       : ${rows.length}`);

  // ── Transform + Validate ─────────────────────────────────────────────────
  const valid    = [];
  const skipped  = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // row 1 = header in Excel
    let doc;
    try {
      doc = mapRow(row, company);
    } catch (err) {
      skipped.push({ row: rowNum, supplier: row.Supplier_No ?? '?', reason: `Transform error: ${err.message}` });
      return;
    }

    const errors = validate(doc, rowNum);
    if (errors.length) {
      skipped.push({ row: rowNum, supplier: row.Supplier_No ?? '?', reason: errors.join('; ') });
    } else {
      valid.push(doc);
    }
  });

  console.log(`Valid documents   : ${valid.length}`);
  console.log(`Skipped rows      : ${skipped.length}`);

  if (skipped.length) {
    console.log('\n── SKIPPED ROWS ──────────────────────────────────────────────────────');
    skipped.forEach(s => console.log(`  Row ${s.row} [Supplier_No=${s.supplier}] → ${s.reason}`));
  }

  if (isDry) {
    console.log('\n[DRY RUN] No data inserted. Remove --dry-run to perform actual import.');
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

  // ── Bulk insert in batches ───────────────────────────────────────────────
  let inserted = 0;
  const insertErrors = [];

  for (let start = 0; start < valid.length; start += batch) {
    const chunk = valid.slice(start, start + batch);
    try {
      const result = await Farmer.insertMany(chunk, {
        ordered: false,   // continue on partial error
        rawResult: true,
      });
      inserted += result.insertedCount;
      console.log(`  Batch ${Math.floor(start / batch) + 1}: inserted ${result.insertedCount}/${chunk.length}`);
    } catch (err) {
      // ordered:false → err.result has partial success details
      if (err.result) {
        const ok = err.result.nInserted ?? err.result.insertedCount ?? 0;
        inserted += ok;
        console.warn(`  Batch ${Math.floor(start / batch) + 1}: inserted ${ok}/${chunk.length} (partial)`);
      }
      // Collect individual write errors
      (err.writeErrors ?? []).forEach(we => {
        const doc = chunk[we.index];
        insertErrors.push({
          farmerNumber: doc?.farmerNumber,
          name: doc?.personalDetails?.name,
          reason: we.errmsg ?? we.err?.message ?? 'Unknown write error',
        });
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('          IMPORT SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  Total rows in file : ${rows.length}`);
  console.log(`  Valid (attempted)  : ${valid.length}`);
  console.log(`  ✓ Inserted         : ${inserted}`);
  console.log(`  ✗ Skipped (invalid): ${skipped.length}`);
  console.log(`  ✗ DB write errors  : ${insertErrors.length}`);
  console.log(`  Failed total       : ${skipped.length + insertErrors.length}`);

  if (insertErrors.length) {
    console.log('\n── DB WRITE ERRORS ───────────────────────────────────────────────────');
    insertErrors.forEach(e =>
      console.log(`  FarmerNo=${e.farmerNumber} [${e.name}] → ${e.reason}`)
    );
  }

  // Write error report to file
  const report = {
    runAt:       new Date().toISOString(),
    file:        absPath,
    companyId:   company,
    totalRows:   rows.length,
    inserted,
    skippedRows: skipped,
    dbErrors:    insertErrors,
  };
  const reportPath = path.resolve(path.dirname(absPath), 'import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  Error report saved : ${reportPath}`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(insertErrors.length + skipped.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

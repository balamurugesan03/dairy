import mongoose  from 'mongoose';
import MilkSales from '../models/MilkSales.js';
import Voucher   from '../models/Voucher.js';
import Customer  from '../models/Customer.js';
import Ledger    from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances, findOrCreateLedger } from '../utils/accountingHelper.js';

// Resolve a ledger from the user's Ledger Management, tolerating case + whitespace.
// Falls back to creating one only if no matching ledger exists at all.
async function resolveLedger(name, ledgerType, parentGroup, balanceType, companyId) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Ledger.findOne({
    companyId,
    ledgerName: { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' },
  });
  if (existing) return existing;
  return findOrCreateLedger(name, ledgerType, parentGroup, balanceType, companyId);
}

// Reverse + delete an existing voucher linked to a sale.
async function reverseMilkSaleVoucher(sale) {
  if (!sale?.voucherId) return;
  try {
    const voucher = await Voucher.findById(sale.voucherId);
    if (voucher) {
      await reverseLedgerBalances(voucher.entries);
      await voucher.deleteOne();
    }
  } catch (err) {
    console.warn('[MilkSales] Voucher reversal failed (non-fatal):', err.message);
  }
}

// ── Helper: create accounting voucher for a milk sale ────────────────────────
async function createMilkSaleVoucher(sale, companyId) {
  const { saleMode, paymentType, creditorId, amount, date, billNo, session } = sale;
  if (!amount || amount <= 0) return null;
  const shiftNote = session ? ` (${session})` : '';

  if (saleMode === 'LOCAL' || saleMode === 'SAMPLE') {
    // Receipt voucher: Dr Cash/Bank, Cr LOCAL SALES / SAMPLE SALES
    const isBank         = paymentType === 'Bank';
    const saleLedgerName = saleMode === 'SAMPLE' ? 'SAMPLE SALES' : 'LOCAL SALES';

    // Use ledgerType lookup for Cash/Bank so the cash book tracks the same ledger
    let payLedger = await Ledger.findOne({
      ledgerType: isBank ? 'Bank' : 'Cash',
      status: 'Active',
      companyId
    });
    if (!payLedger) {
      payLedger = await findOrCreateLedger(
        isBank ? 'Bank' : 'Cash in Hand',
        isBank ? 'Bank' : 'Cash',
        isBank ? 'Bank Accounts' : 'Cash',
        'Dr', companyId
      );
    }

    const saleLedger = await resolveLedger(
      saleLedgerName, 'Sales', 'INCOME', 'Cr', companyId
    );
    const entries = [
      { ledgerId: payLedger._id,  ledgerName: payLedger.ledgerName,  debitAmount: amount, creditAmount: 0,      narration: shiftNote.trim() },
      { ledgerId: saleLedger._id, ledgerName: saleLedger.ledgerName, debitAmount: 0,      creditAmount: amount, narration: shiftNote.trim() }
    ];
    const voucherNumber = await generateVoucherNumber('Receipt', companyId);
    const voucher = new Voucher({
      voucherType: 'Receipt', voucherNumber, voucherDate: date, entries,
      totalDebit: amount, totalCredit: amount,
      narration: `Milk Sales (${saleMode}) - ${billNo}${shiftNote}`,
      referenceType: 'Sales', referenceId: sale._id, companyId
    });
    await voucher.save();
    await updateLedgerBalances(entries);
    return voucher;
  }

  if (saleMode === 'CREDIT') {
    // Adjustment (Journal) voucher — Day Book only:
    //   Dr CUSTOMER       (expenditure / payment side)
    //   Cr CREDIT SALES   (income / receipt side)
    // No cash leg, so nothing shows in Cash Book.
    const customer = creditorId ? await Customer.findById(creditorId).lean() : null;
    const customerName = customer?.name || sale.creditorName || '';

    const [customerLedger, saleLedger] = await Promise.all([
      resolveLedger('CUSTOMER',     'Other Receivable', 'Current Assets', 'Dr', companyId),
      resolveLedger('CREDIT SALES', 'Sales',            'INCOME',         'Cr', companyId),
    ]);

    const entries = [
      { ledgerId: customerLedger._id, ledgerName: customerLedger.ledgerName, debitAmount: amount, creditAmount: 0,      narration: customerName ? `${customerName}${shiftNote}`.trim() : shiftNote.trim() },
      { ledgerId: saleLedger._id,     ledgerName: saleLedger.ledgerName,     debitAmount: 0,      creditAmount: amount, narration: customerName ? `${customerName}${shiftNote}`.trim() : shiftNote.trim() },
    ];
    const voucherNumber = await generateVoucherNumber('Journal', companyId);
    const voucher = new Voucher({
      voucherType: 'Journal', voucherNumber, voucherDate: date, entries,
      totalDebit: amount, totalCredit: amount,
      narration: `Milk Sales (CREDIT) - ${billNo}${customerName ? ' - ' + customerName : ''}${shiftNote}`,
      referenceType: 'Sales', referenceId: sale._id, companyId
    });
    await voucher.save();
    await updateLedgerBalances(entries);
    return voucher;
  }

  return null;
}

// ────────────────────────────────────────────────────────────────
//  GET NEXT BILL NO  (sequential MS-YYMM-01, 02, 03…)
// ────────────────────────────────────────────────────────────────
export const getNextBillNo = async (req, res) => {
  try {
    const n = new Date();
    const yymm = `${String(n.getFullYear()).slice(-2)}${String(n.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `MS-${yymm}-`;

    const last = await MilkSales.findOne(
      { companyId: req.companyId, billNo: { $regex: `^${prefix}\\d+$` } },
      { billNo: 1 }
    ).sort({ billNo: -1 });

    let nextNum = 1;
    if (last) {
      const lastNum = parseInt(last.billNo.replace(prefix, '')) || 0;
      nextNum = lastNum + 1;
    }

    const billNo = `${prefix}${String(nextNum).padStart(2, '0')}`;
    res.json({ success: true, data: { billNo } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  GET ALL  (filter by date, session, saleMode; pagination)
// ────────────────────────────────────────────────────────────────
export const getMilkSales = async (req, res) => {
  try {
    const { date, fromDate, toDate, month, year, session, saleMode, page = 1, limit = 500 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId: req.companyId };

    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) { const d = new Date(fromDate); d.setHours(0, 0, 0, 0); filter.date.$gte = d; }
      if (toDate)   { const d = new Date(toDate);   d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    } else if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    if (session)  filter.session  = session;
    if (saleMode) filter.saleMode = saleMode;

    const [sales, total] = await Promise.all([
      MilkSales.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MilkSales.countDocuments(filter)
    ]);

    res.json({ success: true, data: sales, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  GET BY ID
// ────────────────────────────────────────────────────────────────
export const getMilkSaleById = async (req, res) => {
  try {
    const sale = await MilkSales.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!sale) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: sale });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  GET DAILY SUMMARY  (total litre + amount for a date)
// ────────────────────────────────────────────────────────────────
export const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const filter = { companyId: req.companyId };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const result = await MilkSales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { session: '$session', saleMode: '$saleMode' },
          totalLitre: { $sum: '$litre' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  CREATE
// ────────────────────────────────────────────────────────────────
export const createMilkSale = async (req, res) => {
  try {
    const sale = await MilkSales.create({ ...req.body, companyId: req.companyId });

    // Auto-create accounting voucher
    try {
      const voucher = await createMilkSaleVoucher(sale, req.companyId);
      if (voucher) {
        sale.voucherId = voucher._id;
        await sale.save();
      }
    } catch (vErr) {
      console.warn('[MilkSales] Voucher creation failed (non-fatal):', vErr.message);
    }

    res.status(201).json({ success: true, data: sale });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  UPDATE
// ────────────────────────────────────────────────────────────────
export const updateMilkSale = async (req, res) => {
  try {
    const sale = await MilkSales.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!sale) return res.status(404).json({ success: false, message: 'Record not found' });

    // Refresh accounting voucher to reflect any changes (saleMode/amount/date/etc.)
    try {
      await reverseMilkSaleVoucher(sale);
      const voucher = await createMilkSaleVoucher(sale, req.companyId);
      sale.voucherId = voucher?._id || null;
      await sale.save();
    } catch (vErr) {
      console.warn('[MilkSales] Voucher refresh failed (non-fatal):', vErr.message);
    }

    res.json({ success: true, data: sale });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  DELETE
// ────────────────────────────────────────────────────────────────
export const deleteMilkSale = async (req, res) => {
  try {
    const sale = await MilkSales.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!sale) return res.status(404).json({ success: false, message: 'Record not found' });

    // Reverse ledger balances and delete linked voucher
    if (sale.voucherId) {
      try {
        const voucher = await Voucher.findById(sale.voucherId);
        if (voucher) {
          await reverseLedgerBalances(voucher.entries);
          await voucher.deleteOne();
        }
      } catch (vErr) {
        console.warn('[MilkSales] Voucher reversal failed (non-fatal):', vErr.message);
      }
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  ZIBITT RAW DB IMPORT
//  Accepts raw Zibitt table rows (dcs_id, mc_id, slno, cust_id,
//  qty, rate, amount, source_id, date_entry) and transforms them.
//  source_id 1 → LOCAL, 2 → CREDIT (customer lookup by customerId)
// ────────────────────────────────────────────────────────────────
export const zibittRawImport = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const companyId = req.companyId;

    // Pre-load all customers into a map for O(1) lookup
    const allCustomers = await Customer.find({ companyId }, 'customerId name _id').lean();
    const custMap = {};
    for (const c of allCustomers) {
      custMap[String(c.customerId)] = c;
    }

    const parseDateTime = (dateStr) => {
      if (!dateStr) return new Date();
      // Excel serial number (e.g. 43132.827...)
      if (typeof dateStr === 'number' || /^\d{5}(\.\d+)?$/.test(String(dateStr))) {
        return new Date(Math.round((Number(dateStr) - 25569) * 86400000));
      }
      const str = String(dateStr).trim();
      const [datePart, timePart] = str.split(' ');
      const parts = datePart.split(/[-/]/);
      if (parts.length !== 3) return new Date(str);
      const isYearFirst = parts[0].length === 4;
      const [dd, mm, yyyy] = isYearFirst ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
      return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${timePart || '00:00'}:00`);
    };

    const getSession = (dateStr) => {
      if (!dateStr) return 'AM';
      // Excel serial — fractional part is fraction of day; >= 0.5 = PM (noon)
      if (typeof dateStr === 'number' || /^\d{5}(\.\d+)?$/.test(String(dateStr))) {
        const frac = Number(dateStr) % 1;
        return frac >= 0.5 ? 'PM' : 'AM';
      }
      const timePart = String(dateStr).split(' ')[1];
      if (!timePart) return 'AM';
      return parseInt(timePart.split(':')[0]) < 12 ? 'AM' : 'PM';
    };

    const docs = [];
    const skipped = [];

    for (const row of records) {
      // Skip empty/summary rows (no quantity or amount)
      if (!row.qty && !row.amount) { skipped.push('empty row'); continue; }

      const saleMode = String(row.source_id) === '2' ? 'CREDIT' : 'LOCAL';
      const billNo   = `MS-${row.dcs_id}-${row.mc_id}-${row.cust_id}-${row.slno}`;

      const doc = {
        billNo,
        date:        parseDateTime(row.date_entry),
        session:     getSession(row.date_entry),
        saleMode,
        litre:       Number(row.qty)    || 0,
        rate:        Number(row.rate)   || 0,
        amount:      Number(row.amount) || 0,
        paymentType: 'Cash',
        companyId,
      };

      if (saleMode === 'CREDIT') {
        const customer = custMap[String(row.cust_id)];
        if (!customer) {
          skipped.push(`cust_id=${row.cust_id} not found`);
          continue;
        }
        doc.creditorId   = customer._id;
        doc.creditorName = customer.name;
      }

      docs.push(doc);
    }

    let insertedDocs = [];
    try {
      insertedDocs = await MilkSales.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
        insertedDocs = err.insertedDocs || [];
      } else {
        throw err;
      }
    }

    // Auto-post Day Book / Cash Book voucher for every imported sale
    let posted = 0;
    const voucherErrors = [];
    for (const sale of insertedDocs) {
      try {
        const voucher = await createMilkSaleVoucher(sale, companyId);
        if (voucher) {
          sale.voucherId = voucher._id;
          await sale.save();
          posted++;
        }
      } catch (vErr) {
        console.warn('[MilkSales] Voucher creation failed:', sale.billNo, vErr.message);
        voucherErrors.push({ billNo: sale.billNo, message: vErr.message });
      }
    }

    const inserted = insertedDocs.length;
    const totalSkipped = skipped.length + (docs.length - inserted);
    res.status(201).json({
      success: true,
      data: {
        inserted,
        posted,
        skipped: totalSkipped,
        skipReasons: skipped.slice(0, 20),
        voucherErrors: voucherErrors.slice(0, 20),
      },
      message: `${inserted} inserted, ${posted} posted to Day Book${voucherErrors.length ? ` (${voucherErrors.length} voucher errors)` : ''}, ${totalSkipped} skipped`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  BULK IMPORT  (Zibitt / CSV)
// ────────────────────────────────────────────────────────────────
export const bulkImportMilkSales = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const docs = records.map(r => ({ ...r, companyId: req.companyId }));
    let insertedDocs = [];
    try {
      insertedDocs = await MilkSales.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err.name === 'BulkWriteError' || err.code === 11000) {
        insertedDocs = err.insertedDocs || [];
      } else {
        throw err;
      }
    }

    // Auto-post Day Book / Cash Book voucher for every imported sale
    let posted = 0;
    const voucherErrors = [];
    for (const sale of insertedDocs) {
      try {
        const voucher = await createMilkSaleVoucher(sale, req.companyId);
        if (voucher) {
          sale.voucherId = voucher._id;
          await sale.save();
          posted++;
        }
      } catch (vErr) {
        console.warn('[MilkSales] Voucher creation failed:', sale.billNo, vErr.message);
        voucherErrors.push({ billNo: sale.billNo, message: vErr.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        inserted: insertedDocs.length,
        posted,
        voucherErrors: voucherErrors.slice(0, 20),
      },
      message: `${insertedDocs.length} records imported, ${posted} posted to Day Book${voucherErrors.length ? ` (${voucherErrors.length} voucher errors)` : ''}`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  OPENLYSSA IMPORT
//  Accepts the 4 joined OpenLyssa tables (already merged in frontend):
//    { dcs_id, mc_id, slno, cust_id, cust_name, qty, rate, amount,
//      date_entry (DD-MM-YYYY HH:MM), shift (AM/PM), sale_type (CASH|CREDIT) }
//  LOCAL SALE category → sale_type='CASH' → saleMode='LOCAL'
//  All other categories → sale_type='CREDIT' → saleMode='CREDIT'
// ────────────────────────────────────────────────────────────────
export const openLyssaImport = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }
    const companyId = req.companyId;

    const allCustomers = await Customer.find({ companyId }, 'customerId name _id').lean();
    const custByIdMap   = {};
    const custByNameMap = {};
    for (const c of allCustomers) {
      if (c.customerId) custByIdMap[String(c.customerId).trim()]              = c;
      if (c.name)       custByNameMap[c.name.trim().toLowerCase()]             = c;
    }

    const parseDateTime = (dateStr, shift = 'AM') => {
      if (!dateStr) return new Date();
      const str = String(dateStr).trim();
      const spaceIdx = str.indexOf(' ');
      const datePart = spaceIdx !== -1 ? str.slice(0, spaceIdx) : str;
      const timePart = spaceIdx !== -1 ? str.slice(spaceIdx + 1) : (shift === 'PM' ? '18:00' : '06:00');
      const parts = datePart.split(/[-/]/);
      if (parts.length !== 3) return new Date(str);
      const isYearFirst = parts[0].length === 4;
      const [dd, mm, yyyy] = isYearFirst ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
      return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${timePart}:00`);
    };

    const docs    = [];
    const skipped = [];

    for (const row of records) {
      if ((!row.qty || Number(row.qty) <= 0) && (!row.amount || Number(row.amount) <= 0)) {
        skipped.push('empty row'); continue;
      }

      const saleMode = row.sale_type === 'CASH' ? 'LOCAL' : 'CREDIT';
      const shift    = String(row.shift || 'AM').trim().toUpperCase();
      const billNo   = `OL-${row.dcs_id}-${row.mc_id}-${row.cust_id}-${row.slno}`;

      const doc = {
        billNo,
        date:        parseDateTime(row.date_entry, shift),
        session:     shift === 'PM' ? 'PM' : 'AM',
        saleMode,
        litre:       Number(row.qty)    || 0,
        rate:        Number(row.rate)   || 0,
        amount:      Number(row.amount) || 0,
        paymentType: 'Cash',
        companyId,
      };

      if (saleMode === 'CREDIT') {
        const customer = custByIdMap[String(row.cust_id).trim()]
                      || custByNameMap[String(row.cust_name || '').trim().toLowerCase()];
        if (customer) {
          doc.creditorId   = customer._id;
          doc.creditorName = customer.name;
        } else {
          // No matching Customer found — save with name only (creditorId left unlinked)
          doc.creditorName = String(row.cust_name || `Customer-${row.cust_id}`).trim();
        }
      }

      docs.push(doc);
    }

    let insertedDocs = [];
    try {
      insertedDocs = await MilkSales.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
        insertedDocs = err.insertedDocs || [];
      } else {
        throw err;
      }
    }

    let posted = 0;
    const voucherErrors = [];
    for (const sale of insertedDocs) {
      try {
        const voucher = await createMilkSaleVoucher(sale, companyId);
        if (voucher) {
          sale.voucherId = voucher._id;
          await sale.save();
          posted++;
        }
      } catch (vErr) {
        console.warn('[MilkSales] OL voucher failed:', sale.billNo, vErr.message);
        voucherErrors.push({ billNo: sale.billNo, message: vErr.message });
      }
    }

    const inserted     = insertedDocs.length;
    const totalSkipped = skipped.length + (docs.length - inserted);
    res.status(201).json({
      success: true,
      data: {
        inserted,
        posted,
        skipped:       totalSkipped,
        skipReasons:   skipped.slice(0, 20),
        voucherErrors: voucherErrors.slice(0, 20),
      },
      message: `${inserted} inserted, ${posted} posted to Day Book${voucherErrors.length ? ` (${voucherErrors.length} voucher errors)` : ''}, ${totalSkipped} skipped`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  BACKFILL VOUCHERS — post Day Book/Cash Book vouchers for any
//  existing milk sale that doesn't already have one. Safe to re-run.
// ────────────────────────────────────────────────────────────────
export const backfillMilkSaleVouchers = async (req, res) => {
  try {
    const sales = await MilkSales.find({
      companyId: req.companyId,
      $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
      amount: { $gt: 0 },
    }).sort({ date: 1 });

    const result = { total: sales.length, posted: 0, skipped: 0, errors: [] };
    for (const sale of sales) {
      try {
        const voucher = await createMilkSaleVoucher(sale, req.companyId);
        if (voucher) {
          sale.voucherId = voucher._id;
          await sale.save();
          result.posted++;
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors.push({ billNo: sale.billNo, message: err.message });
        result.skipped++;
      }
    }

    res.json({
      success: true,
      message: `Backfill complete: ${result.posted} posted, ${result.skipped} skipped`,
      data: result,
    });
  } catch (err) {
    console.error('Milk sales backfill error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  SALESMAN / CREDITOR BALANCE REPORT
//  GET /balance-report?startDate=&endDate=&creditorId=
//  Returns day-wise rows: AM/PM local sales, daybook payment/receipt, running balance
// ────────────────────────────────────────────────────────────────
export const getBalanceReport = async (req, res) => {
  try {
    const { startDate, endDate, creditorId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const companyId = req.companyId;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);

    // ── Resolve creditor ──────────────────────────────────────────
    let creditorName     = null;
    let creditorLedgerId = null;

    if (creditorId) {
      const customer = await Customer.findById(creditorId).lean();
      if (customer) {
        creditorName     = customer.name;
        creditorLedgerId = customer.ledgerId?.toString() || null;
      }
    }

    // ── Sales filter — always CREDIT only (no LOCAL rows) ────────
    const baseFilter = { companyId, saleMode: 'CREDIT' };
    if (creditorId) baseFilter.creditorId = creditorId;

    // ── Opening Balance: prior CREDIT sales − prior receipts ─────
    const priorSalesAgg = await MilkSales.aggregate([
      { $match: { ...baseFilter, date: { $lt: start } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const priorSales = priorSalesAgg[0]?.total || 0;

    let priorReceipts = 0;
    if (creditorLedgerId) {
      const priorVouchers = await Voucher.find({
        companyId,
        voucherType: { $in: ['Receipt', 'Payment'] },
        voucherDate: { $lt: start },
        'entries.ledgerId': creditorLedgerId
      }).lean();
      for (const v of priorVouchers) {
        for (const e of v.entries) {
          if (e.ledgerId?.toString() === creditorLedgerId) {
            if (v.voucherType === 'Receipt') priorReceipts += e.creditAmount || 0;
          }
        }
      }
    }

    const openingBalance = priorSales - priorReceipts;

    // ── Sales in period ───────────────────────────────────────────
    const sales = await MilkSales
      .find({ ...baseFilter, date: { $gte: start, $lte: end } })
      .sort({ date: 1, session: 1 })
      .lean();

    // ── Daybook Receipt/Payment vouchers in period ─────────────────
    const voucherQuery = {
      companyId,
      voucherType: { $in: ['Receipt', 'Payment'] },
      voucherDate: { $gte: start, $lte: end }
    };
    if (creditorLedgerId) voucherQuery['entries.ledgerId'] = creditorLedgerId;
    const vouchers = creditorLedgerId ? await Voucher.find(voucherQuery).lean() : [];

    // Group vouchers by date-key
    const vMap = {};
    for (const v of vouchers) {
      const dk = v.voucherDate.toISOString().split('T')[0];
      if (!vMap[dk]) vMap[dk] = { payment: 0, receipt: 0 };
      for (const e of v.entries) {
        if (e.ledgerId?.toString() === creditorLedgerId) {
          if (v.voucherType === 'Receipt') vMap[dk].receipt += e.creditAmount || 0;
          if (v.voucherType === 'Payment') vMap[dk].payment += e.debitAmount  || 0;
        }
      }
    }

    // Group sales by date-key
    const sMap = {};
    for (const s of sales) {
      const dk = new Date(s.date).toISOString().split('T')[0];
      if (!sMap[dk]) sMap[dk] = { am: { qty: 0, value: 0 }, pm: { qty: 0, value: 0 } };
      if (s.session === 'AM') { sMap[dk].am.qty += s.litre; sMap[dk].am.value += s.amount; }
      else                    { sMap[dk].pm.qty += s.litre; sMap[dk].pm.value += s.amount; }
    }

    // Only include dates that have actual sales OR receipts (no empty rows)
    const allDates = new Set([...Object.keys(sMap), ...Object.keys(vMap)]);

    // Build rows with running balance
    let balance = openingBalance;
    const rows = [];
    for (const dk of Array.from(allDates).sort()) {
      const ds  = sMap[dk]  || { am: { qty: 0, value: 0 }, pm: { qty: 0, value: 0 } };
      const dv  = vMap[dk]  || { payment: 0, receipt: 0 };
      const tot = ds.am.value + ds.pm.value;
      const ob  = balance;
      balance   = ob + tot - dv.receipt;
      rows.push({ date: dk, ob, am: ds.am, pm: ds.pm, totalSalesValue: tot, payment: dv.payment, receipt: dv.receipt, balance });
    }

    // Totals
    const totals = rows.reduce((a, r) => ({
      amQty:           a.amQty           + r.am.qty,
      amValue:         a.amValue         + r.am.value,
      pmQty:           a.pmQty           + r.pm.qty,
      pmValue:         a.pmValue         + r.pm.value,
      totalSalesValue: a.totalSalesValue + r.totalSalesValue,
      payment:         a.payment         + r.payment,
      receipt:         a.receipt         + r.receipt
    }), { amQty: 0, amValue: 0, pmQty: 0, pmValue: 0, totalSalesValue: 0, payment: 0, receipt: 0 });

    res.json({
      success: true,
      data: { rows, openingBalance, closingBalance: balance, creditorName, totals }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  CREDITOR OUTSTANDING BALANCE
//  GET /creditor-balance?creditorId=&date=
//  Returns cumulative (sales − receipts) for a creditor up to (not including) date
// ────────────────────────────────────────────────────────────────
export const getCreditorBalance = async (req, res) => {
  try {
    const { creditorId, date } = req.query;
    if (!creditorId) return res.json({ success: true, data: { balance: 0 } });

    const companyId = req.companyId;
    const cutoff = date ? new Date(date) : new Date();
    cutoff.setHours(0, 0, 0, 0);

    const salesAgg = await MilkSales.aggregate([
      { $match: { companyId, creditorId: new mongoose.Types.ObjectId(creditorId), saleMode: 'CREDIT', date: { $lt: cutoff } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalSales = salesAgg[0]?.total || 0;

    const customer = await Customer.findById(creditorId).lean();
    const creditorLedgerId = customer?.ledgerId?.toString() || null;
    let totalReceipts = 0;
    if (creditorLedgerId) {
      const vouchers = await Voucher.find({
        companyId,
        voucherType: { $in: ['Receipt', 'Payment'] },
        voucherDate: { $lt: cutoff },
        'entries.ledgerId': creditorLedgerId
      }).lean();
      for (const v of vouchers) {
        for (const e of v.entries) {
          if (e.ledgerId?.toString() === creditorLedgerId && v.voucherType === 'Receipt') {
            totalReceipts += e.creditAmount || 0;
          }
        }
      }
    }

    res.json({ success: true, data: { balance: Math.max(0, totalSales - totalReceipts) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

import MilkSales from '../models/MilkSales.js';
import Voucher   from '../models/Voucher.js';
import Customer  from '../models/Customer.js';
import Ledger    from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances, findOrCreateLedger } from '../utils/accountingHelper.js';

// ── Helper: create accounting voucher for a milk sale ────────────────────────
async function createMilkSaleVoucher(sale, companyId) {
  const { saleMode, paymentType, creditorId, amount, date, billNo, session } = sale;
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

    const saleLedger = await findOrCreateLedger(
      saleLedgerName, 'Income', 'Income', 'Cr', companyId
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
    // Journal: Dr Creditor ledger, Cr MILK CREDIT SALES / SCHOOL MILK SALES
    const customer = creditorId ? await Customer.findById(creditorId).lean() : null;
    if (!customer) return null;
    const isSchool = ['School', 'Anganwadi'].includes(customer.category);
    const saleLedgerName = isSchool ? 'SCHOOL MILK SALES' : 'MILK CREDIT SALES';
    const [creditorLedger, saleLedger] = await Promise.all([
      customer.ledgerId ? Ledger.findById(customer.ledgerId) : null,
      findOrCreateLedger(saleLedgerName, 'Income', 'Income', 'Cr', companyId)
    ]);
    if (!creditorLedger) return null;
    const entries = [
      { ledgerId: creditorLedger._id, ledgerName: creditorLedger.ledgerName, debitAmount: amount, creditAmount: 0,      narration: shiftNote.trim() },
      { ledgerId: saleLedger._id,     ledgerName: saleLedger.ledgerName,     debitAmount: 0,      creditAmount: amount, narration: shiftNote.trim() }
    ];
    const voucherNumber = await generateVoucherNumber('Journal', companyId);
    const voucher = new Voucher({
      voucherType: 'Journal', voucherNumber, voucherDate: date, entries,
      totalDebit: amount, totalCredit: amount,
      narration: `Milk Sales (CREDIT) - ${billNo} - ${customer.name}${shiftNote}`,
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
    const { date, month, year, session, saleMode, page = 1, limit = 500 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId: req.companyId };

    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
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
      const str = String(dateStr);
      const [datePart, timePart] = str.split(' ');
      const parts = datePart.split('-');
      if (parts.length !== 3) return new Date(str);
      const [dd, mm, yyyy] = parts;
      return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${timePart || '00:00'}:00`);
    };

    const getSession = (dateStr) => {
      const timePart = dateStr ? String(dateStr).split(' ')[1] : null;
      if (!timePart) return 'AM';
      return parseInt(timePart.split(':')[0]) < 12 ? 'AM' : 'PM';
    };

    const docs = [];
    const skipped = [];

    for (const row of records) {
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

    let inserted = 0;
    try {
      const result = await MilkSales.insertMany(docs, { ordered: false });
      inserted = result.length;
    } catch (err) {
      if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
        inserted = err.result?.nInserted ?? 0;
      } else {
        throw err;
      }
    }

    const totalSkipped = skipped.length + (docs.length - inserted);
    res.status(201).json({
      success: true,
      data: { inserted, skipped: totalSkipped, skipReasons: skipped.slice(0, 20) },
      message: `${inserted} inserted, ${totalSkipped} skipped`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────
//  BULK IMPORT  (Zibitt / CSV — no accounting vouchers)
// ────────────────────────────────────────────────────────────────
export const bulkImportMilkSales = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }

    const docs = records.map(r => ({ ...r, companyId: req.companyId }));
    const inserted = await MilkSales.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, data: { inserted: inserted.length }, message: `${inserted.length} records imported` });
  } catch (err) {
    if (err.name === 'BulkWriteError' || err.code === 11000) {
      const inserted = err.result?.nInserted ?? 0;
      return res.status(207).json({ success: true, data: { inserted }, message: `${inserted} records imported (some skipped as duplicates)` });
    }
    res.status(400).json({ success: false, message: err.message });
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

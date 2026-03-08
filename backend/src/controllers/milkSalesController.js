import MilkSales from '../models/MilkSales.js';
import Voucher   from '../models/Voucher.js';
import Customer  from '../models/Customer.js';

// ────────────────────────────────────────────────────────────────
//  GET ALL  (filter by date, session, saleMode; pagination)
// ────────────────────────────────────────────────────────────────
export const getMilkSales = async (req, res) => {
  try {
    const { date, session, saleMode, page = 1, limit = 500 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId: req.companyId };

    if (date) {
      // Match the full calendar day (ignoring time)
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    if (session) filter.session = session;
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
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
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

    // ── Sales filter ──────────────────────────────────────────────
    const baseFilter = { companyId };
    if (creditorId) {
      baseFilter.creditorId = creditorId;
      baseFilter.saleMode   = 'CREDIT';
    } else {
      baseFilter.saleMode = 'LOCAL';
    }

    // ── Opening Balance: prior sales − prior receipts ─────────────
    const priorSalesAgg = await MilkSales.aggregate([
      { $match: { ...baseFilter, date: { $lt: start } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const priorSales = priorSalesAgg[0]?.total || 0;

    let priorReceipts = 0;
    if (creditorLedgerId) {
      const priorVouchers = await Voucher.find({
        voucherType: 'Receipt',
        voucherDate: { $lt: start },
        'entries.ledgerId': creditorLedgerId
      }).lean();
      for (const v of priorVouchers) {
        for (const e of v.entries) {
          if (e.ledgerId?.toString() === creditorLedgerId) {
            priorReceipts += e.creditAmount || 0;
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

    // ── Daybook vouchers in period ────────────────────────────────
    const voucherQuery = { voucherDate: { $gte: start, $lte: end } };
    if (creditorLedgerId) voucherQuery['entries.ledgerId'] = creditorLedgerId;
    const vouchers = await Voucher.find(voucherQuery).lean();

    // Group vouchers by date-key
    const vMap = {};
    for (const v of vouchers) {
      const dk = v.voucherDate.toISOString().split('T')[0];
      if (!vMap[dk]) vMap[dk] = { payment: 0, receipt: 0 };
      if (v.voucherType === 'Payment') {
        if (creditorLedgerId) {
          for (const e of v.entries) {
            if (e.ledgerId?.toString() === creditorLedgerId) vMap[dk].payment += e.debitAmount || 0;
          }
        } else {
          vMap[dk].payment += v.totalDebit;
        }
      }
      if (v.voucherType === 'Receipt') {
        if (creditorLedgerId) {
          for (const e of v.entries) {
            if (e.ledgerId?.toString() === creditorLedgerId) vMap[dk].receipt += e.creditAmount || 0;
          }
        } else {
          vMap[dk].receipt += v.totalCredit;
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

    // Generate every calendar day in range
    const allDates = new Set(Object.keys(sMap));
    const cur = new Date(start);
    while (cur <= end) { allDates.add(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

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

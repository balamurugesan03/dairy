import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import MilkCollection from '../models/MilkCollection.js';
import MilkSales from '../models/MilkSales.js';
import Sales from '../models/Sales.js';
import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import ProducerPayment from '../models/ProducerPayment.js';
import BankTransfer from '../models/BankTransfer.js';
import PaymentRegister from '../models/PaymentRegister.js';
import StockTransaction from '../models/StockTransaction.js';
import ProducerLoan from '../models/ProducerLoan.js';
import { getDateRange } from '../utils/dateFilters.js';
import { findOrCreateLedger } from '../utils/accountingHelper.js';
import {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  getLedgerCategory,
  getParentGroupFromLedgerType,
  getDefaultVoucherType
} from '../utils/balanceCalculator.js';

// 1. CASH BOOK REPORT
export const getCashBook = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Resolve CATTLE FEED SALES / ADVANCE ledger names from Ledger management
    const [cfSalesLedgerDoc, cfAdvLedgerDoc] = await Promise.all([
      Ledger.findOne({ companyId: req.companyId, ledgerName: { $regex: /^cattle\s*feed\s*sales$/i } }).lean(),
      Ledger.findOne({ companyId: req.companyId, ledgerName: { $regex: /^cattle\s*feed\s*advance$/i } }).lean()
    ]);
    const cfSalesLedgerName  = cfSalesLedgerDoc?.ledgerName  || 'CATTLE FEED SALES';
    const cfAdvanceLedgerName = cfAdvLedgerDoc?.ledgerName   || 'CATTLE FEED ADVANCE';

    // Find cash ledger — auto-create if missing
    let cashLedger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active', companyId: req.companyId });
    if (!cashLedger) {
      cashLedger = new Ledger({
        ledgerName: 'Cash in Hand',
        ledgerType: 'Cash',
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId: req.companyId
      });
      await cashLedger.save();
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(
      Ledger,
      Voucher,
      cashLedger._id,
      dateFilter.startDate,
      req.companyId
    );

    // Get all vouchers affecting cash in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': cashLedger._id
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Direct cash receipts — Item Sales (Cash)
    // Skip rows that already have a Voucher posted (those are picked up by the
    // voucher loop above via the Sales voucher's Cash leg) — prevents the same
    // cash inventory sale from appearing twice in the Cash Book.
    const itemSalesCash = await Sales.find({
      companyId: req.companyId,
      billDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 },
      $or: [
        { ledgerEntries: { $exists: false } },
        { ledgerEntries: { $size: 0 } }
      ]
    }).sort({ billDate: 1 });

    // Direct cash payments — Farmer Payments (Cash)
    // Skip rows that already have a Voucher posted (those are picked up by the voucher loop).
    // Also skip paymentSource:'BankTransfer' rows — those are always covered by either the
    // BankTransfer's Payment voucher (cash leg) or the BankTransfer summary entry above.
    const farmerPaymentsCash = await FarmerPayment.find({
      companyId: req.companyId,
      paymentDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 },
      paymentSource: { $ne: 'BankTransfer' },
      $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
    }).sort({ paymentDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Direct cash payments — Advances to Farmers (Cash)
    const advancesCash = await Advance.find({
      companyId: req.companyId,
      advanceDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      advanceAmount: { $gt: 0 }
    }).sort({ advanceDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Direct cash payments — Producer Receipts/Loans (Cash)
    const producerReceiptsCash = await ProducerReceipt.find({
      companyId: req.companyId,
      receiptDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      amount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).sort({ receiptDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Direct cash payments — Producer Payments (Payment-to-Producer, Cash mode)
    const producerPaymentsCash = await ProducerPayment.find({
      companyId: req.companyId,
      paymentDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      amountPaid: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).sort({ paymentDate: 1 });

    // Completed Bank Transfers — Payment side
    // Skip transfers that already have a Voucher posted (avoid double-counting against the voucher loop)
    const completedBankTransfers = await BankTransfer.find({
      companyId: req.companyId,
      status: 'Completed',
      applyDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      totalTransferAmount: { $gt: 0 },
      $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
    }).sort({ applyDate: 1 });

    // Collect raw transactions before sorting
    const rawTransactions = [];

    // From vouchers (existing accounting entries)
    // Skip ProducerReceipt/ProducerPayment vouchers — covered by direct queries below.
    // Skip milk LOCAL/SAMPLE sale Receipt vouchers — aggregated per day below.
    vouchers.forEach(voucher => {
      if (voucher.referenceType === 'ProducerReceipt') return;
      if (voucher.referenceType === 'ProducerPayment') return;
      if (voucher.referenceType === 'Sales' && voucher.voucherType === 'Receipt') return;
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === cashLedger._id.toString()) {
          const isReceipt = entry.debitAmount > 0;
          const amount = isReceipt ? entry.debitAmount : entry.creditAmount;
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== cashLedger._id.toString()
          );
          // For Sales vouchers show the income ledger name directly (no "From/To" prefix)
          const isSalesVoucher = voucher.voucherType === 'Sales';
          rawTransactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: isSalesVoucher
              ? (contraEntry?.ledgerId?.ledgerName || 'CATTLE FEED SALES')
              : isReceipt
                ? `From ${contraEntry?.ledgerId?.ledgerName || 'Various'}`
                : `To ${contraEntry?.ledgerId?.ledgerName || 'Various'}`,
            voucherId: voucher._id,
            debit: isReceipt ? amount : 0,
            credit: isReceipt ? 0 : amount,
            narration: entry.narration || voucher.narration
          });
        }
      });
    });

    // Milk Sales LOCAL/SAMPLE — single aggregated cash entry per day
    const milkLocalSalesCBAgg = await MilkSales.aggregate([
      {
        $match: {
          companyId: req.companyId,
          date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
          saleMode: { $in: ['LOCAL', 'SAMPLE'] },
          paymentType: 'Cash',
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: {
            day:      { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            session:  '$session',
            saleMode: '$saleMode'
          },
          totalQty:    { $sum: '$litre' },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.day': 1, '_id.session': 1 } }
    ]);

    const cbLocalDayMap = {};
    for (const r of milkLocalSalesCBAgg) {
      const { day, session, saleMode } = r._id;
      if (!cbLocalDayMap[day]) cbLocalDayMap[day] = {};
      if (!cbLocalDayMap[day][saleMode]) cbLocalDayMap[day][saleMode] = {};
      cbLocalDayMap[day][saleMode][(session || 'AM').toUpperCase()] = {
        qty: r.totalQty, amount: r.totalAmount
      };
    }

    const fmtCBN = (n) => Number(n || 0).toFixed(2);

    for (const day of Object.keys(cbLocalDayMap).sort()) {
      for (const saleMode of Object.keys(cbLocalDayMap[day])) {
        const shifts = cbLocalDayMap[day][saleMode];
        const am = shifts['AM'] || { qty: 0, amount: 0 };
        const pm = shifts['PM'] || { qty: 0, amount: 0 };
        const totalAmt = (am.amount || 0) + (pm.amount || 0);
        if (totalAmt <= 0) continue;
        const ledgerLabel = saleMode === 'SAMPLE' ? 'SAMPLE SALES' : 'LOCAL SALES';
        const narration = [
          `AM, QTY ${fmtCBN(am.qty)}, AMOUNT ${fmtCBN(am.amount)}`,
          `PM, QTY ${fmtCBN(pm.qty)}, AMOUNT ${fmtCBN(pm.amount)}`
        ].join('\n');
        rawTransactions.push({
          date: new Date(day),
          voucherNumber: `MLS-${day.replace(/-/g, '')}`,
          voucherType: 'MilkSales',
          particulars: ledgerLabel,
          debit: totalAmt,
          credit: 0,
          narration
        });
      }
    }

    // Item Sales — Cash Receipts (fallback for sales without an auto-posted voucher)
    itemSalesCash.forEach(sale => {
      const itemDetail = (sale.items || [])
        .map(i => `${i.itemName} Qty:${parseFloat(i.quantity) || 0} @ Rs.${parseFloat(i.rate) || 0}`)
        .join('; ');
      rawTransactions.push({
        date: sale.billDate,
        voucherNumber: sale.billNumber || `SAL-${sale._id.toString().slice(-6)}`,
        voucherType: 'Sale',
        particulars: cfSalesLedgerName,
        debit: sale.paidAmount,
        credit: 0,
        narration: itemDetail ? `${itemDetail} | Bill No: ${sale.billNumber}` : `Bill No: ${sale.billNumber}`
      });
    });

    // Farmer Payments — Cash Payments
    farmerPaymentsCash.forEach(fp => {
      const farmerName = fp.farmerId?.farmerName || fp.farmerId?.farmerNumber || 'Farmer';
      rawTransactions.push({
        date: fp.paymentDate,
        voucherNumber: fp.paymentNumber || `FP-${fp._id.toString().slice(-6)}`,
        voucherType: 'FarmerPayment',
        particulars: `Farmer Payment — ${farmerName}`,
        debit: 0,
        credit: fp.paidAmount,
        narration: fp.narration || 'Farmer Payment (Cash)'
      });
    });

    // Advances — Cash Payments
    advancesCash.forEach(adv => {
      const farmerName = adv.farmerId?.farmerName || adv.farmerId?.farmerNumber || 'Farmer';
      rawTransactions.push({
        date: adv.advanceDate,
        voucherNumber: adv.advanceNumber || `ADV-${adv._id.toString().slice(-6)}`,
        voucherType: 'Advance',
        particulars: 'Farmers Cash Advance',
        debit: 0,
        credit: adv.advanceAmount,
        narration: `Cash Advance to ${farmerName}`
      });
    });

    // Producer Receipts — Cash returns (CF Advance, Cash Advance, Loan Advance)
    const cashBookLedgerMap = {
      'CF Advance':   cfAdvanceLedgerName,
      'Cash Advance': 'Farmers Cash Advance',
      'Loan Advance': 'Farmers Loan A/C',
    };
    producerReceiptsCash.forEach(pr => {
      const farmerName  = pr.farmerId?.farmerName || pr.farmerId?.farmerNumber || 'Producer';
      const particulars = cashBookLedgerMap[pr.receiptType] || pr.receiptType || 'Producer';
      rawTransactions.push({
        date: pr.receiptDate,
        voucherNumber: pr.receiptNumber || `PR-${pr._id.toString().slice(-6)}`,
        voucherType: 'ProducerLoan',
        particulars,
        debit: pr.amount,   // cash received from farmer
        credit: 0,
        narration: `${pr.receiptType} Return — ${farmerName}`
      });
    });

    // Producer Payments — Cash (Payment-to-Producer)
    producerPaymentsCash.forEach(pp => {
      rawTransactions.push({
        date: pp.paymentDate,
        voucherNumber: pp.paymentNumber || `PTP-${pp._id.toString().slice(-6)}`,
        voucherType: 'Payment',
        particulars: 'PRODUCERS DUES',
        debit: 0,
        credit: pp.amountPaid,
        narration: `Payment to Producer — ${pp.producerName || ''}`.trim()
      });
    });

    // Completed Bank Transfers — Payment side
    completedBankTransfers.forEach(bt => {
      rawTransactions.push({
        date: bt.applyDate,
        voucherNumber: bt.transferNumber || `BT-${bt._id.toString().slice(-6)}`,
        voucherType: 'BankTransfer',
        particulars: `Producer Due — ${bt.transferNumber} (${bt.totalApproved} producers)`,
        debit: 0,
        credit: bt.totalTransferAmount,
        narration: bt.remarks || `Bank Transfer Payment — ${bt.totalApproved} producers`
      });
    });

    // (Milk Purchase is a non-cash adjustment: Dr MILK PURCHASE / Cr PRODUCERS
    // DUES. It never moves cash, so it must not appear in the Cash Book.)

    // Sort all by date
    rawTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    const transactions = [];
    let runningBalance = openingBalance;
    rawTransactions.forEach(txn => {
      runningBalance += (txn.debit || 0) - (txn.credit || 0);
      transactions.push({ ...txn, balance: runningBalance });
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = runningBalance;

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        openingBalance,
        closingBalance,
        transactions,
        summary: {
          totalReceipts: totalDebits,
          totalPayments: totalCredits,
          netChange: totalDebits - totalCredits
        }
      }
    });
  } catch (error) {
    console.error('Error generating cash book:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating cash book'
    });
  }
};

// 2. GENERAL LEDGER REPORT
export const getGeneralLedger = async (req, res) => {
  try {
    const { ledgerId, startDate, endDate, filterType, customStart, customEnd } = req.query;

    if (!ledgerId) {
      return res.status(400).json({ success: false, message: 'Ledger ID is required' });
    }

    // Date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
      const end   = new Date(endDate);   end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date parameters' });
    }

    // Ledger details
    const ledger = await Ledger.findOne({ _id: ledgerId, companyId: req.companyId });
    if (!ledger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

    // Opening balance (sum of all voucher entries before start date)
    const openingBalance = await calculateOpeningBalance(
      Ledger, Voucher, ledgerId, dateFilter.startDate, req.companyId
    );

    // ── Collect raw transactions from Vouchers ─────────────────────────────────
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      'entries.ledgerId': ledgerId
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    const rawTxns = [];

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (!entry.ledgerId) return;
        if (entry.ledgerId._id.toString() !== ledgerId.toString()) return;

        const contraEntry = voucher.entries.find(
          e => e.ledgerId && e.ledgerId._id.toString() !== ledgerId.toString()
        );
        rawTxns.push({
          date:          voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType:   voucher.voucherType,
          particulars:   contraEntry?.ledgerName || voucher.narration || 'Various',
          voucherId:     voucher._id,
          debit:         entry.debitAmount  || 0,
          credit:        entry.creditAmount || 0,
          narration:     entry.narration || voucher.narration || '',
        });
      });
    });

    // ── Dairy-direct queries (dairy flow without formal vouchers) ──────────────
    const lName = ledger.ledgerName.toLowerCase();
    const lType = ledger.ledgerType;

    // ── 1. MILK PURCHASE ledger: Dr side of every milk collection ──
    // Match only by ledger name — type-based matching is too broad and would
    // incorrectly pull milk-collection data into Purchase Returns and other
    // Purchases-type ledgers that share the same ledger type.
    const isMilkPurchaseLedger =
      /milk\s*(purchase|procure|collection)/i.test(ledger.ledgerName);

    // ── 2. PRODUCERS DUES ledger: Cr side of milk collection + Dr side of farmer payments ──
    const isProducersDuesLedger =
      /producers?\s*(dues?|payable|account)/i.test(ledger.ledgerName) ||
      (lType === 'Other Payable' && /producer|farmer|dues/i.test(ledger.ledgerName));

    if (isMilkPurchaseLedger || isProducersDuesLedger) {
      // Aggregate MilkCollection by day + shift
      const mcAgg = await MilkCollection.aggregate([
        {
          $match: {
            companyId: req.companyId,
            date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
            amount: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: {
              day:   { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              shift: '$shift'
            },
            totalQty:    { $sum: '$qty'    },
            totalAmount: { $sum: '$amount' },
            farmerCount: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1, '_id.shift': 1 } }
      ]);

      mcAgg.forEach(c => {
        const { day, shift } = c._id;
        rawTxns.push({
          date:          new Date(day + 'T00:00:00.000Z'),
          voucherNumber: `MKP-${day.replace(/-/g, '')}-${shift}`,
          voucherType:   'MilkPurchase',
          // Dr Milk Purchase / Dr Producers Dues (dairy cooperative: receipt side = amount owed to producer)
          particulars:   isMilkPurchaseLedger ? 'PRODUCERS DUES' : 'MILK PURCHASE',
          debit:         (isMilkPurchaseLedger || isProducersDuesLedger) ? c.totalAmount : 0,
          credit:        0,
          narration:     `${shift} | Qty: ${c.totalQty.toFixed(2)} L | ${c.farmerCount} farmers`,
        });
      });
    }

    // ── LOCAL SALES / SAMPLE SALES: also pull from MilkSales for completeness
    //    (vouchers already cover this, but include unvouched entries too)
    const isMilkSalesLedger =
      /local\s*sales?|sample\s*sales?|credit\s*sales?/i.test(ledger.ledgerName) ||
      (lType === 'Sales' && /milk|local|credit|sample/i.test(ledger.ledgerName));

    if (isMilkSalesLedger) {
      const saleModeFilter = /local/i.test(ledger.ledgerName) ? 'LOCAL'
        : /sample/i.test(ledger.ledgerName) ? 'SAMPLE'
        : /credit/i.test(ledger.ledgerName) ? 'CREDIT'
        : null;

      const msMatch = {
        companyId: req.companyId,
        date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        amount: { $gt: 0 },
        $or: [{ voucherId: { $exists: false } }, { voucherId: null }]
      };
      if (saleModeFilter) msMatch.saleMode = saleModeFilter;

      const unvouchedSales = await MilkSales.find(msMatch).sort({ date: 1 });
      unvouchedSales.forEach(s => {
        rawTxns.push({
          date:          s.date,
          voucherNumber: s.billNo,
          voucherType:   'MilkSales',
          particulars:   s.creditorName || s.centerName || 'Customer',
          debit:         0,
          credit:        s.amount || 0, // income ledger → Cr side (receipt)
          narration:     `${s.session || ''} | ${s.litre || 0} L @ ${s.rate || 0}`,
        });
      });
    }

    // ── 3. CATTLE FEED PURCHASE ledger — fallback for un-vouchered purchases ──
    // Only pulls transactions without a voucher so formal Purchase vouchers
    // (created by accountingHelper.createSalesVoucher) are not double-counted.
    // Dr to a Purchases A/c ledger (debit-normal) → debit field → Receipt side in GL.
    const isCfPurchaseLedger =
      /cattle\s*feed\s*purchase|cf\s*purchase/i.test(ledger.ledgerName) ||
      (/cattle\s*feed/i.test(ledger.ledgerName) && lType === 'Purchases');

    if (isCfPurchaseLedger) {
      const cfTxns = await StockTransaction.find({
        companyId: req.companyId,
        transactionType: 'Stock In',
        referenceType: { $nin: ['Return', 'Opening Balance Adjustment'] },
        $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
        $expr: { $and: [
          { $gte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.startDate] },
          { $lte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.endDate] }
        ]}
      }).select('quantity rate purchaseDate date invoiceNumber supplierName').lean();

      cfTxns.forEach(t => {
        const txDate = t.purchaseDate || t.date;
        rawTxns.push({
          date:          txDate,
          voucherNumber: t.invoiceNumber || `CFP-${new Date(txDate).toISOString().slice(0,10)}`,
          voucherType:   'CFPurchase',
          particulars:   t.supplierName || 'Cattle Feed Supplier',
          debit:         (t.quantity || 0) * (t.rate || 0),
          credit:        0,
          narration:     `Qty: ${t.quantity || 0} @ ${t.rate || 0}`,
        });
      });
    }

    // ── 4. CATTLE FEED SALES ledger — fallback for un-vouchered sales ──
    // Only pulls transactions without a voucher so Sales vouchers
    // (created by accountingHelper.createSalesVoucher) are not double-counted.
    // Cr to a Sales ledger (credit-normal) → credit field → Receipt side in GL.
    const isCfSalesLedger =
      /cattle\s*feed\s*sales?|cf\s*sales?/i.test(ledger.ledgerName) ||
      (/cattle\s*feed/i.test(ledger.ledgerName) && lType === 'Sales');

    if (isCfSalesLedger) {
      const cfSaleTxns = await StockTransaction.find({
        companyId: req.companyId,
        transactionType: 'Stock Out',
        referenceType: { $nin: ['Return', 'Opening Balance Adjustment'] },
        $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
        $expr: { $and: [
          { $gte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.startDate] },
          { $lte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.endDate] }
        ]}
      }).select('quantity rate purchaseDate date invoiceNumber customerName').lean();

      cfSaleTxns.forEach(t => {
        const txDate = t.purchaseDate || t.date;
        rawTxns.push({
          date:          txDate,
          voucherNumber: t.invoiceNumber || `CFS-${new Date(txDate).toISOString().slice(0,10)}`,
          voucherType:   'CFSales',
          particulars:   t.customerName || 'Cattle Feed Customer',
          debit:         0,
          credit:        (t.quantity || 0) * (t.rate || 0),
          narration:     `Qty: ${t.quantity || 0} @ ${t.rate || 0}`,
        });
      });
    }

    // ── 5. CATTLE FEED ADVANCE ledger → receipt (debit) side ──
    // Asset ledger — advance given to farmer increases asset (Dr)
    const isCfAdvanceLedger =
      /cattle\s*feed\s*adv|cf\s*adv/i.test(ledger.ledgerName) ||
      (/cattle\s*feed/i.test(ledger.ledgerName) && /advanc/i.test(ledger.ledgerName));

    if (isCfAdvanceLedger) {
      const cfAdvTxns = await Advance.find({
        companyId: req.companyId,
        advanceCategory: 'CF Advance',
        advanceDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        status: { $ne: 'Cancelled' }
      })
        .select('advanceDate advanceAmount advanceNumber farmerId')
        .populate('farmerId', 'personalDetails.name farmerNumber')
        .lean();

      cfAdvTxns.forEach(t => {
        const farmerName = t.farmerId?.personalDetails?.name || t.farmerId?.farmerNumber || 'Producer';
        rawTxns.push({
          date:          t.advanceDate,
          voucherNumber: t.advanceNumber || `CFA-${new Date(t.advanceDate).toISOString().slice(0,10)}`,
          voucherType:   'CFAdvance',
          particulars:   farmerName,
          debit:         t.advanceAmount || 0,
          credit:        0,
          narration:     'Cattle Feed Advance',
        });
      });
    }

    // ── 6. PRODUCER RECEIPT ledger → receipt (debit) side ──
    const isProducerReceiptLedger =
      /producer\s*receipt|farmer\s*receipt/i.test(ledger.ledgerName) ||
      (/receipt/i.test(ledger.ledgerName) && /producer|farmer/i.test(ledger.ledgerName));

    if (isProducerReceiptLedger) {
      const prTxns = await ProducerReceipt.find({
        companyId: req.companyId,
        status: 'Active',
        receiptDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate }
      }).select('receiptDate amount receiptNumber farmerName').lean();

      prTxns.forEach(t => {
        rawTxns.push({
          date:          t.receiptDate,
          voucherNumber: t.receiptNumber || `PR-${new Date(t.receiptDate).toISOString().slice(0,10)}`,
          voucherType:   'ProducerReceipt',
          particulars:   t.farmerName || 'Producer',
          debit:         t.amount || 0,
          credit:        0,
          narration:     'Producer Receipt',
        });
      });
    }

    // ── 7. CASH ADVANCE ledger → receipt (debit) side ──
    // Asset ledger — advance given to farmer increases asset (Dr)
    const isCashAdvanceLedger =
      /cash\s*advanc|farmer.*cash.*adv|farmers.*cash.*adv/i.test(ledger.ledgerName);

    if (isCashAdvanceLedger) {
      const cashAdvTxns = await Advance.find({
        companyId: req.companyId,
        advanceCategory: 'Cash Advance',
        advanceDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        status: { $ne: 'Cancelled' }
      })
        .select('advanceDate advanceAmount advanceNumber farmerId')
        .populate('farmerId', 'personalDetails.name farmerNumber')
        .lean();

      cashAdvTxns.forEach(t => {
        const farmerName = t.farmerId?.personalDetails?.name || t.farmerId?.farmerNumber || 'Producer';
        rawTxns.push({
          date:          t.advanceDate,
          voucherNumber: t.advanceNumber || `CA-${new Date(t.advanceDate).toISOString().slice(0,10)}`,
          voucherType:   'CashAdvance',
          particulars:   farmerName,
          debit:         t.advanceAmount || 0,
          credit:        0,
          narration:     'Cash Advance',
        });
      });
    }

    // ── 8. LOAN ADVANCE ledger → receipt (debit) side ──
    // Asset ledger — loan given to farmer increases asset (Dr)
    const isLoanAdvanceLedger =
      /loan\s*advanc|producer\s*loan|farmer.*loan/i.test(ledger.ledgerName);

    if (isLoanAdvanceLedger) {
      const loanTxns = await ProducerLoan.find({
        companyId: req.companyId,
        loanDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        status: { $ne: 'Cancelled' }
      })
        .select('loanDate principalAmount loanNumber farmerId')
        .populate('farmerId', 'personalDetails.name farmerNumber')
        .lean();

      loanTxns.forEach(t => {
        const farmerName = t.farmerId?.personalDetails?.name || t.farmerId?.farmerNumber || 'Producer';
        rawTxns.push({
          date:          t.loanDate,
          voucherNumber: t.loanNumber || `LA-${new Date(t.loanDate).toISOString().slice(0,10)}`,
          voucherType:   'LoanAdvance',
          particulars:   farmerName,
          debit:         t.principalAmount || 0,
          credit:        0,
          narration:     'Loan Advance',
        });
      });
    }

    // ── 9. KDFW WELFARE ledger → receipt (debit) side ──
    const isKdwfLedger =
      /kdfw|kdwf|welfare/i.test(ledger.ledgerName);

    if (isKdwfLedger) {
      const welfareAgg = await PaymentRegister.find({
        companyId: req.companyId,
        fromDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate }
      }).select('fromDate toDate totalWelfare registerNumber').lean();

      welfareAgg.forEach(t => {
        if ((t.totalWelfare || 0) <= 0) return;
        rawTxns.push({
          date:          t.fromDate,
          voucherNumber: t.registerNumber || `WLF-${new Date(t.fromDate).toISOString().slice(0,10)}`,
          voucherType:   'Welfare',
          particulars:   'KDFW Welfare Collection',
          debit:         t.totalWelfare || 0,
          credit:        0,
          narration:     `Period: ${new Date(t.fromDate).toLocaleDateString('en-IN')} - ${new Date(t.toDate).toLocaleDateString('en-IN')}`,
        });
      });
    }

    // ── 10. CATTLE FEED COMMISSION ledger → receipt (debit) side ──
    const isCfCommissionLedger =
      /cattle\s*feed\s*comm|cf\s*comm/i.test(ledger.ledgerName);

    if (isCfCommissionLedger) {
      // Only pull from StockTransaction for entries NOT already covered by a Voucher
      const cfCommTxns = await StockTransaction.find({
        companyId: req.companyId,
        transactionType: 'Stock In',
        referenceType: { $nin: ['Return', 'Opening Balance Adjustment'] },
        $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
        $expr: { $and: [
          { $gte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.startDate] },
          { $lte: [{ $ifNull: ['$purchaseDate', '$date'] }, dateFilter.endDate] }
        ]}
      }).select('quantity purchaseDate date invoiceNumber ledgerEntries')
        .populate('ledgerEntries.ledgerId', 'ledgerName').lean();

      cfCommTxns.forEach(t => {
        const txDate = t.purchaseDate || t.date;
        (t.ledgerEntries || []).forEach(le => {
          const name = (le.ledgerId?.ledgerName || '').toLowerCase();
          if (!name.includes('cattle feed commission') && !name.includes('cf commission')) return;
          const amt = le.amount || 0; // le.amount is already total — do NOT multiply by quantity
          if (amt <= 0) return;
          rawTxns.push({
            date:          txDate,
            voucherNumber: t.invoiceNumber || `CFCO-${new Date(txDate).toISOString().slice(0,10)}`,
            voucherType:   'CFCommission',
            particulars:   'Cattle Feed Commission',
            debit:         0,
            credit:        amt, // commission is INCOME → credit side
            narration:     `Qty: ${t.quantity || 0}`,
          });
        });
      });
    }

    // ── Sort all transactions by date, then compute running balance ────────────
    rawTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = openingBalance;
    const transactions = rawTxns.map(t => {
      const netChange = t.debit - t.credit;
      if (isDebitNature) runningBalance += netChange;
      else               runningBalance -= netChange;
      return {
        ...t,
        balance:     Math.abs(runningBalance),
        balanceType: getBalanceType(runningBalance, isDebitNature),
      };
    });

    const totalDebits  = transactions.reduce((s, t) => s + t.debit,  0);
    const totalCredits = transactions.reduce((s, t) => s + t.credit, 0);

    res.status(200).json({
      success: true,
      data: {
        ledger:              { id: ledger._id, name: ledger.ledgerName, type: ledger.ledgerType },
        isDebitNature,
        startDate:           dateFilter.startDate,
        endDate:             dateFilter.endDate,
        openingBalance:      Math.abs(openingBalance),
        openingBalanceType:  getBalanceType(openingBalance, isDebitNature),
        closingBalance:      Math.abs(runningBalance),
        closingBalanceType:  getBalanceType(runningBalance, isDebitNature),
        transactions,
        summary: { totalDebits, totalCredits, difference: totalDebits - totalCredits }
      }
    });
  } catch (error) {
    console.error('Error generating general ledger:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating general ledger' });
  }
};

// 3. GENERAL LEDGER ABSTRACT
export const getGeneralLedgerAbstract = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd, ledgerType } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Get ledgers (optionally filtered by type)
    const query = { status: 'Active', companyId: req.companyId };
    if (ledgerType) query.ledgerType = ledgerType;

    const ledgers = await Ledger.find(query).sort({ ledgerName: 1 });

    // Process each ledger
    const abstract = await Promise.all(
      ledgers.map(async ledger => {
        // Calculate opening balance
        const openingBalance = await calculateOpeningBalance(
          Ledger,
          Voucher,
          ledger._id,
          dateFilter.startDate,
          req.companyId
        );

        // Get transactions in period
        const vouchers = await Voucher.find({
          companyId: req.companyId,
          voucherDate: {
            $gte: dateFilter.startDate,
            $lte: dateFilter.endDate
          },
          'entries.ledgerId': ledger._id
        });

        let totalDebits = 0;
        let totalCredits = 0;

        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            if (entry.ledgerId.toString() === ledger._id.toString()) {
              totalDebits += entry.debitAmount;
              totalCredits += entry.creditAmount;
            }
          });
        });

        // ── Un-vouchered MilkSales (Local / Sample / Credit Sales ledgers) ────
        // The regular GL picks these up via a special path; the Abstract must do
        // the same, otherwise milk-sales ledgers show zero activity.
        const isMilkSalesAbstract =
          /local\s*sales?|sample\s*sales?|credit\s*sales?/i.test(ledger.ledgerName) ||
          (ledger.ledgerType === 'Sales' && /milk|local|credit|sample/i.test(ledger.ledgerName));

        if (isMilkSalesAbstract) {
          const saleModeFilter = /local/i.test(ledger.ledgerName)  ? 'LOCAL'
            : /sample/i.test(ledger.ledgerName) ? 'SAMPLE'
            : /credit/i.test(ledger.ledgerName) ? 'CREDIT'
            : null;

          const msBase = {
            companyId: req.companyId,
            amount:    { $gt: 0 },
            $or:       [{ voucherId: { $exists: false } }, { voucherId: null }],
          };
          if (saleModeFilter) msBase.saleMode = saleModeFilter;

          const [priorAgg, periodAgg] = await Promise.all([
            MilkSales.aggregate([
              { $match: { ...msBase, date: { $lt: dateFilter.startDate } } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            MilkSales.aggregate([
              { $match: { ...msBase, date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate } } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
          ]);

          // For a credit-normal (income) ledger:
          //   opening += prior sales credits
          //   period  += current period sales credits
          const priorSales  = priorAgg[0]?.total  || 0;
          const periodSales = periodAgg[0]?.total || 0;
          // Signed convention: credit-normal positive = Cr balance
          // calculateOpeningBalance already returns a signed value (positive = Cr normal)
          // so adding prior credits increases the Cr balance:
          // We recompute openingBalance inline — reassign the const via a let shadow
          // eslint-disable-next-line no-shadow
          const adjustedOpeningBalance = openingBalance + priorSales;
          totalCredits += periodSales;

          const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
          const closingBalance = calculateClosingBalance(adjustedOpeningBalance, totalDebits, totalCredits, isDebitNature);

          return {
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            category: getLedgerCategory(ledger.ledgerType),
            openingBalance: Math.abs(adjustedOpeningBalance),
            openingBalanceType: getBalanceType(adjustedOpeningBalance, isDebitNature),
            totalDebits,
            totalCredits,
            closingBalance: Math.abs(closingBalance),
            closingBalanceType: getBalanceType(closingBalance, isDebitNature),
          };
        }

        const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
        const closingBalance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);

        return {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          category: getLedgerCategory(ledger.ledgerType),
          openingBalance: Math.abs(openingBalance),
          openingBalanceType: getBalanceType(openingBalance, isDebitNature),
          totalDebits,
          totalCredits,
          closingBalance: Math.abs(closingBalance),
          closingBalanceType: getBalanceType(closingBalance, isDebitNature)
        };
      })
    );

    // Only include ledgers that have actual activity (opening balance, debits, or credits)
    const activeAbstract = abstract.filter(a =>
      a.openingBalance !== 0 || a.totalDebits !== 0 || a.totalCredits !== 0
    );

    // Calculate totals
    const summary = {
      totalLedgers: activeAbstract.length,
      totalOpeningDebit: activeAbstract
        .filter(a => a.openingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalOpeningCredit: activeAbstract
        .filter(a => a.openingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalDebits: activeAbstract.reduce((sum, a) => sum + a.totalDebits, 0),
      totalCredits: activeAbstract.reduce((sum, a) => sum + a.totalCredits, 0),
      totalClosingDebit: activeAbstract
        .filter(a => a.closingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.closingBalance, 0),
      totalClosingCredit: activeAbstract
        .filter(a => a.closingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.closingBalance, 0)
    };

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        abstract: activeAbstract,
        summary
      }
    });
  } catch (error) {
    console.error('Error generating ledger abstract:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating ledger abstract'
    });
  }
};

// 4. RECEIPTS & DISBURSEMENT - ENHANCED WITH MULTIPLE FORMATS
export const getReceiptsDisbursementEnhanced = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd, format = 'threeColumn' } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      // Default to current month if no dates provided
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Get cash/bank ledgers
    const cashBankLedgers = await Ledger.find({
      ledgerType: { $in: ['Cash', 'Bank'] },
      status: 'Active',
      companyId: req.companyId
    });

    const ledgerIds = cashBankLedgers.map(l => l._id);

    // Calculate opening balance for all cash/bank ledgers
    let openingBalance = 0;
    for (const ledger of cashBankLedgers) {
      openingBalance += await calculateOpeningBalance(Ledger, Voucher, ledger._id, dateFilter.startDate, req.companyId);
    }

    // Get all vouchers affecting cash/bank in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: ledgerIds }
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Categorize by ledger heads
    const receiptsByHead = {};
    const paymentsByHead = {};
    const receiptsData = [];
    const paymentsData = [];

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (!entry.ledgerId?._id) return; // null guard — deleted ledger
        const isCashBank = ledgerIds.some(id => id.toString() === entry.ledgerId._id.toString());

        if (isCashBank) {
          // Find contra ledger (null guard on each entry's ledgerId)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId?._id && !ledgerIds.some(id => id.toString() === e.ledgerId._id.toString())
          );

          const contraLedgerName = contraEntry?.ledgerName || 'Various';
          const contraLedgerType = contraEntry?.ledgerId?.ledgerType || 'Other';

          if (entry.debitAmount > 0) {
            // Receipt
            receiptsData.push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              ledgerType: contraLedgerType,
              amount: entry.debitAmount,
              narration: entry.narration || voucher.narration
            });

            if (!receiptsByHead[contraLedgerType]) {
              receiptsByHead[contraLedgerType] = [];
            }
            receiptsByHead[contraLedgerType].push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              amount: entry.debitAmount
            });
          } else if (entry.creditAmount > 0) {
            // Payment
            paymentsData.push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              ledgerType: contraLedgerType,
              amount: entry.creditAmount,
              narration: entry.narration || voucher.narration
            });

            if (!paymentsByHead[contraLedgerType]) {
              paymentsByHead[contraLedgerType] = [];
            }
            paymentsByHead[contraLedgerType].push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              amount: entry.creditAmount
            });
          }
        }
      });
    });

    const totalReceipts = receiptsData.reduce((sum, r) => sum + r.amount, 0);
    const totalPayments = paymentsData.reduce((sum, p) => sum + p.amount, 0);
    const closingBalance = openingBalance + totalReceipts - totalPayments;

    // Format-specific data
    let formattedData = {};

    if (format === 'singleColumn') {
      // Single column: chronological order
      const allTransactions = [
        ...receiptsData.map(r => ({ ...r, type: 'Receipt' })),
        ...paymentsData.map(p => ({ ...p, type: 'Payment' }))
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      formattedData = { transactions: allTransactions };
    } else if (format === 'threeColumn') {
      // Three column: Receipts | Payments | Balance
      const transactions = [];
      let balance = openingBalance;

      const allDates = [
        ...new Set([
          ...receiptsData.map(r => r.date.toISOString()),
          ...paymentsData.map(p => p.date.toISOString())
        ])
      ].sort();

      allDates.forEach(dateStr => {
        const date = new Date(dateStr);
        const dayReceipts = receiptsData.filter(r => r.date.toISOString() === dateStr);
        const dayPayments = paymentsData.filter(p => p.date.toISOString() === dateStr);

        const receiptTotal = dayReceipts.reduce((sum, r) => sum + r.amount, 0);
        const paymentTotal = dayPayments.reduce((sum, p) => sum + p.amount, 0);
        balance = balance + receiptTotal - paymentTotal;

        transactions.push({
          date,
          receipts: dayReceipts,
          payments: dayPayments,
          receiptTotal,
          paymentTotal,
          balance
        });
      });

      formattedData = { transactions };
    } else if (format === 'classified') {
      // Classified by ledger heads
      const receiptHeads = Object.keys(receiptsByHead).map(head => ({
        ledgerType: head,
        transactions: receiptsByHead[head],
        total: receiptsByHead[head].reduce((sum, t) => sum + t.amount, 0)
      }));

      const paymentHeads = Object.keys(paymentsByHead).map(head => ({
        ledgerType: head,
        transactions: paymentsByHead[head],
        total: paymentsByHead[head].reduce((sum, t) => sum + t.amount, 0)
      }));

      formattedData = {
        receiptsByHead: receiptHeads,
        paymentsByHead: paymentHeads
      };
    } else if (format === 'threeColumnLedgerwise') {
      // Three Column Ledger-wise format
      // Uses CUMULATIVE CASH FLOWS (not balance sheet values) so that
      // endOfMonth = uptoMonth + duringMonth is always guaranteed.

      // Step 1: Get cash/bank ledger IDs
      const cashBankLedgers = await Ledger.find({
        ledgerType: { $in: ['Cash', 'Bank'] },
        status: 'Active',
        companyId: req.companyId
      });
      const cashBankIds = new Set(cashBankLedgers.map(l => l._id.toString()));
      const cashBankObjectIds = cashBankLedgers.map(l => l._id);

      // Step 2: Financial year start (April 1) — uptoMonth = FY start → period start (exclusive)
      const fyStartYear = dateFilter.startDate.getUTCMonth() >= 3
        ? dateFilter.startDate.getUTCFullYear()
        : dateFilter.startDate.getUTCFullYear() - 1;
      const fyStart = new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0, 0)); // April 1

      // Step 3: Fetch vouchers for both windows (only cash/bank involved vouchers)
      const [vouchersBefore, vouchersDuring] = await Promise.all([
        Voucher.find({
          companyId: req.companyId,
          voucherDate: { $gte: fyStart, $lt: dateFilter.startDate },
          'entries.ledgerId': { $in: cashBankObjectIds }
        }).populate('entries.ledgerId', 'ledgerName ledgerType'),

        Voucher.find({
          companyId: req.companyId,
          voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
          'entries.ledgerId': { $in: cashBankObjectIds }
        }).populate('entries.ledgerId', 'ledgerName ledgerType')
      ]);

      // Step 4: Aggregate cash flows per contra ledger
      // receipt = cash DEBITED (money came IN), payment = cash CREDITED (money went OUT)
      const contraMap = {};

      const aggregateVouchers = (vouchers, isBefore) => {
        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            // Null guard: populated ledgerId can be null if ledger was deleted
            if (!entry.ledgerId?._id) return;

            const entryLedgerId = entry.ledgerId._id.toString();
            if (!cashBankIds.has(entryLedgerId)) return; // skip non-cash entries

            // Find the contra (non-cash) side — guard against null ledgerIds in same loop
            const contraEntry = voucher.entries.find(e =>
              e.ledgerId?._id && !cashBankIds.has(e.ledgerId._id.toString())
            );
            if (!contraEntry) return; // contra voucher (cash↔bank) — skip

            const key = contraEntry.ledgerId._id.toString();
            if (!contraMap[key]) {
              const lType = contraEntry.ledgerId.ledgerType || 'Other';
              contraMap[key] = {
                ledgerName: contraEntry.ledgerName || contraEntry.ledgerId.ledgerName || 'Unknown',
                ledgerType: lType,
                category: getLedgerCategory(lType),
                receipt: { uptoMonth: 0, duringMonth: 0 },
                payment: { uptoMonth: 0, duringMonth: 0 }
              };
            }

            const col = contraMap[key];
            if (entry.debitAmount > 0) {
              // Cash DEBITED → RECEIPT
              if (isBefore) col.receipt.uptoMonth  += entry.debitAmount;
              else          col.receipt.duringMonth += entry.debitAmount;
            } else if (entry.creditAmount > 0) {
              // Cash CREDITED → PAYMENT
              if (isBefore) col.payment.uptoMonth  += entry.creditAmount;
              else          col.payment.duringMonth += entry.creditAmount;
            }
          });
        });
      };

      aggregateVouchers(vouchersBefore, true);
      aggregateVouchers(vouchersDuring, false);

      // Step 5: Derive endOfMonth = uptoMonth + duringMonth (GUARANTEED by construction)
      const activeLedgers = Object.values(contraMap)
        .filter(l =>
          l.receipt.uptoMonth > 0 || l.receipt.duringMonth > 0 ||
          l.payment.uptoMonth > 0 || l.payment.duringMonth > 0
        )
        .map(l => ({
          ledgerName: l.ledgerName,
          ledgerType: l.ledgerType,
          category: l.category,
          receipt: {
            uptoMonth:   l.receipt.uptoMonth,
            duringMonth: l.receipt.duringMonth,
            endOfMonth:  l.receipt.uptoMonth + l.receipt.duringMonth   // always correct
          },
          payment: {
            uptoMonth:   l.payment.uptoMonth,
            duringMonth: l.payment.duringMonth,
            endOfMonth:  l.payment.uptoMonth + l.payment.duringMonth   // always correct
          }
        }));

      // Step 6: Group by section
      const sectionMap = {
        'LIABILITIES': { name: 'Advance due by Society (LIABILITY)', ledgers: [], order: 1 },
        'ASSETS':      { name: 'Advance due to Society (ASSET)',      ledgers: [], order: 2 },
        'EXPENSES':    { name: 'Contingencies/Expenses',              ledgers: [], order: 3 },
        'INCOME':      { name: 'Income Accounts',                     ledgers: [], order: 4 },
        'CAPITAL':     { name: 'Capital & Reserves',                  ledgers: [], order: 5 },
        'OTHER':       { name: 'Other Accounts',                      ledgers: [], order: 6 }
      };

      activeLedgers.forEach(ledger => {
        const section = sectionMap[ledger.category] || sectionMap['OTHER'];
        section.ledgers.push(ledger);
      });

      // Step 7: Section totals — sum uptoMonth and duringMonth; endOfMonth = their sum
      const sections = Object.values(sectionMap)
        .filter(s => s.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const groupTotal = section.ledgers.reduce((acc, l) => ({
            receipt: {
              uptoMonth:   acc.receipt.uptoMonth   + l.receipt.uptoMonth,
              duringMonth: acc.receipt.duringMonth + l.receipt.duringMonth,
              endOfMonth:  acc.receipt.endOfMonth  + l.receipt.endOfMonth
            },
            payment: {
              uptoMonth:   acc.payment.uptoMonth   + l.payment.uptoMonth,
              duringMonth: acc.payment.duringMonth + l.payment.duringMonth,
              endOfMonth:  acc.payment.endOfMonth  + l.payment.endOfMonth
            }
          }), { receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
                payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 } });

          return { sectionName: section.name, ledgers: section.ledgers, groupTotal };
        });

      // Step 8: Grand total — same guarantee flows up
      const grandTotal = sections.reduce((acc, s) => ({
        receipt: {
          uptoMonth:   acc.receipt.uptoMonth   + s.groupTotal.receipt.uptoMonth,
          duringMonth: acc.receipt.duringMonth + s.groupTotal.receipt.duringMonth,
          endOfMonth:  acc.receipt.endOfMonth  + s.groupTotal.receipt.endOfMonth
        },
        payment: {
          uptoMonth:   acc.payment.uptoMonth   + s.groupTotal.payment.uptoMonth,
          duringMonth: acc.payment.duringMonth + s.groupTotal.payment.duringMonth,
          endOfMonth:  acc.payment.endOfMonth  + s.groupTotal.payment.endOfMonth
        }
      }), { receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
            payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 } });

      // FY end = March 31 of next year
      const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31, 23, 59, 59, 999));

      formattedData = { sections, grandTotal, fyStart, fyEnd };
    } else if (format === 'twoColumnMonthly') {
      // Two-Column Side-by-Side format
      // Cash/Bank ledgers are the tracked accounts; contra entries form the sections.
      // Split each contra ledger by: cash (via Cash-type entry) vs adjustment (via Bank-type entry).

      const cashBankLedgersAll = await Ledger.find({
        ledgerType: { $in: ['Cash', 'Bank'] },
        status: 'Active',
        companyId: req.companyId
      });
      const cashIds  = new Set(cashBankLedgersAll.filter(l => l.ledgerType === 'Cash').map(l => l._id.toString()));
      const bankIds  = new Set(cashBankLedgersAll.filter(l => l.ledgerType === 'Bank').map(l => l._id.toString()));
      const allCBIds = new Set(cashBankLedgersAll.map(l => l._id.toString()));
      const allCBObjectIds = cashBankLedgersAll.map(l => l._id);

      const duringVouchers2 = await Voucher.find({
        companyId: req.companyId,
        voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        'entries.ledgerId': { $in: allCBObjectIds }
      }).populate('entries.ledgerId', 'ledgerName ledgerType');

      const contraMap2 = {};

      duringVouchers2.forEach(voucher => {
        // Find the cash/bank entry that drove this voucher
        const cashBankEntry = voucher.entries.find(e =>
          e.ledgerId?._id && allCBIds.has(e.ledgerId._id.toString())
        );
        if (!cashBankEntry) return;

        const isCash = cashIds.has(cashBankEntry.ledgerId._id.toString());

        // Find the contra (non-cash/bank) entry
        const contraEntry = voucher.entries.find(e =>
          e.ledgerId?._id && !allCBIds.has(e.ledgerId._id.toString())
        );
        if (!contraEntry) return; // contra voucher — skip

        const key = contraEntry.ledgerId._id.toString();
        if (!contraMap2[key]) {
          contraMap2[key] = {
            ledgerName: contraEntry.ledgerName || contraEntry.ledgerId.ledgerName || 'Unknown',
            ledgerType: contraEntry.ledgerId.ledgerType || 'Other',
            category:   getLedgerCategory(contraEntry.ledgerId.ledgerType || 'Other'),
            receiptCash: 0, receiptAdj: 0,
            paymentCash: 0, paymentAdj: 0
          };
        }
        const rec = contraMap2[key];
        if (cashBankEntry.debitAmount > 0) {
          if (isCash) rec.receiptCash += cashBankEntry.debitAmount;
          else        rec.receiptAdj  += cashBankEntry.debitAmount;
        } else if (cashBankEntry.creditAmount > 0) {
          if (isCash) rec.paymentCash += cashBankEntry.creditAmount;
          else        rec.paymentAdj  += cashBankEntry.creditAmount;
        }
      });

      // Group into sections
      const secMap2 = {
        'LIABILITIES': { name: 'Advance due by Society', subtitle: '(LIABILITY)', ledgers: [], order: 1 },
        'ASSETS':      { name: 'Advance due to Society', subtitle: '(ASSET)',      ledgers: [], order: 2 },
        'EXPENSES':    { name: 'Contingencies/Expenses',  subtitle: '',            ledgers: [], order: 3 },
        'INCOME':      { name: 'Income Accounts',         subtitle: '',            ledgers: [], order: 4 },
        'CAPITAL':     { name: 'Capital & Reserves',      subtitle: '',            ledgers: [], order: 5 },
        'OTHER':       { name: 'Other Accounts',          subtitle: '',            ledgers: [], order: 6 }
      };

      Object.values(contraMap2).forEach(l => {
        if (l.receiptCash + l.receiptAdj + l.paymentCash + l.paymentAdj === 0) return;
        const sec = secMap2[l.category] || secMap2['OTHER'];
        sec.ledgers.push({
          ledgerName:   l.ledgerName,
          receiptAdj:   l.receiptAdj,
          receiptCash:  l.receiptCash,
          receiptTotal: l.receiptAdj + l.receiptCash,
          paymentAdj:   l.paymentAdj,
          paymentCash:  l.paymentCash,
          paymentTotal: l.paymentAdj + l.paymentCash
        });
      });

      const sections2 = Object.values(secMap2)
        .filter(s => s.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(sec => {
          const groupTotal = sec.ledgers.reduce((acc, l) => ({
            receiptAdj:   acc.receiptAdj   + l.receiptAdj,
            receiptCash:  acc.receiptCash  + l.receiptCash,
            receiptTotal: acc.receiptTotal + l.receiptTotal,
            paymentAdj:   acc.paymentAdj   + l.paymentAdj,
            paymentCash:  acc.paymentCash  + l.paymentCash,
            paymentTotal: acc.paymentTotal + l.paymentTotal
          }), { receiptAdj: 0, receiptCash: 0, receiptTotal: 0, paymentAdj: 0, paymentCash: 0, paymentTotal: 0 });
          return { sectionName: sec.name, subtitle: sec.subtitle, ledgers: sec.ledgers, groupTotal };
        });

      const grandTotal2 = sections2.reduce((acc, s) => ({
        receiptAdj:   acc.receiptAdj   + s.groupTotal.receiptAdj,
        receiptCash:  acc.receiptCash  + s.groupTotal.receiptCash,
        receiptTotal: acc.receiptTotal + s.groupTotal.receiptTotal,
        paymentAdj:   acc.paymentAdj   + s.groupTotal.paymentAdj,
        paymentCash:  acc.paymentCash  + s.groupTotal.paymentCash,
        paymentTotal: acc.paymentTotal + s.groupTotal.paymentTotal
      }), { receiptAdj: 0, receiptCash: 0, receiptTotal: 0, paymentAdj: 0, paymentCash: 0, paymentTotal: 0 });

      formattedData = { sections: sections2, grandTotal: grandTotal2 };
    } else if (format === 'singleColumnMonthly') {
      // Single Column Monthly format - Only during month transactions
      // Exclude Cash/Bank ledgers — they are the account being tracked; show only contra entries
      const allLedgers = await Ledger.find({
        status: 'Active',
        companyId: req.companyId,
        ledgerType: { $nin: ['Cash', 'Bank'] }
      }).sort({ ledgerName: 1 });

      // Process each ledger for during-month transactions only
      const ledgerData = await Promise.all(
        allLedgers.map(async ledger => {
          // Get transactions during the period
          const vouchers = await Voucher.find({
            companyId: req.companyId,
            voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
            'entries.ledgerId': ledger._id
          });

          // Aggregate debits and credits during period
          let duringMonthDebit = 0;
          let duringMonthCredit = 0;
          vouchers.forEach(voucher => {
            voucher.entries.forEach(entry => {
              if (entry.ledgerId.toString() === ledger._id.toString()) {
                duringMonthDebit += entry.debitAmount;
                duringMonthCredit += entry.creditAmount;
              }
            });
          });

          // Skip ledgers with no activity
          if (duringMonthDebit === 0 && duringMonthCredit === 0) {
            return null;
          }

          // NET: each ledger appears on ONE side only
          // Net credit → Receipt side; Net debit → Payment side
          const net = duringMonthCredit - duringMonthDebit;
          if (net === 0) return null; // perfectly offset — skip

          return {
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            category: getLedgerCategory(ledger.ledgerType),
            receipt: net > 0 ? net : 0,   // only on receipt side if net credit
            payment: net < 0 ? -net : 0   // only on payment side if net debit
          };
        })
      );

      // Filter out null entries (no activity)
      const activeLedgers = ledgerData.filter(l => l !== null);

      // Group by specific sections
      const sectionMap = {
        'LIABILITY': { name: 'Liability', ledgers: [], order: 1 },
        'ASSET': { name: 'Asset', ledgers: [], order: 2 },
        'BANK': { name: 'Bank Accounts', ledgers: [], order: 3 },
        'EXPENSE': { name: 'Contingencies / Expense', ledgers: [], order: 4 }
      };

      activeLedgers.forEach(ledger => {
        if (ledger.ledgerType === 'Bank') {
          sectionMap['BANK'].ledgers.push(ledger);
        } else if (ledger.category === 'LIABILITIES') {
          sectionMap['LIABILITY'].ledgers.push(ledger);
        } else if (ledger.category === 'ASSETS') {
          sectionMap['ASSET'].ledgers.push(ledger);
        } else {
          // All other ledgers (EXPENSES, INCOME, etc.) go to Contingencies / Expense
          sectionMap['EXPENSE'].ledgers.push(ledger);
        }
      });

      // Build sections with totals
      const sections = Object.values(sectionMap)
        .filter(section => section.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const groupTotal = section.ledgers.reduce((total, ledger) => ({
            receipt: total.receipt + ledger.receipt,
            payment: total.payment + ledger.payment
          }), { receipt: 0, payment: 0 });

          return {
            sectionName: section.name,
            ledgers: section.ledgers,
            groupTotal
          };
        });

      // Calculate grand totals
      const grandTotal = sections.reduce((total, section) => ({
        receipt: total.receipt + section.groupTotal.receipt,
        payment: total.payment + section.groupTotal.payment
      }), { receipt: 0, payment: 0 });

      formattedData = { sections, grandTotal };
    }

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        format,
        openingBalance,
        closingBalance,
        receipts: receiptsData,
        payments: paymentsData,
        summary: {
          totalReceipts,
          totalPayments,
          netCashFlow: totalReceipts - totalPayments
        },
        formatted: formattedData
      }
    });
  } catch (error) {
    console.error('Error generating R&D report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating R&D report'
    });
  }
};

// 5. GET ALL LEDGERS FOR DROPDOWN
export const getLedgersForDropdown = async (req, res) => {
  try {
    const { type } = req.query;

    // Ensure key dairy ledgers always exist so they appear in the dropdown
    // even before any transaction has auto-created them.
    await Promise.all([
      findOrCreateLedger('Cattle Feed Advance',  'Other Receivable', 'Assets', 'Dr', req.companyId),
      findOrCreateLedger('Farmers Cash Advance',  'Other Receivable', 'Assets', 'Dr', req.companyId),
      findOrCreateLedger('Farmers Loan A/c',      'Other Receivable', 'Assets', 'Dr', req.companyId),
    ]).catch(() => {}); // non-fatal if creation fails

    const query = { status: 'Active', companyId: req.companyId, 'linkedEntity.entityType': { $ne: 'Farmer' } };
    if (type) query.ledgerType = type;

    const ledgers = await Ledger.find(query)
      .select('_id ledgerName ledgerType')
      .sort({ ledgerName: 1 });

    res.status(200).json({
      success: true,
      data: ledgers
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledgers'
    });
  }
};

// RECEIPTS & PAYMENTS ACCOUNT — summary of all cash/value flows
export const getReceiptsPayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setUTCHours(23, 59, 59, 999);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date parameters' });
    }
    const cid = req.companyId;

    const [
      mcAgg,
      localAgg, creditAgg, sampleAgg,
      cfSalesTxns, cfPurchaseTxns,
      regProducers, regCreditors,
      prAgg,
      cfAdvAgg, cashAdvAgg, loanAgg
    ] = await Promise.all([
      // Milk Purchase (payment side)
      MilkCollection.aggregate([
        { $match: { companyId: cid, date: { $gte: start, $lte: end }, amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Milk Sales by mode (receipt side)
      MilkSales.aggregate([
        { $match: { companyId: cid, date: { $gte: start, $lte: end }, saleMode: 'LOCAL', amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      MilkSales.aggregate([
        { $match: { companyId: cid, date: { $gte: start, $lte: end }, saleMode: 'CREDIT', amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      MilkSales.aggregate([
        { $match: { companyId: cid, date: { $gte: start, $lte: end }, saleMode: 'SAMPLE', amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // CF Sales (Stock Out, not returns) — receipt side
      StockTransaction.find({
        companyId: cid, transactionType: 'Stock Out',
        referenceType: { $nin: ['Return', 'Opening Balance Adjustment'] },
        $expr: { $and: [
          { $gte: [{ $ifNull: ['$purchaseDate', '$date'] }, start] },
          { $lte: [{ $ifNull: ['$purchaseDate', '$date'] }, end] }
        ]}
      }).select('quantity rate').lean(),
      // CF Purchase (Stock In, not returns) — payment side + commission/inspection extraction
      StockTransaction.find({
        companyId: cid, transactionType: 'Stock In',
        referenceType: { $nin: ['Return', 'Opening Balance Adjustment'] },
        $expr: { $and: [
          { $gte: [{ $ifNull: ['$purchaseDate', '$date'] }, start] },
          { $lte: [{ $ifNull: ['$purchaseDate', '$date'] }, end] }
        ]}
      }).select('quantity rate ledgerEntries').populate('ledgerEntries.ledgerId', 'ledgerName').lean(),
      // PaymentRegister — Producers type
      PaymentRegister.aggregate([
        { $match: { companyId: cid, registerType: 'Producers', fromDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, milkValue: { $sum: '$totalMilkValue' }, welfare: { $sum: '$totalWelfare' } } }
      ]),
      // PaymentRegister — Creditor type
      PaymentRegister.aggregate([
        { $match: { companyId: cid, registerType: 'Creditor', fromDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, milkValue: { $sum: '$totalMilkValue' }, welfare: { $sum: '$totalWelfare' } } }
      ]),
      // Producer Receipts (money received back from producers) — receipt side
      ProducerReceipt.aggregate([
        { $match: { companyId: cid, status: 'Active', receiptDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // CF Advance given — payment side
      Advance.aggregate([
        { $match: { companyId: cid, advanceCategory: 'CF Advance', advanceDate: { $gte: start, $lte: end }, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$advanceAmount' } } }
      ]),
      // Cash Advance given — payment side
      Advance.aggregate([
        { $match: { companyId: cid, advanceCategory: 'Cash Advance', advanceDate: { $gte: start, $lte: end }, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$advanceAmount' } } }
      ]),
      // Loan Advance disbursed (ProducerLoan) — payment side
      ProducerLoan.aggregate([
        { $match: { companyId: cid, loanDate: { $gte: start, $lte: end }, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$principalAmount' } } }
      ])
    ]);

    // Derive CF purchase total + commission + inspection fee from ledgerEntries
    let cfPurchaseTotal = 0, cfCommission = 0, cfInspectionFee = 0;
    cfPurchaseTxns.forEach(txn => {
      const qty = txn.quantity || 0;
      cfPurchaseTotal += qty * (txn.rate || 0);
      (txn.ledgerEntries || []).forEach(le => {
        const name = (le.ledgerId?.ledgerName || '').toLowerCase();
        const amt  = (le.amount || 0) * qty;
        if (name.includes('cattle feed commission')) cfCommission    += amt;
        else if (name.includes('inspection fee'))    cfInspectionFee += amt;
      });
    });

    const cfSalesTotal       = cfSalesTxns.reduce((s, t) => s + (t.quantity || 0) * (t.rate || 0), 0);
    const producersDue       = regProducers[0]?.milkValue || 0;
    const producersDueCredit = regCreditors[0]?.milkValue || 0;
    const kdwfWelfare        = (regProducers[0]?.welfare || 0) + (regCreditors[0]?.welfare || 0);

    const receiptItems = [
      { label: 'Producer Due',            amount: producersDueCredit },
      { label: 'Local Sales',             amount: localAgg[0]?.total  || 0 },
      { label: 'Credit Sales',            amount: creditAgg[0]?.total || 0 },
      { label: 'Sample Sales',            amount: sampleAgg[0]?.total || 0 },
      { label: 'Cattle Feed Sales',       amount: cfSalesTotal },
      { label: 'Producer Report',         amount: producersDue },
      { label: 'Producer Receipt',        amount: prAgg[0]?.total     || 0 },
      { label: 'KDFW Welfare',            amount: kdwfWelfare },
      { label: 'Cattle Feed Commission',  amount: cfCommission },
      { label: 'CF Inspection Fee',       amount: cfInspectionFee },
    ];

    const paymentItems = [
      { label: 'Milk Purchase',          amount: mcAgg[0]?.total || 0 },
      { label: 'Cattle Feed Purchase',   amount: cfPurchaseTotal },
      { label: 'CF Advance',             amount: cfAdvAgg[0]?.total  || 0 },
      { label: 'Cash Advance',           amount: cashAdvAgg[0]?.total || 0 },
      { label: 'Loan Advance',           amount: loanAgg[0]?.total   || 0 },
    ];

    const totalReceipts = receiptItems.reduce((s, r) => s + r.amount, 0);
    const totalPayments = paymentItems.reduce((s, p) => s + p.amount, 0);

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        receiptItems, paymentItems,
        totalReceipts, totalPayments,
        balance: totalReceipts - totalPayments
      }
    });
  } catch (error) {
    console.error('Error generating receipts & payments:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating report' });
  }
};

// ─── Shared helper: build voucher activity maps (2-query optimization) ────────
const buildActivityMaps = async (Voucher, companyId, start, end, skipStatus = true) => {
  const baseFilter = { companyId };
  if (skipStatus) baseFilter.status = { $ne: 'Cancelled' };

  const [priorVouchers, periodVouchers] = await Promise.all([
    Voucher.find({ ...baseFilter, voucherDate: { $lt: start } }).select('entries').lean(),
    Voucher.find({ ...baseFilter, voucherDate: { $gte: start, $lte: end } }).select('entries').lean()
  ]);

  const buildMap = (vouchers) => {
    const map = {};
    vouchers.forEach(v => {
      (v.entries || []).forEach(e => {
        const lid = e.ledgerId?.toString();
        if (!lid) return;
        if (!map[lid]) map[lid] = { debit: 0, credit: 0 };
        map[lid].debit += e.debitAmount || 0;
        map[lid].credit += e.creditAmount || 0;
      });
    });
    return map;
  };

  return { priorMap: buildMap(priorVouchers), periodMap: buildMap(periodVouchers) };
};

// ─── Compute signed balance for a ledger using prior + period maps ─────────────
const computeLedgerBalance = (ledger, priorMap, periodMap, addPeriod = true) => {
  const pg = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].includes(ledger.parentGroup)
    ? ledger.parentGroup
    : getParentGroupFromLedgerType(ledger.ledgerType);
  const isDebit = pg === 'ASSET' || pg === 'EXPENSE' || isDebitNatureLedger(ledger.ledgerType);

  let signed = ledger.openingBalance || 0;
  const obType = ledger.openingBalanceType || 'Dr';
  const isNormal = (isDebit && obType === 'Dr') || (!isDebit && obType === 'Cr');
  if (!isNormal && signed > 0) signed = -signed;

  const lid = ledger._id.toString();
  const prior = priorMap[lid];
  if (prior) signed += isDebit ? (prior.debit - prior.credit) : -(prior.debit - prior.credit);

  if (addPeriod) {
    const period = periodMap[lid];
    if (period) signed += isDebit ? (period.debit - period.credit) : -(period.debit - period.credit);
  }

  return { signed, isDebit, pg };
};

// ─── 7. LEDGER ABSTRACT — GROUPED BY ACCOUNT GROUP (ac_ledgers style) ────────
export const getLedgerAbstractGrouped = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setUTCHours(23, 59, 59, 999);

    const ledgers = await Ledger.find({ status: 'Active', companyId: req.companyId }).lean();
    const { priorMap, periodMap } = await buildActivityMaps(Voucher, req.companyId, start, end);

    const results = [];
    ledgers.forEach(ledger => {
      const lid = ledger._id.toString();
      const { signed: obSigned, isDebit, pg } = computeLedgerBalance(ledger, priorMap, {}, false);
      const period = periodMap[lid] || { debit: 0, credit: 0 };

      if (obSigned === 0 && period.debit === 0 && period.credit === 0) return;

      const closingSigned = obSigned + (isDebit ? (period.debit - period.credit) : -(period.debit - period.credit));

      results.push({
        ledgerId: ledger._id,
        ledgerName: ledger.ledgerName,
        ledgerType: ledger.ledgerType || 'Other',
        parentGroup: pg,
        openingBalance: Math.abs(obSigned),
        openingBalanceType: obSigned >= 0 ? (isDebit ? 'Dr' : 'Cr') : (isDebit ? 'Cr' : 'Dr'),
        debit: period.debit,
        credit: period.credit,
        closingBalance: Math.abs(closingSigned),
        closingBalanceType: closingSigned >= 0 ? (isDebit ? 'Dr' : 'Cr') : (isDebit ? 'Cr' : 'Dr')
      });
    });

    // Group by ledgerType (account_group), sorted by parentGroup then accountGroup
    const groupMap = {};
    results.forEach(item => {
      const key = item.ledgerType;
      if (!groupMap[key]) groupMap[key] = { accountGroup: key, parentGroup: item.parentGroup, ledgers: [] };
      groupMap[key].ledgers.push(item);
    });

    const pgOrder = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'OTHER'];
    const groups = Object.values(groupMap).map(g => ({
      ...g,
      totals: g.ledgers.reduce((acc, l) => ({
        debit: acc.debit + l.debit,
        credit: acc.credit + l.credit,
        obDr: acc.obDr + (l.openingBalanceType === 'Dr' ? l.openingBalance : 0),
        obCr: acc.obCr + (l.openingBalanceType === 'Cr' ? l.openingBalance : 0),
        clDr: acc.clDr + (l.closingBalanceType === 'Dr' ? l.closingBalance : 0),
        clCr: acc.clCr + (l.closingBalanceType === 'Cr' ? l.closingBalance : 0)
      }), { debit: 0, credit: 0, obDr: 0, obCr: 0, clDr: 0, clCr: 0 })
    })).sort((a, b) => {
      const ai = pgOrder.indexOf(a.parentGroup), bi = pgOrder.indexOf(b.parentGroup);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.accountGroup.localeCompare(b.accountGroup);
    });

    res.json({ success: true, data: { startDate: start, endDate: end, groups } });
  } catch (err) {
    console.error('getLedgerAbstractGrouped error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 8. R&D STATEMENT — DYNAMIC (ac_ledgers voucher_type classification) ─────
export const getRDStatementDynamic = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd } = req.query;

    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
      const end   = new Date(endDate);   end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }
    const start = dateFilter.startDate;
    const end   = dateFilter.endDate;

    const ledgers = await Ledger.find({ status: 'Active', companyId: req.companyId }).lean();
    const ledgerMap = Object.fromEntries(ledgers.map(l => [l._id.toString(), l]));

    const periodVouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' }
    }).select('entries').lean();

    const periodMap = {};
    periodVouchers.forEach(v => {
      (v.entries || []).forEach(e => {
        const lid = e.ledgerId?.toString();
        if (!lid) return;
        if (!periodMap[lid]) periodMap[lid] = { debit: 0, credit: 0 };
        periodMap[lid].debit  += e.debitAmount  || 0;
        periodMap[lid].credit += e.creditAmount || 0;
      });
    });

    const receiptGroupMap = {};
    const paymentGroupMap = {};

    Object.entries(periodMap).forEach(([lid, act]) => {
      const ledger = ledgerMap[lid];
      if (!ledger) return;

      const vt = ['R', 'P', 'B'].includes(ledger.voucherType)
        ? ledger.voucherType
        : getDefaultVoucherType(ledger.ledgerType);
      const groupKey = ledger.ledgerType || 'Other';
      const pg = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].includes(ledger.parentGroup)
        ? ledger.parentGroup : getParentGroupFromLedgerType(ledger.ledgerType);

      if (['R', 'B'].includes(vt) && act.credit > 0) {
        if (!receiptGroupMap[groupKey]) receiptGroupMap[groupKey] = { accountGroup: groupKey, parentGroup: pg, ledgers: [] };
        receiptGroupMap[groupKey].ledgers.push({ ledgerName: ledger.ledgerName, amount: act.credit });
      }
      if (['P', 'B'].includes(vt) && act.debit > 0) {
        if (!paymentGroupMap[groupKey]) paymentGroupMap[groupKey] = { accountGroup: groupKey, parentGroup: pg, ledgers: [] };
        paymentGroupMap[groupKey].ledgers.push({ ledgerName: ledger.ledgerName, amount: act.debit });
      }
    });

    const addTotals = (groupMap) =>
      Object.values(groupMap).map(g => ({ ...g, total: g.ledgers.reduce((s, l) => s + l.amount, 0) }));

    const receipts = addTotals(receiptGroupMap);
    const payments = addTotals(paymentGroupMap);

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        receipts,
        payments,
        totalReceipts: receipts.reduce((s, g) => s + g.total, 0),
        totalPayments: payments.reduce((s, g) => s + g.total, 0)
      }
    });
  } catch (err) {
    console.error('getRDStatementDynamic error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 9. RECEIPTS & PAYMENTS — DYNAMIC (with opening/closing cash balance) ────
export const getReceiptsPaymentsDynamic = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd } = req.query;

    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
      const end   = new Date(endDate);   end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }
    const start = dateFilter.startDate;
    const end   = dateFilter.endDate;

    const ledgers = await Ledger.find({ status: 'Active', companyId: req.companyId }).lean();
    const ledgerMap = Object.fromEntries(ledgers.map(l => [l._id.toString(), l]));

    const { priorMap, periodMap } = await buildActivityMaps(Voucher, req.companyId, start, end);

    // Cash & bank ledger types (for opening/closing balance)
    const CASH_BANK_TYPES = ['Cash', 'Bank', 'Cash in Hand', 'Bank Accounts'];
    const cashBankLedgers = ledgers.filter(l => CASH_BANK_TYPES.includes(l.ledgerType));

    const computeSigned = (ledger, map) => {
      const lid = ledger._id.toString();
      const act = map[lid] || { debit: 0, credit: 0 };
      const { signed } = computeLedgerBalance(ledger, {}, {}, false);
      // isDebit for cash = true, so net = signed + debit - credit
      return signed + act.debit - act.credit;
    };

    const openingBalance = cashBankLedgers.reduce((s, l) => {
      const { signed } = computeLedgerBalance(l, priorMap, {}, false);
      return s + signed;
    }, 0);

    const closingBalance = cashBankLedgers.reduce((s, l) => {
      const { signed } = computeLedgerBalance(l, priorMap, periodMap, true);
      return s + signed;
    }, 0);

    // R&D groups (same as getRDStatementDynamic)
    const receiptGroupMap = {};
    const paymentGroupMap = {};

    Object.entries(periodMap).forEach(([lid, act]) => {
      const ledger = ledgerMap[lid];
      if (!ledger) return;
      if (CASH_BANK_TYPES.includes(ledger.ledgerType)) return; // exclude cash/bank from groups

      const vt = ['R', 'P', 'B'].includes(ledger.voucherType)
        ? ledger.voucherType
        : getDefaultVoucherType(ledger.ledgerType);
      const groupKey = ledger.ledgerType || 'Other';
      const pg = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].includes(ledger.parentGroup)
        ? ledger.parentGroup : getParentGroupFromLedgerType(ledger.ledgerType);

      if (['R', 'B'].includes(vt) && act.credit > 0) {
        if (!receiptGroupMap[groupKey]) receiptGroupMap[groupKey] = { accountGroup: groupKey, parentGroup: pg, ledgers: [] };
        receiptGroupMap[groupKey].ledgers.push({ ledgerName: ledger.ledgerName, amount: act.credit });
      }
      if (['P', 'B'].includes(vt) && act.debit > 0) {
        if (!paymentGroupMap[groupKey]) paymentGroupMap[groupKey] = { accountGroup: groupKey, parentGroup: pg, ledgers: [] };
        paymentGroupMap[groupKey].ledgers.push({ ledgerName: ledger.ledgerName, amount: act.debit });
      }
    });

    const addTotals = (gm) =>
      Object.values(gm).map(g => ({ ...g, total: g.ledgers.reduce((s, l) => s + l.amount, 0) }));

    const receipts = addTotals(receiptGroupMap);
    const payments = addTotals(paymentGroupMap);
    const totalReceipts = receipts.reduce((s, g) => s + g.total, 0);
    const totalPayments = payments.reduce((s, g) => s + g.total, 0);

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        openingBalance,
        receipts, payments,
        totalReceipts, totalPayments,
        closingBalance
      }
    });
  } catch (err) {
    console.error('getReceiptsPaymentsDynamic error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getCashBook,
  getGeneralLedger,
  getGeneralLedgerAbstract,
  getReceiptsDisbursementEnhanced,
  getLedgersForDropdown,
  getReceiptsPayments,
  getLedgerAbstractGrouped,
  getRDStatementDynamic,
  getReceiptsPaymentsDynamic
};

import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import MilkCollection from '../models/MilkCollection.js';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import StockTransaction from '../models/StockTransaction.js';
import Advance from '../models/Advance.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import ProducerPayment from '../models/ProducerPayment.js';
import Sales from '../models/Sales.js';

// Get Day Book report with date-wise grouping
export const getDayBook = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const companyId = req.companyId;

    // Fetch all vouchers in date range for this company
    const vouchers = await Voucher.find({
      companyId,
      voucherDate: { $gte: start, $lte: end }
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // --- Calculate opening balance from Cash/Bank ledgers before startDate ---
    const cashBankLedgers = await Ledger.find({
      companyId,
      ledgerType: { $in: ['Cash', 'Bank'] },
      status: 'Active'
    });

    // Start with ledger opening balances (Dr = positive, Cr = negative for asset accounts)
    let openingBalance = 0;
    for (const ledger of cashBankLedgers) {
      const bal = ledger.openingBalance || 0;
      openingBalance += ledger.openingBalanceType === 'Dr' ? bal : -bal;
    }

    // Add net effect of all vouchers before startDate on Cash/Bank accounts
    const cashBankLedgerIds = cashBankLedgers.map(l => l._id.toString());

    const preVouchers = await Voucher.find({
      companyId,
      voucherDate: { $lt: start }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    for (const voucher of preVouchers) {
      for (const entry of voucher.entries) {
        const ledgerId = entry.ledgerId?._id?.toString();
        if (ledgerId && cashBankLedgerIds.includes(ledgerId)) {
          // For asset accounts: debit increases, credit decreases
          openingBalance += (entry.debitAmount || 0) - (entry.creditAmount || 0);
        }
      }
    }

    // --- Categorize entries into Receipt and Payment, grouped by date ---
    const dateMap = {};
    const receiptSide = []; // All credit entries (flat list for backward compat)
    const paymentSide = []; // All debit entries (flat list for backward compat)

    const cashBankTypes = new Set(['Cash', 'Bank']);

    for (const voucher of vouchers) {
      // Skip milk-purchase vouchers — Day Book derives a single combined
      // AM+PM adjustment line per day directly from MilkCollection below.
      // Includes legacy per-collection 'Journal' vouchers tagged as Purchase.
      if (voucher.voucherType === 'MilkPurchase') continue;
      if (voucher.voucherType === 'Journal' && voucher.referenceType === 'Purchase') continue;
      // Same pattern for Union Sales: per-slip journal vouchers are replaced
      // by a single combined AM+PM adjustment line per day (built below).
      if (voucher.voucherType === 'Journal' && voucher.referenceType === 'UnionSales') continue;
      // Inventory Purchase vouchers — handled separately below so the day-book
      // shows the supplier / commission / inspection legs on the receipt side
      // and a single combined purchase line on the payment side.
      if (voucher.voucherType === 'Purchase') continue;
      // Inventory Sales vouchers — handled separately below so cash sales go to
      // the cash column and credit sales (+ subsidy) go to the adjustment column.
      if (voucher.voucherType === 'Sales') continue;
      // Producer Receipts (advance returns) — handled by direct ProducerReceipt
      // query below; skip the voucher to avoid double-counting.
      if (voucher.referenceType === 'ProducerReceipt') continue;
      // Producer Payments (payment-to-producer) — handled by direct ProducerPayment
      // query below; skip the voucher to avoid double-counting.
      if (voucher.referenceType === 'ProducerPayment') continue;

      const dateKey = voucher.voucherDate.toISOString().split('T')[0];

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      // ── Producer Dues payment (Bank Transfer / Cheque / UPI / NEFT / RTGS / Cash) ─
      // Voucher: Dr PRODUCERS DUES / Cr <bank ledger or Cash in Hand>
      // Non-cash variant → adjustment column on both sides:
      //   • Receipt side : Bank ledger leg with "Producer's Payment" narration
      //   • Payment side : PRODUCERS DUES leg
      // Cash variant     → falls through to normal Payment logic so it
      //                    posts under the cash column on the payment side.
      const isProducerDuesPayment =
        voucher.voucherType === 'Payment' &&
        (voucher.referenceType === 'BankTransfer' || voucher.referenceType === 'ProducerPayment');

      if (isProducerDuesPayment) {
        const hasCashLeg = (voucher.entries || []).some(
          (e) => e.ledgerId?.ledgerType === 'Cash'
        );
        if (!hasCashLeg) {
          for (const entry of voucher.entries) {
            const baseEntry = {
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              voucherType: 'BankTransfer',                  // → Adjustment column
              ledgerName: entry.ledgerName,
              ledgerType: entry.ledgerId?.ledgerType,
              voucherId: voucher._id,
            };
            if (entry.creditAmount > 0) {
              // Bank ledger leg → Receipt side adjustment
              const receiptEntry = {
                ...baseEntry,
                narration: `Producer's Payment — ${voucher.narration || ''}`.trim(),
                amount: entry.creditAmount,
              };
              dateMap[dateKey].receiptSide.push(receiptEntry);
              dateMap[dateKey].totalReceipts += entry.creditAmount;
              receiptSide.push(receiptEntry);
            }
            if (entry.debitAmount > 0) {
              // PRODUCERS DUES leg → Payment side adjustment
              const paymentEntry = {
                ...baseEntry,
                narration: voucher.narration || '',
                amount: entry.debitAmount,
              };
              dateMap[dateKey].paymentSide.push(paymentEntry);
              dateMap[dateKey].totalPayments += entry.debitAmount;
              paymentSide.push(paymentEntry);
            }
          }
          continue;
        }
        // Cash variant — fall through to the standard Payment voucher logic
        // below. The Cash leg gets skipped there and the PRODUCERS DUES debit
        // lands on the payment side with voucherType = 'Payment', which the
        // frontend maps to the cash column.
      }

      const isReceiptVoucher  = voucher.voucherType === 'Receipt';
      const isPaymentVoucher  = voucher.voucherType === 'Payment';
      const isPurchaseVoucher = voucher.voucherType === 'Purchase';

      for (const entry of voucher.entries) {
        const ledgerType = entry.ledgerId?.ledgerType;
        const isCashBank = cashBankTypes.has(ledgerType);

        // Always skip Cash/Bank legs — the cash movement is implied in the day book
        if (isCashBank) continue;

        const entryData = {
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          ledgerName: entry.ledgerName,
          ledgerType,
          narration: entry.narration || voucher.narration,
          voucherId: voucher._id
        };

        if (isReceiptVoucher) {
          // Receipt voucher non-cash leg → receipt side
          const amount = entry.creditAmount || 0;
          if (amount > 0) {
            const receiptEntry = { ...entryData, amount };
            dateMap[dateKey].receiptSide.push(receiptEntry);
            dateMap[dateKey].totalReceipts += amount;
            receiptSide.push(receiptEntry);
          }
        } else if (isPaymentVoucher) {
          // Payment voucher non-cash leg → payment side
          const amount = entry.debitAmount || 0;
          if (amount > 0) {
            const paymentEntry = { ...entryData, amount };
            dateMap[dateKey].paymentSide.push(paymentEntry);
            dateMap[dateKey].totalPayments += amount;
            paymentSide.push(paymentEntry);
          }
        } else if (isPurchaseVoucher) {
          // Purchase voucher: only show the expense (Dr) entry on payment side.
          // Supplier/creditor Cr entries are payables — not a "receipt" in the day book.
          if (entry.debitAmount > 0) {
            const paymentEntry = { ...entryData, amount: entry.debitAmount };
            dateMap[dateKey].paymentSide.push(paymentEntry);
            dateMap[dateKey].totalPayments += entry.debitAmount;
            paymentSide.push(paymentEntry);
          }
        } else {
          // Journal and other vouchers: skip cash; debit non-cash → payment, credit non-cash → receipt
          if (entry.debitAmount > 0) {
            const paymentEntry = { ...entryData, amount: entry.debitAmount };
            dateMap[dateKey].paymentSide.push(paymentEntry);
            dateMap[dateKey].totalPayments += entry.debitAmount;
            paymentSide.push(paymentEntry);
          }
          if (entry.creditAmount > 0) {
            const receiptEntry = { ...entryData, amount: entry.creditAmount };
            dateMap[dateKey].receiptSide.push(receiptEntry);
            dateMap[dateKey].totalReceipts += entry.creditAmount;
            receiptSide.push(receiptEntry);
          }
        }
      }
    }

    // --- Milk Purchase — single adjustment entry per day (AM+PM combined) ---
    // Receipt side : PRODUCERS DUES (with shift-wise narration)
    // Payment side : MILK PURCHASE
    // Amount       : day total (AM + PM)
    const milkPurchaseShiftTotals = await MilkCollection.aggregate([
      {
        $match: {
          companyId,
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            day:   { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            shift: '$shift'
          },
          totalAmount: { $sum: '$amount' },
          totalQty:    { $sum: '$qty' },
          farmers:     { $addToSet: '$farmer' }
        }
      },
      { $sort: { '_id.day': 1, '_id.shift': 1 } }
    ]);

    // Re-group shift-wise rows into per-day buckets
    const dayShiftMap = {};
    for (const r of milkPurchaseShiftTotals) {
      const dateKey = r._id.day;
      const shift   = (r._id.shift || '').toUpperCase();
      if (!dayShiftMap[dateKey]) dayShiftMap[dateKey] = {};
      dayShiftMap[dateKey][shift] = {
        farmerCount: r.farmers.length,
        qty:         r.totalQty,
        amount:      r.totalAmount,
      };
    }

    for (const dateKey of Object.keys(dayShiftMap).sort()) {
      const shifts = dayShiftMap[dateKey];
      const am = shifts['AM'] || { farmerCount: 0, qty: 0, amount: 0 };
      const pm = shifts['PM'] || { farmerCount: 0, qty: 0, amount: 0 };

      const totalAmt = (am.amount || 0) + (pm.amount || 0);
      if (totalAmt <= 0) continue;

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      // Build the shift-wise narration shown on the PRODUCERS DUES line
      const fmt = (n) => Number(n || 0).toFixed(2);
      const narrationLines = [
        `AM, Total Farmer ${am.farmerCount}, QTY ${fmt(am.qty)}, AMOUNT ${fmt(am.amount)}`,
        `PM, Total Farmer ${pm.farmerCount}, QTY ${fmt(pm.qty)}, AMOUNT ${fmt(pm.amount)}`,
      ];
      const narration = narrationLines.join('\n');

      const voucherNumber = `MKP-${dateKey.replace(/-/g, '')}`;

      // Receipt side : PRODUCERS DUES
      const producerDueEntry = {
        date: new Date(dateKey),
        voucherNumber,
        voucherType: 'MilkPurchase',
        ledgerName: 'PRODUCERS DUES',
        narration,
        amount: totalAmt
      };
      dateMap[dateKey].receiptSide.push(producerDueEntry);
      dateMap[dateKey].totalReceipts += totalAmt;
      receiptSide.push(producerDueEntry);

      // Payment side : MILK PURCHASE
      const milkPurchaseEntry = {
        date: new Date(dateKey),
        voucherNumber,
        voucherType: 'MilkPurchase',
        ledgerName: 'MILK PURCHASE',
        narration,
        amount: totalAmt
      };
      dateMap[dateKey].paymentSide.push(milkPurchaseEntry);
      dateMap[dateKey].totalPayments += totalAmt;
      paymentSide.push(milkPurchaseEntry);
    }

    // --- Union Sales — single adjustment entry per day (AM+PM combined) ---
    // Receipt side : UNION SALES   (income leg)
    // Payment side : MILMA UNION   (advance-due-to-society leg)
    // Amount       : day total (AM + PM); narration shows AM and PM lines.
    const unionSalesShiftRows = await UnionSalesSlip.aggregate([
      {
        $match: {
          companyId,
          date: { $gte: start, $lte: end },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: {
            day:  { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            time: '$time'
          },
          totalQty:    { $sum: '$qty' },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.day': 1, '_id.time': 1 } }
    ]);

    const unionDayMap = {};
    for (const r of unionSalesShiftRows) {
      const dateKey = r._id.day;
      const time    = (r._id.time || '').toUpperCase();
      if (!unionDayMap[dateKey]) unionDayMap[dateKey] = {};
      unionDayMap[dateKey][time] = { qty: r.totalQty, amount: r.totalAmount };
    }

    for (const dateKey of Object.keys(unionDayMap).sort()) {
      const shifts = unionDayMap[dateKey];
      const am = shifts['AM'] || { qty: 0, amount: 0 };
      const pm = shifts['PM'] || { qty: 0, amount: 0 };

      const totalAmt = (am.amount || 0) + (pm.amount || 0);
      if (totalAmt <= 0) continue;

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      const fmt = (n) => Number(n || 0).toFixed(2);
      const narration = [
        `AM, QTY ${fmt(am.qty)}, AMOUNT ${fmt(am.amount)}`,
        `PM, QTY ${fmt(pm.qty)}, AMOUNT ${fmt(pm.amount)}`,
      ].join('\n');

      const voucherNumber = `USS-${dateKey.replace(/-/g, '')}`;

      // Receipt side : UNION SALES (Cr leg)
      const unionSalesEntry = {
        date: new Date(dateKey),
        voucherNumber,
        voucherType: 'UnionSales',
        ledgerName: 'UNION SALES',
        narration,
        amount: totalAmt
      };
      dateMap[dateKey].receiptSide.push(unionSalesEntry);
      dateMap[dateKey].totalReceipts += totalAmt;
      receiptSide.push(unionSalesEntry);

      // Payment side : MILMA UNION (Dr leg)
      const milmaUnionEntry = {
        date: new Date(dateKey),
        voucherNumber,
        voucherType: 'UnionSales',
        ledgerName: 'MILMA UNION',
        narration,
        amount: totalAmt
      };
      dateMap[dateKey].paymentSide.push(milmaUnionEntry);
      dateMap[dateKey].totalPayments += totalAmt;
      paymentSide.push(milmaUnionEntry);
    }

    // --- Inventory Purchase — adjustment column (one row per voucher) ---
    // Receipt side : the non-cash Cr legs (Supplier, Cattle Feed Commission,
    //                Inspection Fee, …) shown individually
    // Payment side : a single combined line — the purchase ledger total (e.g.
    //                CATTLE FEED PURCHASE) with the bill's qty + sales rate
    // Cash/Bank legs are intentionally skipped so both sides balance to the
    // non-cash adjustment portion of the bill.
    const purchaseVouchers = vouchers.filter(v => v.voucherType === 'Purchase');

    const fmt2 = (n) => Number(n || 0).toFixed(2);

    for (const voucher of purchaseVouchers) {
      const dateKey = voucher.voucherDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      // Pull related stock transactions for qty / purchase-rate / sales-rate
      const stockTxns = await StockTransaction.find({ voucherId: voucher._id }).lean();
      const totalQty = stockTxns.reduce((s, t) => s + (t.quantity || 0), 0);
      const purchaseRate = totalQty > 0
        ? stockTxns.reduce((s, t) => s + (t.quantity || 0) * (t.rate || 0), 0) / totalQty
        : 0;
      const salesRate = totalQty > 0
        ? stockTxns.reduce((s, t) => s + (t.quantity || 0) * (t.salesRate || 0), 0) / totalQty
        : 0;

      // ── Payment side: sum non-cash Dr legs into one combined purchase row ──
      let totalDr = 0;
      let purchaseLedgerName = '';
      for (const entry of voucher.entries) {
        if (!(entry.debitAmount > 0)) continue;
        const ledgerType = entry.ledgerId?.ledgerType;
        if (cashBankTypes.has(ledgerType)) continue;
        totalDr += entry.debitAmount;
        // First non-GST debit ledger becomes the row label
        if (!purchaseLedgerName && !/gst/i.test(entry.ledgerName || '')) {
          purchaseLedgerName = entry.ledgerName;
        }
      }
      if (!purchaseLedgerName) purchaseLedgerName = 'CATTLE FEED PURCHASE';
      // Normalise variations of the cattle-feed purchase ledger so the Day Book
      // matches the manually-named "CATTLE FEED PURCHASE" in ledger master,
      // regardless of the item-linked ledger's casing ("Cattle Feed Purchase" etc.)
      if (/cattle.?feed.?purchase/i.test(purchaseLedgerName)) {
        purchaseLedgerName = 'CATTLE FEED PURCHASE';
      }

      if (totalDr > 0) {
        const paymentEntry = {
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: 'InventoryPurchase',
          ledgerName: purchaseLedgerName,
          narration: `${purchaseLedgerName} :- Qty ${fmt2(totalQty)}, Sales Rate ${fmt2(salesRate)}`,
          amount: totalDr
        };
        dateMap[dateKey].paymentSide.push(paymentEntry);
        dateMap[dateKey].totalPayments += totalDr;
        paymentSide.push(paymentEntry);
      }

      // ── Receipt side: each non-cash Cr leg as a separate row ──────────────
      for (const entry of voucher.entries) {
        if (!(entry.creditAmount > 0)) continue;
        const ledgerType = entry.ledgerId?.ledgerType;
        if (cashBankTypes.has(ledgerType)) continue;

        const ledgerName = entry.ledgerName || '';
        const isSupplier =
          /supplier|sundry creditor/i.test(ledgerName) ||
          /sundry creditor/i.test(ledgerType || '');

        let displayName, narration;
        if (isSupplier) {
          // Show the actual supplier ledger name (e.g. "ABC Cattle Feed Suppliers"),
          // not a generic "Supplier Purchased" tag.
          displayName = ledgerName || 'Supplier';
          narration = `${displayName} :- Qty ${fmt2(totalQty)}, Purchase Rate ${fmt2(purchaseRate)}`;
        } else {
          const ratePerUnit = totalQty > 0 ? entry.creditAmount / totalQty : 0;
          displayName = ledgerName;
          narration = `${ledgerName} :- Qty ${fmt2(totalQty)}, Rate ${fmt2(ratePerUnit)}`;
        }

        const receiptEntry = {
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: 'InventoryPurchase',
          ledgerName: displayName,
          narration,
          amount: entry.creditAmount
        };
        dateMap[dateKey].receiptSide.push(receiptEntry);
        dateMap[dateKey].totalReceipts += entry.creditAmount;
        receiptSide.push(receiptEntry);
      }
    }

    // --- Inventory Sales — direct query from Sales model ---
    // Sales vouchers are always excluded from the voucher loop above (voucherType='Sales' skip)
    // so there is no double-count risk from this direct query.
    //
    // Cash sale  : receipt side CASH column  → CATTLE FEED SALES (grandTotal)
    //              subsidy portion (if any)  → receipt side ADJUSTMENT (CATTLE FEED SALES)
    //                                          + payment side ADJUSTMENT (per subsidy ledger)
    // Credit sale: receipt side ADJUSTMENT   → CATTLE FEED SALES (grandTotal + totalSubsidy)
    //              payment side ADJUSTMENT   → CATTLE FEED ADVANCE (grandTotal)
    //              subsidy (if any)          → payment side ADJUSTMENT (per subsidy ledger)
    // Narration  : product name, qty, selling price, bill number

    // Resolve ledger names from Ledger management (fallback to standard names)
    const [cfSalesLedger, cfAdvanceLedger] = await Promise.all([
      Ledger.findOne({ companyId, ledgerName: { $regex: /^cattle\s*feed\s*sales$/i } }).lean(),
      Ledger.findOne({ companyId, ledgerName: { $regex: /^cattle\s*feed\s*advance$/i } }).lean()
    ]);
    const cfSalesName   = cfSalesLedger?.ledgerName   || 'CATTLE FEED SALES';
    const cfAdvanceName = cfAdvanceLedger?.ledgerName || 'CATTLE FEED ADVANCE';

    const salesRecords = await Sales.find({
      companyId,
      billDate: { $gte: start, $lte: end }
    }).populate('items.subsidyId', 'subsidyName').lean();

    for (const sale of salesRecords) {
      const dateKey = sale.billDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }

      const isCash     = sale.paymentMode === 'Cash';
      const grandTotal = sale.grandTotal  || 0;
      const totalSub   = sale.totalSubsidy || 0;

      const itemNarration = (sale.items || [])
        .map(i => `${i.itemName} Qty:${i.quantity || 0} @ Rs.${i.rate || 0}`)
        .join('; ');
      const narration = itemNarration
        ? `${itemNarration} | Bill No: ${sale.billNumber}`
        : `Bill No: ${sale.billNumber}`;

      const base = { date: sale.billDate, voucherNumber: sale.billNumber, narration };

      // Helper: group subsidy amounts by ledger name
      const buildSubsidyMap = () => {
        const m = {};
        for (const item of (sale.items || [])) {
          const amt = item.subsidyAmount || 0;
          if (amt <= 0) continue;
          const name = item.subsidyId?.subsidyName || 'Subsidy';
          m[name] = (m[name] || 0) + amt;
        }
        return m;
      };

      if (isCash) {
        // ── Cash sale: income in CASH column ──────────────────────────────
        if (grandTotal > 0) {
          const e = { ...base, voucherType: 'Sales', ledgerName: cfSalesName, amount: grandTotal };
          dateMap[dateKey].receiptSide.push(e);
          dateMap[dateKey].totalReceipts += grandTotal;
          receiptSide.push(e);
        }
        // Subsidy portion → ADJUSTMENT column in Day Book only
        if (totalSub > 0) {
          const subIncome = { ...base, voucherType: 'InventorySale', ledgerName: cfSalesName, amount: totalSub };
          dateMap[dateKey].receiptSide.push(subIncome);
          dateMap[dateKey].totalReceipts += totalSub;
          receiptSide.push(subIncome);

          for (const [subName, subAmt] of Object.entries(buildSubsidyMap())) {
            const subExp = { ...base, voucherType: 'InventorySale', ledgerName: subName, amount: subAmt };
            dateMap[dateKey].paymentSide.push(subExp);
            dateMap[dateKey].totalPayments += subAmt;
            paymentSide.push(subExp);
          }
        }
      } else {
        // ── Credit sale: all in ADJUSTMENT column ─────────────────────────
        const incomeAmt = grandTotal + totalSub; // full item value
        if (incomeAmt > 0) {
          const e = { ...base, voucherType: 'InventorySale', ledgerName: cfSalesName, amount: incomeAmt };
          dateMap[dateKey].receiptSide.push(e);
          dateMap[dateKey].totalReceipts += incomeAmt;
          receiptSide.push(e);
        }
        // Customer owes → CATTLE FEED ADVANCE
        if (grandTotal > 0) {
          const e = { ...base, voucherType: 'InventorySale', ledgerName: cfAdvanceName, amount: grandTotal };
          dateMap[dateKey].paymentSide.push(e);
          dateMap[dateKey].totalPayments += grandTotal;
          paymentSide.push(e);
        }
        // Subsidy portion → per-subsidy ledger on expense side
        if (totalSub > 0) {
          for (const [subName, subAmt] of Object.entries(buildSubsidyMap())) {
            const subExp = { ...base, voucherType: 'InventorySale', ledgerName: subName, amount: subAmt };
            dateMap[dateKey].paymentSide.push(subExp);
            dateMap[dateKey].totalPayments += subAmt;
            paymentSide.push(subExp);
          }
        }
      }
    }

    // --- Cash Advances Given (Farmers Cash Advance ledger) ---
    const cashAdvancesGiven = await Advance.find({
      companyId,
      advanceDate: { $gte: start, $lte: end },
      advanceCategory: 'Cash Advance',
      paymentMode: 'Cash',
      advanceAmount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).populate('farmerId', 'farmerNumber personalDetails').lean();

    for (const adv of cashAdvancesGiven) {
      const dateKey = adv.advanceDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }
      const farmerName = adv.farmerId?.personalDetails?.name || adv.farmerId?.farmerNumber || 'Farmer';
      const entry = {
        date: adv.advanceDate,
        voucherNumber: adv.advanceNumber || `ADV-${String(adv._id).slice(-6)}`,
        voucherType: 'Advance',
        ledgerName: 'Farmers Cash Advance',
        narration: `Cash Advance to ${farmerName}`,
        amount: adv.advanceAmount
      };
      dateMap[dateKey].paymentSide.push(entry);
      dateMap[dateKey].totalPayments += adv.advanceAmount;
      paymentSide.push(entry);
    }

    // --- Producer Receipts (returns from farmers) ---
    // Ledger names for each receipt type
    const [cashAdvLedger, loanLedger] = await Promise.all([
      Ledger.findOne({ companyId, ledgerName: { $regex: /^farmers?\s*cash\s*advance$/i } }).lean(),
      Ledger.findOne({ companyId, ledgerName: { $regex: /^farmers?\s*loan/i } }).lean()
    ]);
    const cashAdvLedgerName = cashAdvLedger?.ledgerName || 'Farmers Cash Advance';
    const loanLedgerName    = loanLedger?.ledgerName    || 'Farmers Loan A/C';

    const advanceLedgerNameMap = {
      'CF Advance':   cfAdvanceName,
      'Cash Advance': cashAdvLedgerName,
      'Loan Advance': loanLedgerName
    };

    // Cash receipts → receipt side (Cash column via voucherType 'Advance')
    const cashReceipts = await ProducerReceipt.find({
      companyId,
      receiptDate: { $gte: start, $lte: end },
      paymentMode: 'Cash',
      amount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).populate('farmerId', 'farmerNumber personalDetails').lean();

    for (const ret of cashReceipts) {
      const dateKey = ret.receiptDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }
      const farmerName  = ret.farmerId?.personalDetails?.name || ret.farmerId?.farmerNumber || 'Farmer';
      const ledgerLabel = advanceLedgerNameMap[ret.receiptType] || ret.receiptType;
      const entry = {
        date:          ret.receiptDate,
        voucherNumber: ret.receiptNumber || `RET-${String(ret._id).slice(-6)}`,
        voucherType:   'Advance',
        ledgerName:    ledgerLabel,
        narration:     `${ret.receiptType} Return — ${farmerName}`,
        amount:        ret.amount
      };
      dateMap[dateKey].receiptSide.push(entry);
      dateMap[dateKey].totalReceipts += ret.amount;
      receiptSide.push(entry);
    }

    // Bank/UPI receipts → adjustment column (both sides)
    const bankReceipts = await ProducerReceipt.find({
      companyId,
      receiptDate: { $gte: start, $lte: end },
      paymentMode: { $in: ['Bank', 'UPI', 'Cheque'] },
      amount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).populate('farmerId', 'farmerNumber personalDetails').lean();

    for (const ret of bankReceipts) {
      const dateKey = ret.receiptDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }
      const farmerName   = ret.farmerId?.personalDetails?.name || ret.farmerId?.farmerNumber || 'Farmer';
      const advLedger    = advanceLedgerNameMap[ret.receiptType] || ret.receiptType;
      const bankLedger   = ret.bankLedgerName || 'Bank';
      const voucherNum   = ret.receiptNumber || `RET-${String(ret._id).slice(-6)}`;
      const narration    = `${ret.receiptType} Return — ${farmerName}`;

      // Income/receipt side: advance ledger being recovered
      const incomeEntry = {
        date: ret.receiptDate, voucherNumber: voucherNum,
        voucherType: 'BankTransfer', ledgerName: advLedger, narration, amount: ret.amount
      };
      dateMap[dateKey].receiptSide.push(incomeEntry);
      dateMap[dateKey].totalReceipts += ret.amount;
      receiptSide.push(incomeEntry);

      // Expense/payment side: bank account that received the money
      const expenseEntry = {
        date: ret.receiptDate, voucherNumber: voucherNum,
        voucherType: 'BankTransfer', ledgerName: bankLedger, narration, amount: ret.amount
      };
      dateMap[dateKey].paymentSide.push(expenseEntry);
      dateMap[dateKey].totalPayments += ret.amount;
      paymentSide.push(expenseEntry);
    }

    // --- Producer Payments (Payment-to-Producer) ---
    // Cash: payment side cash column → PRODUCERS DUES
    // Bank/UPI/Cheque/NEFT/RTGS: both sides adjustment → PRODUCERS DUES + bank ledger

    const bankLedgerForPay = await Ledger.findOne({ companyId, ledgerType: 'Bank' }).lean();
    const bankLedgerPayName = bankLedgerForPay?.ledgerName || 'Bank Account';

    const cashProducerPayments = await ProducerPayment.find({
      companyId,
      paymentDate: { $gte: start, $lte: end },
      paymentMode: 'Cash',
      amountPaid: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).lean();

    for (const pp of cashProducerPayments) {
      const dateKey = pp.paymentDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }
      const entry = {
        date: pp.paymentDate,
        voucherNumber: pp.paymentNumber || `PTP-${String(pp._id).slice(-6)}`,
        voucherType: 'Payment',
        ledgerName: 'PRODUCERS DUES',
        narration: `Payment to Producer — ${pp.producerName || ''}`.trim(),
        amount: pp.amountPaid
      };
      dateMap[dateKey].paymentSide.push(entry);
      dateMap[dateKey].totalPayments += pp.amountPaid;
      paymentSide.push(entry);
    }

    const bankProducerPayments = await ProducerPayment.find({
      companyId,
      paymentDate: { $gte: start, $lte: end },
      paymentMode: { $in: ['Bank', 'UPI', 'Cheque', 'NEFT', 'RTGS'] },
      amountPaid: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    }).lean();

    for (const pp of bankProducerPayments) {
      const dateKey = pp.paymentDate.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, receiptSide: [], paymentSide: [], totalReceipts: 0, totalPayments: 0 };
      }
      const voucherNum = pp.paymentNumber || `PTP-${String(pp._id).slice(-6)}`;
      const narration  = `Payment to Producer — ${pp.producerName || ''}`.trim();

      const receiptEntry = {
        date: pp.paymentDate, voucherNumber: voucherNum,
        voucherType: 'BankTransfer', ledgerName: bankLedgerPayName,
        narration, amount: pp.amountPaid
      };
      dateMap[dateKey].receiptSide.push(receiptEntry);
      dateMap[dateKey].totalReceipts += pp.amountPaid;
      receiptSide.push(receiptEntry);

      const paymentEntry = {
        date: pp.paymentDate, voucherNumber: voucherNum,
        voucherType: 'BankTransfer', ledgerName: 'PRODUCERS DUES',
        narration, amount: pp.amountPaid
      };
      dateMap[dateKey].paymentSide.push(paymentEntry);
      dateMap[dateKey].totalPayments += pp.amountPaid;
      paymentSide.push(paymentEntry);
    }

    // --- Build dayWiseData with chained opening/closing balances ---
    const sortedDates = Object.keys(dateMap).sort();
    const dayWiseData = [];
    let runningBalance = openingBalance;

    for (const dateKey of sortedDates) {
      const day = dateMap[dateKey];
      day.openingBalance = runningBalance;
      day.closingBalance = runningBalance + day.totalReceipts - day.totalPayments;
      runningBalance = day.closingBalance;
      dayWiseData.push(day);
    }

    // --- Summary ---
    const totalReceipts = receiptSide.reduce((sum, e) => sum + e.amount, 0);
    const totalPayments = paymentSide.reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        startDate,
        endDate,
        dayWiseData,
        receiptSide,
        paymentSide,
        summary: {
          openingBalance,
          closingBalance: openingBalance + totalReceipts - totalPayments,
          totalReceipts,
          totalPayments
        }
      }
    });
  } catch (error) {
    console.error('Error generating day book:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating day book'
    });
  }
};

export default {
  getDayBook
};

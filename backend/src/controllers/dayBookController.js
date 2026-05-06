import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import MilkCollection from '../models/MilkCollection.js';

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

      const isReceiptVoucher = voucher.voucherType === 'Receipt';
      const isPaymentVoucher = voucher.voucherType === 'Payment';
      const isSalesVoucher   = voucher.voucherType === 'Sales';
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
        } else if (isSalesVoucher) {
          // Sales voucher: only show the income (Cr) entry on receipt side.
          // Customer/debtor Dr entries are receivables — not a "payment" in the day book.
          if (entry.creditAmount > 0) {
            const receiptEntry = { ...entryData, amount: entry.creditAmount };
            dateMap[dateKey].receiptSide.push(receiptEntry);
            dateMap[dateKey].totalReceipts += entry.creditAmount;
            receiptSide.push(receiptEntry);
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

    // --- Milk Purchase day totals — Payment side ---
    const milkPurchaseDayTotals = await MilkCollection.aggregate([
      {
        $match: {
          companyId,
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalAmount: { $sum: '$amount' },
          totalQty: { $sum: '$qty' },
          farmerCount: { $addToSet: '$farmer' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    for (const day of milkPurchaseDayTotals) {
      const dateKey = day._id;
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      const farmerCount = day.farmerCount.length;
      const totalQty = day.totalQty.toFixed(2);
      const totalAmt = day.totalAmount;

      // Receipt side: Producers Dues (what is owed to producers)
      const producerDueEntry = {
        date: new Date(dateKey),
        voucherNumber: `MKP-${dateKey.replace(/-/g, '')}`,
        voucherType: 'ProducersDue',
        ledgerName: `Producers Dues — ${farmerCount} Farmers`,
        narration: `Total Farmers: ${farmerCount} | Qty: ${totalQty} L`,
        amount: totalAmt
      };
      dateMap[dateKey].receiptSide.push(producerDueEntry);
      dateMap[dateKey].totalReceipts += totalAmt;
      receiptSide.push(producerDueEntry);

      // Payment side: Milk Purchase (milk purchased from farmers)
      const milkPurchaseEntry = {
        date: new Date(dateKey),
        voucherNumber: `MKP-${dateKey.replace(/-/g, '')}`,
        voucherType: 'MilkPurchase',
        ledgerName: `Milk Purchase — ${farmerCount} Farmers`,
        narration: `Qty: ${totalQty} L | Day Total: ₹${totalAmt.toFixed(2)}`,
        amount: totalAmt
      };
      dateMap[dateKey].paymentSide.push(milkPurchaseEntry);
      dateMap[dateKey].totalPayments += totalAmt;
      paymentSide.push(milkPurchaseEntry);
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

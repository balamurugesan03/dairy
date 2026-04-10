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

      for (const entry of voucher.entries) {
        const ledgerType = entry.ledgerId?.ledgerType;
        const isCashBank = cashBankTypes.has(ledgerType);

        // For Receipt vouchers: skip the Cash/Bank debit leg (it's implied cash-in)
        // For Payment vouchers: skip the Cash/Bank credit leg (it's implied cash-out)
        if ((isReceiptVoucher && isCashBank && entry.debitAmount > 0) ||
            (isPaymentVoucher && isCashBank && entry.creditAmount > 0)) {
          continue;
        }

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
          // Receipt voucher: non-cash leg → receipt side (cash received for this)
          const amount = entry.creditAmount || entry.debitAmount || 0;
          if (amount > 0) {
            const receiptEntry = { ...entryData, amount };
            dateMap[dateKey].receiptSide.push(receiptEntry);
            dateMap[dateKey].totalReceipts += amount;
            receiptSide.push(receiptEntry);
          }
        } else if (isPaymentVoucher) {
          // Payment voucher: non-cash leg → payment side (cash paid for this)
          const amount = entry.debitAmount || entry.creditAmount || 0;
          if (amount > 0) {
            const paymentEntry = { ...entryData, amount };
            dateMap[dateKey].paymentSide.push(paymentEntry);
            dateMap[dateKey].totalPayments += amount;
            paymentSide.push(paymentEntry);
          }
        } else {
          // Journal and other vouchers: use debit/credit sides as-is
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

      // Receipt (Dr): Milk Purchase
      const drEntry = {
        date: new Date(dateKey),
        voucherNumber: `MKP-${dateKey.replace(/-/g, '')}`,
        voucherType: 'MilkPurchase',
        ledgerName: `Milk Purchase — ${day.farmerCount.length} farmers (${day.totalQty.toFixed(2)} L)`,
        narration: `Shift Total — ${dateKey}`,
        amount: day.totalAmount
      };
      dateMap[dateKey].receiptSide.push(drEntry);
      dateMap[dateKey].totalReceipts += day.totalAmount;
      receiptSide.push(drEntry);

      // Payment (Cr): Producers Dues
      const crEntry = {
        date: new Date(dateKey),
        voucherNumber: `MKP-${dateKey.replace(/-/g, '')}`,
        voucherType: 'ProducersDue',
        ledgerName: `Producers Dues — ${day.farmerCount.length} farmers`,
        narration: `Milk Purchase Day Total — ${dateKey}`,
        amount: day.totalAmount
      };
      dateMap[dateKey].paymentSide.push(crEntry);
      dateMap[dateKey].totalPayments += day.totalAmount;
      paymentSide.push(crEntry);
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

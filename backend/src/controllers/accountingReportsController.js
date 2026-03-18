import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import { getDateRange } from '../utils/dateFilters.js';
import {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  getLedgerCategory
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

    // Process transactions
    const transactions = [];
    let runningBalance = openingBalance;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === cashLedger._id.toString()) {
          const isReceipt = entry.debitAmount > 0;
          const amount = isReceipt ? entry.debitAmount : entry.creditAmount;

          // Find contra ledger (the other side)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== cashLedger._id.toString()
          );

          runningBalance += isReceipt ? amount : -amount;

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: isReceipt
              ? `From ${contraEntry?.ledgerName || 'Various'}`
              : `To ${contraEntry?.ledgerName || 'Various'}`,
            voucherId: voucher._id,
            debit: isReceipt ? amount : 0,
            credit: isReceipt ? 0 : amount,
            balance: runningBalance,
            narration: entry.narration || voucher.narration
          });
        }
      });
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
      return res.status(400).json({
        success: false,
        message: 'Ledger ID is required'
      });
    }

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999); // include the full end date
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

    // Get ledger details
    const ledger = await Ledger.findOne({ _id: ledgerId, companyId: req.companyId });
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(
      Ledger,
      Voucher,
      ledgerId,
      dateFilter.startDate,
      req.companyId
    );

    // Get all voucher entries for this ledger in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': ledgerId
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

    // Process transactions with running balance
    const transactions = [];
    let runningBalance = openingBalance;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === ledgerId.toString()) {
          // Calculate new balance
          const netChange = entry.debitAmount - entry.creditAmount;
          if (isDebitNature) {
            runningBalance += netChange;
          } else {
            runningBalance -= netChange;
          }

          // Find contra ledger (the other side of the entry)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== ledgerId.toString()
          );

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: contraEntry ? contraEntry.ledgerName : 'Various',
            voucherId: voucher._id,
            debit: entry.debitAmount,
            credit: entry.creditAmount,
            balance: Math.abs(runningBalance),
            balanceType: getBalanceType(runningBalance, isDebitNature),
            narration: entry.narration || voucher.narration
          });
        }
      });
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

    res.status(200).json({
      success: true,
      data: {
        ledger: {
          id: ledger._id,
          name: ledger.ledgerName,
          type: ledger.ledgerType
        },
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType: getBalanceType(openingBalance, isDebitNature),
        closingBalance: Math.abs(runningBalance),
        closingBalanceType: getBalanceType(runningBalance, isDebitNature),
        transactions,
        summary: {
          totalDebits,
          totalCredits,
          difference: totalDebits - totalCredits
        }
      }
    });
  } catch (error) {
    console.error('Error generating general ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating general ledger'
    });
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

    // Calculate totals
    const summary = {
      totalLedgers: abstract.length,
      totalOpeningDebit: abstract
        .filter(a => a.openingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalOpeningCredit: abstract
        .filter(a => a.openingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalDebits: abstract.reduce((sum, a) => sum + a.totalDebits, 0),
      totalCredits: abstract.reduce((sum, a) => sum + a.totalCredits, 0),
      totalClosingDebit: abstract
        .filter(a => a.closingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.closingBalance, 0),
      totalClosingCredit: abstract
        .filter(a => a.closingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.closingBalance, 0)
    };

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        abstract,
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

    const query = { status: 'Active', companyId: req.companyId };
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

export default {
  getCashBook,
  getGeneralLedger,
  getGeneralLedgerAbstract,
  getReceiptsDisbursementEnhanced,
  getLedgersForDropdown
};

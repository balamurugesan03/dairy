import BankTransfer from '../models/BankTransfer.js';
import Farmer from '../models/Farmer.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import CollectionCenter from '../models/CollectionCenter.js';
import FarmerPayment from '../models/FarmerPayment.js';
import PaymentRegister from '../models/PaymentRegister.js';
import ProducerPayment from '../models/ProducerPayment.js';
import { saveWithUniqueNumber } from '../models/Counter.js';
import mongoose from 'mongoose';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// Retrieve producer balances for bank transfer
export const retrieveBalances = async (req, res) => {
  try {
    const {
      transferBasis,
      asOnDate,
      applyDate,
      collectionCenter,
      bank,
      roundDownAmount,
      dueByList,
      cycleFromDate,
      cycleToDate,
    } = req.body;

    const companyId = req.userCompany;

    // Build farmer filter
    const farmerFilter = {
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'Active'
    };

    if (collectionCenter && collectionCenter !== 'all') {
      farmerFilter.collectionCenter = new mongoose.Types.ObjectId(collectionCenter);
    }

    // Get all active farmers
    const farmers = await Farmer.find(farmerFilter)
      .select('farmerNumber personalDetails bankDetails collectionCenter')
      .lean();

    const balances = [];
    const roundDown = parseInt(roundDownAmount) || 10;

    // Build cycle filter for FarmerPayment (±2 day window for IST/UTC offset).
    // When a cycle is provided, only payments whose paymentPeriod matches that cycle count.
    let cycleFpFilter = null;
    let cycleRegisterEntryByFarmer = null; // Map<farmerId, register entry>
    let cycleRegisterFarmerIds = null;     // Set<farmerId> of farmers in the saved cycle
    let alreadyPaidSet = new Set();        // farmerIds already paid (cash + bank) for the cycle
    if (cycleFromDate && cycleToDate) {
      const dayMs    = 24 * 60 * 60 * 1000;
      const fromMid  = new Date(cycleFromDate);
      const toMid    = new Date(cycleToDate);
      const range = (mid) => ({
        $gte: new Date(mid.getTime() - 2 * dayMs),
        $lte: new Date(mid.getTime() + 2 * dayMs),
      });
      cycleFpFilter = {
        'paymentPeriod.fromDate': range(fromMid),
        'paymentPeriod.toDate':   range(toMid),
      };

      // Source the farmer list from the saved PaymentRegister for this cycle —
      // PaymentRegister.entries is the cycle's source of truth (e.g. all 95
      // farmers), whereas FarmerPayment records may exist only for the subset
      // that the user locked + saved (e.g. just 11 of 95).
      const register = await PaymentRegister.findOne({
        companyId:    new mongoose.Types.ObjectId(companyId),
        registerType: { $in: ['Ledger', 'Producers'] },
        fromDate:     range(fromMid),
        toDate:       range(toMid),
        status:       { $in: ['Saved', 'Printed'] },
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (register?.entries?.length) {
        cycleRegisterEntryByFarmer = {};
        cycleRegisterFarmerIds     = new Set();
        for (const e of register.entries) {
          const fid = e.farmerId?.toString();
          if (!fid) continue;
          cycleRegisterFarmerIds.add(fid);
          cycleRegisterEntryByFarmer[fid] = e;
        }
      }

      // Build "already paid" set so those farmers are excluded from the queue:
      //   • cash payments via Payment to Producer (ProducerPayment)
      //   • bank transfers already applied (FarmerPayment status=Paid)
      const cashPaid = await ProducerPayment.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        'processingPeriod.fromDate': range(fromMid),
        'processingPeriod.toDate':   range(toMid),
      }).select('farmerId').lean();
      cashPaid.forEach(p => p.farmerId && alreadyPaidSet.add(p.farmerId.toString()));

      const bankPaid = await FarmerPayment.find({
        companyId:     new mongoose.Types.ObjectId(companyId),
        paymentSource: 'BankTransfer',
        status:        'Paid',
        'paymentPeriod.fromDate': range(fromMid),
        'paymentPeriod.toDate':   range(toMid),
      }).select('farmerId').lean();
      bankPaid.forEach(p => p.farmerId && alreadyPaidSet.add(p.farmerId.toString()));
    }

    for (const farmer of farmers) {
      const farmerIdStr = farmer._id.toString();

      // Cycle selected & saved register found → restrict to the register's farmer list
      // so all entries in the saved cycle (e.g. all 95) are eligible to appear.
      if (cycleRegisterFarmerIds && !cycleRegisterFarmerIds.has(farmerIdStr)) continue;

      // Skip farmers already paid (cash or bank) for this cycle
      if (alreadyPaidSet.has(farmerIdStr)) continue;
      // Calculate net payable based on transfer basis
      let netPayable = 0;

      let paymentMode = 'Bank Transfer'; // default

      const baseFpQuery = {
        companyId: new mongoose.Types.ObjectId(companyId),
        farmerId: farmer._id,
        status: { $in: ['Pending', 'Partial'] },
        paymentSource: 'BankTransfer',
        ...(cycleFpFilter || {}),
      };

      if (transferBasis === 'As on Date Balance') {
        // Query pending BankTransfer payments restricted to the selected cycle (when provided).
        // Sum balanceAmount (not netPayable) so a partial transfer leaves only
        // the remaining balance in the queue, not the original full amount.
        const pendingPayments = await FarmerPayment.find(baseFpQuery).sort({ paymentDate: -1 });

        netPayable = pendingPayments.reduce((sum, p) => sum + (p.balanceAmount || 0), 0);
        if (pendingPayments.length > 0) {
          paymentMode = pendingPayments[0].paymentMode || 'Bank Transfer';
        }
      } else {
        // Most recent BankTransfer-source pending payment in the cycle.
        // balanceAmount reflects what's actually left to disburse after any
        // partial apply; netPayable is the original gross amount.
        const lastPeriod = await FarmerPayment.findOne(baseFpQuery).sort({ paymentDate: -1 });

        if (lastPeriod) {
          netPayable = lastPeriod.balanceAmount || 0;
          paymentMode = lastPeriod.paymentMode || 'Bank Transfer';
        }
      }

      // Fallback: if no FarmerPayment record exists for this farmer in the cycle,
      // use the saved PaymentRegister entry's netPay so all farmers in the saved
      // cycle appear (not only the ones that were locked + saved as BankTransfer).
      const registerEntry = cycleRegisterEntryByFarmer?.[farmerIdStr];
      if (netPayable === 0 && registerEntry) {
        netPayable = registerEntry.netPay || 0;
        const regMode = registerEntry.payMode || registerEntry.paymentMode;
        if (regMode) {
          paymentMode = regMode === 'Cash' ? 'Cash' : 'Bank Transfer';
        }
      }

      // Bank Transfer queues only farmers with a positive net pay. Recovery-
      // only rows (net pay ≤ 0) are recorded in Payment Register Detailed but
      // have nothing to disburse, so they're skipped here.
      if (cycleFpFilter && netPayable <= 0) {
        continue;
      }

      // Filter by bank if specified
      const bankDetails = farmer.bankDetails || {};
      if (bank && bank !== 'all' && bankDetails.bankName !== bank) {
        continue;
      }

      // Apply due by list filter if enabled
      if (dueByList && netPayable <= 0) {
        continue;
      }

      // Calculate transfer amount with round down
      let transferAmount = 0;
      if (netPayable > 0) {
        transferAmount = Math.floor(netPayable / roundDown) * roundDown;
      }

      balances.push({
        farmerId: farmer._id,
        producerId: farmer.farmerNumber,
        producerName: farmer.personalDetails?.name || 'Unknown',
        netPayable,
        transferAmount,
        paymentMode,           // Cash / Bank Transfer / Cheque from Payment Register
        approved: transferAmount > 0,
        bankDetails: {
          accountNumber: bankDetails.accountNumber || '-',
          bankName: bankDetails.bankName || '-',
          branch: bankDetails.branch || '-',
          ifscCode: bankDetails.ifsc || bankDetails.ifscCode || '-',
          micr: bankDetails.micr || '-',
          bankLedgerId: bankDetails.bankLedgerId || null,
          bankCode: bankDetails.branchCode || '-'
        }
      });
    }

    // Sort by producer ID — numeric ascending (so "2" comes before "10")
    balances.sort((a, b) => {
      const na = parseInt(String(a.producerId || '').replace(/\D/g, ''), 10);
      const nb = parseInt(String(b.producerId || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.producerId || '').localeCompare(String(b.producerId || ''));
    });

    // Calculate summary
    const summary = {
      totalProducers: balances.length,
      totalNetPayable: balances.reduce((sum, b) => sum + b.netPayable, 0),
      totalTransferAmount: balances.filter(b => b.approved).reduce((sum, b) => sum + b.transferAmount, 0),
      totalApproved: balances.filter(b => b.approved).length,
      negativeBalances: balances.filter(b => b.netPayable < 0).length
    };

    res.json({
      success: true,
      data: balances,
      summary,
      message: `Retrieved ${balances.length} producer balances`
    });
  } catch (error) {
    console.error('Error retrieving balances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving producer balances'
    });
  }
};

// Apply bank transfer
export const applyBankTransfer = async (req, res) => {
  try {
    const {
      transferBasis,
      asOnDate,
      applyDate,
      collectionCenter,
      collectionCenterName,
      bank,
      bankName,
      roundDownAmount,
      dueByList,
      transferDetails,
      remarks,
      chequeNumber,
      chequeDate,
    } = req.body;

    const companyId = req.userCompany;

    // ── Block re-applying a cycle that's already been applied ─────────────
    // Match by asOnDate (which is the cycle's toDate) with ±2 day tolerance
    // for IST/UTC offsets. Cancelled transfers don't block (they freed the
    // cycle); a Deleted transfer is gone from the collection so won't match.
    if (asOnDate) {
      const dayMs = 24 * 60 * 60 * 1000;
      const cycleEnd = new Date(asOnDate);
      const existing = await BankTransfer.findOne({
        companyId,
        status: { $in: ['Applied', 'Completed'] },
        asOnDate: {
          $gte: new Date(cycleEnd.getTime() - 2 * dayMs),
          $lte: new Date(cycleEnd.getTime() + 2 * dayMs),
        },
      }).sort({ createdAt: -1 });
      if (existing) {
        return res.status(409).json({
          success: false,
          alreadyApplied: true,
          transferNumber: existing.transferNumber,
          message: `ALREADY PAYMENT APPLIED — Transfer ${existing.transferNumber} on ${new Date(existing.applyDate).toLocaleDateString('en-IN')}. Delete it from the log to re-apply this cycle.`,
        });
      }
    }

    // Filter only approved transfers
    const approvedTransfers = transferDetails.filter(d => d.approved && d.transferAmount > 0);

    if (approvedTransfers.length === 0) {
      throw new Error('No approved transfers to process');
    }

    // Create bank transfer record (with retry on transferNumber collisions)
    const bankTransfer = await saveWithUniqueNumber({
      Model:       BankTransfer,
      companyId,
      prefix:      'BT',
      numberField: 'transferNumber',
      build: () => new BankTransfer({
        companyId,
        transferBasis,
        asOnDate: new Date(asOnDate),
        applyDate: new Date(applyDate),
        collectionCenter: collectionCenter && collectionCenter !== 'all' ? collectionCenter : null,
        collectionCenterName: collectionCenterName || 'All',
        bank: bank && bank !== 'all' ? bank : null,
        bankName: bankName || 'All',
        roundDownAmount: parseInt(roundDownAmount) || 10,
        dueByList,
        transferDetails: approvedTransfers.map(d => ({
          farmerId: d.farmerId,
          producerId: d.producerId,
          producerName: d.producerName,
          netPayable: d.netPayable,
          transferAmount: d.transferAmount,
          paymentMode: d.paymentMode || d.mode || 'Bank Transfer',
          approved: true,
          bankDetails: d.bankDetails,
          transferStatus: 'Pending'
        })),
        status: 'Applied',
        createdBy: req.user?._id,
        appliedBy: req.user?._id,
        appliedAt: new Date(),
        chequeNumber: chequeNumber || '',
        chequeDate:   chequeDate ? new Date(chequeDate) : null,
        remarks
      }),
    });

    // Mark each farmer's pending BankTransfer FarmerPayment.
    // balanceAmount = max(0, netPayable − transferAmount). When the transfer
    // is short of the full netPayable (round-down or partial), the row stays
    // Partial with the remaining balance — the next cycle's previousBalance
    // aggregation picks it up automatically via $sum: '$balanceAmount'.
    for (const d of approvedTransfers) {
      try {
        const netPayable    = d.netPayable     || 0;
        const transferAmt   = d.transferAmount || 0;
        const balanceAmount = Math.max(0, netPayable - transferAmt);
        const newStatus     = transferAmt >= netPayable ? 'Paid' : 'Partial';
        await FarmerPayment.updateMany(
          {
            companyId,
            farmerId:      d.farmerId,
            paymentSource: 'BankTransfer',
            status:        { $in: ['Pending', 'Partial'] },
          },
          {
            $set: {
              paidAmount:    transferAmt,
              balanceAmount,
              status:        newStatus,
              paymentDate:   new Date(applyDate),
            },
          }
        );
      } catch (updateErr) {
        console.error('FarmerPayment status update failed for farmer', d.farmerId, updateErr.message);
      }
    }

    // Create PRODUCERS DUES vouchers: cash → Payment in Cash Book, bank → Payment in Day Book
    try {
      const vouchers = await createProducerDuesVouchers(bankTransfer, approvedTransfers, companyId);
      if (vouchers.length > 0) {
        bankTransfer.voucherId = vouchers[0]._id;
        await bankTransfer.save();
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
    }
    res.status(201).json({
      success: true,
      message: `Bank transfer applied successfully for ${approvedTransfers.length} producers`,
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error applying bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error applying bank transfer'
    });
  } finally {
  }
};

// ─── Helper: get-or-create a ledger by name ──────────────────────────────────
const ensureLedger = async (ledgerName, ledgerType, balanceType, companyId) => {
  let ledger = await Ledger.findOne({ ledgerName, companyId });
  if (!ledger) {
    ledger = new Ledger({
      ledgerName,
      ledgerType,
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType,
    });
    await ledger.save();
  }
  return ledger;
};

// ─── Helper: create PRODUCERS DUES vouchers (cash + bank) on apply ───────────
// Cash payments              → Payment voucher in Cash Book (Dr PRODUCERS DUES, Cr Cash in Hand)
// Bank Transfer + Cheque(s)  → Payment voucher in Day Book  (Dr PRODUCERS DUES, Cr Bank Ledger)
// Cheques are issued from a bank account, so they post on the bank side just
// like Bank Transfer — and surface in the Day Book adjustment column.
const createProducerDuesVouchers = async (bankTransfer, transferDetails, companyId) => {
  const vouchers = [];
  const applyDate = bankTransfer.applyDate;

  // Get or create PRODUCERS DUES ledger (expense/liability — amount owed to farmers)
  const producerDuesLedger = await ensureLedger(
    'PRODUCERS DUES', 'Other Payable', 'Cr', companyId
  );

  // Only physical cash payments go to Cash Book; cheques are bank-side.
  const CASH_MODES = ['Cash'];
  const cashTransfers = transferDetails.filter(d => CASH_MODES.includes(d.paymentMode));
  const bankTransfers = transferDetails.filter(d => !d.paymentMode || !CASH_MODES.includes(d.paymentMode));

  const cashTotal = cashTransfers.reduce((s, d) => s + (d.transferAmount || 0), 0);
  const bankTotal = bankTransfers.reduce((s, d) => s + (d.transferAmount || 0), 0);

  // ── Cash Payment voucher ──────────────────────────────────────────────────
  if (cashTotal > 0) {
    const cashLedger = await ensureLedger('Cash in Hand', 'Cash', 'Dr', companyId);
    const entries = [
      // Dr PRODUCERS DUES (reducing liability to producers)
      { ledgerId: producerDuesLedger._id, ledgerName: producerDuesLedger.ledgerName, debitAmount: cashTotal, creditAmount: 0 },
      // Cr Cash in Hand (cash going out)
      { ledgerId: cashLedger._id, ledgerName: cashLedger.ledgerName, debitAmount: 0, creditAmount: cashTotal },
    ];
    const voucher = new Voucher({
      voucherType: 'Payment',
      voucherNumber: await generateVoucherNumber('Payment', companyId),
      voucherDate: applyDate,
      companyId,
      entries,
      totalDebit: cashTotal,
      totalCredit: cashTotal,
      narration: `Producers Cash Payment — ${bankTransfer.transferNumber} — ${cashTransfers.length} producer(s)`,
      referenceType: 'BankTransfer',
      referenceId: bankTransfer._id,
      createdBy: bankTransfer.appliedBy,
    });
    await voucher.save();
    await updateLedgerBalances(entries);
    vouchers.push(voucher);
  }

  // ── Bank Payment voucher(s) ───────────────────────────────────────────────
  // Group bank transfers by the farmer's selected bank ledger (bankDetails.bankLedgerId).
  // Each group posts a separate voucher Dr PRODUCERS DUES / Cr <that bank ledger>,
  // so the Day Book reflects which physical bank account the money left from.
  // Producers without a linked bank ledger fall back to the transfer-level bank ledger.
  if (bankTotal > 0) {
    const groups = new Map(); // key: bankLedgerId | 'fallback'  →  { ledgerId, total, count }

    for (const d of bankTransfers) {
      const linkedId = d.bankDetails?.bankLedgerId;
      const key = linkedId ? String(linkedId) : 'fallback';
      if (!groups.has(key)) groups.set(key, { ledgerId: linkedId || null, total: 0, count: 0 });
      const g = groups.get(key);
      g.total += d.transferAmount || 0;
      g.count += 1;
    }

    // Fallback ledger (used when farmer has no linked bank ledger)
    const fallbackName = bankTransfer.bankName && bankTransfer.bankName !== 'All'
      ? bankTransfer.bankName
      : 'Bank Account';
    const fallbackLedger = await ensureLedger(fallbackName, 'Bank Accounts', 'Dr', companyId);

    for (const [key, g] of groups) {
      if (g.total <= 0) continue;

      let bankLedger = null;
      if (g.ledgerId) {
        bankLedger = await Ledger.findOne({ _id: g.ledgerId, companyId });
      }
      if (!bankLedger) bankLedger = fallbackLedger;

      const entries = [
        // Dr PRODUCERS DUES (reducing liability to producers)
        { ledgerId: producerDuesLedger._id, ledgerName: producerDuesLedger.ledgerName, debitAmount: g.total, creditAmount: 0 },
        // Cr <farmer-linked bank ledger> (or fallback)
        { ledgerId: bankLedger._id, ledgerName: bankLedger.ledgerName, debitAmount: 0, creditAmount: g.total },
      ];
      const chequeSuffix = bankTransfer.chequeNumber
        ? ` — Cheque #${bankTransfer.chequeNumber}${bankTransfer.chequeDate ? ` dt ${new Date(bankTransfer.chequeDate).toLocaleDateString('en-IN')}` : ''}`
        : '';
      const voucher = new Voucher({
        voucherType: 'Payment',
        voucherNumber: await generateVoucherNumber('Payment', companyId),
        voucherDate: applyDate,
        companyId,
        entries,
        totalDebit: g.total,
        totalCredit: g.total,
        narration: `Producers Bank Transfer — ${bankTransfer.transferNumber} — ${g.count} producer(s) via ${bankLedger.ledgerName}${chequeSuffix}`,
        referenceType: 'BankTransfer',
        referenceId: bankTransfer._id,
        createdBy: bankTransfer.appliedBy,
      });
      await voucher.save();
      await updateLedgerBalances(entries);
      vouchers.push(voucher);
    }
  }

  return vouchers;
};

// ─── Helper: delete all auto-posted vouchers for a BankTransfer ──────────────
// Apply can create multiple vouchers (one Cash voucher + one per bank-ledger
// group), but only the first is stored on bankTransfer.voucherId. Find them
// by their referenceType/referenceId, reverse the ledger-balance impact, and
// delete the voucher docs so the Day Book / Cash Book entries disappear.
const removeAutoPostedVouchers = async (bankTransferId, companyId) => {
  const linked = await Voucher.find({
    companyId,
    referenceType: 'BankTransfer',
    referenceId:   bankTransferId,
  });

  for (const v of linked) {
    try {
      // Reverse ledger balance: apply entries with debit/credit swapped
      const reversedEntries = (v.entries || []).map(e => ({
        ledgerId:     e.ledgerId,
        ledgerName:   e.ledgerName,
        debitAmount:  e.creditAmount || 0,
        creditAmount: e.debitAmount  || 0,
      }));
      if (reversedEntries.length > 0) {
        await updateLedgerBalances(reversedEntries, null, companyId);
      }
      await Voucher.deleteOne({ _id: v._id });
    } catch (err) {
      console.error('Failed to remove auto-posted voucher', v._id?.toString(), err.message);
    }
  }
  return linked.length;
};

// Helper function to create ProducerDue voucher on completion
const createCompletionVoucher = async (bankTransfer, companyId, userId) => {
  // Get Bank Transfer Payable ledger (created during apply)
  let bankTransferPayableLedger = await Ledger.findOne({
    ledgerName: 'Bank Transfer Payable',
    companyId
  });

  if (!bankTransferPayableLedger) {
    bankTransferPayableLedger = new Ledger({
      ledgerName: 'Bank Transfer Payable',
      ledgerType: 'Other Payable',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Cr'
    });
    await bankTransferPayableLedger.save();
  }

  // Get or create Producer Bank Payment ledger (Bank side)
  let producerBankLedger = await Ledger.findOne({
    ledgerName: 'Producer Bank Payment',
    companyId
  });

  if (!producerBankLedger) {
    producerBankLedger = new Ledger({
      ledgerName: 'Producer Bank Payment',
      ledgerType: 'Bank',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Cr'
    });
    await producerBankLedger.save();
  }

  const entries = [
    // Debit: Bank Transfer Payable (clear the liability)
    {
      ledgerId: bankTransferPayableLedger._id,
      ledgerName: bankTransferPayableLedger.ledgerName,
      debitAmount: bankTransfer.totalTransferAmount,
      creditAmount: 0
    },
    // Credit: Producer Bank Payment (actual bank outflow)
    {
      ledgerId: producerBankLedger._id,
      ledgerName: producerBankLedger.ledgerName,
      debitAmount: 0,
      creditAmount: bankTransfer.totalTransferAmount
    }
  ];

  const voucher = new Voucher({
    voucherType: 'ProducerDue',
    voucherNumber: await generateVoucherNumber('ProducerDue', companyId),
    voucherDate: new Date(),
    companyId,
    entries,
    totalDebit: bankTransfer.totalTransferAmount,
    totalCredit: bankTransfer.totalTransferAmount,
    narration: `Producer Due - Bank Transfer Completed: ${bankTransfer.transferNumber} - ${bankTransfer.totalApproved} producers`,
    referenceType: 'BankTransfer',
    referenceId: bankTransfer._id,
    createdBy: userId
  });

  await voucher.save();
  await updateLedgerBalances(entries);

  return voucher;
};

// Get all bank transfers
export const getAllBankTransfers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      fromDate,
      toDate,
      sortBy = 'applyDate',
      sortOrder = 'desc'
    } = req.query;

    const filter = { companyId: req.userCompany };

    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.applyDate = {};
      if (fromDate) filter.applyDate.$gte = new Date(fromDate);
      if (toDate) filter.applyDate.$lte = new Date(toDate);
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      BankTransfer.find(filter)
        .populate('createdBy', 'username name')
        .populate('appliedBy', 'username name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      BankTransfer.countDocuments(filter)
    ]);

    // Summary
    const summary = await BankTransfer.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(req.userCompany) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalTransferAmount' },
          totalProducers: { $sum: '$totalApproved' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data,
      summary: summary[0] || { totalAmount: 0, totalProducers: 0, count: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bank transfers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bank transfers'
    });
  }
};

// Get single bank transfer
export const getBankTransferById = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    })
    .populate('createdBy', 'username name')
    .populate('appliedBy', 'username name')
    .populate('transferDetails.farmerId', 'farmerNumber personalDetails');

    if (!bankTransfer) {
      return res.status(404).json({
        success: false,
        message: 'Bank transfer not found'
      });
    }

    res.json({
      success: true,
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error fetching bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bank transfer'
    });
  }
};

// Cancel bank transfer
export const cancelBankTransfer = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!bankTransfer) {
      throw new Error('Bank transfer not found');
    }

    if (bankTransfer.status === 'Completed') {
      throw new Error('Cannot cancel a completed transfer');
    }

    if (bankTransfer.status === 'Cancelled') {
      throw new Error('Transfer is already cancelled');
    }

    // Update status
    bankTransfer.status = 'Cancelled';
    bankTransfer.transferDetails.forEach(detail => {
      detail.transferStatus = 'Cancelled';
    });

    // Reverse FarmerPayment records back to Pending. balanceAmount must be
    // restored to the full netPayable so the next-cycle prevBalance carry
    // picks the amount up via $sum: '$balanceAmount'.
    for (const d of bankTransfer.transferDetails) {
      try {
        await FarmerPayment.updateMany(
          {
            companyId:     req.userCompany,
            farmerId:      d.farmerId,
            paymentSource: 'BankTransfer',
            status:        { $in: ['Paid', 'Partial'] },
          },
          {
            $set: {
              paidAmount:    0,
              balanceAmount: d.netPayable || 0,
              status:        'Pending',
            },
          }
        );
      } catch (reverseErr) {
        console.error('Reverse FarmerPayment failed for farmer', d.farmerId, reverseErr.message);
      }
    }

    // Remove the auto-posted Day Book / Cash Book vouchers (covers all bank
    // groups + cash voucher, not just bankTransfer.voucherId).
    const removed = await removeAutoPostedVouchers(bankTransfer._id, req.userCompany);
    bankTransfer.voucherId = undefined;

    await bankTransfer.save();

    res.json({
      success: true,
      message: `Bank transfer cancelled — ${removed} auto-posted voucher(s) removed`,
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error cancelling bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling bank transfer'
    });
  } finally {
  }
};

// Mark transfer as completed
export const completeTransfer = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!bankTransfer) {
      return res.status(404).json({
        success: false,
        message: 'Bank transfer not found'
      });
    }

    if (bankTransfer.status !== 'Applied') {
      return res.status(400).json({
        success: false,
        message: 'Only applied transfers can be marked as completed'
      });
    }

    bankTransfer.status = 'Completed';
    bankTransfer.transferDetails.forEach(detail => {
      if (detail.approved) {
        detail.transferStatus = 'Transferred';
        detail.transferredAt = new Date();
      }
    });

    await bankTransfer.save();
    // Accounting (PRODUCERS DUES vouchers) is already created at Apply time — no additional posting needed here.

    res.json({
      success: true,
      message: 'Bank transfer marked as completed',
      data: bankTransfer
    });
  } catch (error) {
    console.error('Error completing transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing transfer'
    });
  }
};

// Get collection centers for dropdown
export const getCollectionCenters = async (req, res) => {
  try {
    const centers = await CollectionCenter.find({
      companyId: req.userCompany,
      status: 'Active'
    }).select('centerName centerType');

    res.json({
      success: true,
      data: centers
    });
  } catch (error) {
    console.error('Error fetching collection centers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching collection centers'
    });
  }
};

// Create BankTransfer record from Register-Ledger payments (Bank payMode rows)
export const createFromLedger = async (req, res) => {
  try {
    const { farmers, applyDate, fromDate, toDate, remarks } = req.body;
    const companyId = req.userCompany;

    if (!farmers || farmers.length === 0) {
      return res.status(400).json({ success: false, message: 'No farmers provided' });
    }

    // Fetch bank details for each farmer from DB
    const farmerIds = farmers.map(f => f.farmerId);
    const farmerDocs = await Farmer.find({ _id: { $in: farmerIds } })
      .select('farmerNumber personalDetails bankDetails')
      .lean();
    const farmerMap = {};
    farmerDocs.forEach(f => { farmerMap[f._id.toString()] = f; });

    const transferDetails = farmers.map(f => {
      const doc = farmerMap[f.farmerId?.toString()] || {};
      const bd  = doc.bankDetails || {};
      return {
        farmerId:       f.farmerId,
        producerId:     f.farmerNumber || doc.farmerNumber || '',
        producerName:   f.farmerName   || doc.personalDetails?.name || '',
        netPayable:     f.netPayable   || f.paidAmount || 0,
        transferAmount: f.paidAmount   || 0,
        paymentMode:    bd.accountNumber ? 'Bank Transfer' : 'Cash',
        approved:       true,
        bankDetails: {
          accountNumber: bd.accountNumber || '-',
          bankName:      bd.bankName      || '-',
          branch:        bd.branch        || '-',
          ifscCode:      bd.ifsc || bd.ifscCode || '-',
          micr:          bd.micr          || '-',
          bankLedgerId:  bd.bankLedgerId  || null,
          bankCode:      bd.branchCode    || '-',
        },
        transferStatus: 'Pending',
      };
    });

    const bankTransfer = new BankTransfer({
      companyId,
      transferBasis:        'Register Ledger',
      asOnDate:             toDate   ? new Date(toDate)   : new Date(),
      applyDate:            applyDate ? new Date(applyDate) : new Date(),
      collectionCenterName: 'All',
      bankName:             'All',
      roundDownAmount:      1,
      dueByList:            false,
      transferDetails,
      status:               'Applied',
      appliedAt:            new Date(),
      createdBy:            req.user?._id,
      appliedBy:            req.user?._id,
      remarks:              remarks || `Register Ledger — ${fromDate ? new Date(fromDate).toLocaleDateString('en-IN') : ''} to ${toDate ? new Date(toDate).toLocaleDateString('en-IN') : ''}`,
    });

    await bankTransfer.save();
    res.json({ success: true, data: bankTransfer });
  } catch (error) {
    console.error('Error creating bank transfer from ledger:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating bank transfer' });
  }
};

// Update a bank transfer (applyDate + per-farmer transferAmount/paymentMode)
export const updateBankTransfer = async (req, res) => {
  try {
    const { applyDate, remarks, transferDetails } = req.body;

    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany,
    });

    if (!bankTransfer) {
      return res.status(404).json({ success: false, message: 'Bank transfer not found' });
    }

    if (applyDate) bankTransfer.applyDate = new Date(applyDate);
    if (remarks !== undefined) bankTransfer.remarks = remarks;

    // Update each detail's transferAmount by farmerId
    if (Array.isArray(transferDetails)) {
      transferDetails.forEach(upd => {
        const detail = bankTransfer.transferDetails.find(
          d => d._id.toString() === upd._id || d.farmerId?.toString() === upd.farmerId?.toString()
        );
        if (detail) {
          if (upd.transferAmount !== undefined) detail.transferAmount = upd.transferAmount;
          if (upd.paymentMode    !== undefined) detail.paymentMode    = upd.paymentMode;
        }
      });
    }

    await bankTransfer.save();
    res.json({ success: true, message: 'Bank transfer updated successfully', data: bankTransfer });
  } catch (error) {
    console.error('Error updating bank transfer:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating bank transfer' });
  }
};

// Delete a bank transfer and reverse FarmerPayment records back to Pending
export const deleteBankTransfer = async (req, res) => {
  try {
    const bankTransfer = await BankTransfer.findOne({
      _id: req.params.id,
      companyId: req.userCompany,
    });

    if (!bankTransfer) {
      return res.status(404).json({ success: false, message: 'Bank transfer not found' });
    }

    // Reverse each farmer's FarmerPayment back to BankTransfer-pending so the
    // balance carries forward into the next cycle's previousBalance.
    for (const d of bankTransfer.transferDetails) {
      try {
        await FarmerPayment.updateMany(
          {
            companyId:     req.userCompany,
            farmerId:      d.farmerId,
            paymentSource: 'BankTransfer',
            status:        { $in: ['Paid', 'Partial'] },
          },
          {
            $set: {
              paidAmount:    0,
              balanceAmount: d.netPayable || 0,
              status:        'Pending',
            },
          }
        );
      } catch (reverseErr) {
        console.error('Reverse FarmerPayment failed for farmer', d.farmerId, reverseErr.message);
      }
    }

    // Remove all auto-posted Day Book / Cash Book vouchers (one per bank-ledger
    // group + cash voucher). bankTransfer.voucherId only points to the first;
    // the helper finds them all via referenceType/referenceId.
    const removed = await removeAutoPostedVouchers(bankTransfer._id, req.userCompany);

    await BankTransfer.deleteOne({ _id: bankTransfer._id });

    res.json({
      success: true,
      message: `Bank transfer deleted — ${removed} auto-posted voucher(s) removed and payments reversed`,
    });
  } catch (error) {
    console.error('Error deleting bank transfer:', error);
    res.status(500).json({ success: false, message: error.message || 'Error deleting bank transfer' });
  }
};

// Check whether a cycle has already been applied (frontend pre-check).
// Returns { alreadyApplied: bool, transferNumber, applyDate, asOnDate }.
export const checkCycleApplied = async (req, res) => {
  try {
    const { asOnDate, cycleToDate } = req.query;
    const companyId = req.userCompany;
    const ref = asOnDate || cycleToDate;
    if (!ref) {
      return res.json({ success: true, data: { alreadyApplied: false } });
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const cycleEnd = new Date(ref);
    const existing = await BankTransfer.findOne({
      companyId,
      status: { $in: ['Applied', 'Completed'] },
      asOnDate: {
        $gte: new Date(cycleEnd.getTime() - 2 * dayMs),
        $lte: new Date(cycleEnd.getTime() + 2 * dayMs),
      },
    }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: {
        alreadyApplied: !!existing,
        transferId:     existing?._id || null,
        transferNumber: existing?.transferNumber || null,
        applyDate:      existing?.applyDate || null,
        asOnDate:       existing?.asOnDate || null,
        status:         existing?.status || null,
      },
    });
  } catch (error) {
    console.error('Error checking cycle:', error);
    res.status(500).json({ success: false, message: error.message || 'Error checking cycle' });
  }
};

// Get distinct pending periods from register-ledger BankTransfer-queued payments
export const getPendingPeriods = async (req, res) => {
  try {
    const companyId = req.userCompany;

    const periods = await FarmerPayment.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          paymentSource: 'BankTransfer',
          status: { $in: ['Pending', 'Partial'] },
          balanceAmount: { $gt: 0 },                         // remaining to disburse
          'paymentPeriod.fromDate': { $exists: true },
          'paymentPeriod.toDate':   { $exists: true },
        }
      },
      {
        $group: {
          _id: {
            fromDate: '$paymentPeriod.fromDate',
            toDate:   '$paymentPeriod.toDate',
          },
          count:    { $sum: 1 },
          totalAmt: { $sum: '$balanceAmount' },
        }
      },
      { $sort: { '_id.fromDate': -1 } },
      { $limit: 24 },
    ]);

    const data = periods.map(p => ({
      fromDate: p._id.fromDate,
      toDate:   p._id.toDate,
      count:    p.count,
      totalAmt: p.totalAmt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching pending periods:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching pending periods' });
  }
};

// Get banks for dropdown
export const getBanks = async (req, res) => {
  try {
    // Get unique banks from farmer bank details
    const banks = await Farmer.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(req.userCompany) } },
      { $group: {
        _id: '$bankDetails.bankName',
        count: { $sum: 1 }
      }},
      { $match: { _id: { $type: 'string', $ne: '' } } },
      { $project: {
        name: '$_id',
        count: 1,
        _id: 0
      }},
      { $sort: { name: 1 } }
    ]);

    res.json({
      success: true,
      data: banks
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.json({
      success: true,
      data: []
    });
  }
};

// ── Payment Report ─────────────────────────────────────────────────────────────
// Combines BankTransfer (applyDate) + ProducerPayment (paymentDate) records
// within a date range and groups them by payment date.
export const getPaymentReport = async (req, res) => {
  try {
    const { fromDate, toDate, centerId, bankFilter, reportType } = req.query;
    const companyId = new mongoose.Types.ObjectId(req.userCompany);

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    // BankTransfer records (applied / completed) in date range
    const btFilter = {
      companyId,
      applyDate: { $gte: from, $lte: to },
      status: { $in: ['Applied', 'Completed'] },
    };
    if (centerId && centerId !== 'all') {
      btFilter.collectionCenter = new mongoose.Types.ObjectId(centerId);
    }

    const bankTransfers = await BankTransfer.find(btFilter)
      .select('applyDate transferNumber collectionCenterName transferDetails')
      .lean();

    // ProducerPayment records (Pay to Producer / individual cash) in date range
    let producerPayments = [];
    if (reportType !== 'bankOnly') {
      const ppFilter = {
        companyId,
        paymentDate: { $gte: from, $lte: to },
        status: 'Active',
      };
      if (centerId && centerId !== 'all') {
        ppFilter.paymentCenter = new mongoose.Types.ObjectId(centerId);
      }
      producerPayments = await ProducerPayment.find(ppFilter)
        .select('paymentDate paymentNumber producerNumber producerName amountPaid paymentCenterName paymentMode bankLedgerName')
        .lean();
    }

    // Group by payment date
    const groupMap = {};
    const getGroup = (dateKey) => {
      if (!groupMap[dateKey]) groupMap[dateKey] = { date: dateKey, bankRows: [], cashRows: [] };
      return groupMap[dateKey];
    };

    for (const bt of bankTransfers) {
      const dateKey = new Date(bt.applyDate).toISOString().slice(0, 10);
      const group = getGroup(dateKey);
      for (const det of (bt.transferDetails || [])) {
        if (!det.approved || !(det.transferAmount > 0)) continue;
        if (bankFilter && bankFilter !== 'all' && det.bankDetails?.bankName !== bankFilter) continue;
        const row = {
          source: 'BankTransfer',
          transferNumber: bt.transferNumber,
          producerId: det.producerId || '',
          producerName: det.producerName || '',
          center: bt.collectionCenterName || 'All',
          amount: det.transferAmount,
          paymentMode: det.paymentMode || 'Bank Transfer',
          bankName: det.bankDetails?.bankName || '',
          accountNumber: det.bankDetails?.accountNumber || '',
          ifscCode: det.bankDetails?.ifscCode || '',
          branch: det.bankDetails?.branch || '',
        };
        if (det.paymentMode === 'Cash') group.cashRows.push(row);
        else group.bankRows.push(row);
      }
    }

    for (const pp of producerPayments) {
      const dateKey = new Date(pp.paymentDate).toISOString().slice(0, 10);
      const group = getGroup(dateKey);
      const row = {
        source: 'ProducerPayment',
        paymentNumber: pp.paymentNumber || '',
        producerId: pp.producerNumber || '',
        producerName: pp.producerName || '',
        center: pp.paymentCenterName || 'All',
        amount: pp.amountPaid,
        paymentMode: pp.paymentMode || 'Cash',
        bankName: pp.bankLedgerName || '',
      };
      if (['Bank', 'NEFT', 'RTGS'].includes(pp.paymentMode)) group.bankRows.push(row);
      else group.cashRows.push(row);
    }

    const groups = Object.values(groupMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(g => ({
        ...g,
        totalBank: g.bankRows.reduce((s, r) => s + (r.amount || 0), 0),
        totalCash: g.cashRows.reduce((s, r) => s + (r.amount || 0), 0),
        grandTotal: g.bankRows.reduce((s, r) => s + (r.amount || 0), 0) + g.cashRows.reduce((s, r) => s + (r.amount || 0), 0),
      }));

    const summary = {
      totalBank: groups.reduce((s, g) => s + g.totalBank, 0),
      totalCash: groups.reduce((s, g) => s + g.totalCash, 0),
      grandTotal: groups.reduce((s, g) => s + g.grandTotal, 0),
      bankCount: groups.reduce((s, g) => s + g.bankRows.length, 0),
      cashCount: groups.reduce((s, g) => s + g.cashRows.length, 0),
      dateCount: groups.length,
    };

    res.json({ success: true, data: { groups, summary } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * returnAccountingHelper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tally / Vyapar-style accounting engine for Sale Return & Purchase Return.
 *
 * FLOW
 * ────
 *  Credit Sale Return  (paymentMode = 'Credit')
 *    Dr  Sales Returns A/c        taxableAmount + roundOff
 *    Dr  CGST / SGST / IGST Output  (reverse output tax)
 *    Cr  Customer A/c             grandTotal
 *    → Supplier ledger updated  |  Day Book: YES  |  Cash Book: NO
 *
 *  Cash Sale Return  (paymentMode = Cash / Bank / UPI / Cheque)
 *    Dr  Sales Returns A/c        taxableAmount + roundOff
 *    Dr  CGST / SGST / IGST Output
 *    Cr  Cash / Bank A/c          paidAmount      ← Payment → Cash Book
 *    Cr  Customer A/c             balanceAmount   (if partial)
 *    → Day Book: YES  |  Cash Book: YES (Payment)
 *
 *  Credit Purchase Return  (paymentMode = 'Credit')
 *    Dr  Supplier A/c             grandTotal
 *    Cr  Purchase Returns A/c     taxableAmount + roundOff
 *    Cr  CGST / SGST / IGST Input   (reverse ITC)
 *    → Supplier ledger updated  |  Day Book: YES  |  Cash Book: NO
 *
 *  Cash Purchase Return  (paymentMode = Cash / Bank / UPI / Cheque)
 *    Dr  Cash / Bank A/c          receivedAmount  ← Receipt → Cash Book
 *    Dr  Supplier A/c             balanceAmount   (if partial)
 *    Cr  Purchase Returns A/c     taxableAmount + roundOff
 *    Cr  CGST / SGST / IGST Input
 *    → Day Book: YES  |  Cash Book: YES (Receipt)
 */

import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessLedger  from '../models/BusinessLedger.js';
import {
  generateBusinessVoucherNumber,
  applyLedgerBalanceChange
} from '../controllers/businessAccountingController.js';

// ─── Ledger helpers ───────────────────────────────────────────────────────────

export const getOrCreateLedger = async (name, group, type, companyId) => {
  let l = await BusinessLedger.findOne({ name, companyId, status: 'Active' });
  if (!l) {
    l = new BusinessLedger({ name, group, type, companyId, businessType: 'Private Firm' });
    await l.save();
  }
  return l;
};

const cashOrBankLedger = (paymentMode, companyId) =>
  (paymentMode === 'Bank' || paymentMode === 'Cheque')
    ? getOrCreateLedger('Bank Account', 'Bank Accounts', 'Asset', companyId)
    : getOrCreateLedger('Cash in Hand', 'Cash-in-Hand', 'Asset', companyId);

// ─── GST entries ─────────────────────────────────────────────────────────────

const addGSTEntries = async (entries, { totalCgst, totalSgst, totalIgst }, side, isInput, companyId) => {
  const suffix = isInput ? 'Input' : 'Output';
  if (totalCgst > 0) {
    const l = await getOrCreateLedger(`CGST ${suffix}`, 'Duties & Taxes', 'Liability', companyId);
    entries.push({ ledgerId: l._id, ledgerName: l.name, type: side, amount: totalCgst, isGSTLine: true, gstComponent: 'CGST' });
  }
  if (totalSgst > 0) {
    const l = await getOrCreateLedger(`SGST ${suffix}`, 'Duties & Taxes', 'Liability', companyId);
    entries.push({ ledgerId: l._id, ledgerName: l.name, type: side, amount: totalSgst, isGSTLine: true, gstComponent: 'SGST' });
  }
  if (totalIgst > 0) {
    const l = await getOrCreateLedger(`IGST ${suffix}`, 'Duties & Taxes', 'Liability', companyId);
    entries.push({ ledgerId: l._id, ledgerName: l.name, type: side, amount: totalIgst, isGSTLine: true, gstComponent: 'IGST' });
  }
};

// ─── Balance guard ────────────────────────────────────────────────────────────

const checkBalance = (entries, label) => {
  const dr = entries.filter(e => e.type === 'debit') .reduce((s, e) => s + e.amount, 0);
  const cr = entries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  if (Math.abs(dr - cr) > 0.02)
    throw new Error(`${label} voucher imbalanced — Dr: ${dr.toFixed(2)}, Cr: ${cr.toFixed(2)}`);
  return { dr, cr };
};

// ─── Persist voucher + update ledger balances ─────────────────────────────────

const saveVoucherAndBalances = async (voucher) => {
  await voucher.save();
  for (const entry of voucher.entries) {
    if (!entry.ledgerId) continue;
    const l = await BusinessLedger.findById(entry.ledgerId);
    if (l) { applyLedgerBalanceChange(l, entry.type, entry.amount); await l.save(); }
  }
  return voucher;
};

// ─── Reverse + delete existing voucher ───────────────────────────────────────

export const reverseAndDeleteReturnVoucher = async (referenceType, referenceId) => {
  const v = await BusinessVoucher.findOne({ referenceType, referenceId, status: 'Posted' });
  if (!v) return;
  for (const entry of v.entries) {
    if (!entry.ledgerId) continue;
    const l = await BusinessLedger.findById(entry.ledgerId);
    if (l) {
      applyLedgerBalanceChange(l, entry.type === 'debit' ? 'credit' : 'debit', entry.amount);
      await l.save();
    }
  }
  await BusinessVoucher.findByIdAndDelete(v._id);
};

// ─────────────────────────────────────────────────────────────────────────────
// SALE RETURN  →  Credit Note (BCN prefix)
// ─────────────────────────────────────────────────────────────────────────────

export const createSalesReturnVoucher = async ({
  salesReturn,
  returnNumber, returnDate, customerName,
  paymentMode,
  taxableAmount, totalCgst, totalSgst, totalIgst, roundOff,
  grandTotal, paidAmount, balanceAmount,
  companyId
}) => {
  try {
    const isCash  = paymentMode !== 'Credit' && paymentMode !== 'Adjustment';
    const paid    = parseFloat(paidAmount)    || 0;
    const balance = parseFloat(balanceAmount) || 0;

    // roundOff absorbed into Sales Returns A/c (same pattern as businessSalesController)
    const returnAmt = parseFloat((taxableAmount + (parseFloat(roundOff) || 0)).toFixed(2));

    const srLedger   = await getOrCreateLedger('Sales Returns', 'Sales Accounts', 'Income', companyId);
    const custLedger = await getOrCreateLedger(
      customerName || 'Sundry Creditors', 'Sundry Creditors', 'Liability', companyId
    );

    const entries = [];

    // ── DEBIT: Sales Returns + GST Output reversal ───────────────────────────
    entries.push({ ledgerId: srLedger._id, ledgerName: srLedger.name, type: 'debit', amount: returnAmt });
    await addGSTEntries(entries, { totalCgst, totalSgst, totalIgst }, 'debit', false, companyId);

    // ── CREDIT ───────────────────────────────────────────────────────────────
    if (isCash) {
      // Cash Payment out to customer → Cash Book (Payment)
      if (paid > 0) {
        const cl = await cashOrBankLedger(paymentMode, companyId);
        entries.push({ ledgerId: cl._id, ledgerName: cl.name, type: 'credit', amount: paid });
      }
      // Remaining credit still owed to customer
      if (balance > 0) {
        entries.push({ ledgerId: custLedger._id, ledgerName: custLedger.name, type: 'credit', amount: balance });
      }
    } else {
      // Credit return — full amount credited to customer ledger (they have credit with us)
      entries.push({ ledgerId: custLedger._id, ledgerName: custLedger.name, type: 'credit', amount: grandTotal });
    }

    const { dr, cr } = checkBalance(entries, 'Sales Return');

    const voucher = new BusinessVoucher({
      voucherNumber:   await generateBusinessVoucherNumber('CreditNote', companyId),
      voucherType:     'CreditNote',
      date:            new Date(returnDate),
      entries,
      paymentMode:     isCash ? (paymentMode || 'Cash') : 'Bank',
      totalDebit:      dr,
      totalCredit:     cr,
      narration:       `Sales Return ${returnNumber} — ${customerName || 'Customer'} [${isCash ? 'Cash Refund' : 'Credit Note'}]`,
      partyName:       customerName || '',
      referenceType:   'SalesReturn',
      referenceId:     salesReturn._id,
      referenceNumber: returnNumber,
      companyId,
      status:          'Posted'
    });

    return await saveVoucherAndBalances(voucher);
  } catch (err) {
    console.error('[SalesReturnVoucher]', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE RETURN  →  Debit Note (BDN prefix)
// ─────────────────────────────────────────────────────────────────────────────

export const createPurchaseReturnVoucher = async ({
  purchaseReturn,
  returnNumber, returnDate, supplierName,
  paymentMode,
  taxableAmount, totalCgst, totalSgst, totalIgst, roundOff,
  grandTotal, receivedAmount, balanceAmount,
  companyId
}) => {
  try {
    const isCash    = paymentMode !== 'Credit' && paymentMode !== 'Adjustment';
    const received  = parseFloat(receivedAmount) || 0;
    const balance   = parseFloat(balanceAmount)  || 0;

    const returnAmt = parseFloat((taxableAmount + (parseFloat(roundOff) || 0)).toFixed(2));

    const prLedger  = await getOrCreateLedger('Purchase Returns', 'Purchase Accounts', 'Expense', companyId);
    const supLedger = await getOrCreateLedger(
      supplierName || 'Sundry Creditors', 'Sundry Creditors', 'Liability', companyId
    );

    const entries = [];

    // ── DEBIT ────────────────────────────────────────────────────────────────
    if (isCash) {
      // Cash Receipt from supplier → Cash Book (Receipt)
      if (received > 0) {
        const cl = await cashOrBankLedger(paymentMode, companyId);
        entries.push({ ledgerId: cl._id, ledgerName: cl.name, type: 'debit', amount: received });
      }
      // Balance supplier still owes us
      if (balance > 0) {
        entries.push({ ledgerId: supLedger._id, ledgerName: supLedger.name, type: 'debit', amount: balance });
      }
    } else {
      // Credit return — supplier owes us full amount (reduces our payable)
      entries.push({ ledgerId: supLedger._id, ledgerName: supLedger.name, type: 'debit', amount: grandTotal });
    }

    // ── CREDIT: Purchase Returns + GST Input reversal ─────────────────────────
    entries.push({ ledgerId: prLedger._id, ledgerName: prLedger.name, type: 'credit', amount: returnAmt });
    await addGSTEntries(entries, { totalCgst, totalSgst, totalIgst }, 'credit', true, companyId);

    const { dr, cr } = checkBalance(entries, 'Purchase Return');

    const voucher = new BusinessVoucher({
      voucherNumber:   await generateBusinessVoucherNumber('DebitNote', companyId),
      voucherType:     'DebitNote',
      date:            new Date(returnDate),
      entries,
      paymentMode:     isCash ? (paymentMode || 'Cash') : 'Bank',
      totalDebit:      dr,
      totalCredit:     cr,
      narration:       `Purchase Return ${returnNumber} — ${supplierName || 'Supplier'} [${isCash ? 'Cash Receipt' : 'Debit Note'}]`,
      partyName:       supplierName || '',
      referenceType:   'PurchaseReturn',
      referenceId:     purchaseReturn._id,
      referenceNumber: returnNumber,
      companyId,
      status:          'Posted'
    });

    return await saveVoucherAndBalances(voucher);
  } catch (err) {
    console.error('[PurchaseReturnVoucher]', err.message);
    return null;
  }
};

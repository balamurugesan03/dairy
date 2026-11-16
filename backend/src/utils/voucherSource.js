// Transaction source & book classification for the Accounts entry screens.
//
// Cash Book Entry and Adjustment Entry must never list each other's rows, so
// every row is classified on the SERVER by where it came from and how money
// moved — not by the screen hiding rows after fetching everything:
//
//   source  CashBookEntry | ReceiptVoucher | PaymentVoucher | AdjustmentEntry
//           | ProducerDuesCashAdvance | Auto:<referenceType>
//   mode    'Cash' (a Cash in Hand leg) | 'Bank' (a bank leg, no cash) | 'Adjustment' (neither)
//   book    'cash'        → Cash Book Entry (Cash Receipt / Cash Payment columns)
//           'adjustment'  → Adjustment Entry (Adjustment Receipt / Payment columns)
//
// A Cash in Hand leg always wins: a voucher that moves cash is a Cash Book
// transaction whatever its type, and is never an Adjustment.

import { isCashInHandName } from './cashInHandOpening.js';
import { CASH_ADVANCE_REF } from './cashAdvanceVoucherRows.js';

const CASH_TYPES = ['Cash', 'Cash in Hand'];
const BANK_TYPES = ['Bank', 'Bank Accounts'];

const legId = (e) => {
  const raw = e?.ledgerId?._id || e?.ledgerId;
  return raw ? String(raw) : '';
};

/** 'Cash' | 'Bank' | 'Adjustment' — how money moved in this voucher / virtual row. */
export const voucherMode = (v, ids) => {
  if (v.isVirtual) {
    // Cash Advance module row: its own Mode decides (Cash vs Bank / UPI / Cheque)
    return String(v.paymentMode || 'Cash').toLowerCase() === 'cash' ? 'Cash' : 'Bank';
  }
  const entries = v.entries || [];
  const isCash = (e) => ids.cashIds.has(legId(e))
    || CASH_TYPES.includes(e.ledgerId?.ledgerType)
    || isCashInHandName(e.ledgerName || e.ledgerId?.ledgerName);
  if (entries.some(isCash)) return 'Cash';
  const isBank = (e) => ids.bankIds.has(legId(e)) || BANK_TYPES.includes(e.ledgerId?.ledgerType);
  if (entries.some(isBank)) return 'Bank';
  return 'Adjustment';
};

/** Which screen / module the row belongs to. */
export const voucherSource = (v) => {
  if (v.isVirtual || v.referenceType === CASH_ADVANCE_REF) return 'ProducerDuesCashAdvance';
  if (v.entrySource) return v.entrySource;
  if (!v.referenceType || v.referenceType === 'Manual') {
    if (v.voucherType === 'Journal') return 'AdjustmentEntry';
    if (v.voucherType === 'Receipt') return 'ReceiptVoucher';
    if (v.voucherType === 'Payment') return 'PaymentVoucher';
  }
  return `Auto:${v.referenceType || v.voucherType}`;
};

/** Adds { entrySource, mode, book } to a (lean / plain) voucher row. */
export const tagVoucher = (v, ids) => {
  const mode = voucherMode(v, ids);
  return { ...v, entrySource: voucherSource(v), mode, book: mode === 'Cash' ? 'cash' : 'adjustment' };
};

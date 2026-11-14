import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import FarmerSettings from '../models/FarmerSettings.js';

// ════════════════════════════════════════════════════════════════
//  Who a farmer's payment goes to, and into which bank account.
//
//  Farmer Settings switches:
//   • Parent Grouping on + farmer has a parent → pay into the PARENT's account
//     (the child's own milk, bill and dues stay the child's).
//   • Secondary Bank on + the account holder chose "Secondary" and has a
//     secondary account number → that account, else the Primary account.
//  Both off → exactly the old behaviour: the farmer's own bankDetails.
//
//  Every payment / bank transfer / register and the bank columns of
//  reports go through payeeFor(), so the rule lives in one place.
// ════════════════════════════════════════════════════════════════

/** Farmer fields needed to resolve a payee — add to .select() wherever payees are resolved */
export const PAYEE_SELECT = 'farmerNumber personalDetails.name bankDetails secondaryBankDetails payTo parentFarmer';

const clean = (b = {}) => ({
  accountNumber: String(b.accountNumber || '').trim(),
  bankName:      String(b.bankName || '').trim(),
  branch:        String(b.branch || '').trim(),
  ifsc:          String(b.ifsc || b.ifscCode || '').trim().toUpperCase(),
  micr:          String(b.micr || '').trim(),
  bankLedgerId:  b.bankLedgerId || null,
});

/** { parentGrouping, secondaryBank } for the company (both false when never saved) */
export const payeeSettings = async (companyId) => {
  const s = await FarmerSettings.findOne({ companyId }).select('parentGrouping secondaryBank').lean();
  return { parentGrouping: !!s?.parentGrouping, secondaryBank: !!s?.secondaryBank };
};

/** Primary and Secondary account of a farmer, as stored (for reports that show both) */
export const banksOf = (farmer = {}) => ({
  primary: clean(farmer.bankDetails),
  secondary: clean(farmer.secondaryBankDetails),
});

/** Which of the holder's accounts payments use */
const chosenAccount = (holder, settings) => (
  settings.secondaryBank && holder?.payTo === 'Secondary' && String(holder?.secondaryBankDetails?.accountNumber || '').trim()
    ? 'Secondary' : 'Primary');

/**
 * @param farmer   farmer selected with PAYEE_SELECT
 * @param parents  Map(parentId → parent farmer selected with PAYEE_SELECT)
 * @returns { account: 'Primary'|'Secondary', viaParent, holderId, holderNumber, holderName, bank: {…} }
 */
export const payeeFor = (farmer, parents, settings) => {
  let holder = farmer;
  let viaParent = false;
  if (settings.parentGrouping && farmer?.parentFarmer) {
    const p = parents.get(String(farmer.parentFarmer));
    if (p) { holder = p; viaParent = true; }
  }
  const account = chosenAccount(holder, settings);
  return {
    account,
    viaParent,
    holderId: holder?._id || null,
    holderNumber: holder?.farmerNumber || '',
    holderName: holder?.personalDetails?.name || '',
    bank: clean(account === 'Secondary' ? holder.secondaryBankDetails : holder?.bankDetails),
  };
};

/**
 * Payees for a list of farmers (selected with PAYEE_SELECT). Loads the parents once.
 * @returns { settings, payeeOf: (farmer) => payee }
 */
export const loadPayees = async (companyId, farmers = []) => {
  const settings = await payeeSettings(companyId);
  const parents = new Map();
  if (settings.parentGrouping) {
    const ids = [...new Set(farmers.map((f) => f?.parentFarmer && String(f.parentFarmer)).filter(Boolean))];
    if (ids.length) {
      const list = await Farmer.find({ companyId, _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select(PAYEE_SELECT).lean();
      list.forEach((p) => parents.set(String(p._id), p));
    }
  }
  return { settings, payeeOf: (farmer) => payeeFor(farmer, parents, settings) };
};

/**
 * Bank details stored on a transfer / payment row: the account paid into, plus who holds
 * it, so a child paid into the parent's account reads "A/c of 12 – Ravi" in prints.
 */
export const transferBankDetails = (payee, ownFarmer) => ({
  accountNumber: payee.bank.accountNumber || '-',
  bankName:      payee.bank.bankName || '-',
  branch:        payee.bank.branch || '-',
  ifscCode:      payee.bank.ifsc || '-',
  micr:          payee.bank.micr || '-',
  bankLedgerId:  payee.bank.bankLedgerId || null,
  bankCode:      '-',
  account:       payee.account,
  viaParent:     payee.viaParent,
  holderNumber:  payee.viaParent ? payee.holderNumber : (ownFarmer?.farmerNumber || ''),
  holderName:    payee.viaParent ? payee.holderName : (ownFarmer?.personalDetails?.name || ''),
});

// ── Parent links ──────────────────────────────────────────────────

/**
 * Check a parent link before saving. One level: the parent must not have a parent,
 * and a farmer that has children cannot become a child. Throws { status, message }.
 * @returns the parent's ObjectId, or null to clear the link
 */
export const validateParentLink = async (companyId, farmerId, parentId) => {
  if (parentId === undefined) return undefined;              // not part of this update
  if (!parentId) return null;                                // clear
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!mongoose.isValidObjectId(String(parentId))) fail('Select a valid Parent Farmer');
  if (farmerId && String(parentId) === String(farmerId)) fail('A farmer cannot be its own parent');
  const parent = await Farmer.findOne({ _id: parentId, companyId }).select('farmerNumber parentFarmer').lean();
  if (!parent) fail('Parent Farmer not found in this society');
  if (parent.parentFarmer) fail(`Farmer ${parent.farmerNumber} is itself a child of another farmer — pick the main (parent) farmer`);
  if (farmerId) {
    const kids = await Farmer.countDocuments({ companyId, parentFarmer: farmerId });
    if (kids) fail(`This farmer is the parent of ${kids} farmer(s) — a parent cannot be linked under another parent`);
  }
  return parent._id;
};

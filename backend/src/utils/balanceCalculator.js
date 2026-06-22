// Balance calculation utilities for accounting reports

/**
 * Calculate opening balance for a ledger at a given date
 * Sums all transactions before the start date
 *
 * @param {Model} Ledger - Ledger model
 * @param {Model} Voucher - Voucher model
 * @param {ObjectId} ledgerId - Ledger ID
 * @param {Date} startDate - Start date for the report period
 * @returns {Promise<number>} Opening balance
 */
export const calculateOpeningBalance = async (Ledger, Voucher, ledgerId, startDate, companyId) => {
  try {
    // Validate startDate
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      console.warn('Invalid startDate provided to calculateOpeningBalance:', startDate);
      return 0;
    }

    // Get ledger details
    const ledgerQuery = companyId ? { _id: ledgerId, companyId } : { _id: ledgerId };
    const ledger = await Ledger.findOne(ledgerQuery);
    if (!ledger) return 0;

    // Determine if this is a debit nature account
    const isDebitNature = [
      'Asset', 'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
      'Expense', 'Purchases A/c', 'Trade Expenses', 'Establishment Charges', 'Miscellaneous Expenses',
      'Cash', 'Bank', 'Other Receivable', 'Sundry Debtors', 'Customer', 'Party'
    ].includes(ledger.ledgerType);

    // openingBalance is stored as an absolute (positive) number.
    // openingBalanceType ('Dr'/'Cr') tells the direction.
    // Internal signed convention:
    //   debit-nature  : positive = Dr (normal), negative = Cr (unusual)
    //   credit-nature : positive = Cr (normal), negative = Dr (unusual)
    let balance = ledger.openingBalance || 0;
    const obType = ledger.openingBalanceType || 'Dr';
    const isNormalDirection =
      (isDebitNature && obType === 'Dr') || (!isDebitNature && obType === 'Cr');
    if (!isNormalDirection && balance > 0) {
      balance = -balance; // unusual direction → negate to fit signed convention
    }

    // Get all voucher entries strictly before startDate for this ledger
    const startDateObj = new Date(startDate);
    startDateObj.setUTCHours(0, 0, 0, 0); // normalise to midnight UTC

    const voucherQuery = {
      voucherDate: { $lt: startDateObj },
      'entries.ledgerId': ledgerId
    };
    if (companyId) voucherQuery.companyId = companyId;

    const vouchers = await Voucher.find(voucherQuery).sort({ voucherDate: 1 });

    // Process each voucher entry
    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId.toString() === ledgerId.toString()) {
          const netChange = entry.debitAmount - entry.creditAmount;
          if (isDebitNature) {
            balance += netChange;
          } else {
            balance -= netChange;
          }
        }
      });
    });

    return balance;
  } catch (error) {
    console.error('Error calculating opening balance:', error);
    return 0;
  }
};

/**
 * Calculate closing balance from opening balance and period transactions
 *
 * @param {number} openingBalance - Opening balance
 * @param {number} totalDebits - Total debit amount in period
 * @param {number} totalCredits - Total credit amount in period
 * @param {boolean} isDebitNature - Whether the account has debit nature
 * @returns {number} Closing balance
 */
export const calculateClosingBalance = (openingBalance, totalDebits, totalCredits, isDebitNature) => {
  const netChange = totalDebits - totalCredits;

  if (isDebitNature) {
    // Debit nature: debit increases, credit decreases
    return openingBalance + netChange;
  } else {
    // Credit nature: credit increases, debit decreases
    return openingBalance - netChange;
  }
};

/**
 * Determine if a ledger type has debit nature
 *
 * @param {string} ledgerType - Type of ledger
 * @returns {boolean} True if debit nature
 */
export const isDebitNatureLedger = (ledgerType) => {
  const debitNatureTypes = [
    // Legacy types
    'Asset', 'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
    'Expense', 'Purchases A/c', 'Trade Expenses', 'Establishment Charges', 'Miscellaneous Expenses',
    'Cash', 'Bank', 'Other Receivable', 'Party',
    'Sundry Debtors', 'Customer',
    // New ac_ledgers ASSET types
    'Bank Accounts', 'Share in Other Institutions', 'Other Investments',
    'Fixed Assets - Movables', 'Fixed Assets - Immovables', 'Advance due to Society',
    'Loss', 'Cash in Hand', 'Loans & Advances to Members', 'Interest Receivable',
    'Investment in Govt. Securities',
    // New ac_ledgers EXPENSE types
    'Contingencies', 'Purchases'
  ];

  return debitNatureTypes.includes(ledgerType);
};

/**
 * Get balance type label (Dr or Cr) based on amount and ledger nature
 *
 * @param {number} balance - Balance amount
 * @param {boolean} isDebitNature - Whether the account has debit nature
 * @returns {string} 'Dr' or 'Cr'
 */
export const getBalanceType = (balance, isDebitNature) => {
  if (balance === 0) return isDebitNature ? 'Dr' : 'Cr';

  if (isDebitNature) {
    return balance >= 0 ? 'Dr' : 'Cr';
  } else {
    return balance >= 0 ? 'Cr' : 'Dr';
  }
};

/**
 * Calculate running balance for a ledger statement
 *
 * @param {number} openingBalance - Opening balance
 * @param {Array} transactions - Array of transactions with debitAmount and creditAmount
 * @param {boolean} isDebitNature - Whether the account has debit nature
 * @returns {Array} Transactions with balance field added
 */
export const calculateRunningBalance = (openingBalance, transactions, isDebitNature) => {
  let runningBalance = openingBalance;

  return transactions.map(transaction => {
    const netChange = transaction.debitAmount - transaction.creditAmount;

    if (isDebitNature) {
      runningBalance += netChange;
    } else {
      runningBalance -= netChange;
    }

    return {
      ...transaction,
      balance: Math.abs(runningBalance),
      balanceType: getBalanceType(runningBalance, isDebitNature)
    };
  });
};

/**
 * Get ledger category for grouping in reports
 *
 * @param {string} ledgerType - Type of ledger
 * @returns {string} Category name
 */
export const getLedgerCategory = (ledgerType) => {
  const categories = {
    // Legacy ASSET types
    'Asset': 'ASSETS', 'Fixed Assets': 'ASSETS', 'Movable Assets': 'ASSETS',
    'Immovable Assets': 'ASSETS', 'Other Assets': 'ASSETS', 'Other Receivable': 'ASSETS',
    'Cash': 'ASSETS', 'Bank': 'ASSETS', 'Sundry Debtors': 'ASSETS', 'Customer': 'ASSETS',
    'Advance due to Society': 'ASSETS',
    // New ac_ledgers ASSET types
    'Bank Accounts': 'ASSETS', 'Share in Other Institutions': 'ASSETS',
    'Other Investments': 'ASSETS', 'Fixed Assets - Movables': 'ASSETS',
    'Fixed Assets - Immovables': 'ASSETS', 'Loss': 'ASSETS', 'Cash in Hand': 'ASSETS',
    'Loans & Advances to Members': 'ASSETS', 'Interest Receivable': 'ASSETS',
    'Investment in Govt. Securities': 'ASSETS',
    // Legacy LIABILITY types
    'Liability': 'LIABILITIES', 'Other Payable': 'LIABILITIES',
    'Other Liabilities': 'LIABILITIES', 'Deposit A/c': 'LIABILITIES',
    'Contingency Fund': 'LIABILITIES', 'Education Fund': 'LIABILITIES',
    'Accounts Due To (Sundry Creditors)': 'LIABILITIES', 'Sundry Creditors': 'LIABILITIES',
    // New ac_ledgers LIABILITY types
    'Statutory Funds and Reserves': 'LIABILITIES',
    'Other Funds, Reserves and Provisions': 'LIABILITIES',
    'Grants and Subsidies': 'LIABILITIES', 'Advance due by Society': 'LIABILITIES',
    'Profit': 'LIABILITIES', 'Deposits': 'LIABILITIES',
    'Borrowings (Loans, Cash Credits)': 'LIABILITIES', 'Interest Payable': 'LIABILITIES',
    // Capital (maps to LIABILITIES in ac_ledgers parent_group)
    'Capital': 'CAPITAL', 'Share Capital': 'CAPITAL',
    // INCOME types
    'Income': 'INCOME', 'Sales': 'INCOME', 'Sales A/c': 'INCOME', 'Trade Income': 'INCOME',
    'Miscellaneous Income': 'INCOME', 'Other Revenue': 'INCOME',
    'Grants & Aid': 'INCOME', 'Subsidies': 'INCOME',
    // EXPENSE types
    'Expense': 'EXPENSES', 'Purchases A/c': 'EXPENSES', 'Purchases': 'EXPENSES',
    'Trade Expenses': 'EXPENSES', 'Establishment Charges': 'EXPENSES',
    'Miscellaneous Expenses': 'EXPENSES', 'Contingencies': 'EXPENSES'
  };

  return categories[ledgerType] || 'OTHER';
};

/**
 * Derive ASSET|LIABILITY|INCOME|EXPENSE from ledgerType (account_group in ac_ledgers).
 * Used when ledger.parentGroup is not explicitly set.
 */
export const getParentGroupFromLedgerType = (ledgerType) => {
  const ASSET_TYPES = [
    'Asset', 'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
    'Cash', 'Bank', 'Other Receivable', 'Sundry Debtors', 'Customer', 'Party',
    'Bank Accounts', 'Share in Other Institutions', 'Other Investments',
    'Fixed Assets - Movables', 'Fixed Assets - Immovables', 'Advance due to Society',
    'Loss', 'Cash in Hand', 'Loans & Advances to Members', 'Interest Receivable',
    'Investment in Govt. Securities'
  ];
  const LIABILITY_TYPES = [
    'Liability', 'Other Payable', 'Other Liabilities', 'Deposit A/c', 'Contingency Fund',
    'Education Fund', 'Accounts Due To (Sundry Creditors)', 'Sundry Creditors',
    'Capital', 'Share Capital',
    'Statutory Funds and Reserves', 'Other Funds, Reserves and Provisions',
    'Grants and Subsidies', 'Advance due by Society', 'Profit',
    'Deposits', 'Borrowings (Loans, Cash Credits)', 'Interest Payable'
  ];
  const INCOME_TYPES = [
    'Income', 'Sales', 'Sales A/c', 'Trade Income', 'Miscellaneous Income',
    'Other Revenue', 'Grants & Aid', 'Subsidies'
  ];
  const EXPENSE_TYPES = [
    'Expense', 'Purchases A/c', 'Purchases', 'Trade Expenses',
    'Establishment Charges', 'Miscellaneous Expenses', 'Contingencies'
  ];

  if (ASSET_TYPES.includes(ledgerType)) return 'ASSET';
  if (LIABILITY_TYPES.includes(ledgerType)) return 'LIABILITY';
  if (INCOME_TYPES.includes(ledgerType)) return 'INCOME';
  if (EXPENSE_TYPES.includes(ledgerType)) return 'EXPENSE';
  return 'OTHER';
};

/**
 * Return default voucher side (R/P/B) for a ledger type based on ac_ledgers configuration.
 * R = Receipt side only, P = Payment side only, B = Both sides.
 */
export const getDefaultVoucherType = (ledgerType) => {
  const INCOME_TYPES = [
    'Sales', 'Trade Income', 'Sales A/c', 'Income', 'Miscellaneous Income',
    'Other Revenue', 'Grants & Aid', 'Subsidies'
  ];
  const EXPENSE_TYPES = [
    'Purchases A/c', 'Purchases', 'Trade Expenses', 'Establishment Charges',
    'Miscellaneous Expenses', 'Contingencies', 'Expense'
  ];
  if (INCOME_TYPES.includes(ledgerType)) return 'R';
  if (EXPENSE_TYPES.includes(ledgerType)) return 'P';
  return 'B';
};

export default {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  calculateRunningBalance,
  getLedgerCategory,
  getParentGroupFromLedgerType,
  getDefaultVoucherType
};

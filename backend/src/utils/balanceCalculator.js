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
export const calculateOpeningBalance = async (Ledger, Voucher, ledgerId, startDate) => {
  try {
    // Validate startDate
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      console.warn('Invalid startDate provided to calculateOpeningBalance:', startDate);
      return 0;
    }

    // Get ledger details
    const ledger = await Ledger.findById(ledgerId);
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

    const vouchers = await Voucher.find({
      voucherDate: { $lt: startDateObj },
      'entries.ledgerId': ledgerId
    }).sort({ voucherDate: 1 });

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
    'Asset', 'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
    'Expense', 'Purchases A/c', 'Trade Expenses', 'Establishment Charges', 'Miscellaneous Expenses',
    'Cash', 'Bank', 'Other Receivable', 'Party',
    'Sundry Debtors', 'Customer' // Customers owe us money - debit nature
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
  if (balance === 0) return 'Dr'; // Zero balance defaults to Dr

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
    'Asset': 'ASSETS',
    'Fixed Assets': 'ASSETS',
    'Movable Assets': 'ASSETS',
    'Immovable Assets': 'ASSETS',
    'Other Assets': 'ASSETS',
    'Other Receivable': 'ASSETS',
    'Cash': 'ASSETS',
    'Bank': 'ASSETS',

    'Liability': 'LIABILITIES',
    'Other Payable': 'LIABILITIES',
    'Other Liabilities': 'LIABILITIES',
    'Deposit A/c': 'LIABILITIES',
    'Contingency Fund': 'LIABILITIES',
    'Education Fund': 'LIABILITIES',
    'Accounts Due To (Sundry Creditors)': 'LIABILITIES',
    'Sundry Creditors': 'LIABILITIES',

    'Sundry Debtors': 'ASSETS',
    'Customer': 'ASSETS',

    'Capital': 'CAPITAL',
    'Share Capital': 'CAPITAL',

    'Income': 'INCOME',
    'Sales A/c': 'INCOME',
    'Trade Income': 'INCOME',
    'Miscellaneous Income': 'INCOME',
    'Other Revenue': 'INCOME',
    'Grants & Aid': 'INCOME',
    'Subsidies': 'INCOME',

    'Expense': 'EXPENSES',
    'Purchases A/c': 'EXPENSES',
    'Trade Expenses': 'EXPENSES',
    'Establishment Charges': 'EXPENSES',
    'Miscellaneous Expenses': 'EXPENSES'
  };

  return categories[ledgerType] || 'OTHER';
};

export default {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  calculateRunningBalance,
  getLedgerCategory
};

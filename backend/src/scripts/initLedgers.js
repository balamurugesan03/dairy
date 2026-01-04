import mongoose from 'mongoose';
import Ledger from '../models/Ledger.js';
import dotenv from 'dotenv';

dotenv.config();

const defaultLedgers = [
  {
    ledgerName: 'Sales',
    ledgerType: 'Income',
    linkedEntity: {
      entityType: 'None'
    },
    openingBalance: 0,
    openingBalanceType: 'Cr',
    currentBalance: 0,
    balanceType: 'Cr',
    parentGroup: 'Revenue',
    status: 'Active'
  },
  {
    ledgerName: 'Cash',
    ledgerType: 'Cash',
    linkedEntity: {
      entityType: 'None'
    },
    openingBalance: 0,
    openingBalanceType: 'Dr',
    currentBalance: 0,
    balanceType: 'Dr',
    parentGroup: 'Cash in Hand',
    status: 'Active'
  },
  {
    ledgerName: 'Bank',
    ledgerType: 'Bank',
    linkedEntity: {
      entityType: 'None'
    },
    openingBalance: 0,
    openingBalanceType: 'Dr',
    currentBalance: 0,
    balanceType: 'Dr',
    parentGroup: 'Bank Accounts',
    status: 'Active'
  },
  {
    ledgerName: 'Purchase',
    ledgerType: 'Expense',
    linkedEntity: {
      entityType: 'None'
    },
    openingBalance: 0,
    openingBalanceType: 'Dr',
    currentBalance: 0,
    balanceType: 'Dr',
    parentGroup: 'Direct Expenses',
    status: 'Active'
  },
  {
    ledgerName: 'GST Input',
    ledgerType: 'Other Receivable',
    linkedEntity: {
      entityType: 'None'
    },
    openingBalance: 0,
    openingBalanceType: 'Dr',
    currentBalance: 0,
    balanceType: 'Dr',
    parentGroup: 'Tax Credits',
    status: 'Active'
  }
];

async function initializeLedgers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Check and create each ledger if it doesn't exist
    for (const ledgerData of defaultLedgers) {
      const existingLedger = await Ledger.findOne({
        ledgerName: ledgerData.ledgerName,
        ledgerType: ledgerData.ledgerType
      });

      if (existingLedger) {
        console.log(`✓ Ledger "${ledgerData.ledgerName}" already exists`);
      } else {
        await Ledger.create(ledgerData);
        console.log(`✓ Created ledger "${ledgerData.ledgerName}"`);
      }
    }

    console.log('\n✓ Ledger initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing ledgers:', error);
    process.exit(1);
  }
}

initializeLedgers();

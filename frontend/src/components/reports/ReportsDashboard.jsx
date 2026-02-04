import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../common/PageHeader';
import './ReportsDashboard.css';

const ReportsDashboard = () => {
  const navigate = useNavigate();
  const { selectedBusinessType } = useCompany();

  // Dairy Cooperative Society Reports
  const dairyReports = [
    {
      title: 'Sales Report',
      description: 'View sales transactions with date filtering and export options',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#1890ff">
          <circle cx="9" cy="21" r="1" strokeWidth="2"/>
          <circle cx="20" cy="21" r="1" strokeWidth="2"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/sales',
      color: '#e6f7ff'
    },
    {
      title: 'Stock Report',
      description: 'Current stock levels and inventory balance',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#52c41a">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3 10 12 13 21 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/stock',
      color: '#f6ffed'
    },
    {
      title: 'Stock Register',
      description: 'Day-wise, Month-wise & From-To Date stock movement report',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#13c2c2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/stock-register',
      color: '#e6fffb'
    },
    {
      title: 'Purchase Register',
      description: 'Inventory Purchase Checklist - Audit Ready A4 Landscape Format',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#389e0d">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="9" y="3" width="6" height="4" rx="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/purchase-register',
      color: '#f6ffed'
    },
    {
      title: 'Financial Reports',
      description: 'Profit & Loss, Balance Sheet, and Trading Account',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#faad14">
          <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/financial',
      color: '#fffbe6'
    },
    {
      title: 'Subsidy Report',
      description: 'Farmer subsidy details and calculations',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#722ed1">
          <polyline points="20 12 20 22 4 22 4 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="2" y="7" width="20" height="5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="22" x2="12" y2="7" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/subsidy',
      color: '#f9f0ff'
    },
    {
      title: 'Receipts & Disbursement',
      description: 'Summary of all receipts and disbursements',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#eb2f96">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/receipts-disbursement',
      color: '#fff0f6'
    },
    {
      title: 'Cash Book',
      description: 'Detailed cash transactions with running balance',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#13c2c2">
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/cash-book',
      color: '#e6fffb'
    },
    {
      title: 'Day Book',
      description: 'Daily transaction register with receipts and payments',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fa8c16">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/daybook',
      color: '#fff7e6'
    },
    {
      title: 'General Ledger',
      description: 'Ledger-wise detailed account statement with selection',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#2f54eb">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/general-ledger',
      color: '#f0f5ff'
    },
    {
      title: 'Ledger Abstract',
      description: 'Summary of all ledgers with opening/closing balances',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#9254de">
          <path d="M3 3v18h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/ledger-abstract',
      color: '#f9f0ff'
    },
    {
      title: 'R&D Enhanced',
      description: 'Receipts & Disbursement: Single | Three Column | Classified',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f5222d">
          <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/rd-enhanced',
      color: '#fff1f0'
    },
    {
      title: 'Final Accounts',
      description: 'Trading Account, Profit & Loss, Balance Sheet - Combined View',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#52c41a">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/final-accounts',
      color: '#f6ffed'
    },
    {
      title: 'Milk Bill Abstract',
      description: 'Consolidated milk bill abstract by farmer',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#1890ff">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/milk-bill-abstract',
      color: '#e6f7ff'
    }
  ];

  // Private Firm / Business (Vyapar) Reports
  const vyaparReports = [
    {
      title: 'Sale Report',
      description: 'Detailed sales transactions with payment status',
      path: '/reports/vyapar/sale-report',
      color: '#e6f7ff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#1890ff">
          <circle cx="9" cy="21" r="1" strokeWidth="2"/>
          <circle cx="20" cy="21" r="1" strokeWidth="2"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Purchase Report',
      description: 'Purchase transactions with supplier details',
      path: '/reports/vyapar/purchase-report',
      color: '#fff1f0',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f5222d">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 10a4 4 0 0 1-8 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Profit & Loss',
      description: 'Revenue, expenses and profitability analysis',
      path: '/reports/vyapar/profit-loss',
      color: '#f6ffed',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#52c41a">
          <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Cashflow Report',
      description: 'Cash inflow, outflow and running balance',
      path: '/reports/vyapar/cashflow',
      color: '#e6fffb',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#13c2c2">
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Bill Wise Party Report',
      description: 'All bills grouped by party with payments, GST, and balances',
      path: '/reports/vyapar/bill-profit',
      color: '#fffbe6',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#faad14">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="18" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="9" y1="15" x2="15" y2="15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Party Wise Profit',
      description: 'Profit analysis by customer/supplier',
      path: '/reports/vyapar/party-profit',
      color: '#f9f0ff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#722ed1">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Item Wise Profit',
      description: 'Product profitability and margin analysis',
      path: '/reports/vyapar/item-profit',
      color: '#fff7e6',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fa8c16">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3 10 12 13 21 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Trial Balance',
      description: 'Ledger-wise debit and credit balance verification',
      path: '/reports/vyapar/trial-balance',
      color: '#f0f5ff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#2f54eb">
          <path d="M3 3v18h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, liabilities and capital statement',
      path: '/reports/vyapar/balance-sheet',
      color: '#f6ffed',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#52c41a">
          <rect x="2" y="3" width="20" height="18" rx="2" ry="2" strokeWidth="2"/>
          <line x1="12" y1="3" x2="12" y2="21" strokeWidth="2"/>
        </svg>
      )
    },
    {
      title: 'Stock Summary',
      description: 'Current inventory levels and stock values',
      path: '/reports/vyapar/stock-summary',
      color: '#e6fffb',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#13c2c2">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3 10 12 13 21 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Low Stock Alert',
      description: 'Items below reorder level requiring attention',
      path: '/reports/vyapar/low-stock',
      color: '#fff1f0',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f5222d">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="9" x2="12" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'Item by Party',
      description: 'Matrix view of items sold/purchased per party',
      path: '/reports/vyapar/item-by-party',
      color: '#f9f0ff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#722ed1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
          <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2"/>
          <line x1="9" y1="21" x2="9" y2="9" strokeWidth="2"/>
        </svg>
      )
    },
    {
      title: 'Bank Statement',
      description: 'Bank ledger transactions with deposits and withdrawals',
      path: '/reports/vyapar/bank-statement',
      color: '#e6fffb',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#13c2c2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2"/>
          <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2"/>
        </svg>
      )
    },
    {
      title: 'Party Statement',
      description: 'Transaction history and balance for specific party',
      path: '/reports/vyapar/party-statement',
      color: '#fff0f6',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#eb2f96">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'All Parties',
      description: 'Complete list of customers and suppliers with balances',
      path: '/reports/vyapar/all-parties',
      color: '#e6f7ff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#1890ff">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      title: 'All Transactions',
      description: 'Complete transaction history across all vouchers',
      path: '/reports/vyapar/all-transactions',
      color: '#fffbe6',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#faad14">
          <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  // Choose reports based on business type
  const reports = selectedBusinessType === 'Private Firm' ? vyaparReports : dairyReports;

  const isDairy = selectedBusinessType === 'Dairy Cooperative Society';

  return (
    <div className="reports-dashboard-container">
      <PageHeader
        title={isDairy ? "Dairy Society Reports" : "Business Reports (Vyapar)"}
        subtitle={isDairy
          ? "Dairy cooperative society reports and analytics"
          : "Comprehensive business reports like Vyapar app"
        }
      />

      <div className="reports-grid">
        {reports.map((report, index) => (
          <div
            key={index}
            className="report-card"
            style={{ backgroundColor: report.color }}
            onClick={() => navigate(report.path)}
          >
            <div className="report-card-content">
              <div className="report-icon">
                {report.icon}
              </div>
              <h3 className="report-title">{report.title}</h3>
              <p className="report-description">{report.description}</p>
              <button className="btn btn-primary">View Report</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsDashboard;

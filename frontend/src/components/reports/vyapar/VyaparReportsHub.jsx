import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../common/PageHeader';
import '../ReportsDashboard.css';

const VyaparReportsHub = () => {
  const navigate = useNavigate();

  const vyaparReports = [
    {
      title: 'Sale Report',
      description: 'Detailed sales transactions with payment status and invoices',
      path: '/reports/vyapar/sale-report',
      color: '#e6f7ff',
      category: 'Sales'
    },
    {
      title: 'Purchase Report',
      description: 'Purchase transactions with supplier and payment details',
      path: '/reports/vyapar/purchase-report',
      color: '#fff1f0',
      category: 'Purchase'
    },
    {
      title: 'Profit & Loss',
      description: 'Revenue, expenses, and profitability analysis',
      path: '/reports/vyapar/profit-loss',
      color: '#f6ffed',
      category: 'Financial'
    },
    {
      title: 'Cashflow Report',
      description: 'Cash inflow, outflow, and running balance tracking',
      path: '/reports/vyapar/cashflow',
      color: '#e6fffb',
      category: 'Financial'
    },
    {
      title: 'Bill Wise Profit',
      description: 'Profitability analysis for each invoice/bill',
      path: '/reports/vyapar/bill-profit',
      color: '#fffbe6',
      category: 'Profitability'
    },
    {
      title: 'Party Wise Profit',
      description: 'Profit analysis by customer/supplier relationships',
      path: '/reports/vyapar/party-profit',
      color: '#f9f0ff',
      category: 'Profitability'
    },
    {
      title: 'Item Wise Profit',
      description: 'Product profitability and margin analysis',
      path: '/reports/vyapar/item-profit',
      color: '#fff7e6',
      category: 'Profitability'
    },
    {
      title: 'Trial Balance',
      description: 'Ledger-wise debit and credit balance verification',
      path: '/reports/vyapar/trial-balance',
      color: '#f0f5ff',
      category: 'Accounting'
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and capital financial statement',
      path: '/reports/vyapar/balance-sheet',
      color: '#f6ffed',
      category: 'Accounting'
    },
    {
      title: 'Stock Summary',
      description: 'Current inventory levels and stock valuation',
      path: '/reports/vyapar/stock-summary',
      color: '#f6ffed',
      category: 'Inventory'
    },
    {
      title: 'Low Stock Summary',
      description: 'Items below reorder level requiring attention',
      path: '/reports/vyapar/low-stock',
      color: '#fff1f0',
      category: 'Inventory'
    },
    {
      title: 'Item by Party',
      description: 'Matrix view of items sold/purchased per party',
      path: '/reports/vyapar/item-by-party',
      color: '#f9f0ff',
      category: 'Analysis'
    },
    {
      title: 'Bank Statement',
      description: 'Bank ledger transactions with deposits and withdrawals',
      path: '/reports/vyapar/bank-statement',
      color: '#e6fffb',
      category: 'Banking'
    },
    {
      title: 'Party Statement',
      description: 'Transaction history and balance for specific party',
      path: '/reports/vyapar/party-statement',
      color: '#fff0f6',
      category: 'Ledger'
    },
    {
      title: 'All Parties',
      description: 'Complete list of customers and suppliers with balances',
      path: '/reports/vyapar/all-parties',
      color: '#e6f7ff',
      category: 'Ledger'
    },
    {
      title: 'All Transactions',
      description: 'Complete transaction history across all voucher types',
      path: '/reports/vyapar/all-transactions',
      color: '#fffbe6',
      category: 'Audit'
    }
  ];

  const categories = ['All', 'Sales', 'Purchase', 'Financial', 'Profitability', 'Accounting', 'Inventory', 'Analysis', 'Banking', 'Ledger', 'Audit'];
  const [selectedCategory, setSelectedCategory] = React.useState('All');

  const filteredReports = selectedCategory === 'All'
    ? vyaparReports
    : vyaparReports.filter(r => r.category === selectedCategory);

  return (
    <div className="reports-dashboard-container">
      <PageHeader
        title="Vyapar Reports Hub"
        subtitle="Comprehensive business reports like Vyapar app"
      />

      {/* Category Filter */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '8px 16px',
              border: selectedCategory === cat ? '2px solid #1890ff' : '1px solid #ddd',
              background: selectedCategory === cat ? '#e6f7ff' : 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: selectedCategory === cat ? 'bold' : 'normal'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="reports-grid">
        {filteredReports.map((report, index) => (
          <div
            key={index}
            className="report-card"
            style={{ backgroundColor: report.color }}
            onClick={() => navigate(report.path)}
          >
            <div className="report-card-content">
              <div style={{
                display: 'inline-block',
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
                fontSize: '10px',
                marginBottom: '10px',
                fontWeight: 'bold'
              }}>
                {report.category}
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

export default VyaparReportsHub;

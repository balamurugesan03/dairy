import { useState, useEffect, useRef } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './BalanceSheet.css';

const BalanceSheet = () => {
  const [loading, setLoading] = useState(false);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [asOnDate, setAsOnDate] = useState(dayjs().endOf('year').month(2).date(31)); // Default 31-Mar
  const [financialYear, setFinancialYear] = useState('2024-25');
  const printRef = useRef(null);

  // Liability Groups Configuration
  const liabilityGroupConfig = [
    {
      groupName: 'Grants and Subsidies',
      keywords: ['grant', 'subsidy', 'department grant']
    },
    {
      groupName: 'Advance Due by Society',
      keywords: ['milk value', 'addl price', 'producers dues', 'kdf welfare', 'minerals factory', 'silage factory', 'advance due by']
    },
    {
      groupName: 'Profit',
      keywords: ['net profit', 'profit brought', 'p&l']
    }
  ];

  // Asset Groups Configuration
  const assetGroupConfig = [
    {
      groupName: 'Cash',
      keywords: ['cash in hand', 'cash']
    },
    {
      groupName: 'Bank Accounts',
      keywords: ['bank', 'union bank', 'kottakal', 'co-operative bank', 'cooperative bank', 'a/c']
    },
    {
      groupName: 'Share in Other Institutions',
      keywords: ['share in', 'milma', 'share']
    },
    {
      groupName: 'Interest Receivable',
      keywords: ['interest receivable', 'interest received']
    },
    {
      groupName: 'Fixed Assets - Movables',
      keywords: ['furniture', 'equipment', 'fixed asset', 'movable']
    },
    {
      groupName: 'Advance Due to Society',
      keywords: ['am lps', 'amlp', 'lps kuttippuram', 'lp school', 'minerals subsidy', 'silage subsidy', 'advance due to']
    },
    {
      groupName: 'Closing Stock',
      keywords: ['cattle feed', 'minerals', 'closing stock', 'stock']
    }
  ];

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.balanceSheet({
        asOnDate: asOnDate.toISOString()
      });
      setBalanceSheetData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = dayjs(e.target.value);
    setAsOnDate(newDate);

    // Auto-calculate financial year
    const month = newDate.month();
    const year = newDate.year();
    if (month >= 3) { // April onwards
      setFinancialYear(`${year}-${(year + 1).toString().slice(2)}`);
    } else {
      setFinancialYear(`${year - 1}-${year.toString().slice(2)}`);
    }
  };

  const categorizeItems = (items, groupConfig) => {
    const grouped = {};
    const uncategorized = [];

    groupConfig.forEach(group => {
      grouped[group.groupName] = [];
    });

    items?.forEach(item => {
      const name = (item.ledgerName || item.particulars || '').toLowerCase();
      let matched = false;

      for (const group of groupConfig) {
        for (const keyword of group.keywords) {
          if (name.includes(keyword.toLowerCase())) {
            grouped[group.groupName].push(item);
            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        uncategorized.push(item);
      }
    });

    // Add uncategorized items to appropriate "Other" group
    if (uncategorized.length > 0) {
      const otherGroupName = 'Other Items';
      grouped[otherGroupName] = uncategorized;
    }

    return grouped;
  };

  const formatCurrency = (amount) => {
    const value = parseFloat(amount || 0);
    const formatted = Math.abs(value).toFixed(2);
    return value < 0 ? `(${formatted})` : formatted;
  };

  const isNegative = (amount) => {
    return parseFloat(amount || 0) < 0;
  };

  const calculateGroupTotal = (items) => {
    return items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderGroupedTable = (groupedData, side) => {
    let globalSlNo = 1;
    const rows = [];

    Object.entries(groupedData).forEach(([groupName, items]) => {
      if (items.length === 0) return;

      const groupTotal = calculateGroupTotal(items);

      // Group Header
      rows.push(
        <tr key={`${side}-header-${groupName}`} className="bs-group-header">
          <td className="bs-sl-col">{globalSlNo++}</td>
          <td className="bs-name-col" colSpan="2"><strong>{groupName}</strong></td>
          <td className="bs-total-col"></td>
        </tr>
      );

      // Group Items
      items.forEach((item, idx) => {
        const ledgerName = item.ledgerName || item.particulars || 'Unknown';
        const amount = parseFloat(item.amount || 0);

        rows.push(
          <tr key={`${side}-item-${groupName}-${idx}`} className="bs-ledger-row">
            <td className="bs-sl-col"></td>
            <td className="bs-name-col bs-indent">{ledgerName}</td>
            <td className={`bs-amount-col ${isNegative(amount) ? 'negative-value' : ''}`}>
              {formatCurrency(amount)}
            </td>
            <td className="bs-total-col"></td>
          </tr>
        );
      });

      // Group Total
      rows.push(
        <tr key={`${side}-total-${groupName}`} className="bs-group-total">
          <td className="bs-sl-col"></td>
          <td className="bs-name-col bs-indent"><strong>Total</strong></td>
          <td className="bs-amount-col"></td>
          <td className={`bs-total-col ${isNegative(groupTotal) ? 'negative-value' : ''}`}>
            <strong>{formatCurrency(groupTotal)}</strong>
          </td>
        </tr>
      );
    });

    return rows;
  };

  const renderBalanceSheet = () => {
    if (!balanceSheetData) return null;

    // Group the data
    const liabilityGroups = categorizeItems(balanceSheetData.liabilities, liabilityGroupConfig);
    const assetGroups = categorizeItems(balanceSheetData.assets, assetGroupConfig);

    // Calculate totals
    const totalLiabilities = (balanceSheetData.liabilities || []).reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );
    const totalAssets = (balanceSheetData.assets || []).reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );

    // Net Profit from P&L (if available)
    const netProfit = balanceSheetData.netProfit || 0;
    const grandTotalLiabilities = totalLiabilities + netProfit;

    return (
      <div className="bs-report-container" ref={printRef}>
        {/* Report Header */}
        <div className="bs-report-header">
          <h1 className="bs-report-title">BALANCE SHEET AS ON {asOnDate.format('DD-MMM-YYYY').toUpperCase()}</h1>
          <p className="bs-financial-year">Financial Year: {financialYear}</p>
          <p className="bs-report-type">Standard Balance Sheet | Cooperative Society / ERP / Audit-Ready Format</p>
        </div>

        {/* Balance Sheet Content */}
        <div className="bs-content">
          <div className="bs-two-column-layout">
            {/* LIABILITIES SIDE */}
            <div className="bs-side bs-liabilities-side">
              <div className="bs-side-header">LIABILITIES</div>
              <table className="bs-table">
                <thead>
                  <tr>
                    <th className="bs-sl-col">Sl. No</th>
                    <th className="bs-name-col">Ledger / Group Name</th>
                    <th className="bs-amount-col">Amount</th>
                    <th className="bs-total-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {renderGroupedTable(liabilityGroups, 'liability')}

                  {/* Net Profit from P&L */}
                  {netProfit !== 0 && (
                    <>
                      <tr className="bs-group-header">
                        <td className="bs-sl-col">{Object.keys(liabilityGroups).filter(k => liabilityGroups[k].length > 0).length + 1}</td>
                        <td className="bs-name-col" colSpan="2"><strong>Profit</strong></td>
                        <td className="bs-total-col"></td>
                      </tr>
                      <tr className="bs-ledger-row">
                        <td className="bs-sl-col"></td>
                        <td className="bs-name-col bs-indent">Net Profit Brought From P&L A/c</td>
                        <td className={`bs-amount-col ${isNegative(netProfit) ? 'negative-value' : ''}`}>
                          {formatCurrency(netProfit)}
                        </td>
                        <td className="bs-total-col"></td>
                      </tr>
                      <tr className="bs-group-total">
                        <td className="bs-sl-col"></td>
                        <td className="bs-name-col bs-indent"><strong>Total</strong></td>
                        <td className="bs-amount-col"></td>
                        <td className={`bs-total-col ${isNegative(netProfit) ? 'negative-value' : ''}`}>
                          <strong>{formatCurrency(netProfit)}</strong>
                        </td>
                      </tr>
                    </>
                  )}

                  {/* Grand Total */}
                  <tr className="bs-grand-total">
                    <td className="bs-sl-col"></td>
                    <td className="bs-name-col"><strong>GRAND TOTAL</strong></td>
                    <td className="bs-amount-col"></td>
                    <td className="bs-total-col"><strong>{formatCurrency(grandTotalLiabilities)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ASSETS SIDE */}
            <div className="bs-side bs-assets-side">
              <div className="bs-side-header">ASSETS</div>
              <table className="bs-table">
                <thead>
                  <tr>
                    <th className="bs-sl-col">Sl. No</th>
                    <th className="bs-name-col">Ledger / Group Name</th>
                    <th className="bs-amount-col">Amount</th>
                    <th className="bs-total-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {renderGroupedTable(assetGroups, 'asset')}

                  {/* Grand Total */}
                  <tr className="bs-grand-total">
                    <td className="bs-sl-col"></td>
                    <td className="bs-name-col"><strong>GRAND TOTAL</strong></td>
                    <td className="bs-amount-col"></td>
                    <td className="bs-total-col"><strong>{formatCurrency(totalAssets)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Balance Check Warning */}
          {Math.abs(grandTotalLiabilities - totalAssets) > 0.01 && (
            <div className="bs-balance-warning">
              <strong>Warning:</strong> Balance Sheet is not balanced.
              Liabilities: {formatCurrency(grandTotalLiabilities)} | Assets: {formatCurrency(totalAssets)} |
              Difference: {formatCurrency(Math.abs(grandTotalLiabilities - totalAssets))}
            </div>
          )}
        </div>

        {/* Report Footer */}
        <div className="bs-report-footer">
          <div className="bs-footer-left">Generated on: {dayjs().format('DD/MM/YYYY hh:mm A')}</div>
          <div className="bs-footer-center">This is a computer-generated report</div>
          <div className="bs-footer-right">Page 1 of 1</div>
        </div>
      </div>
    );
  };

  return (
    <div className="balance-sheet-page">
      <PageHeader
        title="Balance Sheet"
        subtitle="Cooperative Society / ERP / Audit-Ready Format"
      />

      {/* Controls */}
      <div className="bs-controls no-print">
        <div className="bs-date-control">
          <label>As On Date:</label>
          <input
            type="date"
            value={asOnDate.format('YYYY-MM-DD')}
            onChange={handleDateChange}
            className="bs-date-input"
          />
        </div>
        <div className="bs-fy-control">
          <label>Financial Year:</label>
          <input
            type="text"
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="bs-fy-input"
            placeholder="2024-25"
          />
        </div>
        <div className="bs-actions">
          <button
            className="bs-btn bs-btn-primary"
            onClick={fetchBalanceSheet}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            className="bs-btn bs-btn-secondary"
            onClick={handlePrint}
            disabled={!balanceSheetData}
          >
            Print Report
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bs-loading">
          <div className="bs-spinner"></div>
          <p>Loading balance sheet data...</p>
        </div>
      )}

      {/* Balance Sheet Content */}
      {!loading && balanceSheetData && renderBalanceSheet()}

      {/* No Data State */}
      {!loading && !balanceSheetData && (
        <div className="bs-no-data">
          <p>Click "Generate Report" to view the Balance Sheet</p>
        </div>
      )}
    </div>
  );
};

export default BalanceSheet;

import { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './LedgerAbstract.css';

const LedgerAbstract = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.ledgerAbstract(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledger abstract');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toFixed(2);
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  // Group ledgers by category
  const groupLedgersByCategory = () => {
    if (!reportData?.abstract) return {};

    const grouped = {};
    reportData.abstract.forEach(item => {
      const category = item.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  };

  // Calculate group totals
  const calculateGroupTotals = (items) => {
    const totals = {
      openingDr: 0,
      openingCr: 0,
      receipt: 0,
      payment: 0,
      closingDr: 0,
      closingCr: 0
    };

    items.forEach(item => {
      if (item.openingBalanceType === 'Dr') {
        totals.openingDr += parseFloat(item.openingBalance || 0);
      } else {
        totals.openingCr += parseFloat(item.openingBalance || 0);
      }

      totals.receipt += parseFloat(item.totalCredits || 0);
      totals.payment += parseFloat(item.totalDebits || 0);

      if (item.closingBalanceType === 'Dr') {
        totals.closingDr += parseFloat(item.closingBalance || 0);
      } else {
        totals.closingCr += parseFloat(item.closingBalance || 0);
      }
    });

    return totals;
  };

  const exportData = reportData?.abstract.map(item => ({
    'Ledger Name': item.ledgerName,
    'Opening Dr': item.openingBalanceType === 'Dr' ? item.openingBalance.toFixed(2) : '',
    'Opening Cr': item.openingBalanceType === 'Cr' ? item.openingBalance.toFixed(2) : '',
    'Receipt': item.totalCredits.toFixed(2),
    'Payment': item.totalDebits.toFixed(2),
    'Closing Dr': item.closingBalanceType === 'Dr' ? item.closingBalance.toFixed(2) : '',
    'Closing Cr': item.closingBalanceType === 'Cr' ? item.closingBalance.toFixed(2) : ''
  })) || [];

  const groupedLedgers = groupLedgersByCategory();

  return (
    <div className="ledger-abstract-container">
      <PageHeader
        title="GENERAL LEDGER – Abstract"
        subtitle={reportData ? `Period: ${formatDate(reportData.startDate)} to ${formatDate(reportData.endDate)}` : 'Summary of all ledgers with opening and closing balances'}
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading ledger abstract...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Professional Report Header */}
          <div className="report-header-card">
            <h3 className="report-title">GENERAL LEDGER – Abstract</h3>
            <p className="report-period">
              For the period from {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
            </p>
          </div>

          {/* Professional Abstract Table */}
          <div className="abstract-table-container">
            <table className="abstract-table">
              <thead>
                <tr>
                  <th rowSpan="2" className="ledger-name-header">Ledger Name</th>
                  <th colSpan="2" className="section-header">Opening Balance</th>
                  <th colSpan="2" className="section-header">During the Year</th>
                  <th colSpan="2" className="section-header">Closing Balance</th>
                </tr>
                <tr>
                  <th className="sub-header">Dr.</th>
                  <th className="sub-header">Cr.</th>
                  <th className="sub-header">Receipt</th>
                  <th className="sub-header">Payment</th>
                  <th className="sub-header">Asset (Dr.)</th>
                  <th className="sub-header">Liability (Cr.)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedLedgers).map(([category, items], groupIdx) => (
                  <>
                    {/* Group Header */}
                    <tr key={`group-${groupIdx}`} className="group-header-row">
                      <td colSpan="7" className="group-header">
                        {category === 'ASSETS' && 'Advance due to Society (ASSET)'}
                        {category === 'LIABILITIES' && 'Advance due by Society (LIABILITY)'}
                        {category !== 'ASSETS' && category !== 'LIABILITIES' && category}
                      </td>
                    </tr>

                    {/* Ledger Items */}
                    {items.map((item, itemIdx) => (
                      <tr key={`item-${groupIdx}-${itemIdx}`} className="ledger-row">
                        <td className="ledger-name">{item.ledgerName}</td>
                        <td className="amount-cell">
                          {item.openingBalanceType === 'Dr' ? formatCurrency(item.openingBalance) : ''}
                        </td>
                        <td className="amount-cell">
                          {item.openingBalanceType === 'Cr' ? formatCurrency(item.openingBalance) : ''}
                        </td>
                        <td className="amount-cell">{formatCurrency(item.totalCredits)}</td>
                        <td className="amount-cell">{formatCurrency(item.totalDebits)}</td>
                        <td className="amount-cell">
                          {item.closingBalanceType === 'Dr' ? formatCurrency(item.closingBalance) : ''}
                        </td>
                        <td className="amount-cell">
                          {item.closingBalanceType === 'Cr' ? formatCurrency(item.closingBalance) : ''}
                        </td>
                      </tr>
                    ))}

                    {/* Group Total */}
                    {(() => {
                      const totals = calculateGroupTotals(items);
                      return (
                        <tr key={`total-${groupIdx}`} className="group-total-row">
                          <td className="total-label">Total - {category}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.openingDr)}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.openingCr)}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.receipt)}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.payment)}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.closingDr)}</td>
                          <td className="amount-cell total-amount">{formatCurrency(totals.closingCr)}</td>
                        </tr>
                      );
                    })()}
                  </>
                ))}

                {/* Grand Total */}
                <tr className="grand-total-row">
                  <td className="grand-total-label">CLOSING BALANCE</td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalOpeningDebit)}
                  </td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalOpeningCredit)}
                  </td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalCredits)}
                  </td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalDebits)}
                  </td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalClosingDebit)}
                  </td>
                  <td className="amount-cell grand-total-amount">
                    {formatCurrency(reportData.summary.totalClosingCredit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="export-section">
            <ExportButton
              data={exportData}
              filename={`general_ledger_abstract_${formatDate(reportData.startDate)}_to_${formatDate(reportData.endDate)}`}
              buttonText="Export Abstract"
            />
            <button className="print-button" onClick={() => window.print()}>
              Print Report
            </button>
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          Please select a date range to view the ledger abstract
        </div>
      )}
    </div>
  );
};

export default LedgerAbstract;

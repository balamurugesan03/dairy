

import React, { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './ReceiptsDisbursement.css';

const ReceiptsDisbursement = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [format, setFormat] = useState('singleColumnMonthly');
  const [currentFilter, setCurrentFilter] = useState(null);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.rdEnhanced({
        ...filterData,
        format
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch R&D report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    setCurrentFilter(filterData);
    fetchReport(filterData);
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (reportData && currentFilter) {
      fetchReport(currentFilter);
    }
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  // Remove the render functions for the removed formats
  const renderSingleColumnMonthly = () => {
    if (!reportData.formatted?.sections) return null;

    return (
      <div className="single-column-monthly-container">
        <div className="monthly-report-header">
          <h2>RECEIPT AND DISBURSEMENT ACCOUNT FOR THE MONTH OF {dayjs(reportData.startDate).format('MMMM–YYYY')}</h2>
          <p className="report-subtitle">End of the Month</p>
        </div>

        <table className="monthly-report-table">
          <thead>
            <tr>
              <th className="ledger-col">Ledger / Description</th>
              <th className="amount-col">Receipt (₹)</th>
              <th className="amount-col">Payment (₹)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.formatted.sections.map((section, sectionIdx) => (
              <React.Fragment key={`section-${sectionIdx}`}>
                {/* Section Header */}
                <tr className="section-header-row">
                  <td colSpan="3"><strong>{section.sectionName}</strong></td>
                </tr>

                {/* Ledger Rows */}
                {section.ledgers.map((ledger, ledgerIdx) => (
                  <tr key={`ledger-${sectionIdx}-${ledgerIdx}`} className="ledger-data-row">
                    <td className="particulars-col indent">{ledger.ledgerName}</td>
                    <td className="amount-col">
                      {formatCurrency(ledger.receipt)}
                    </td>
                    <td className="amount-col">
                      {formatCurrency(ledger.payment)}
                    </td>
                  </tr>
                ))}

                {/* Group Total */}
                <tr className="group-total-row">
                  <td className="particulars-col"><strong>Account Group Total</strong></td>
                  <td className="amount-col">
                    <strong>{formatCurrency(section.groupTotal.receipt)}</strong>
                  </td>
                  <td className="amount-col">
                    <strong>{formatCurrency(section.groupTotal.payment)}</strong>
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {/* Grand Total */}
            <tr className="grand-total-row">
              <td className="particulars-col"><strong>GRAND TOTAL</strong></td>
              <td className="amount-col">
                <strong>{formatCurrency(reportData.formatted.grandTotal.receipt)}</strong>
              </td>
              <td className="amount-col">
                <strong>{formatCurrency(reportData.formatted.grandTotal.payment)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="report-footer">
          <div className="footer-left">Created on {dayjs().format('DD/MM/YYYY hh:mm A')} by ERP System</div>
          <div className="footer-right">Page 1 of 1</div>
          <p className="footer-center">This is a computer-generated report</p>
        </div>
      </div>
    );
  };

  const renderThreeColumnLedgerwise = () => {
    if (!reportData.formatted?.sections) return null;

    return (
      <div className="ledgerwise-report-container">
        <div className="ledgerwise-report-header">
          <h2>Receipts & Disbursement Account</h2>
          <h3>Three Column Ledger-wise Format</h3>
          <p className="report-period">
            For the period: {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
          </p>
        </div>

        <table className="ledgerwise-table">
          <thead>
            <tr>
              <th rowSpan="2" className="ledger-col">Ledger / Particulars</th>
              <th colSpan="3" className="section-header">Receipt (₹)</th>
              <th colSpan="3" className="section-header">Payment (₹)</th>
            </tr>
            <tr>
              <th className="amount-col">Upto Month</th>
              <th className="amount-col">During Month</th>
              <th className="amount-col">End of Month</th>
              <th className="amount-col">Upto Month</th>
              <th className="amount-col">During Month</th>
              <th className="amount-col">End of Month</th>
            </tr>
          </thead>
          <tbody>
            {reportData.formatted.sections.map((section, sectionIdx) => (
              <React.Fragment key={`section-${sectionIdx}`}>
                {/* Section Header */}
                <tr className="section-header-row">
                  <td colSpan="7"><strong>{section.sectionName}</strong></td>
                </tr>

                {/* Ledger Rows */}
                {section.ledgers.map((ledger, ledgerIdx) => (
                  <tr key={`ledger-${sectionIdx}-${ledgerIdx}`} className="ledger-data-row">
                    <td className="ledger-col indent">{ledger.ledgerName}</td>
                    <td className="amount-col">
                      {ledger.receipt.uptoMonth > 0 ? formatCurrency(ledger.receipt.uptoMonth) : '-'}
                    </td>
                    <td className="amount-col">
                      {ledger.receipt.duringMonth > 0 ? formatCurrency(ledger.receipt.duringMonth) : '-'}
                    </td>
                    <td className="amount-col">
                      {ledger.receipt.endOfMonth > 0 ? formatCurrency(ledger.receipt.endOfMonth) : '-'}
                    </td>
                    <td className="amount-col">
                      {ledger.payment.uptoMonth > 0 ? formatCurrency(ledger.payment.uptoMonth) : '-'}
                    </td>
                    <td className="amount-col">
                      {ledger.payment.duringMonth > 0 ? formatCurrency(ledger.payment.duringMonth) : '-'}
                    </td>
                    <td className="amount-col">
                      {ledger.payment.endOfMonth > 0 ? formatCurrency(ledger.payment.endOfMonth) : '-'}
                    </td>
                  </tr>
                ))}

                {/* Group Total */}
                <tr className="group-total-row">
                  <td className="ledger-col"><strong>Group Total - {section.sectionName}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.receipt.uptoMonth)}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.receipt.duringMonth)}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.receipt.endOfMonth)}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.payment.uptoMonth)}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.payment.duringMonth)}</strong></td>
                  <td className="amount-col"><strong>{formatCurrency(section.groupTotal.payment.endOfMonth)}</strong></td>
                </tr>

                <tr className="section-spacer"><td colSpan="7"></td></tr>
              </React.Fragment>
            ))}

            {/* Grand Total */}
            <tr className="grand-total-row">
              <td className="ledger-col"><strong>GRAND TOTAL</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.receipt.uptoMonth)}</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.receipt.duringMonth)}</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.receipt.endOfMonth)}</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.payment.uptoMonth)}</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.payment.duringMonth)}</strong></td>
              <td className="amount-col"><strong>{formatCurrency(reportData.formatted.grandTotal.payment.endOfMonth)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div className="report-footer">
          <div className="footer-left">Created on {dayjs().format('DD/MM/YYYY hh:mm A')} | By ADM</div>
          <div className="footer-right">Page 1 of 1</div>
        </div>
      </div>
    );
  };

  const exportData = reportData?.receipts?.concat(reportData.payments || []).map(t => ({
    Date: formatDate(t.date),
    'Voucher No': t.voucherNumber,
    Type: t.amount > 0 ? 'Receipt' : 'Payment',
    Particulars: t.particulars,
    Amount: formatCurrency(t.amount)
  })) || [];

  return (
    <div className="rd-report-container">
      <PageHeader
        title="Receipts & Disbursement Report"
        subtitle="Single Column Monthly and Three Column Ledger-wise formats"
      />

      {/* Format Selector - Only showing remaining formats */}
      <div className="format-selector">
        <button
          className={`format-btn ${format === 'singleColumnMonthly' ? 'active' : ''}`}
          onClick={() => handleFormatChange('singleColumnMonthly')}
        >
          Single Column Monthly
        </button>
        <button
          className={`format-btn ${format === 'threeColumnLedgerwise' ? 'active' : ''}`}
          onClick={() => handleFormatChange('threeColumnLedgerwise')}
        >
          Three Column Ledger-wise
        </button>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading R&D report...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Opening Balance</span>
              <span className="summary-value">{formatCurrency(reportData.openingBalance)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Receipts</span>
              <span className="summary-value success">{formatCurrency(reportData.summary.totalReceipts)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Payments</span>
              <span className="summary-value danger">{formatCurrency(reportData.summary.totalPayments)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Closing Balance</span>
              <span className="summary-value">{formatCurrency(reportData.closingBalance)}</span>
            </div>
          </div>

          {/* Report Content - Only showing remaining formats */}
          <div className="report-content">
            {format === 'singleColumnMonthly' && renderSingleColumnMonthly()}
            {format === 'threeColumnLedgerwise' && renderThreeColumnLedgerwise()}
          </div>

          <div className="export-section">
            <ExportButton
              data={exportData}
              filename="receipts_disbursement"
              buttonText="Export R&D Report"
            />
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          Please select a date range to view the receipts & disbursement report
        </div>
      )}
    </div>
  );
};

export default ReceiptsDisbursement;
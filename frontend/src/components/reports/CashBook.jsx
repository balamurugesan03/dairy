import { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './CashBook.css';

const CashBook = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.cashBook(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  const exportData = reportData?.transactions.map(t => ({
    Date: formatDate(t.date),
    Description: t.particulars,
    'Receipt No': t.debit > 0 ? t.voucherNumber : '',
    'Receipt Amount': t.debit > 0 ? t.debit.toFixed(2) : '',
    'Voucher No': t.credit > 0 ? t.voucherNumber : '',
    'Payment Amount': t.credit > 0 ? t.credit.toFixed(2) : '',
    Narration: t.narration || ''
  })) || [];

  return (
    <div className="cash-book-container">
      <PageHeader
        title="Cash Book"
        subtitle="Traditional double-sided cash book format"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading cash book...</div>
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

          {/* Traditional Cash Book Table */}
          <div className="report-table-container">
            <div className="print-header">
              <h2>Cash Book</h2>
              <p className="date-range">
                Period: {reportData.startDate && formatDate(reportData.startDate)} to {reportData.endDate && formatDate(reportData.endDate)}
              </p>
            </div>

            <table className="traditional-cashbook">
              <thead>
                <tr>
                  <th rowSpan="2" className="col-date">Date</th>
                  <th rowSpan="2" className="col-description">Description</th>
                  <th colSpan="2" className="receipt-header">Receipt</th>
                  <th rowSpan="2" className="col-date">Date</th>
                  <th rowSpan="2" className="col-description">Description</th>
                  <th colSpan="2" className="payment-header">Payment</th>
                </tr>
                <tr>
                  <th className="col-voucher">Rec. No</th>
                  <th className="col-amount">Cash</th>
                  <th className="col-voucher">Vouch. No</th>
                  <th className="col-amount">Cash</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="balance-row">
                  <td className="col-date"></td>
                  <td className="col-description"><strong>To Balance b/d (Opening)</strong></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount"><strong>{formatCurrency(reportData.openingBalance)}</strong></td>
                  <td className="col-date"></td>
                  <td className="col-description"></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount"></td>
                </tr>

                {/* Group transactions by date for better presentation */}
                {reportData.transactions.map((transaction, idx) => {
                  const isReceipt = transaction.debit > 0;
                  const isPayment = transaction.credit > 0;

                  return (
                    <tr key={idx} className="transaction-row">
                      {/* Receipt side */}
                      {isReceipt ? (
                        <>
                          <td className="col-date">{formatDate(transaction.date)}</td>
                          <td className="col-description">
                            <div className="particulars">
                              {transaction.particulars}
                              {transaction.narration && <small className="narration">{transaction.narration}</small>}
                            </div>
                          </td>
                          <td className="col-voucher">{transaction.voucherNumber}</td>
                          <td className="col-amount">{formatCurrency(transaction.debit)}</td>
                        </>
                      ) : (
                        <>
                          <td className="col-date"></td>
                          <td className="col-description"></td>
                          <td className="col-voucher"></td>
                          <td className="col-amount"></td>
                        </>
                      )}

                      {/* Payment side */}
                      {isPayment ? (
                        <>
                          <td className="col-date">{formatDate(transaction.date)}</td>
                          <td className="col-description">
                            <div className="particulars">
                              {transaction.particulars}
                              {transaction.narration && <small className="narration">{transaction.narration}</small>}
                            </div>
                          </td>
                          <td className="col-voucher">{transaction.voucherNumber}</td>
                          <td className="col-amount">{formatCurrency(transaction.credit)}</td>
                        </>
                      ) : (
                        <>
                          <td className="col-date"></td>
                          <td className="col-description"></td>
                          <td className="col-voucher"></td>
                          <td className="col-amount"></td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {/* Closing Balance Row */}
                <tr className="balance-row">
                  <td className="col-date"></td>
                  <td className="col-description"></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount"></td>
                  <td className="col-date"></td>
                  <td className="col-description"><strong>By Balance c/d (Closing)</strong></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount"><strong>{formatCurrency(reportData.closingBalance)}</strong></td>
                </tr>

                {/* Grand Total Row */}
                <tr className="total-row">
                  <td className="col-date"></td>
                  <td className="col-description"><strong>Total</strong></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount">
                    <strong>{formatCurrency((reportData.openingBalance || 0) + (reportData.summary.totalReceipts || 0))}</strong>
                  </td>
                  <td className="col-date"></td>
                  <td className="col-description"><strong>Total</strong></td>
                  <td className="col-voucher"></td>
                  <td className="col-amount">
                    <strong>{formatCurrency((reportData.closingBalance || 0) + (reportData.summary.totalPayments || 0))}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="export-section">
            <ExportButton
              data={exportData}
              filename="cash_book"
              buttonText="Export Cash Book"
            />
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          Please select a date range to view the cash book
        </div>
      )}
    </div>
  );
};

export default CashBook;

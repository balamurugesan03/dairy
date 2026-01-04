import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { dayBookAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './DayBook.css';

const DayBook = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('month').format('YYYY-MM-DD')
  });
  const [dayBookData, setDayBookData] = useState(null);

  useEffect(() => {
    fetchDayBook();
  }, []);

  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const response = await dayBookAPI.get(dateRange);
      setDayBookData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch day book');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    fetchDayBook();
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  return (
    <div className="day-book-container">
      <PageHeader
        title="Day Book"
        subtitle="Complete transaction register with receipts and payments"
      />

      {/* Filters */}
      <div className="day-book-filters">
        <div className="filter-group">
          <label className="filter-label">From Date</label>
          <input
            type="date"
            className="filter-input"
            value={dateRange.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">To Date</label>
          <input
            type="date"
            className="filter-input"
            value={dateRange.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Day Book'}
        </button>
      </div>

      {/* Day Book Display */}
      {dayBookData && (
        <div className="day-book-content">
          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-label">Opening Balance (Cash + Bank)</span>
                <span className="summary-value">{formatCurrency(dayBookData.summary.openingBalance)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Closing Balance (Cash + Bank)</span>
                <span className="summary-value">{formatCurrency(dayBookData.summary.closingBalance)}</span>
              </div>
            </div>
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-label">Total Receipts</span>
                <span className="summary-value success">{formatCurrency(dayBookData.summary.totalReceipts)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Payments</span>
                <span className="summary-value danger">{formatCurrency(dayBookData.summary.totalPayments)}</span>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="day-book-table">
            <div className="table-side receipt-side">
              <h3 className="side-title">Receipt Side (Credits)</h3>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher No</th>
                    <th>Particulars</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBookData.receiptSide.length > 0 ? (
                    dayBookData.receiptSide.map((entry, index) => (
                      <tr key={index}>
                        <td>{formatDate(entry.date)}</td>
                        <td>
                          <span className={`voucher-badge ${entry.voucherType.toLowerCase()}`}>
                            {entry.voucherNumber}
                          </span>
                        </td>
                        <td>
                          <div className="particulars">
                            <strong>{entry.ledgerName}</strong>
                            {entry.narration && <small>{entry.narration}</small>}
                          </div>
                        </td>
                        <td className="amount-cell credit">{formatCurrency(entry.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="no-data">No receipt entries</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3"><strong>Total Receipts</strong></td>
                    <td className="amount-cell credit">
                      <strong>{formatCurrency(dayBookData.summary.totalReceipts)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="table-side payment-side">
              <h3 className="side-title">Payment Side (Debits)</h3>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher No</th>
                    <th>Particulars</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBookData.paymentSide.length > 0 ? (
                    dayBookData.paymentSide.map((entry, index) => (
                      <tr key={index}>
                        <td>{formatDate(entry.date)}</td>
                        <td>
                          <span className={`voucher-badge ${entry.voucherType.toLowerCase()}`}>
                            {entry.voucherNumber}
                          </span>
                        </td>
                        <td>
                          <div className="particulars">
                            <strong>{entry.ledgerName}</strong>
                            {entry.narration && <small>{entry.narration}</small>}
                          </div>
                        </td>
                        <td className="amount-cell debit">{formatCurrency(entry.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="no-data">No payment entries</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3"><strong>Total Payments</strong></td>
                    <td className="amount-cell debit">
                      <strong>{formatCurrency(dayBookData.summary.totalPayments)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayBook;

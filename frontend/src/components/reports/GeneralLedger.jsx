import { useState, useEffect, useRef } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import './GeneralLedger.css';

const GeneralLedger = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [societyName, setSocietyName] = useState('Dairy Cooperative Society');
  const printRef = useRef(null);

  useEffect(() => {
    fetchLedgers();
    // Set default date range (current financial year)
    const today = dayjs();
    const financialYearStart = today.month() >= 3
      ? dayjs().month(3).date(1)
      : dayjs().subtract(1, 'year').month(3).date(1);
    setDateRange({
      startDate: financialYearStart.format('YYYY-MM-DD'),
      endDate: today.format('YYYY-MM-DD')
    });
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await reportAPI.ledgersDropdown();
      setLedgers(response.data);
    } catch (error) {
      message.error('Failed to fetch ledgers');
    }
  };

  const fetchReport = async () => {
    if (!selectedLedger) {
      message.error('Please select a ledger');
      return;
    }
    if (!dateRange.startDate || !dateRange.endDate) {
      message.error('Please select date range');
      return;
    }

    setLoading(true);
    try {
      const response = await reportAPI.generalLedger({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ledgerId: selectedLedger
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch general ledger');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  const formatDay = (date) => {
    return dayjs(date).format('DD');
  };

  const getFinancialYear = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const startYear = start.month() >= 3 ? start.year() : start.year() - 1;
    const endYear = startYear + 1;
    return `${startYear}-${endYear.toString().slice(2)}`;
  };

  const groupTransactionsByMonth = (transactions) => {
    const grouped = {};
    transactions.forEach(transaction => {
      const monthYear = dayjs(transaction.date).format('MMM-YYYY');
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(transaction);
    });
    return grouped;
  };

  const calculateProgressiveData = (transactions) => {
    let progressiveReceipt = 0;
    let progressivePayment = 0;
    let runningBalance = reportData?.openingBalance || 0;

    return transactions.map(transaction => {
      // Map debit/credit to receipt/payment (customize based on ledger type)
      const isReceipt = transaction.credit > 0;
      const receipt = isReceipt ? transaction.credit : 0;
      const payment = !isReceipt ? transaction.debit : 0;

      progressiveReceipt += receipt;
      progressivePayment += payment;
      runningBalance = runningBalance + receipt - payment;

      return {
        ...transaction,
        receipt,
        payment,
        progressiveReceipt,
        progressivePayment,
        runningBalance
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!reportData) return;

    const csvData = [];
    csvData.push(['Day', 'Receipt', 'Progressive Receipt', 'Payment', 'Progressive Payment', 'Balance', 'Description']);

    const processedTransactions = calculateProgressiveData(reportData.transactions);
    processedTransactions.forEach(t => {
      csvData.push([
        formatDay(t.date),
        formatNumber(t.receipt),
        formatNumber(t.progressiveReceipt),
        formatNumber(t.payment),
        formatNumber(t.progressivePayment),
        formatNumber(t.runningBalance),
        `${t.particulars} ${t.narration || ''}`
      ]);
    });

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `general_ledger_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
  };

  const renderLedgerReport = () => {
    if (!reportData) return null;

    const processedTransactions = calculateProgressiveData(reportData.transactions);
    const groupedByMonth = groupTransactionsByMonth(processedTransactions);

    return (
      <div className="ledger-print-container" ref={printRef}>
        {/* Report Header */}
        <div className="report-header">
          <h1 className="society-name">{societyName}</h1>
          <h2 className="report-title">GENERAL LEDGER</h2>
          <div className="report-info">
            <p><strong>Financial Year:</strong> {getFinancialYear(dateRange.startDate, dateRange.endDate)}</p>
            <p><strong>Head of Account:</strong> {reportData.ledger.name}</p>
            <p><strong>Period:</strong> {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}</p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="ledger-table-wrapper">
          <table className="traditional-ledger-table">
            <thead>
              <tr>
                <th className="col-day">Day</th>
                <th className="col-amount">Receipt</th>
                <th className="col-amount">Progressive<br/>Receipt</th>
                <th className="col-amount">Payment</th>
                <th className="col-amount">Progressive<br/>Payment</th>
                <th className="col-amount">Balance</th>
                <th className="col-description">Description</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance */}
              <tr className="opening-balance-row">
                <td colSpan="5" className="text-left"><strong>Opening Balance</strong></td>
                <td className="text-right"><strong>{formatNumber(reportData.openingBalance)}</strong></td>
                <td className="text-left">Brought Forward</td>
              </tr>

              {/* Month-wise transactions */}
              {Object.keys(groupedByMonth).map((monthYear, idx) => {
                const monthTransactions = groupedByMonth[monthYear];
                const monthTotal = monthTransactions[monthTransactions.length - 1];

                return (
                  <tbody key={idx}>
                    {/* Month Header */}
                    <tr className="month-header-row">
                      <td colSpan="7" className="month-header">{monthYear}</td>
                    </tr>

                    {/* Transactions for this month */}
                    {monthTransactions.map((transaction, tIdx) => (
                      <tr key={tIdx} className="transaction-row">
                        <td className="text-center">{formatDay(transaction.date)}</td>
                        <td className="text-right">
                          {transaction.receipt > 0 ? formatNumber(transaction.receipt) : ''}
                        </td>
                        <td className="text-right">
                          {transaction.receipt > 0 ? formatNumber(transaction.progressiveReceipt) : ''}
                        </td>
                        <td className="text-right">
                          {transaction.payment > 0 ? formatNumber(transaction.payment) : ''}
                        </td>
                        <td className="text-right">
                          {transaction.payment > 0 ? formatNumber(transaction.progressivePayment) : ''}
                        </td>
                        <td className="text-right">{formatNumber(transaction.runningBalance)}</td>
                        <td className="text-left">
                          <div className="description-cell">
                            <span className="particulars">{transaction.particulars}</span>
                            {transaction.narration && (
                              <span className="narration"> - {transaction.narration}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}

              {/* Closing Balance */}
              <tr className="closing-balance-row">
                <td colSpan="5" className="text-left"><strong>Closing Balance</strong></td>
                <td className="text-right">
                  <strong>{formatNumber(processedTransactions[processedTransactions.length - 1]?.runningBalance || reportData.closingBalance)}</strong>
                </td>
                <td className="text-left">Carried Forward</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Report Footer */}
        <div className="report-footer">
          <div className="footer-info">
            <p>Created on {dayjs().format('DD/MM/YYYY HH:mm:ss')} | By ADM</p>
          </div>
          <div className="signature-section">
            <div className="signature-box">
              <p className="signature-label">Secretary</p>
              <div className="signature-line"></div>
            </div>
            <div className="signature-box">
              <p className="signature-label">Cashier</p>
              <div className="signature-line"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="general-ledger-modern-container">
      {/* Control Panel - Hidden in print */}
      <div className="control-panel no-print">
        <div className="control-header">
          <h1>General Ledger Report</h1>
        </div>

        <div className="control-form">
          {/* Society Name */}
          <div className="form-group">
            <label>Society Name</label>
            <input
              type="text"
              value={societyName}
              onChange={(e) => setSocietyName(e.target.value)}
              className="form-input"
              placeholder="Enter society name"
            />
          </div>

          {/* Ledger Selection */}
          <div className="form-group">
            <label>Select Ledger Account</label>
            <select
              value={selectedLedger}
              onChange={(e) => setSelectedLedger(e.target.value)}
              className="form-select"
            >
              <option value="">-- Select Ledger --</option>
              {ledgers.map(ledger => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.ledgerName} ({ledger.ledgerType})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="form-row">
            <div className="form-group">
              <label>From Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={fetchReport}
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
            {reportData && (
              <>
                <button onClick={handlePrint} className="btn btn-secondary">
                  Print Report
                </button>
                <button onClick={handleExport} className="btn btn-secondary">
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report Display */}
      {loading && (
        <div className="loading-state no-print">
          <div className="spinner"></div>
          <p>Loading general ledger...</p>
        </div>
      )}

      {!loading && reportData && renderLedgerReport()}

      {!loading && !reportData && (
        <div className="empty-state no-print">
          <p>Select ledger account and date range to generate report</p>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;

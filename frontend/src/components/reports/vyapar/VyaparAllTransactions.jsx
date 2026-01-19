import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparAllTransactions = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparAllTransactions(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch all transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getVoucherTypeBadge = (type) => {
    const typeClasses = {
      'Sale': 'status-badge paid',
      'Purchase': 'status-badge danger',
      'Payment': 'status-badge info',
      'Receipt': 'status-badge success',
      'Journal': 'status-badge warning',
      'Contra': 'status-badge partial'
    };
    return <span className={typeClasses[type] || 'status-badge'}>{type}</span>;
  };

  const exportData = reportData?.transactions?.map(txn => ({
    Date: formatDate(txn.date),
    'Voucher Type': txn.voucherType,
    'Voucher No': txn.voucherNumber,
    'Party Name': txn.partyName || '-',
    'Ledger': txn.ledgerName,
    'Debit': txn.debit.toFixed(2),
    'Credit': txn.credit.toFixed(2),
    'Amount': txn.amount.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="All Transactions"
        subtitle="Complete transaction history across all vouchers"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading all transactions...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Transactions</div>
              <div className="card-value">{reportData.summary.totalTransactions}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Debit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalDebit)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Credit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalCredit)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Voucher Types</div>
              <div className="card-value">{Object.keys(reportData.summary.byVoucherType).length}</div>
              <div className="card-subtext">Different types</div>
            </div>
          </div>

          {/* Voucher Type Summary */}
          {reportData.summary.byVoucherType && Object.keys(reportData.summary.byVoucherType).length > 0 && (
            <div className="report-table-container" style={{ marginBottom: '20px' }}>
              <div className="table-header">
                <div className="table-info">
                  Transaction Summary by Voucher Type
                </div>
              </div>
              <div className="table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Voucher Type</th>
                      <th className="text-right">Count</th>
                      <th className="text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reportData.summary.byVoucherType).map(([type, data]) => (
                      <tr key={type}>
                        <td>{getVoucherTypeBadge(type)}</td>
                        <td className="text-right">{data.count}</td>
                        <td className="text-right success-text">{formatCurrency(data.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Transactions Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.transactions.length} transactions
              </div>
              <ExportButton data={exportData} filename="all_transactions" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-center">Type</th>
                    <th>Voucher No.</th>
                    <th>Party</th>
                    <th>Ledger</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="no-data">
                        No transactions found for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.transactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(txn.date)}</td>
                        <td className="text-center">{getVoucherTypeBadge(txn.voucherType)}</td>
                        <td className="invoice-number">{txn.voucherNumber}</td>
                        <td>{txn.partyName || '-'}</td>
                        <td>{txn.ledgerName}</td>
                        <td className="text-right danger-text">
                          {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                        </td>
                        <td className="text-right success-text">
                          {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                        </td>
                        <td className="text-right amount-highlight">{formatCurrency(txn.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="5" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right danger-text">
                      <strong>{formatCurrency(reportData.summary.totalDebit)}</strong>
                    </td>
                    <td className="text-right success-text">
                      <strong>{formatCurrency(reportData.summary.totalCredit)}</strong>
                    </td>
                    <td className="text-right amount-highlight">
                      <strong>{formatCurrency(reportData.summary.totalDebit)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VyaparAllTransactions;

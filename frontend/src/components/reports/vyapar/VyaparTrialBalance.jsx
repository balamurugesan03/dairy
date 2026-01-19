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

const VyaparTrialBalance = () => {
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
      const response = await reportAPI.vyaparTrialBalance(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const exportData = reportData?.ledgers?.map(ledger => ({
    'Ledger Name': ledger.ledgerName,
    'Group': ledger.group,
    'Debit': ledger.debit.toFixed(2),
    'Credit': ledger.credit.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Trial Balance"
        subtitle="Ledger-wise debit and credit balances"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading trial balance...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Ledgers</div>
              <div className="card-value">{reportData.summary.totalLedgers}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Debit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalDebit)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Credit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalCredit)}</div>
            </div>
            <div className={`summary-card ${reportData.summary.isBalanced ? 'success' : 'danger'}`}>
              <div className="card-label">Status</div>
              <div className="card-value">{reportData.summary.isBalanced ? 'Balanced' : 'Not Balanced'}</div>
              <div className="card-subtext">
                Diff: {formatCurrency(reportData.summary.difference)}
              </div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.ledgers?.length || 0} ledgers
              </div>
              <ExportButton data={exportData} filename="trial_balance" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Ledger Name</th>
                    <th>Group</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
               <tbody>
  {!reportData?.ledgers || reportData.ledgers.length === 0 ? (
    <tr>
      <td colSpan="4" className="no-data">
        No ledgers found
      </td>
    </tr>
  ) : (
    reportData.ledgers.map((ledger, idx) => (
      <tr key={idx}>
        <td className="ledger-name">{ledger.ledgerName}</td>
        <td>
          <span className="status-badge info">{ledger.group}</span>
        </td>
        <td className="text-right danger-text">
          {ledger.debit > 0 ? formatCurrency(ledger.debit) : '-'}
        </td>
        <td className="text-right success-text">
          {ledger.credit > 0 ? formatCurrency(ledger.credit) : '-'}
        </td>
      </tr>
    ))
  )}
</tbody>

                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="2" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right danger-text">
                      <strong>{formatCurrency(reportData.summary.totalDebit)}</strong>
                    </td>
                    <td className="text-right success-text">
                      <strong>{formatCurrency(reportData.summary.totalCredit)}</strong>
                    </td>
                  </tr>
                  {!reportData.summary.isBalanced && (
                    <tr className="difference-row">
                      <td colSpan="2" className="text-right"><strong>Difference:</strong></td>
                      <td colSpan="2" className="text-center" style={{ color: 'red' }}>
                        <strong>{formatCurrency(reportData.summary.difference)}</strong>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VyaparTrialBalance;

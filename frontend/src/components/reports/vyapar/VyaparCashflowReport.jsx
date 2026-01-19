import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparCashflowReport.css';

const VyaparCashflowReport = () => {
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
      const response = await reportAPI.vyaparCashflow(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cashflow report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getTransactionTypeBadge = (type) => {
    const typeClasses = {
      'Inflow': 'transaction-badge inflow',
      'Outflow': 'transaction-badge outflow'
    };
    return <span className={typeClasses[type] || 'transaction-badge'}>{type}</span>;
  };

  const exportData = reportData?.transactions?.map(transaction => ({
    Date: formatDate(transaction.date),
    'Particulars': transaction.particulars,
    'Type': transaction.type,
    'Mode': transaction.mode,
    'Inflow': transaction.type === 'Inflow' ? transaction.amount.toFixed(2) : '0.00',
    'Outflow': transaction.type === 'Outflow' ? transaction.amount.toFixed(2) : '0.00',
    'Balance': transaction.balance.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-cashflow-report">
      <PageHeader
        title="Cashflow Report"
        subtitle="Track all cash inflows and outflows with running balance"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading cashflow report...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Opening Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.openingBalance)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Inflow</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalInflow)}</div>
              <div className="card-subtext">{reportData.summary.inflowCount} transactions</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Outflow</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalOutflow)}</div>
              <div className="card-subtext">{reportData.summary.outflowCount} transactions</div>
            </div>
            <div className="summary-card warning">
              <div className="card-label">Net Cashflow</div>
              <div className="card-value">{formatCurrency(reportData.summary.netCashflow)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Closing Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.closingBalance)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.transactions.length} transactions
              </div>
              <ExportButton data={exportData} filename="cashflow_report" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Particulars</th>
                    <th className="text-center">Type</th>
                    <th>Payment Mode</th>
                    <th className="text-right">Inflow</th>
                    <th className="text-right">Outflow</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No cashflow data available for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.transactions.map((transaction, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(transaction.date)}</td>
                        <td className="particulars-cell">{transaction.particulars}</td>
                        <td className="text-center">{getTransactionTypeBadge(transaction.type)}</td>
                        <td>{transaction.mode}</td>
                        <td className="text-right inflow-amount">
                          {transaction.type === 'Inflow' ? formatCurrency(transaction.amount) : '-'}
                        </td>
                        <td className="text-right outflow-amount">
                          {transaction.type === 'Outflow' ? formatCurrency(transaction.amount) : '-'}
                        </td>
                        <td className="text-right balance-amount">
                          {formatCurrency(transaction.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="4" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right inflow-amount">
                      <strong>{formatCurrency(reportData.summary.totalInflow)}</strong>
                    </td>
                    <td className="text-right outflow-amount">
                      <strong>{formatCurrency(reportData.summary.totalOutflow)}</strong>
                    </td>
                    <td className="text-right balance-amount">
                      <strong>{formatCurrency(reportData.summary.closingBalance)}</strong>
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

export default VyaparCashflowReport;

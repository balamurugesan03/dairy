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

const VyaparSaleReport = () => {
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
      const response = await reportAPI.vyaparSaleReport(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch sale report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Paid': 'status-badge paid',
      'Pending': 'status-badge pending',
      'Partial': 'status-badge partial'
    };
    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  const exportData = reportData?.records?.map(record => ({
    Date: formatDate(record.date),
    'Invoice No': record.invoiceNumber,
    'Party Name': record.partyName,
    'Items': record.itemCount,
    'Subtotal': record.subtotal.toFixed(2),
    'Tax': record.tax.toFixed(2),
    'Total': record.total.toFixed(2),
    'Paid': record.paid.toFixed(2),
    'Balance': record.balance.toFixed(2),
    'Status': record.paymentStatus
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Sale Report"
        subtitle="Detailed sales transaction report with payment status"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading sale report...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card success">
              <div className="card-label">Total Sales</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalSales)}</div>
              <div className="card-subtext">{reportData.summary.totalBills} bills</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Total Tax</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalTax)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Paid Amount</div>
              <div className="card-value">{formatCurrency(reportData.summary.paidAmount)}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Pending Amount</div>
              <div className="card-value">{formatCurrency(reportData.summary.pendingAmount)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.records.length} transactions
              </div>
              <ExportButton data={exportData} filename="sale_report" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No.</th>
                    <th>Party Name</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="no-data">
                        No sales data available for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((record, idx) => (
                      <tr
                        key={idx}
                        className="clickable-row"
                        onClick={() => navigate(`/sales/view/${record._id}`)}
                      >
                        <td>{formatDate(record.date)}</td>
                        <td className="invoice-number">{record.invoiceNumber}</td>
                        <td>{record.partyName}</td>
                        <td className="text-center">{record.itemCount}</td>
                        <td className="text-right">{formatCurrency(record.subtotal)}</td>
                        <td className="text-right">{formatCurrency(record.tax)}</td>
                        <td className="text-right amount-highlight">{formatCurrency(record.total)}</td>
                        <td className="text-right success-text">{formatCurrency(record.paid)}</td>
                        <td className="text-right danger-text">{formatCurrency(record.balance)}</td>
                        <td className="text-center">{getStatusBadge(record.paymentStatus)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="4" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right"><strong>{formatCurrency(reportData.records.reduce((sum, r) => sum + r.subtotal, 0))}</strong></td>
                    <td className="text-right"><strong>{formatCurrency(reportData.records.reduce((sum, r) => sum + r.tax, 0))}</strong></td>
                    <td className="text-right amount-highlight"><strong>{formatCurrency(reportData.records.reduce((sum, r) => sum + r.total, 0))}</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.records.reduce((sum, r) => sum + r.paid, 0))}</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.records.reduce((sum, r) => sum + r.balance, 0))}</strong></td>
                    <td></td>
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

export default VyaparSaleReport;

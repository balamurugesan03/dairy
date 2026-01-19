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

const VyaparBillWiseProfit = () => {
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
      const response = await reportAPI.vyaparBillProfit(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch bill-wise profit');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');
  const formatPercent = (value) => `${parseFloat(value || 0).toFixed(2)}%`;

  const getProfitBadge = (profit) => {
    if (profit > 0) {
      return <span className="status-badge paid">Profit</span>;
    } else if (profit < 0) {
      return <span className="status-badge pending">Loss</span>;
    }
    return <span className="status-badge">Break-even</span>;
  };

  const exportData = reportData?.bills?.map(bill => ({
    Date: formatDate(bill.date),
    'Invoice No': bill.invoiceNumber,
    'Party Name': bill.partyName,
    'Revenue': bill.revenue.toFixed(2),
    'Cost': bill.cost.toFixed(2),
    'Profit': bill.profit.toFixed(2),
    'Margin %': bill.profitMargin.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Bill Wise Profit"
        subtitle="Profit analysis for each bill/invoice"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading bill wise profit...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card success">
              <div className="card-label">Total Revenue</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalRevenue)}</div>
              <div className="card-subtext">{reportData.summary.totalBills} bills</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Cost</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalCost)}</div>
            </div>
            <div className={`summary-card ${reportData.summary.totalProfit >= 0 ? 'success' : 'danger'}`}>
              <div className="card-label">Total Profit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalProfit)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Avg Profit Margin</div>
              <div className="card-value">{formatPercent(reportData.summary.averageMargin)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.bills.length} bills
              </div>
              <ExportButton data={exportData} filename="bill_wise_profit" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No.</th>
                    <th>Party Name</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit/Loss</th>
                    <th className="text-right">Margin %</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.bills.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="no-data">
                        No bills found for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.bills.map((bill, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(bill.date)}</td>
                        <td className="invoice-number">{bill.invoiceNumber}</td>
                        <td>{bill.partyName}</td>
                        <td className="text-right success-text">{formatCurrency(bill.revenue)}</td>
                        <td className="text-right danger-text">{formatCurrency(bill.cost)}</td>
                        <td className={`text-right ${bill.profit >= 0 ? 'success-text' : 'danger-text'}`}>
                          {formatCurrency(bill.profit)}
                        </td>
                        <td className="text-right">{formatPercent(bill.profitMargin)}</td>
                        <td className="text-center">{getProfitBadge(bill.profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="3" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.summary.totalRevenue)}</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.summary.totalCost)}</strong></td>
                    <td className={`text-right ${reportData.summary.totalProfit >= 0 ? 'success-text' : 'danger-text'}`}>
                      <strong>{formatCurrency(reportData.summary.totalProfit)}</strong>
                    </td>
                    <td className="text-right"><strong>{formatPercent(reportData.summary.averageMargin)}</strong></td>
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

export default VyaparBillWiseProfit;

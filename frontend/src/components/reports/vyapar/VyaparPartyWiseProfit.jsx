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

const VyaparPartyWiseProfit = () => {
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
      const response = await reportAPI.vyaparPartyProfit(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch party-wise profit');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatPercent = (value) => `${parseFloat(value || 0).toFixed(2)}%`;

  const getProfitBadge = (profit) => {
    if (profit > 0) {
      return <span className="status-badge paid">Profit</span>;
    } else if (profit < 0) {
      return <span className="status-badge pending">Loss</span>;
    }
    return <span className="status-badge">Break-even</span>;
  };

  const exportData = reportData?.parties?.map(party => ({
    'Party Name': party.partyName,
    'Type': party.partyType,
    'Total Sales': party.totalSales.toFixed(2),
    'Total Cost': party.totalCost.toFixed(2),
    'Profit': party.profit.toFixed(2),
    'Margin %': party.profitMargin.toFixed(2),
    'Avg Order Value': party.averageOrderValue.toFixed(2),
    'Bill Count': party.billCount
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Party Wise Profit"
        subtitle="Profit analysis by customer/supplier"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading party wise profit...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Parties</div>
              <div className="card-value">{reportData.summary.totalParties}</div>
              <div className="card-subtext">{reportData.summary.totalBills} bills</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Revenue</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalRevenue)}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Cost</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalCost)}</div>
            </div>
            <div className={`summary-card ${reportData.summary.totalProfit >= 0 ? 'success' : 'danger'}`}>
              <div className="card-label">Total Profit</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalProfit)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.parties.length} parties
              </div>
              <ExportButton data={exportData} filename="party_wise_profit" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Party Name</th>
                    <th>Type</th>
                    <th className="text-right">Total Sales</th>
                    <th className="text-right">Total Cost</th>
                    <th className="text-right">Profit/Loss</th>
                    <th className="text-right">Margin %</th>
                    <th className="text-right">Avg Order Value</th>
                    <th className="text-center">Bill Count</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.parties.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">
                        No parties found for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.parties.map((party, idx) => (
                      <tr key={idx}>
                        <td className="party-name">{party.partyName}</td>
                        <td>
                          <span className={`status-badge ${party.partyType === 'Customer' ? 'info' : 'warning'}`}>
                            {party.partyType}
                          </span>
                        </td>
                        <td className="text-right success-text">{formatCurrency(party.totalSales)}</td>
                        <td className="text-right danger-text">{formatCurrency(party.totalCost)}</td>
                        <td className={`text-right ${party.profit >= 0 ? 'success-text' : 'danger-text'}`}>
                          {formatCurrency(party.profit)}
                        </td>
                        <td className="text-right">{formatPercent(party.profitMargin)}</td>
                        <td className="text-right">{formatCurrency(party.averageOrderValue)}</td>
                        <td className="text-center">{party.billCount}</td>
                        <td className="text-center">{getProfitBadge(party.profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="2" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.summary.totalRevenue)}</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.summary.totalCost)}</strong></td>
                    <td className={`text-right ${reportData.summary.totalProfit >= 0 ? 'success-text' : 'danger-text'}`}>
                      <strong>{formatCurrency(reportData.summary.totalProfit)}</strong>
                    </td>
                    <td colSpan="4"></td>
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

export default VyaparPartyWiseProfit;

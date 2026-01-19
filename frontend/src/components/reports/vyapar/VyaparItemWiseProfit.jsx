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

const VyaparItemWiseProfit = () => {
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
      const response = await reportAPI.vyaparItemProfit(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch item-wise profit');
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

  const exportData = reportData?.items?.map(item => ({
    'Item Name': item.itemName,
    'Category': item.category,
    'Quantity Sold': item.quantitySold,
    'Total Revenue': item.totalRevenue.toFixed(2),
    'Total Cost': item.totalCost.toFixed(2),
    'Profit': item.profit.toFixed(2),
    'Margin %': item.profitMargin.toFixed(2),
    'Avg Selling Price': item.averageSellingPrice.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Item Wise Profit"
        subtitle="Profit analysis by product/item"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading item wise profit...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Items</div>
              <div className="card-value">{reportData.summary.totalItems}</div>
              <div className="card-subtext">{reportData.summary.totalQuantitySold} units sold</div>
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
                Showing {reportData.items.length} items
              </div>
              <ExportButton data={exportData} filename="item_wise_profit" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-right">Quantity Sold</th>
                    <th className="text-right">Total Revenue</th>
                    <th className="text-right">Total Cost</th>
                    <th className="text-right">Profit/Loss</th>
                    <th className="text-right">Margin %</th>
                    <th className="text-right">Avg Price</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">
                        No items found for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="item-name">{item.itemName}</td>
                        <td>
                          <span className="status-badge info">{item.category}</span>
                        </td>
                        <td className="text-right">{item.quantitySold}</td>
                        <td className="text-right success-text">{formatCurrency(item.totalRevenue)}</td>
                        <td className="text-right danger-text">{formatCurrency(item.totalCost)}</td>
                        <td className={`text-right ${item.profit >= 0 ? 'success-text' : 'danger-text'}`}>
                          {formatCurrency(item.profit)}
                        </td>
                        <td className="text-right">{formatPercent(item.profitMargin)}</td>
                        <td className="text-right">{formatCurrency(item.averageSellingPrice)}</td>
                        <td className="text-center">{getProfitBadge(item.profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="2" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right"><strong>{reportData.summary.totalQuantitySold}</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.summary.totalRevenue)}</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.summary.totalCost)}</strong></td>
                    <td className={`text-right ${reportData.summary.totalProfit >= 0 ? 'success-text' : 'danger-text'}`}>
                      <strong>{formatCurrency(reportData.summary.totalProfit)}</strong>
                    </td>
                    <td colSpan="3"></td>
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

export default VyaparItemWiseProfit;

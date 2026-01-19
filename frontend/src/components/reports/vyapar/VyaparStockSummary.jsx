import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparStockSummary = () => {
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
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparStockSummary({});
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock summary');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const getStockStatusBadge = (currentBalance, reorderLevel) => {
    if (currentBalance === 0) {
      return <span className="status-badge pending">Out of Stock</span>;
    } else if (currentBalance <= reorderLevel) {
      return <span className="status-badge partial">Low Stock</span>;
    }
    return <span className="status-badge paid">In Stock</span>;
  };

  const exportData = (reportData?.items || []).map(item => ({
    'Item Name': item.itemName,
    'Category': item.category,
    'Current Balance': item.currentBalance,
    'Reorder Level': item.reorderLevel,
    'Unit Price': item.unitPrice.toFixed(2),
    'Stock Value': item.stockValue.toFixed(2),
    'Status': item.currentBalance === 0 ? 'Out of Stock' : item.currentBalance <= item.reorderLevel ? 'Low Stock' : 'In Stock'
  }));

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Stock Summary"
        subtitle="Current inventory levels and stock values"
      />

      {loading && (
        <div className="loading-message">Loading stock summary...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Items</div>
              <div className="card-value">{reportData?.summary?.totalItems || 0}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">In Stock</div>
              <div className="card-value">{reportData?.summary?.inStock || 0}</div>
            </div>
            <div className="summary-card partial">
              <div className="card-label">Low Stock</div>
              <div className="card-value">{reportData?.summary?.lowStock || 0}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Stock Value</div>
              <div className="card-value">{formatCurrency(reportData?.summary?.totalValue)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData?.items?.length || 0} items
              </div>
              <ExportButton data={exportData} filename="stock_summary" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-right">Current Balance</th>
                    <th className="text-right">Reorder Level</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Stock Value</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(!reportData?.items || reportData.items.length === 0) ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No items found
                      </td>
                    </tr>
                  ) : (
                    reportData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="item-name">{item.itemName}</td>
                        <td>
                          <span className="status-badge info">{item.category}</span>
                        </td>
                        <td className="text-right">{item.currentBalance}</td>
                        <td className="text-right">{item.reorderLevel}</td>
                        <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right success-text">{formatCurrency(item.stockValue)}</td>
                        <td className="text-center">{getStockStatusBadge(item.currentBalance, item.reorderLevel)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="5" className="text-right"><strong>Total Stock Value:</strong></td>
                    <td className="text-right success-text">
                      <strong>{formatCurrency(reportData?.summary?.totalValue)}</strong>
                    </td>
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

export default VyaparStockSummary;

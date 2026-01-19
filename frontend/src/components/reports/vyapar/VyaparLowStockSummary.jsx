import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparLowStockSummary = () => {
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
      const response = await reportAPI.vyaparLowStockSummary();
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch low stock report');
    } finally {
      setLoading(false);
    }
  };

  const exportData = reportData?.items?.map(item => ({
    'Item Name': item.itemName,
    'Category': item.category,
    'Current Stock': item.currentStock,
    'Minimum Stock': item.minStock,
    'Unit': item.unit,
    'Value': item.stockValue.toFixed(2),
    'Status': item.status
  })) || [];

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Critical': 'status-badge danger',
      'Low': 'status-badge warning',
      'Out of Stock': 'status-badge danger'
    };
    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Low Stock Summary"
        subtitle="Items with stock below minimum level"
      />

      {loading && (
        <div className="loading-message">Loading low stock report...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card danger">
              <div className="card-label">Critical Items</div>
              <div className="card-value">{reportData.summary?.criticalItems || 0}</div>
              <div className="card-subtext">Stock below 25%</div>
            </div>
            <div className="summary-card warning">
              <div className="card-label">Low Stock Items</div>
              <div className="card-value">{reportData.summary?.lowStockItems || 0}</div>
              <div className="card-subtext">Stock below minimum</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Out of Stock</div>
              <div className="card-value">{reportData.summary?.outOfStock || 0}</div>
              <div className="card-subtext">Zero quantity</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Total Value</div>
              <div className="card-value">₹{parseFloat(reportData.summary?.totalValue || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.items?.length || 0} items
              </div>
              <ExportButton data={exportData} filename="low_stock_summary" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-right">Current Stock</th>
                    <th className="text-right">Min Stock</th>
                    <th>Unit</th>
                    <th className="text-right">Stock Value</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!reportData.items || reportData.items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No low stock items found
                      </td>
                    </tr>
                  ) : (
                    reportData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.itemName}</td>
                        <td>{item.category}</td>
                        <td className="text-right">{item.currentStock}</td>
                        <td className="text-right">{item.minStock}</td>
                        <td>{item.unit}</td>
                        <td className="text-right">₹{parseFloat(item.stockValue || 0).toFixed(2)}</td>
                        <td className="text-center">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VyaparLowStockSummary;

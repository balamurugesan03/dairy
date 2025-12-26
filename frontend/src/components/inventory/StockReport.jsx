import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './StockReport.css';

const StockReport = () => {
  const navigate = useNavigate();
  const [stockBalance, setStockBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0
  });

  useEffect(() => {
    fetchStockBalance();
  }, []);

  const fetchStockBalance = async () => {
    setLoading(true);
    try {
      const response = await stockAPI.getBalance();
      const data = response.data || [];
      setStockBalance(data);

      const totalItems = data.length;
      const totalValue = data.reduce((sum, item) => sum + (item.currentBalance * item.salesRate), 0);
      const lowStock = data.filter(item => item.currentBalance < 10).length;

      setStats({ totalItems, totalValue, lowStock });
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock balance');
    } finally {
      setLoading(false);
    }
  };

  const getBalanceClass = (balance) => {
    if (balance < 10) return 'tag-red';
    if (balance < 50) return 'tag-orange';
    return 'tag-green';
  };

  const getStatusText = (balance) => {
    if (balance < 10) return 'Low Stock';
    if (balance < 50) return 'Moderate';
    return 'Good';
  };

  const getStatusClass = (balance) => {
    if (balance < 10) return 'tag-error';
    if (balance < 50) return 'tag-warning';
    return 'tag-success';
  };

  const exportData = stockBalance.map(item => ({
    'Item Code': item.itemCode,
    'Item Name': item.itemName,
    'Category': item.category,
    'Unit': item.unit,
    'Current Balance': item.currentBalance,
    'Purchase Rate': item.purchaseRate,
    'Sales Rate': item.salesRate,
    'Stock Value': (item.currentBalance * item.salesRate).toFixed(2)
  }));

  return (
    <div className="stock-report">
      <PageHeader
        title="Stock Report"
        subtitle="View current inventory stock levels"
        extra={
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/inventory/stock-in')}
            >
              + Stock In
            </button>
            <button
              className="btn btn-danger"
              onClick={() => navigate('/inventory/stock-out')}
            >
              - Stock Out
            </button>
            <button
              className="btn btn-default"
              onClick={fetchStockBalance}
            >
              ↻ Refresh
            </button>
            <ExportButton
              data={exportData}
              filename="stock_report"
              buttonText="Export"
            />
          </div>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Items</div>
          <div className="stat-value stat-blue">{stats.totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Stock Value</div>
          <div className="stat-value stat-green">₹{stats.totalValue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Low Stock Items</div>
          <div className={`stat-value ${stats.lowStock > 0 ? 'stat-red' : 'stat-green'}`}>
            {stats.lowStock}
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Current Balance</th>
                <th>Purchase Rate</th>
                <th>Sales Rate</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stockBalance.map((item) => (
                <tr key={item._id}>
                  <td>{item.itemCode}</td>
                  <td>{item.itemName}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>
                    <span className={`tag ${getBalanceClass(item.currentBalance)}`}>
                      {item.currentBalance} {item.unit}
                    </span>
                  </td>
                  <td>₹{item.purchaseRate?.toFixed(2) || 0}</td>
                  <td>₹{item.salesRate?.toFixed(2) || 0}</td>
                  <td>₹{(item.currentBalance * item.salesRate).toFixed(2)}</td>
                  <td>
                    <span className={`tag ${getStatusClass(item.currentBalance)}`}>
                      {getStatusText(item.currentBalance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && stockBalance.length === 0 && (
          <div className="empty-state">No stock data available</div>
        )}
      </div>
    </div>
  );
};

export default StockReport;

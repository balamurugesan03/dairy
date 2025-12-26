import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './SalesList.css';


const SalesList = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: null,
    status: ''
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await salesAPI.getAll();
      setSales(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Sale',
      content: 'Are you sure you want to delete this sale? This will reverse the stock.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await salesAPI.delete(id);
          message.success('Sale deleted successfully');
          fetchSales();
        } catch (error) {
          message.error(error.message || 'Failed to delete sale');
        }
      }
    });
  };

  const getStatusClass = (status) => {
    if (status === 'Paid') return 'status-paid';
    if (status === 'Partial') return 'status-partial';
    if (status === 'Pending') return 'status-pending';
    return 'status-default';
  };

  const getCustomerTypeClass = (type) => {
    return type === 'Farmer' ? 'type-farmer' : 'type-retailer';
  };

  const filteredSales = sales.filter(sale => {
    if (filters.status && sale.status !== filters.status) return false;
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      if (startDate && endDate) {
        const saleDate = dayjs(sale.billDate);
        if (saleDate.isBefore(startDate, 'day') || saleDate.isAfter(endDate, 'day')) {
          return false;
        }
      }
    }
    return true;
  });

  const exportData = filteredSales.map(sale => ({
    'Bill No': sale.billNumber,
    'Bill Date': dayjs(sale.billDate).format('DD-MM-YYYY'),
    'Customer': sale.customerName,
    'Phone': sale.customerPhone,
    'Customer Type': sale.customerType,
    'Grand Total': sale.grandTotal,
    'Paid Amount': sale.paidAmount,
    'Balance': sale.balanceAmount,
    'Payment Mode': sale.paymentMode,
    'Status': sale.status
  }));

  return (
    <div className="sales-list-container">
      <PageHeader
        title="Sales Management"
        subtitle="View and manage sales bills"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/sales/create')}
          >
            + Create Bill
          </button>,
          <ExportButton
            key="export"
            data={exportData}
            filename="sales_report"
            buttonText="Export"
          />
        ]}
      />

      <div className="filters-container">
        <div className="date-range-filter">
          <label>Start Date:</label>
          <input
            type="date"
            value={filters.dateRange?.[0] ? dayjs(filters.dateRange[0]).format('YYYY-MM-DD') : ''}
            onChange={(e) => {
              const startDate = e.target.value ? dayjs(e.target.value) : null;
              setFilters(prev => ({
                ...prev,
                dateRange: [startDate, prev.dateRange?.[1] || null]
              }));
            }}
          />
          <label>End Date:</label>
          <input
            type="date"
            value={filters.dateRange?.[1] ? dayjs(filters.dateRange[1]).format('YYYY-MM-DD') : ''}
            onChange={(e) => {
              const endDate = e.target.value ? dayjs(e.target.value) : null;
              setFilters(prev => ({
                ...prev,
                dateRange: [prev.dateRange?.[0] || null, endDate]
              }));
            }}
          />
        </div>
        <select
          className="status-filter"
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
        >
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Bill Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Customer Type</th>
                <th>Grand Total</th>
                <th>Paid Amount</th>
                <th>Balance</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">No sales found</td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.billNumber}</td>
                    <td>{dayjs(sale.billDate).format('DD-MM-YYYY')}</td>
                    <td>{sale.customerName}</td>
                    <td>{sale.customerPhone}</td>
                    <td>
                      <span className={`tag ${getCustomerTypeClass(sale.customerType)}`}>
                        {sale.customerType}
                      </span>
                    </td>
                    <td>₹{sale.grandTotal?.toFixed(2) || 0}</td>
                    <td>₹{sale.paidAmount?.toFixed(2) || 0}</td>
                    <td>
                      <span style={{ color: sale.balanceAmount > 0 ? 'red' : 'green' }}>
                        ₹{sale.balanceAmount?.toFixed(2) || 0}
                      </span>
                    </td>
                    <td>{sale.paymentMode}</td>
                    <td>
                      <span className={`tag ${getStatusClass(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-link"
                          onClick={() => navigate(`/sales/view/${sale._id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-link btn-danger"
                          onClick={() => handleDelete(sale._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SalesList;

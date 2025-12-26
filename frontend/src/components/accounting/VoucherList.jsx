import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { voucherAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './VoucherList.css';


const VoucherList = () => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: null,
    voucherType: ''
  });

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await voucherAPI.getAll();
      setVouchers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Voucher',
      content: 'Are you sure you want to delete this voucher?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await voucherAPI.delete(id);
          message.success('Voucher deleted successfully');
          fetchVouchers();
        } catch (error) {
          message.error(error.message || 'Failed to delete voucher');
        }
      }
    });
  };

  const getTypeClass = (type) => {
    if (type === 'Receipt') return 'tag-success';
    else if (type === 'Payment') return 'tag-danger';
    else if (type === 'Journal') return 'tag-info';
    return 'tag-default';
  };

  const filteredVouchers = vouchers.filter(voucher => {
    if (filters.voucherType && voucher.voucherType !== filters.voucherType) return false;
    if (filters.dateRange && filters.dateRange.length === 2) {
      const voucherDate = dayjs(voucher.voucherDate);
      if (voucherDate.isBefore(filters.dateRange[0], 'day') || voucherDate.isAfter(filters.dateRange[1], 'day')) {
        return false;
      }
    }
    return true;
  });

  const exportData = filteredVouchers.map(voucher => ({
    'Voucher No': voucher.voucherNumber,
    'Date': dayjs(voucher.voucherDate).format('DD-MM-YYYY'),
    'Type': voucher.voucherType,
    'Total Debit': voucher.totalDebit,
    'Total Credit': voucher.totalCredit,
    'Reference': voucher.referenceType
  }));

  return (
    <div className="voucher-list-container">
      <PageHeader
        title="Voucher Management"
        subtitle="View and manage accounting vouchers"
        extra={[
          <button
            key="receipt"
            className="btn btn-primary"
            onClick={() => navigate('/accounting/vouchers/receipt')}
          >
            Receipt Voucher
          </button>,
          <button
            key="payment"
            className="btn btn-danger"
            onClick={() => navigate('/accounting/vouchers/payment')}
          >
            Payment Voucher
          </button>,
          <button
            key="journal"
            className="btn btn-default"
            onClick={() => navigate('/accounting/vouchers/journal')}
          >
            Journal Voucher
          </button>,
          <ExportButton
            key="export"
            data={exportData}
            filename="vouchers_report"
            buttonText="Export"
          />
        ]}
      />

      <div className="filters-container">
        <div className="filter-group">
          <label>Date Range:</label>
          <input
            type="date"
            className="date-input"
            placeholder="Start Date"
            onChange={(e) => {
              const startDate = e.target.value ? dayjs(e.target.value) : null;
              setFilters(prev => ({
                ...prev,
                dateRange: startDate ? [startDate, prev.dateRange?.[1]] : null
              }));
            }}
          />
          <span className="date-separator">to</span>
          <input
            type="date"
            className="date-input"
            placeholder="End Date"
            onChange={(e) => {
              const endDate = e.target.value ? dayjs(e.target.value) : null;
              setFilters(prev => ({
                ...prev,
                dateRange: endDate ? [prev.dateRange?.[0], endDate] : null
              }));
            }}
          />
        </div>
        <div className="filter-group">
          <label>Type:</label>
          <select
            className="select-input"
            value={filters.voucherType}
            onChange={(e) => setFilters(prev => ({ ...prev, voucherType: e.target.value }))}
          >
            <option value="">All Types</option>
            <option value="Receipt">Receipt</option>
            <option value="Payment">Payment</option>
            <option value="Journal">Journal</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="voucher-table">
            <thead>
              <tr>
                <th>Voucher No.</th>
                <th>Date</th>
                <th>Type</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">No vouchers found</td>
                </tr>
              ) : (
                filteredVouchers.map(voucher => (
                  <tr key={voucher._id}>
                    <td>{voucher.voucherNumber}</td>
                    <td>{dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</td>
                    <td>
                      <span className={`tag ${getTypeClass(voucher.voucherType)}`}>
                        {voucher.voucherType}
                      </span>
                    </td>
                    <td>₹{voucher.totalDebit?.toFixed(2) || '0.00'}</td>
                    <td>₹{voucher.totalCredit?.toFixed(2) || '0.00'}</td>
                    <td>{voucher.referenceType || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-link btn-view"
                          onClick={() => navigate(`/accounting/vouchers/view/${voucher._id}`)}
                          title="View"
                        >
                          👁 View
                        </button>
                        {voucher.referenceType === 'Manual' && (
                          <button
                            className="btn-link btn-delete"
                            onClick={() => handleDelete(voucher._id)}
                            title="Delete"
                          >
                            🗑 Delete
                          </button>
                        )}
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

export default VoucherList;

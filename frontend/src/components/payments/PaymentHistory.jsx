import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { paymentAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './PaymentHistory.css';

const PaymentHistory = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentAPI.getAll();
      setPayments(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (startDate && endDate) {
      const paymentDate = dayjs(payment.createdAt);
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      if (paymentDate.isBefore(start, 'day') || paymentDate.isAfter(end, 'day')) {
        return false;
      }
    }
    return true;
  });

  const exportData = filteredPayments.map(payment => ({
    'Date': dayjs(payment.createdAt).format('DD-MM-YYYY'),
    'Farmer': payment.farmerId?.personalDetails?.name || '-',
    'Milk Amount': payment.milkAmount,
    'Advance': payment.advanceAmount,
    'Deductions': payment.totalDeduction,
    'Net Payable': payment.netPayable,
    'Paid': payment.paidAmount,
    'Payment Mode': payment.paymentMode,
    'Status': payment.status
  }));

  return (
    <div className="payment-history-container">
      <PageHeader
        title="Payment History"
        subtitle="View farmer payment history"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/payments/milk')}
          >
            <span className="btn-icon">+</span> New Payment
          </button>,
          <ExportButton
            key="export"
            data={exportData}
            filename="payment_history"
            buttonText="Export"
          />
        ]}
      />

      <div className="filter-container">
        <div className="date-range-filter">
          <label>From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="date-input"
          />
          <label>To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="date-input"
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <table className="payment-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Farmer</th>
                <th>Milk Amount</th>
                <th>Advance</th>
                <th>Deductions</th>
                <th>Net Payable</th>
                <th>Paid</th>
                <th>Payment Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{dayjs(payment.createdAt).format('DD-MM-YYYY')}</td>
                    <td>{payment.farmerId?.personalDetails?.name || '-'}</td>
                    <td>₹{payment.milkAmount?.toFixed(2) || 0}</td>
                    <td>₹{payment.advanceAmount?.toFixed(2) || 0}</td>
                    <td>₹{payment.totalDeduction?.toFixed(2) || 0}</td>
                    <td>₹{payment.netPayable?.toFixed(2) || 0}</td>
                    <td>₹{payment.paidAmount?.toFixed(2) || 0}</td>
                    <td>{payment.paymentMode}</td>
                    <td>
                      <span className={`status-badge ${payment.status === 'Paid' ? 'status-success' : 'status-warning'}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="no-data">No payment records found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;

import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './SalesReportView.css';

const SalesReportView = () => {
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalAmount: 0,
    totalTax: 0,
    netAmount: 0
  });
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  useEffect(() => {
    fetchSalesReport();
  }, []);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(startDate).toISOString(),
        endDate: dayjs(endDate).toISOString()
      };
      const response = await reportAPI.sales(params);

      setSalesData(response.data.sales || []);

      // Calculate summary
      const totalSales = response.data.sales?.length || 0;
      const totalAmount = response.data.sales?.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0) || 0;
      const totalTax = response.data.sales?.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0) || 0;
      const netAmount = response.data.sales?.reduce((sum, sale) => sum + (sale.netAmount || 0), 0) || 0;

      setSummary({
        totalSales,
        totalAmount,
        totalTax,
        netAmount
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  };

  const exportData = salesData.map(sale => ({
    'Bill No': sale.billNumber,
    'Date': dayjs(sale.date).format('DD/MM/YYYY'),
    'Customer': sale.customer?.name || sale.customerName || '-',
    'Items': sale.items?.length || 0,
    'Subtotal': (sale.subtotal || 0).toFixed(2),
    'Tax Amount': (sale.taxAmount || 0).toFixed(2),
    'Discount': (sale.discount || 0).toFixed(2),
    'Total Amount': (sale.totalAmount || 0).toFixed(2)
  }));

  return (
    <div className="sales-report-view">
      <PageHeader
        title="Sales Report"
        subtitle="View and analyze sales transactions"
      />

      <div className="summary-cards">
        <div className="stat-card">
          <div className="stat-title">Total Sales</div>
          <div className="stat-value">#{summary.totalSales}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Amount</div>
          <div className="stat-value">₹{summary.totalAmount.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Tax</div>
          <div className="stat-value">₹{summary.totalTax.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Net Amount</div>
          <div className="stat-value">₹{summary.netAmount.toFixed(2)}</div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-controls">
          <div className="date-inputs">
            <label>
              From:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              To:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchSalesReport}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <ExportButton
            data={exportData}
            filename="sales_report"
            buttonText="Export to Excel"
          />
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Tax Amount</th>
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.billNumber}</td>
                    <td>{dayjs(sale.date).format('DD/MM/YYYY')}</td>
                    <td>{sale.customer?.name || sale.customerName || '-'}</td>
                    <td>{sale.items?.length || 0}</td>
                    <td style={{ textAlign: 'right' }}>₹{(sale.subtotal || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₹{(sale.taxAmount || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₹{(sale.discount || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₹{(sale.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{salesData.reduce((sum, sale) => sum + (sale.subtotal || 0), 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{salesData.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{salesData.reduce((sum, sale) => sum + (sale.discount || 0), 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{salesData.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesReportView;

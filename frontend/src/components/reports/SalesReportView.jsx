import { useState, useEffect, useRef, useMemo } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { SegmentedControl } from '@mantine/core';
import './SalesReportView.css';

const fmt = (n) => parseFloat(n || 0).toFixed(2);

const SalesReportView = () => {
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [viewMode, setViewMode] = useState('invoice'); // 'invoice' | 'farmer'
  const printRef = useRef(null);

  const toggleRow = (id) => setExpandedRows(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate,   setEndDate]   = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  useEffect(() => { fetchSalesReport(); }, []);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(startDate).toISOString(),
        endDate:   dayjs(endDate).toISOString(),
      };
      const response = await reportAPI.sales(params);
      setSalesData(response.data.sales || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  };

  // Sale-amount = grandTotal only (excludes oldBalance / CF advance carry-over)
  const saleAmount = (s) => parseFloat(s.grandTotal || 0);
  const customerNameOf = (s) =>
    s.customerId?.personalDetails?.name ||
    s.customer?.name ||
    s.customerName ||
    '-';

  const summary = useMemo(() => {
    const totalAmount = salesData.reduce((acc, s) => acc + saleAmount(s), 0);
    const totalGst    = salesData.reduce((acc, s) => acc + parseFloat(s.totalGst || 0), 0);
    const totalDisc   = salesData.reduce((acc, s) => acc + parseFloat(s.promotionDiscount || s.discount || 0), 0);
    const totalSub    = salesData.reduce((acc, s) => acc + parseFloat(s.subtotal || 0), 0);
    return {
      totalSales:  salesData.length,
      totalAmount,
      totalTax:    totalGst,
      totalDisc,
      totalSub,
      netAmount:   totalAmount,
    };
  }, [salesData]);

  // Farmer-wise grouping
  const farmerGroups = useMemo(() => {
    const map = new Map();
    salesData.forEach(s => {
      const key = customerNameOf(s);
      if (!map.has(key)) map.set(key, { customer: key, count: 0, subtotal: 0, totalGst: 0, discount: 0, totalAmount: 0, sales: [] });
      const g = map.get(key);
      g.count++;
      g.subtotal    += parseFloat(s.subtotal || 0);
      g.totalGst    += parseFloat(s.totalGst || 0);
      g.discount    += parseFloat(s.promotionDiscount || s.discount || 0);
      g.totalAmount += saleAmount(s);
      g.sales.push(s);
    });
    return Array.from(map.values()).sort((a, b) => a.customer.localeCompare(b.customer));
  }, [salesData]);

  const exportData = useMemo(() => {
    if (viewMode === 'farmer') {
      return farmerGroups.map(g => ({
        Customer:  g.customer,
        Invoices:  g.count,
        Subtotal:  fmt(g.subtotal),
        'Tax':     fmt(g.totalGst),
        Discount:  fmt(g.discount),
        'Total':   fmt(g.totalAmount),
      }));
    }
    return salesData.map(sale => ({
      'Bill No':  sale.billNumber,
      Date:       dayjs(sale.billDate || sale.date).format('DD/MM/YYYY'),
      Customer:   customerNameOf(sale),
      Items:      sale.items?.length || 0,
      Subtotal:   fmt(sale.subtotal),
      'Tax':      fmt(sale.totalGst),
      Discount:   fmt(sale.promotionDiscount || sale.discount),
      'Total':    fmt(saleAmount(sale)),
    }));
  }, [salesData, farmerGroups, viewMode]);

  const handlePrint = () => {
    printReport(printRef, {
      title: viewMode === 'farmer' ? 'Sales Report — Farmer Wise' : 'Sales Report',
      orientation: 'portrait',
    });
  };

  return (
    <div className="sales-report-view" ref={printRef}>
      <PageHeader
        title="Sales Report"
        subtitle="View and analyze sales transactions"
      />

      <div className="summary-cards" data-no-print>
        <div className="stat-card">
          <div className="stat-title">Total Sales</div>
          <div className="stat-value">#{summary.totalSales}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Amount</div>
          <div className="stat-value">₹{fmt(summary.totalAmount)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Tax</div>
          <div className="stat-value">₹{fmt(summary.totalTax)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Net Amount</div>
          <div className="stat-value">₹{fmt(summary.netAmount)}</div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-controls" data-no-print>
          <div className="date-inputs">
            <label>
              From:
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              To:
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            size="sm"
            data={[
              { value: 'invoice', label: 'Invoice Wise' },
              { value: 'farmer',  label: 'Farmer Wise' },
            ]}
          />

          <button className="btn btn-primary" onClick={fetchSalesReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <ExportButton
            data={exportData}
            filename={viewMode === 'farmer' ? 'sales_report_farmer_wise' : 'sales_report'}
            buttonText="Export to Excel"
          />
          <button className="btn btn-primary" onClick={handlePrint} disabled={loading || !salesData.length}>
            Print A4 Portrait
          </button>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : viewMode === 'farmer' ? (
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {farmerGroups.map((g) => (
                  <tr key={g.customer}>
                    <td>{g.customer}</td>
                    <td style={{ textAlign: 'right' }}>{g.count}</td>
                    <td style={{ textAlign: 'right' }}>₹{fmt(g.subtotal)}</td>
                    <td style={{ textAlign: 'right' }}>₹{fmt(g.totalGst)}</td>
                    <td style={{ textAlign: 'right' }}>₹{fmt(g.discount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{fmt(g.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Total ({farmerGroups.length} customers):</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{summary.totalSales}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalSub)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalTax)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalDisc)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((sale) => (
                  <>
                    <tr
                      key={sale._id}
                      onClick={() => toggleRow(sale._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{sale.billNumber}</td>
                      <td>{dayjs(sale.billDate || sale.date).format('DD/MM/YYYY')}</td>
                      <td>{customerNameOf(sale)}</td>
                      <td style={{ userSelect: 'none' }}>
                        {expandedRows.has(sale._id) ? '▼' : '▶'} {sale.items?.length || 0}
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{fmt(sale.subtotal)}</td>
                      <td style={{ textAlign: 'right' }}>₹{fmt(sale.totalGst)}</td>
                      <td style={{ textAlign: 'right' }}>₹{fmt(sale.promotionDiscount || sale.discount)}</td>
                      <td style={{ textAlign: 'right' }}>₹{fmt(saleAmount(sale))}</td>
                    </tr>
                    {expandedRows.has(sale._id) && (
                      <tr key={`${sale._id}-items`} style={{ background: '#f8f9fa' }}>
                        <td colSpan={8} style={{ padding: '0 16px 12px 32px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#e9ecef' }}>
                                <th style={{ padding: '6px 10px', textAlign: 'left',  fontWeight: 600 }}>#</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left',  fontWeight: 600 }}>Item Name</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Qty</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left',  fontWeight: 600 }}>Unit</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Rate</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(sale.items || []).map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                  <td style={{ padding: '5px 10px' }}>{idx + 1}</td>
                                  <td style={{ padding: '5px 10px' }}>{item.itemName || item.item?.name || '-'}</td>
                                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>{item.quantity ?? item.qty ?? 0}</td>
                                  <td style={{ padding: '5px 10px' }}>{item.unit || '-'}</td>
                                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>₹{fmt(item.rate)}</td>
                                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>₹{fmt(item.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalSub)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalTax)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalDisc)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(summary.totalAmount)}</td>
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

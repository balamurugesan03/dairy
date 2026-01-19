import { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './InventoryPurchaseRegister.css';

const InventoryPurchaseRegister = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [organizationName, setOrganizationName] = useState('DAIRY COOPERATIVE SOCIETY');

  const fetchReport = async (filterData) => {
    if (!filterData?.startDate || !filterData?.endDate) {
      message.error('Please select a date range');
      return;
    }

    setLoading(true);
    setDateRange(filterData);

    try {
      const params = {
        startDate: filterData.startDate,
        endDate: filterData.endDate
      };

      const response = await reportAPI.inventoryPurchaseRegister(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch inventory purchase register');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD-MM-YYYY');
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toFixed(2);
  };

  const formatInvoice = (invNo, invDate) => {
    if (!invNo) return '-';
    const formattedDate = invDate ? dayjs(invDate).format('DD-MM-YYYY') : '';
    return formattedDate ? `${invNo} - ${formattedDate}` : invNo;
  };

  // Calculate derived values
  const calculateNetAmount = (purchAmount, earnings, recovery) => {
    const purch = parseFloat(purchAmount || 0);
    const earn = parseFloat(earnings || 0);
    const recov = parseFloat(recovery || 0);
    return (purch - earn - recov).toFixed(2);
  };

  const calculateTotalQty = (qty, freeQty) => {
    const q = parseFloat(qty || 0);
    const fq = parseFloat(freeQty || 0);
    return (q + fq).toFixed(2);
  };

  const calculateAmount = (totalQty, rate) => {
    const tq = parseFloat(totalQty || 0);
    const r = parseFloat(rate || 0);
    return (tq * r).toFixed(2);
  };

  // Calculate grand totals
  const calculateGrandTotals = (rows) => {
    if (!rows || rows.length === 0) return null;

    return rows.reduce((totals, row) => {
      const totalQty = parseFloat(row.qty || 0) + parseFloat(row.freeQty || 0);
      return {
        purchAmount: totals.purchAmount + parseFloat(row.purchAmount || 0),
        earnings: totals.earnings + parseFloat(row.earnings || 0),
        recovery: totals.recovery + parseFloat(row.recovery || 0),
        netAmount: totals.netAmount + (parseFloat(row.purchAmount || 0) - parseFloat(row.earnings || 0) - parseFloat(row.recovery || 0)),
        qty: totals.qty + parseFloat(row.qty || 0),
        freeQty: totals.freeQty + parseFloat(row.freeQty || 0),
        totalQty: totals.totalQty + totalQty,
        amount: totals.amount + (totalQty * parseFloat(row.rate || 0))
      };
    }, {
      purchAmount: 0,
      earnings: 0,
      recovery: 0,
      netAmount: 0,
      qty: 0,
      freeQty: 0,
      totalQty: 0,
      amount: 0
    });
  };

  // Prepare export data
  const exportData = reportData?.rows?.map(row => {
    const totalQty = calculateTotalQty(row.qty, row.freeQty);
    return {
      'Date': formatDate(row.date),
      'Inv. No. & Date': formatInvoice(row.invoiceNo, row.invoiceDate),
      'Supplier': row.supplier || '-',
      'Purch. Amnt': formatNumber(row.purchAmount),
      'Earnings': formatNumber(row.earnings),
      'Recovery': formatNumber(row.recovery),
      'Net Amnt': calculateNetAmount(row.purchAmount, row.earnings, row.recovery),
      'Product': row.product || '-',
      'Qty': formatNumber(row.qty),
      'Free Qty': formatNumber(row.freeQty),
      'Total Qty': totalQty,
      'Rate': formatNumber(row.rate),
      'Amount': calculateAmount(totalQty, row.rate)
    };
  }) || [];

  const grandTotals = reportData?.rows ? calculateGrandTotals(reportData.rows) : null;

  // Get financial year string
  const getFinancialYear = () => {
    if (!dateRange?.startDate) return '';
    const start = dayjs(dateRange.startDate);
    const year = start.month() >= 3 ? start.year() : start.year() - 1;
    return `${year}-${(year + 1).toString().slice(2)}`;
  };

  return (
    <div className="purchase-register-container">
      <PageHeader
        title="Inventory Purchase Register"
        subtitle="Checklist Format - Audit Ready"
      />

      {/* Organization Name Input */}
      <div className="org-name-section no-print">
        <label>Organization Name:</label>
        <input
          type="text"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="Enter Society / Unit Name"
          className="org-name-input"
        />
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading inventory purchase register...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Report Header */}
          <div className="report-table-container">
            <div className="print-header">
              <h2>INVENTORY PURCHASE REGISTER CHECK LIST</h2>
              <p className="period-line">
                FOR THE PERIOD OF {formatDate(dateRange?.startDate)} TO {formatDate(dateRange?.endDate)}
              </p>
              <p className="org-name">{organizationName}</p>
              <p className="financial-year">Financial Year: {getFinancialYear()}</p>
            </div>

            {/* Purchase Register Table */}
            <table className="purchase-register-table">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-invoice">Inv. No. & Date</th>
                  <th className="col-supplier">Supplier</th>
                  <th className="col-amount">Purch. Amnt</th>
                  <th className="col-amount">Earnings</th>
                  <th className="col-amount">Recovery</th>
                  <th className="col-amount">Net Amnt</th>
                  <th className="col-product">Product</th>
                  <th className="col-qty">Qty</th>
                  <th className="col-qty">Free Qty</th>
                  <th className="col-qty">Total Qty</th>
                  <th className="col-rate">Rate</th>
                  <th className="col-amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, idx) => {
                  const totalQty = calculateTotalQty(row.qty, row.freeQty);
                  return (
                    <tr key={idx}>
                      <td className="col-date">{formatDate(row.date)}</td>
                      <td className="col-invoice">{formatInvoice(row.invoiceNo, row.invoiceDate)}</td>
                      <td className="col-supplier">{row.supplier || '-'}</td>
                      <td className="col-amount">{formatNumber(row.purchAmount)}</td>
                      <td className="col-amount">{formatNumber(row.earnings)}</td>
                      <td className="col-amount">{formatNumber(row.recovery)}</td>
                      <td className="col-amount">{calculateNetAmount(row.purchAmount, row.earnings, row.recovery)}</td>
                      <td className="col-product">{row.product || '-'}</td>
                      <td className="col-qty">{formatNumber(row.qty)}</td>
                      <td className="col-qty">{formatNumber(row.freeQty)}</td>
                      <td className="col-qty">{totalQty}</td>
                      <td className="col-rate">{formatNumber(row.rate)}</td>
                      <td className="col-amount">{calculateAmount(totalQty, row.rate)}</td>
                    </tr>
                  );
                })}

                {/* Grand Total Row */}
                {grandTotals && (
                  <tr className="grand-total-row">
                    <td colSpan="3" className="col-total-label">
                      <strong>G Total</strong>
                    </td>
                    <td className="col-amount">
                      <strong>{formatNumber(grandTotals.purchAmount)}</strong>
                    </td>
                    <td className="col-amount">
                      <strong>{formatNumber(grandTotals.earnings)}</strong>
                    </td>
                    <td className="col-amount">
                      <strong>{formatNumber(grandTotals.recovery)}</strong>
                    </td>
                    <td className="col-amount">
                      <strong>{formatNumber(grandTotals.netAmount)}</strong>
                    </td>
                    <td className="col-product"></td>
                    <td className="col-qty">
                      <strong>{formatNumber(grandTotals.qty)}</strong>
                    </td>
                    <td className="col-qty">
                      <strong>{formatNumber(grandTotals.freeQty)}</strong>
                    </td>
                    <td className="col-qty">
                      <strong>{formatNumber(grandTotals.totalQty)}</strong>
                    </td>
                    <td className="col-rate"></td>
                    <td className="col-amount">
                      <strong>{formatNumber(grandTotals.amount)}</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Footer Notes */}
            <div className="report-footer">
              <div className="calculation-notes">
                <p><strong>Calculation Rules:</strong></p>
                <p>Net Amnt = Purch. Amnt − Earnings − Recovery</p>
                <p>Total Qty = Qty + Free Qty</p>
                <p>Amount = Total Qty × Rate</p>
              </div>
              <div className="verification-section">
                <div className="signature-line">
                  <span>Prepared By: _______________</span>
                  <span>Verified By: _______________</span>
                  <span>Approved By: _______________</span>
                </div>
                <p className="print-date">Print Date: {dayjs().format('DD-MM-YYYY HH:mm')}</p>
              </div>
            </div>
          </div>

          <div className="export-section no-print">
            <button className="print-btn" onClick={() => window.print()}>
              Print Report
            </button>
            <ExportButton
              data={exportData}
              filename={`inventory_purchase_register_${dayjs().format('YYYY-MM-DD')}`}
              buttonText="Export to Excel"
            />
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          Please select a date range to view the Inventory Purchase Register
        </div>
      )}
    </div>
  );
};

export default InventoryPurchaseRegister;

import { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './StockRegister.css';

const StockRegister = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [mode, setMode] = useState('day'); // 'day', 'month', 'range'
  const [dateRange, setDateRange] = useState(null);

  const fetchReport = async (filterData) => {
    // Handle both preset and custom date formats from DateFilterToolbar
    let startDate, endDate;

    if (filterData?.filterType === 'custom') {
      startDate = filterData.customStart;
      endDate = filterData.customEnd;
    } else if (filterData?.filterType) {
      // Handle preset filters (thisMonth, lastMonth, etc.)
      const now = dayjs();
      switch (filterData.filterType) {
        case 'thisMonth':
          startDate = now.startOf('month').format('YYYY-MM-DD');
          endDate = now.endOf('month').format('YYYY-MM-DD');
          break;
        case 'lastMonth':
          startDate = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
          endDate = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
          break;
        case 'thisQuarter':
          startDate = now.startOf('quarter').format('YYYY-MM-DD');
          endDate = now.endOf('quarter').format('YYYY-MM-DD');
          break;
        case 'thisYear':
          startDate = now.startOf('year').format('YYYY-MM-DD');
          endDate = now.endOf('year').format('YYYY-MM-DD');
          break;
        case 'financialYear':
          // Financial year: April to March
          const currentMonth = now.month();
          const fyStartYear = currentMonth >= 3 ? now.year() : now.year() - 1;
          startDate = dayjs(new Date(fyStartYear, 3, 1)).format('YYYY-MM-DD');
          endDate = dayjs(new Date(fyStartYear + 1, 2, 31)).format('YYYY-MM-DD');
          break;
        default:
          startDate = now.startOf('month').format('YYYY-MM-DD');
          endDate = now.endOf('month').format('YYYY-MM-DD');
      }
    } else {
      // Fallback for direct startDate/endDate
      startDate = filterData?.startDate;
      endDate = filterData?.endDate;
    }

    if (!startDate || !endDate) {
      message.error('Please select a date range');
      return;
    }

    setLoading(true);
    setDateRange({ startDate, endDate });

    try {
      const params = {
        startDate,
        endDate,
        mode: mode
      };

      const response = await reportAPI.stockRegister(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock register');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (dateRange) {
      fetchReport(dateRange);
    }
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD-MM-YYYY');
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toFixed(2);
  };

  // Prepare export data
  const exportData = reportData?.rows.map(row => {
    const baseData = {
      Product: row.itemName,
      'OB': row.ob,
      'Purchase': row.purchase,
      'Sales Return': row.salesReturn,
      'Total': row.total,
      'Sales': row.sales,
      'Purchase Return': row.purchaseReturn,
      'Closing Stock': row.closingStock,
      'Stock Value': row.stockValue
    };

    if (mode === 'day') {
      return {
        Date: formatDate(row.date),
        ...baseData
      };
    } else if (mode === 'month') {
      return {
        Month: row.month,
        ...baseData
      };
    } else {
      return baseData;
    }
  }) || [];

  return (
    <div className="stock-register-container">
      <PageHeader
        title="Stock Register"
        subtitle="Society Wise Summary Report"
      />

      {/* Mode Selection */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === 'day' ? 'active' : ''}`}
          onClick={() => handleModeChange('day')}
        >
          Day-wise
        </button>
        <button
          className={`mode-btn ${mode === 'month' ? 'active' : ''}`}
          onClick={() => handleModeChange('month')}
        >
          Month-wise
        </button>
        <button
          className={`mode-btn ${mode === 'range' ? 'active' : ''}`}
          onClick={() => handleModeChange('range')}
        >
          From-To Date
        </button>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading stock register...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Report Header */}
          <div className="report-table-container">
            <div className="print-header">
              <h2>STOCK REGISTER</h2>
              <p className="financial-year">Financial Year: {reportData.financialYear}</p>
              <p className="subtitle">Society Wise Summary Report</p>
              <p className="date-range">
                Period: {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
              </p>
              <p className="mode-info">
                Mode: <strong>
                  {mode === 'day' ? 'Day-wise' : mode === 'month' ? 'Month-wise' : 'From-To Date'}
                </strong>
              </p>
            </div>

            {/* Stock Register Table */}
            <table className="stock-register-table">
              <thead>
                <tr>
                  {mode === 'day' && <th className="col-date">Date</th>}
                  {mode === 'month' && <th className="col-month">Month</th>}
                  <th className="col-product">Product</th>
                  <th className="col-number">OB</th>
                  <th className="col-number">Purchase</th>
                  <th className="col-number">Sales Return</th>
                  <th className="col-number">Total*</th>
                  <th className="col-number">Sales</th>
                  <th className="col-number">Purchase Return</th>
                  <th className="col-number">Closing Stock</th>
                  <th className="col-number">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, idx) => (
                  <tr key={idx}>
                    {mode === 'day' && (
                      <td className="col-date">{formatDate(row.date)}</td>
                    )}
                    {mode === 'month' && (
                      <td className="col-month">{row.month}</td>
                    )}
                    <td className="col-product">{row.itemName}</td>
                    <td className="col-number">{row.ob}</td>
                    <td className="col-number">{row.purchase}</td>
                    <td className="col-number">{row.salesReturn}</td>
                    <td className="col-number">{row.total}</td>
                    <td className="col-number">{row.sales}</td>
                    <td className="col-number">{row.purchaseReturn}</td>
                    <td className="col-number">{row.closingStock}</td>
                    <td className="col-number">{row.stockValue}</td>
                  </tr>
                ))}

                {/* Grand Total Row */}
                <tr className="total-row">
                  {(mode === 'day' || mode === 'month') && <td></td>}
                  <td className="col-product"><strong>Grand Total</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.ob}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.purchase}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.salesReturn}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.total}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.sales}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.purchaseReturn}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.closingStock}</strong></td>
                  <td className="col-number"><strong>{reportData.grandTotal.stockValue}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Footer Note */}
            <div className="report-footer">
              <p>* Total = OB + Purchase + Sales Return</p>
              <p>Closing Stock = Total - Sales - Purchase Return</p>
              <p>Stock Value = Closing Stock × Rate</p>
            </div>
          </div>

          <div className="export-section">
            <ExportButton
              data={exportData}
              filename={`stock_register_${mode}_${dayjs().format('YYYY-MM-DD')}`}
              buttonText="Export Stock Register"
            />
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          Please select a date range and report mode to view the stock register
        </div>
      )}
    </div>
  );
};

export default StockRegister;

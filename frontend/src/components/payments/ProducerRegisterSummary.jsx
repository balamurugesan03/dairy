import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { producerRegisterAPI, collectionCenterAPI } from '../../services/api';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import './ProducerRegister.css';

const ProducerRegisterSummary = () => {
  const [summaryData, setSummaryData] = useState(null);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    toDate: dayjs().endOf('month').format('YYYY-MM-DD'),
    collectionCenter: ''
  });

  const printRef = useRef();

  useEffect(() => {
    fetchCollectionCenters();
    fetchSummary();
  }, []);

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ status: 'Active' });
      setCollectionCenters(response.data || response.collectionCenters || []);
    } catch (error) {
      console.log('Collection centers not available');
    }
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await producerRegisterAPI.getSummary({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        collectionCenter: filters.collectionCenter || undefined
      });
      setSummaryData(response);
    } catch (error) {
      message.error('Failed to fetch summary data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [filters.fromDate, filters.toDate, filters.collectionCenter]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Producer_Register_Summary_${dayjs().format('YYYY-MM-DD')}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  });

  return (
    <div className="ledger-container">
      {/* Control Panel */}
      <div className="ledger-controls no-print">
        <div className="control-row">
          <div className="control-group">
            <label>From Date:</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
              className="ledger-input"
            />
          </div>

          <div className="control-group">
            <label>To Date:</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
              className="ledger-input"
            />
          </div>

          {collectionCenters.length > 0 && (
            <div className="control-group">
              <label>Collection Center:</label>
              <select
                value={filters.collectionCenter}
                onChange={(e) => setFilters(prev => ({ ...prev, collectionCenter: e.target.value }))}
                className="ledger-select"
              >
                <option value="">All Centers</option>
                {collectionCenters.map(center => (
                  <option key={center._id} value={center._id}>
                    {center.centerName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="control-actions">
            <button onClick={fetchSummary} className="ledger-btn ledger-btn-primary">
              Refresh
            </button>
            <button onClick={handlePrint} className="ledger-btn ledger-btn-secondary">
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Summary Register */}
      <div className="ledger-page summary-page" ref={printRef}>
        <div className="ledger-header">
          <div className="ledger-title-block">
            <h1 className="ledger-main-title">Producer Register - Summary</h1>
            <div className="ledger-period">
              Period: {dayjs(filters.fromDate).format('DD/MM/YYYY')} to {dayjs(filters.toDate).format('DD/MM/YYYY')}
            </div>
          </div>
        </div>

        <div className="ledger-table-wrapper">
          <table className="ledger-table summary-table">
            <thead>
              <tr className="column-header-row">
                <th className="col-header" style={{ width: '50px' }}>S.No</th>
                <th className="col-header" style={{ width: '80px' }}>Pr. No</th>
                <th className="col-header" style={{ width: '80px' }}>Member ID</th>
                <th className="col-header" style={{ width: '180px' }}>Producer Name</th>
                <th className="col-header" style={{ width: '100px' }}>Total Milk (Ltrs)</th>
                <th className="col-header" style={{ width: '120px' }}>Total Amount (Rs.)</th>
                <th className="col-header" style={{ width: '120px' }}>Total Deduction (Rs.)</th>
                <th className="col-header" style={{ width: '120px' }}>Total Paid (Rs.)</th>
                <th className="col-header" style={{ width: '120px' }}>Net Payable (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="cell" style={{ textAlign: 'center', padding: '40px' }}>
                    Loading...
                  </td>
                </tr>
              ) : summaryData?.summaries?.length > 0 ? (
                <>
                  {summaryData.summaries.map((item, index) => (
                    <tr key={item.farmerId} className="ledger-row">
                      <td className="cell" style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td className="cell" style={{ textAlign: 'center' }}>{item.farmerNumber}</td>
                      <td className="cell" style={{ textAlign: 'center' }}>{item.memberId || '-'}</td>
                      <td className="cell">{item.farmerName}</td>
                      <td className="cell cell-calculated">{item.totalMilk?.toFixed(2) || '0.00'}</td>
                      <td className="cell cell-calculated">{item.totalAmount?.toFixed(2) || '0.00'}</td>
                      <td className="cell cell-calculated cell-deduct-total">{item.totalDeduction?.toFixed(2) || '0.00'}</td>
                      <td className="cell cell-calculated">{item.totalPaid?.toFixed(2) || '0.00'}</td>
                      <td className="cell cell-calculated cell-net-payable">{item.netPayable?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="ledger-total-row">
                    <td colSpan="4" className="cell cell-total-label">GRAND TOTAL</td>
                    <td className="cell cell-total cell-total-value cell-total-highlight">
                      {summaryData.grandTotals?.totalMilk?.toFixed(2) || '0.00'}
                    </td>
                    <td className="cell cell-total cell-total-value cell-total-highlight">
                      {summaryData.grandTotals?.totalAmount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="cell cell-total cell-total-value">
                      {summaryData.grandTotals?.totalDeduction?.toFixed(2) || '0.00'}
                    </td>
                    <td className="cell cell-total cell-total-value">
                      {summaryData.grandTotals?.totalPaid?.toFixed(2) || '0.00'}
                    </td>
                    <td className="cell cell-total cell-total-value cell-net-payable">
                      {summaryData.grandTotals?.netPayable?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="9" className="cell" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No data found for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ledger-footer">
          <div className="footer-summary">
            <div className="summary-item">
              <span className="summary-label">Total Producers:</span>
              <span className="summary-value">{summaryData?.totalFarmers || 0}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Milk:</span>
              <span className="summary-value">{summaryData?.grandTotals?.totalMilk?.toFixed(2) || '0.00'} Ltrs</span>
            </div>
            <div className="summary-item summary-item-highlight">
              <span className="summary-label">Net Payable:</span>
              <span className="summary-value">Rs. {summaryData?.grandTotals?.netPayable?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <div className="footer-signatures">
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Prepared By</span>
            </div>
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Verified By</span>
            </div>
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProducerRegisterSummary;

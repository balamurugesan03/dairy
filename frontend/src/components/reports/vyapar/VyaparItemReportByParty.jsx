import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparItemReportByParty = () => {
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
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparItemByParty(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch item report by party');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const exportData = reportData?.records?.map(record => ({
    'Item Name': record.itemName,
    'Party Name': record.partyName,
    'Quantity': record.quantity,
    'Amount': record.amount.toFixed(2),
    'Bill Count': record.billCount
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Item Report By Party"
        subtitle="Matrix view of items and parties"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading item report by party...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Items</div>
              <div className="card-value">{reportData.summary.totalItems}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Total Parties</div>
              <div className="card-value">{reportData.summary.totalParties}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Amount</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalAmount)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Total Quantity</div>
              <div className="card-value">{reportData.summary.totalQuantity}</div>
              <div className="card-subtext">{reportData.summary.totalBills} bills</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.records.length} records
              </div>
              <ExportButton data={exportData} filename="item_by_party" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Party Name</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Amount</th>
                    <th className="text-center">Bill Count</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">
                        No records found for the selected period
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((record, idx) => (
                      <tr key={idx}>
                        <td className="item-name">{record.itemName}</td>
                        <td className="party-name">{record.partyName}</td>
                        <td className="text-right">{record.quantity}</td>
                        <td className="text-right success-text">{formatCurrency(record.amount)}</td>
                        <td className="text-center">
                          <span className="status-badge info">{record.billCount}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="2" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right"><strong>{reportData.summary.totalQuantity}</strong></td>
                    <td className="text-right success-text">
                      <strong>{formatCurrency(reportData.summary.totalAmount)}</strong>
                    </td>
                    <td className="text-center"><strong>{reportData.summary.totalBills}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VyaparItemReportByParty;

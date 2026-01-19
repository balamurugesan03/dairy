import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparAllParties = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filter, setFilter] = useState('all'); // all, customers, suppliers

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport();
  }, [filter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparAllParties({ type: filter });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch parties report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const getBalanceType = (balance) => {
    if (balance > 0) return <span className="success-text">To Receive</span>;
    if (balance < 0) return <span className="danger-text">To Pay</span>;
    return <span>Balanced</span>;
  };

  const exportData = reportData?.parties?.map(party => ({
    'Party Name': party.name,
    'Type': party.type,
    'Phone': party.phone,
    'Email': party.email,
    'Opening Balance': party.openingBalance.toFixed(2),
    'Total Sales': party.totalSales.toFixed(2),
    'Total Purchases': party.totalPurchases.toFixed(2),
    'Total Payments': party.totalPayments.toFixed(2),
    'Total Receipts': party.totalReceipts.toFixed(2),
    'Closing Balance': party.closingBalance.toFixed(2),
    'Status': party.closingBalance > 0 ? 'To Receive' : party.closingBalance < 0 ? 'To Pay' : 'Balanced'
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="All Parties"
        subtitle="Complete list of customers and suppliers with balances"
      />

      <div className="filter-section">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Parties
          </button>
          <button
            className={`filter-btn ${filter === 'customers' ? 'active' : ''}`}
            onClick={() => setFilter('customers')}
          >
            Customers
          </button>
          <button
            className={`filter-btn ${filter === 'suppliers' ? 'active' : ''}`}
            onClick={() => setFilter('suppliers')}
          >
            Suppliers
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-message">Loading parties report...</div>
      )}

      {reportData?.parties && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Total Parties</div>
              <div className="card-value">{reportData.summary.totalParties}</div>
              <div className="card-subtext">{reportData.summary.customers} customers, {reportData.summary.suppliers} suppliers</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">To Receive</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalReceivable)}</div>
              <div className="card-subtext">From {reportData.summary.partiesWithCredit} parties</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">To Pay</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalPayable)}</div>
              <div className="card-subtext">To {reportData.summary.partiesWithDebit} parties</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Net Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.netBalance)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.parties.length} parties
              </div>
              <ExportButton data={exportData} filename="all_parties" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Party Name</th>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th className="text-right">Opening Bal.</th>
                    <th className="text-right">Sales</th>
                    <th className="text-right">Purchases</th>
                    <th className="text-right">Payments</th>
                    <th className="text-right">Receipts</th>
                    <th className="text-right">Closing Bal.</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.parties.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="no-data">
                        No parties found
                      </td>
                    </tr>
                  ) : (
                    reportData.parties.map((party, idx) => (
                      <tr
                        key={idx}
                        className="clickable-row"
                        onClick={() => navigate(`/reports/vyapar/party-statement?party=${party._id}`)}
                      >
                        <td>{party.name}</td>
                        <td><span className="status-badge info">{party.type}</span></td>
                        <td>{party.phone}</td>
                        <td>{party.email}</td>
                        <td className="text-right">{formatCurrency(party.openingBalance)}</td>
                        <td className="text-right success-text">{formatCurrency(party.totalSales)}</td>
                        <td className="text-right danger-text">{formatCurrency(party.totalPurchases)}</td>
                        <td className="text-right">{formatCurrency(party.totalPayments)}</td>
                        <td className="text-right">{formatCurrency(party.totalReceipts)}</td>
                        <td className="text-right amount-highlight">{formatCurrency(Math.abs(party.closingBalance))}</td>
                        <td className="text-center">{getBalanceType(party.closingBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="5" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.parties.reduce((sum, p) => sum + p.totalSales, 0))}</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.parties.reduce((sum, p) => sum + p.totalPurchases, 0))}</strong></td>
                    <td className="text-right"><strong>{formatCurrency(reportData.parties.reduce((sum, p) => sum + p.totalPayments, 0))}</strong></td>
                    <td className="text-right"><strong>{formatCurrency(reportData.parties.reduce((sum, p) => sum + p.totalReceipts, 0))}</strong></td>
                    <td className="text-right amount-highlight"><strong>{formatCurrency(Math.abs(reportData.summary.netBalance))}</strong></td>
                    <td></td>
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

export default VyaparAllParties;

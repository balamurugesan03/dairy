import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparPartyStatement = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedParty, setSelectedParty] = useState('');
  const [parties, setParties] = useState([]);

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch parties on mount
  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const response = await reportAPI.vyaparAllParties({});
      if (response.data && response.data.parties) {
        setParties(response.data.parties);
      }
    } catch (error) {
      console.error('Failed to fetch parties:', error);
      message.error('Failed to load parties list');
    }
  };

  const fetchReport = async (filterData) => {
    if (!selectedParty) {
      message.warning('Please select a party');
      return;
    }

    setLoading(true);
    try {
      const response = await reportAPI.vyaparPartyStatement({
        ...filterData,
        partyId: selectedParty
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch party statement');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getTransactionType = (type) => {
    const typeClasses = {
      'Sale': 'status-badge success',
      'Payment': 'status-badge info',
      'Credit Note': 'status-badge warning',
      'Debit Note': 'status-badge danger'
    };
    return <span className={typeClasses[type] || 'status-badge'}>{type}</span>;
  };

  const exportData = reportData?.transactions?.map(txn => ({
    Date: formatDate(txn.date),
    'Transaction No': txn.transactionNumber,
    'Type': txn.type,
    'Debit': txn.debit.toFixed(2),
    'Credit': txn.credit.toFixed(2),
    'Balance': txn.balance.toFixed(2),
    'Description': txn.description
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Party Statement"
        subtitle="Detailed transaction statement for a party"
      />

      <div className="filter-section">
        <div className="form-group">
          <label>Select Party</label>
          <select
            value={selectedParty}
            onChange={(e) => setSelectedParty(e.target.value)}
            className="form-control"
          >
            <option value="">Choose a party...</option>
            {parties.map(party => (
              <option key={party._id} value={party._id}>
                {party.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading party statement...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Party Info Card */}
          <div className="party-info-card">
            <h3>{reportData.partyInfo.name}</h3>
            <p>{reportData.partyInfo.phone} | {reportData.partyInfo.email}</p>
          </div>

          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Opening Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.openingBalance)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Sales</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalSales)}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Payments</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalPayments)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Closing Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.closingBalance)}</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Showing {reportData.transactions.length} transactions
              </div>
              <ExportButton data={exportData} filename="party_statement" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction No.</th>
                    <th className="text-center">Type</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No transactions found for this party
                      </td>
                    </tr>
                  ) : (
                    reportData.transactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(txn.date)}</td>
                        <td className="invoice-number">{txn.transactionNumber}</td>
                        <td className="text-center">{getTransactionType(txn.type)}</td>
                        <td>{txn.description}</td>
                        <td className="text-right danger-text">{txn.debit > 0 ? formatCurrency(txn.debit) : '-'}</td>
                        <td className="text-right success-text">{txn.credit > 0 ? formatCurrency(txn.credit) : '-'}</td>
                        <td className="text-right amount-highlight">{formatCurrency(txn.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="4" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right danger-text"><strong>{formatCurrency(reportData.transactions.reduce((sum, txn) => sum + txn.debit, 0))}</strong></td>
                    <td className="text-right success-text"><strong>{formatCurrency(reportData.transactions.reduce((sum, txn) => sum + txn.credit, 0))}</strong></td>
                    <td className="text-right amount-highlight"><strong>{formatCurrency(reportData.summary.closingBalance)}</strong></td>
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

export default VyaparPartyStatement;

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

const VyaparBankStatement = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [bankLedgers, setBankLedgers] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch bank ledgers on mount
  useEffect(() => {
    fetchBankLedgers();
  }, []);

  const fetchBankLedgers = async () => {
    try {
      // Fetch all parties to get bank ledgers
      const response = await reportAPI.vyaparAllParties({});
      if (response.data && response.data.parties) {
        // Filter bank type parties
        const banks = response.data.parties.filter(p => p.partyType === 'Bank');
        setBankLedgers(banks);
      }
    } catch (error) {
      console.error('Failed to fetch bank ledgers:', error);
    }
  };

  const fetchReport = async (filterData) => {
    if (!selectedBank) {
      message.warning('Please select a bank');
      return;
    }

    setLoading(true);
    try {
      const response = await reportAPI.vyaparBankStatement({
        ...filterData,
        bankLedgerId: selectedBank
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch bank statement');
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
      'Deposit': 'status-badge paid',
      'Withdrawal': 'status-badge pending',
      'Transfer': 'status-badge info'
    };
    return <span className={typeClasses[type] || 'status-badge'}>{type}</span>;
  };

  const exportData = reportData?.transactions?.map(txn => ({
    Date: formatDate(txn.date),
    'Voucher No': txn.voucherNumber,
    'Type': txn.type,
    'Description': txn.description,
    'Deposit': txn.deposit.toFixed(2),
    'Withdrawal': txn.withdrawal.toFixed(2),
    'Balance': txn.balance.toFixed(2)
  })) || [];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Bank Statement"
        subtitle="Bank ledger transactions and balance"
      />

      <div className="filter-section">
        <div className="form-group">
          <label>Select Bank</label>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="form-control"
          >
            <option value="">Choose a bank...</option>
            {bankLedgers.map(bank => (
              <option key={bank._id} value={bank._id}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading bank statement...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Bank Info Card */}
          <div className="party-info-card">
            <h3>{reportData.bankInfo.name}</h3>
            <p>Account: {reportData.bankInfo.accountNumber || 'N/A'}</p>
          </div>

          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card info">
              <div className="card-label">Opening Balance</div>
              <div className="card-value">{formatCurrency(reportData.summary.openingBalance)}</div>
            </div>
            <div className="summary-card success">
              <div className="card-label">Total Deposits</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalDeposits)}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Withdrawals</div>
              <div className="card-value">{formatCurrency(reportData.summary.totalWithdrawals)}</div>
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
              <ExportButton data={exportData} filename="bank_statement" />
            </div>

            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher No.</th>
                    <th className="text-center">Type</th>
                    <th>Description</th>
                    <th className="text-right">Deposit</th>
                    <th className="text-right">Withdrawal</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No transactions found for this bank
                      </td>
                    </tr>
                  ) : (
                    reportData.transactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(txn.date)}</td>
                        <td className="invoice-number">{txn.voucherNumber}</td>
                        <td className="text-center">{getTransactionType(txn.type)}</td>
                        <td>{txn.description}</td>
                        <td className="text-right success-text">
                          {txn.deposit > 0 ? formatCurrency(txn.deposit) : '-'}
                        </td>
                        <td className="text-right danger-text">
                          {txn.withdrawal > 0 ? formatCurrency(txn.withdrawal) : '-'}
                        </td>
                        <td className="text-right amount-highlight">{formatCurrency(txn.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="4" className="text-right"><strong>Totals:</strong></td>
                    <td className="text-right success-text">
                      <strong>{formatCurrency(reportData.summary.totalDeposits)}</strong>
                    </td>
                    <td className="text-right danger-text">
                      <strong>{formatCurrency(reportData.summary.totalWithdrawals)}</strong>
                    </td>
                    <td className="text-right amount-highlight">
                      <strong>{formatCurrency(reportData.summary.closingBalance)}</strong>
                    </td>
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

export default VyaparBankStatement;

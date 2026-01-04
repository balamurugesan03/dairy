import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './OutstandingReport.css';

const OutstandingReport = () => {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalReceivable: 0,
    totalPayable: 0,
    netPosition: 0
  });

  useEffect(() => {
    fetchOutstandingLedgers();
  }, []);

  const fetchOutstandingLedgers = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getAll();
      const partyLedgers = response.data.filter(ledger =>
        ledger.ledgerType === 'Party' && ledger.currentBalance > 0
      );

      setLedgers(partyLedgers);
      calculateStats(partyLedgers);
    } catch (error) {
      message.error(error.message || 'Failed to fetch outstanding ledgers');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ledgers) => {
    let totalReceivable = 0;
    let totalPayable = 0;

    ledgers.forEach(ledger => {
      if (ledger.balanceType === 'Dr') {
        totalReceivable += ledger.currentBalance;
      } else if (ledger.balanceType === 'Cr') {
        totalPayable += ledger.currentBalance;
      }
    });

    const netPosition = totalReceivable - totalPayable;

    setStats({ totalReceivable, totalPayable, netPosition });
  };

  const exportData = ledgers.map(ledger => ({
    'Ledger Name': ledger.ledgerName,
    'Account Group': ledger.ledgerType,
    'Balance Type': ledger.balanceType === 'Dr' ? 'Receivable' : 'Payable',
    'Outstanding Amount': ledger.currentBalance,
    'Contact': ledger.linkedEntity?.entityType || '-'
  }));

  return (
    <div>
      <PageHeader
        title="Outstanding Report"
        subtitle="View party outstanding balances"
      />

      <div className="actions-bar">
        <ExportButton
          data={exportData}
          filename="outstanding_report"
          buttonText="Export"
        />
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-receivable">
          <div className="stat-label">Total Receivable (To Receive)</div>
          <div className="stat-value">₹{stats.totalReceivable.toFixed(2)}</div>
        </div>
        <div className="stat-card stat-payable">
          <div className="stat-label">Total Payable (To Pay)</div>
          <div className="stat-value">₹{stats.totalPayable.toFixed(2)}</div>
        </div>
        <div className={`stat-card ${stats.netPosition >= 0 ? 'stat-favorable' : 'stat-unfavorable'}`}>
          <div className="stat-label">Net Position</div>
          <div className="stat-value">
            ₹{Math.abs(stats.netPosition).toFixed(2)}
            <span className="stat-suffix">
              {stats.netPosition >= 0 ? ' (Favorable)' : ' (Unfavorable)'}
            </span>
          </div>
        </div>
      </div>

      <div className="report-card">
        <h3>Party Outstanding Details</h3>
        <div className="table-container">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : ledgers.length === 0 ? (
            <div className="no-data">No outstanding ledgers found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ledger Name</th>
                  <th>Account Group</th>
                  <th>Balance Type</th>
                  <th style={{ textAlign: 'right' }}>Outstanding Amount</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {ledgers.map((ledger) => (
                  <tr key={ledger._id}>
                    <td>{ledger.ledgerName}</td>
                    <td>
                      <span className="tag tag-info">{ledger.ledgerType}</span>
                    </td>
                    <td>
                      <span className={`tag ${ledger.balanceType === 'Dr' ? 'tag-danger' : 'tag-success'}`}>
                        {ledger.balanceType === 'Dr' ? 'Receivable' : 'Payable'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: ledger.balanceType === 'Dr' ? '#52c41a' : '#ff4d4f' }}>
                      ₹{ledger.currentBalance?.toFixed(2) || 0}
                    </td>
                    <td>
                      {ledger.linkedEntity?.entityType === 'Farmer' ? 'Farmer Account' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutstandingReport;

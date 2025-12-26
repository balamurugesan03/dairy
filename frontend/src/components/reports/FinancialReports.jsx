import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './FinancialReports.css';

const FinancialReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profitLoss');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);

  // Profit & Loss State
  const [profitLossData, setProfitLossData] = useState({
    revenue: [],
    expenses: [],
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  // Trading Account State
  const [tradingData, setTradingData] = useState({
    purchases: [],
    sales: [],
    openingStock: 0,
    closingStock: 0,
    grossProfit: 0
  });

  // Balance Sheet State
  const [balanceSheetData, setBalanceSheetData] = useState({
    assets: [],
    liabilities: [],
    totalAssets: 0,
    totalLiabilities: 0
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange[0].toISOString(),
        endDate: dateRange[1].toISOString()
      };

      if (activeTab === 'profitLoss') {
        const response = await reportAPI.profitLoss(params);
        setProfitLossData(response.data || {});
      } else if (activeTab === 'trading') {
        const response = await reportAPI.tradingAccount(params);
        setTradingData(response.data || {});
      } else if (activeTab === 'balanceSheet') {
        const response = await reportAPI.balanceSheet();
        setBalanceSheetData(response.data || {});
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e, isStart) => {
    const newDate = dayjs(e.target.value);
    if (isStart) {
      setDateRange([newDate, dateRange[1]]);
    } else {
      setDateRange([dateRange[0], newDate]);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const renderProfitLoss = () => {
    const exportData = [
      ...profitLossData.revenue?.map(item => ({
        Type: 'Revenue',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      { Type: '', Particulars: 'Total Revenue', Amount: (profitLossData.totalRevenue || 0).toFixed(2) },
      ...profitLossData.expenses?.map(item => ({
        Type: 'Expense',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      { Type: '', Particulars: 'Total Expenses', Amount: (profitLossData.totalExpenses || 0).toFixed(2) },
      { Type: '', Particulars: 'Net Profit', Amount: (profitLossData.netProfit || 0).toFixed(2) }
    ];

    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Total Revenue</div>
            <div className="stat-value success">
              ₹{(profitLossData.totalRevenue || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Expenses</div>
            <div className="stat-value danger">
              ₹{(profitLossData.totalExpenses || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Net Profit</div>
            <div className={`stat-value ${profitLossData.netProfit >= 0 ? 'success' : 'danger'}`}>
              ₹{(profitLossData.netProfit || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="section-divider">Revenue</div>
        <table className="financial-table">
          <thead>
            <tr>
              <th>Particulars</th>
              <th className="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {profitLossData.revenue?.map((item, index) => (
              <tr key={index}>
                <td>{item.particulars}</td>
                <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row revenue-total">
              <td><strong>Total Revenue</strong></td>
              <td className="align-right"><strong>₹{(profitLossData.totalRevenue || 0).toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div className="section-divider">Expenses</div>
        <table className="financial-table">
          <thead>
            <tr>
              <th>Particulars</th>
              <th className="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {profitLossData.expenses?.map((item, index) => (
              <tr key={index}>
                <td>{item.particulars}</td>
                <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row expense-total">
              <td><strong>Total Expenses</strong></td>
              <td className="align-right"><strong>₹{(profitLossData.totalExpenses || 0).toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div className="export-section">
          <ExportButton
            data={exportData}
            filename="profit_loss_statement"
            buttonText="Export P&L"
          />
        </div>
      </div>
    );
  };

  const renderTradingAccount = () => {
    const exportData = [
      { Type: 'Opening Stock', Amount: (tradingData.openingStock || 0).toFixed(2) },
      ...tradingData.purchases?.map(item => ({
        Type: 'Purchase',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      ...tradingData.sales?.map(item => ({
        Type: 'Sales',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      { Type: 'Closing Stock', Amount: (tradingData.closingStock || 0).toFixed(2) },
      { Type: 'Gross Profit', Amount: (tradingData.grossProfit || 0).toFixed(2) }
    ];

    return (
      <div>
        <div className="stats-grid stats-grid-4">
          <div className="stat-card">
            <div className="stat-title">Opening Stock</div>
            <div className="stat-value">
              ₹{(tradingData.openingStock || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Closing Stock</div>
            <div className="stat-value">
              ₹{(tradingData.closingStock || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Purchases</div>
            <div className="stat-value">
              ₹{(tradingData.purchases?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Gross Profit</div>
            <div className={`stat-value ${tradingData.grossProfit >= 0 ? 'success' : 'danger'}`}>
              ₹{(tradingData.grossProfit || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="trading-grid">
          <div className="trading-card">
            <div className="card-header">Debit Side</div>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Opening Stock</td>
                  <td className="align-right">₹{(tradingData.openingStock || 0).toFixed(2)}</td>
                </tr>
                {tradingData.purchases?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.particulars}</td>
                    <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="trading-card">
            <div className="card-header">Credit Side</div>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tradingData.sales?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.particulars}</td>
                    <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Closing Stock</td>
                  <td className="align-right">₹{(tradingData.closingStock || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="export-section">
          <ExportButton
            data={exportData}
            filename="trading_account"
            buttonText="Export Trading Account"
          />
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    const exportData = [
      ...balanceSheetData.liabilities?.map(item => ({
        Type: 'Liability',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      { Type: '', Particulars: 'Total Liabilities', Amount: (balanceSheetData.totalLiabilities || 0).toFixed(2) },
      ...balanceSheetData.assets?.map(item => ({
        Type: 'Asset',
        Particulars: item.particulars,
        Amount: (item.amount || 0).toFixed(2)
      })) || [],
      { Type: '', Particulars: 'Total Assets', Amount: (balanceSheetData.totalAssets || 0).toFixed(2) }
    ];

    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Total Assets</div>
            <div className="stat-value success">
              ₹{(balanceSheetData.totalAssets || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Liabilities</div>
            <div className="stat-value info">
              ₹{(balanceSheetData.totalLiabilities || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="trading-grid">
          <div className="trading-card">
            <div className="card-header">Liabilities</div>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheetData.liabilities?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.particulars}</td>
                    <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="total-row liability-total">
                  <td><strong>Total Liabilities</strong></td>
                  <td className="align-right"><strong>₹{(balanceSheetData.totalLiabilities || 0).toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="trading-card">
            <div className="card-header">Assets</div>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheetData.assets?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.particulars}</td>
                    <td className="align-right">₹{(item.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="total-row asset-total">
                  <td><strong>Total Assets</strong></td>
                  <td className="align-right"><strong>₹{(balanceSheetData.totalAssets || 0).toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="export-section">
          <ExportButton
            data={exportData}
            filename="balance_sheet"
            buttonText="Export Balance Sheet"
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        subtitle="Profit & Loss, Trading Account, and Balance Sheet"
      />

      <div className="financial-reports-card">
        <div className="toolbar">
          {activeTab !== 'balanceSheet' && (
            <div className="date-range">
              <input
                type="date"
                value={dateRange[0].format('YYYY-MM-DD')}
                onChange={(e) => handleDateChange(e, true)}
                className="date-input"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={dateRange[1].format('YYYY-MM-DD')}
                onChange={(e) => handleDateChange(e, false)}
                className="date-input"
              />
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={fetchReports}
            disabled={loading}
          >
            <span className="btn-icon">⟳</span>
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>

        <div className="tabs">
          <div className="tab-headers">
            <button
              className={`tab-header ${activeTab === 'profitLoss' ? 'active' : ''}`}
              onClick={() => handleTabChange('profitLoss')}
            >
              Profit & Loss
            </button>
            <button
              className={`tab-header ${activeTab === 'trading' ? 'active' : ''}`}
              onClick={() => handleTabChange('trading')}
            >
              Trading Account
            </button>
            <button
              className={`tab-header ${activeTab === 'balanceSheet' ? 'active' : ''}`}
              onClick={() => handleTabChange('balanceSheet')}
            >
              Balance Sheet
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'profitLoss' && renderProfitLoss()}
            {activeTab === 'trading' && renderTradingAccount()}
            {activeTab === 'balanceSheet' && renderBalanceSheet()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;

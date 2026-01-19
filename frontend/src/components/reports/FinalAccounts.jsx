import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import './FinalAccounts.css';

const FinalAccounts = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [tradingData, setTradingData] = useState(null);
  const [profitLossData, setProfitLossData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [filterParams, setFilterParams] = useState(null);

  const fetchAllReports = async (params) => {
    setLoading(true);
    try {
      const [trading, pl, bs] = await Promise.all([
        reportAPI.tradingAccount(params),
        reportAPI.profitLoss(params),
        reportAPI.balanceSheet()
      ]);

      setTradingData(trading.data);
      setProfitLossData(pl.data);
      setBalanceSheetData(bs.data);
      setFilterParams(params);
    } catch (error) {
      message.error(error.message || 'Failed to fetch final accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchAllReports(filterData);
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toFixed(2)}`;
  };

  const renderTradingAccount = () => {
    if (!tradingData) return null;

    const { period, debitSide, creditSide, totals } = tradingData;
    let debitSlNo = 1;
    let creditSlNo = 1;

    return (
      <div className="statement-section trading-account-section">
        <div className="trading-account-header">
          <h2 className="statement-title">
            TRADING ACCOUNT FOR THE PERIOD: {dayjs(period?.startDate).format('DD-MMM-YYYY')} to {dayjs(period?.endDate).format('DD-MMM-YYYY')}
          </h2>
          <p className="financial-year">Financial Year: {period?.financialYear || '2024-25'}</p>
          <p className="report-subtitle">Standard Trading Account | Single Column Accounting Format</p>
          <p className="report-subtitle">Cooperative Society / ERP / Audit-Ready Layout</p>
        </div>

        <div className="statement-content">
          <div className="trading-account-columns">
            {/* DEBIT SIDE */}
            <div className="debit-side">
              <h3 className="side-header">DEBIT (EXPENDITURE / PURCHASES)</h3>
              <table className="trading-account-table">
                <thead>
                  <tr>
                    <th className="sl-col">Sl. No</th>
                    <th className="particulars-col">Particulars</th>
                    <th className="amount-col">Amount (₹)</th>
                    <th className="total-col">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Stock */}
                  <tr>
                    <td className="sl-no">{debitSlNo++}</td>
                    <td className="particulars-col"><strong>Opening Stock</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right">{formatCurrency(debitSide?.openingStock?.total || 0)}</td>
                  </tr>

                  {/* Purchases Group */}
                  <tr className="group-header-row">
                    <td className="sl-no">{debitSlNo++}</td>
                    <td className="particulars-col"><strong>Purchases</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col"></td>
                  </tr>
                  {debitSide?.purchases?.items?.map((item, idx) => (
                    <tr key={`purchase-${idx}`} className="ledger-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col indent">{item.ledgerName}</td>
                      <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
                      <td className="total-col"></td>
                    </tr>
                  ))}
                  <tr className="group-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent"><strong>Total Purchases</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(debitSide?.purchases?.total || 0)}</strong></td>
                  </tr>

                  {/* Trade Expenses Group */}
                  <tr className="group-header-row">
                    <td className="sl-no">{debitSlNo++}</td>
                    <td className="particulars-col"><strong>Trade Expenses</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col"></td>
                  </tr>
                  {debitSide?.tradeExpenses?.items?.map((item, idx) => (
                    <tr key={`expense-${idx}`} className="ledger-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col indent">{item.ledgerName}</td>
                      <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
                      <td className="total-col"></td>
                    </tr>
                  ))}
                  <tr className="group-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent"><strong>Total Trade Expenses</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(debitSide?.tradeExpenses?.total || 0)}</strong></td>
                  </tr>

                  {/* Gross Profit */}
                  {debitSide?.grossProfit > 0 && (
                    <tr className="profit-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col"><strong>Gross Profit Carried to P&amp;L A/c</strong></td>
                      <td className="amount-col"></td>
                      <td className="total-col text-right"><strong>{formatCurrency(debitSide.grossProfit)}</strong></td>
                    </tr>
                  )}

                  {/* Grand Total */}
                  <tr className="grand-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col"><strong>GRAND TOTAL</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(totals?.debitTotal || 0)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CREDIT SIDE */}
            <div className="credit-side">
              <h3 className="side-header">CREDIT (SALES / INCOME)</h3>
              <table className="trading-account-table">
                <thead>
                  <tr>
                    <th className="sl-col">Sl. No</th>
                    <th className="particulars-col">Particulars</th>
                    <th className="amount-col">Amount (₹)</th>
                    <th className="total-col">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sales Group */}
                  <tr className="group-header-row">
                    <td className="sl-no">{creditSlNo++}</td>
                    <td className="particulars-col"><strong>Sales</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col"></td>
                  </tr>
                  {creditSide?.sales?.items?.map((item, idx) => (
                    <tr key={`sales-${idx}`} className="ledger-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col indent">{item.ledgerName}</td>
                      <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
                      <td className="total-col"></td>
                    </tr>
                  ))}
                  <tr className="group-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent"><strong>Total Sales</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(creditSide?.sales?.total || 0)}</strong></td>
                  </tr>

                  {/* Trade Income Group */}
                  <tr className="group-header-row">
                    <td className="sl-no">{creditSlNo++}</td>
                    <td className="particulars-col"><strong>Trade Income</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col"></td>
                  </tr>
                  {creditSide?.tradeIncome?.items?.map((item, idx) => (
                    <tr key={`income-${idx}`} className="ledger-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col indent">{item.ledgerName}</td>
                      <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
                      <td className="total-col"></td>
                    </tr>
                  ))}
                  <tr className="group-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent"><strong>Total Trade Income</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(creditSide?.tradeIncome?.total || 0)}</strong></td>
                  </tr>

                  {/* Closing Stock Group */}
                  <tr className="group-header-row">
                    <td className="sl-no">{creditSlNo++}</td>
                    <td className="particulars-col"><strong>Closing Stock</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col"></td>
                  </tr>
                  {creditSide?.closingStock?.items?.map((item, idx) => (
                    <tr key={`stock-${idx}`} className="ledger-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col indent">{item.category}</td>
                      <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
                      <td className="total-col"></td>
                    </tr>
                  ))}
                  <tr className="group-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent"><strong>Total Closing Stock</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(creditSide?.closingStock?.total || 0)}</strong></td>
                  </tr>

                  {/* Gross Loss */}
                  {creditSide?.grossLoss > 0 && (
                    <tr className="loss-row">
                      <td className="sl-no"></td>
                      <td className="particulars-col"><strong>Gross Loss Carried to P&amp;L A/c</strong></td>
                      <td className="amount-col"></td>
                      <td className="total-col text-right"><strong>{formatCurrency(creditSide.grossLoss)}</strong></td>
                    </tr>
                  )}

                  {/* Grand Total */}
                  <tr className="grand-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col"><strong>GRAND TOTAL</strong></td>
                    <td className="amount-col"></td>
                    <td className="total-col text-right"><strong>{formatCurrency(totals?.creditTotal || 0)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="report-footer">
          <div className="footer-left">Created on {dayjs().format('DD/MM/YYYY hh:mm A')}</div>
          <div className="footer-right">Page 1 of 1</div>
          <p className="footer-center">This is a computer-generated report</p>
        </div>
      </div>
    );
  };

  const renderProfitLoss = () => (
    <div className="statement-section">
      <h2 className="statement-title">Profit & Loss Account</h2>
      <div className="statement-content">
        <div className="statement-columns">
          <div className="debit-side">
            <h3>Expenses</h3>
            <table className="statement-table">
              <tbody>
                {profitLossData?.expenses.map((expense, idx) => (
                  <tr key={idx}>
                    <td>{expense.ledgerName}</td>
                    <td className="text-right">{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td><strong>Net Profit</strong></td>
                  <td className="text-right"><strong>{formatCurrency(profitLossData?.netProfit || 0)}</strong></td>
                </tr>
                <tr className="grand-total">
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong>{formatCurrency(profitLossData?.totalExpense || 0)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="credit-side">
            <h3>Income</h3>
            <table className="statement-table">
              <tbody>
                {profitLossData?.income.map((inc, idx) => (
                  <tr key={idx}>
                    <td>{inc.ledgerName}</td>
                    <td className="text-right">{formatCurrency(inc.amount)}</td>
                  </tr>
                ))}
                <tr className="grand-total">
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong>{formatCurrency(profitLossData?.totalIncome || 0)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBalanceSheet = () => {
    if (!balanceSheetData) return null;

    // Group liabilities by category
    const liabilityGroups = {
      'Grants and Subsidies': [],
      'Advance due by Society': [],
      'Profit': [],
      'Other Liabilities': []
    };

    // Group assets by category
    const assetGroups = {
      'Cash': [],
      'Bank Accounts': [],
      'Share in Other Institutions': [],
      'Interest Receivable': [],
      'Fixed Assets - Movables': [],
      'Advance due to Society': [],
      'Closing Stock': [],
      'Other Assets': []
    };

    // Categorize liabilities
    balanceSheetData?.liabilities?.forEach(item => {
      const name = (item.ledgerName || '').toLowerCase();
      if (name.includes('grant') || name.includes('subsidy')) {
        liabilityGroups['Grants and Subsidies'].push(item);
      } else if (name.includes('milk value') || name.includes('producers') ||
                 name.includes('kdf') || name.includes('welfare') ||
                 name.includes('minerals factory') || name.includes('silage factory')) {
        liabilityGroups['Advance due by Society'].push(item);
      } else {
        liabilityGroups['Other Liabilities'].push(item);
      }
    });

    // Categorize assets
    balanceSheetData?.assets?.forEach(item => {
      const name = (item.ledgerName || '').toLowerCase();
      if (name.includes('cash in hand')) {
        assetGroups['Cash'].push(item);
      } else if (name.includes('bank') || name.includes('a/c')) {
        assetGroups['Bank Accounts'].push(item);
      } else if (name.includes('share in')) {
        assetGroups['Share in Other Institutions'].push(item);
      } else if (name.includes('interest')) {
        assetGroups['Interest Receivable'].push(item);
      } else if (name.includes('furniture') || name.includes('equipment')) {
        assetGroups['Fixed Assets - Movables'].push(item);
      } else if (name.includes('am lps') || name.includes('amlp') ||
                 name.includes('minerals subsidy') || name.includes('silage subsidy')) {
        assetGroups['Advance due to Society'].push(item);
      } else if (name.includes('stock') || name.includes('cattle feed') ||
                 name.includes('minerals') || name.includes('others')) {
        assetGroups['Closing Stock'].push(item);
      } else {
        assetGroups['Other Assets'].push(item);
      }
    });

    const renderGroupedItems = (groups, showTotal = true) => {
      let slNo = 1;
      const items = [];

      Object.entries(groups).forEach(([groupName, groupItems]) => {
        if (groupItems.length === 0) return;

        // Group header
        items.push(
          <tr key={`header-${groupName}`} className="group-header-row">
            <td className="sl-no"></td>
            <td colSpan="2"><strong>{groupName}</strong></td>
          </tr>
        );

        // Group items
        let groupTotal = 0;
        groupItems.forEach((item, idx) => {
          groupTotal += parseFloat(item.amount || 0);
          items.push(
            <tr key={`${groupName}-${idx}`} className="ledger-row">
              <td className="sl-no">{slNo++}</td>
              <td className="particulars-col indent">{item.ledgerName}</td>
              <td className="amount-col text-right">{formatCurrency(item.amount)}</td>
            </tr>
          );
        });

        // Group total (if more than one item)
        if (groupItems.length > 1) {
          items.push(
            <tr key={`total-${groupName}`} className="group-total-row">
              <td className="sl-no"></td>
              <td className="particulars-col indent"><strong>Total {groupName}</strong></td>
              <td className="amount-col text-right"><strong>{formatCurrency(groupTotal)}</strong></td>
            </tr>
          );
        }
      });

      return items;
    };

    const totalLiabilities = (balanceSheetData?.liabilities || []).reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );
    const totalAssets = (balanceSheetData?.assets || []).reduce(
      (sum, item) => sum + parseFloat(item.amount || 0), 0
    );
    const netProfit = balanceSheetData?.netProfit || 0;
    const grandTotal = totalLiabilities + netProfit;

    return (
      <div className="statement-section balance-sheet-section">
        <div className="balance-sheet-header">
          <h2 className="statement-title">BALANCE SHEET AS ON {filterParams?.date ? dayjs(filterParams.date).format('DD-MMM-YYYY') : '31-Mar-2025'}</h2>
          <p className="financial-year">Financial Year: {filterParams?.financialYear || '2024-25'}</p>
          <p className="report-subtitle">Standard Balance Sheet | Single Column Accounting Format</p>
        </div>
        <div className="statement-content">
          <div className="statement-columns balance-sheet-columns">
            {/* LIABILITIES SIDE */}
            <div className="liabilities-side">
              <h3 className="side-header">LIABILITIES</h3>
              <table className="balance-sheet-table">
                <thead>
                  <tr>
                    <th className="sl-col">Sl. No</th>
                    <th className="particulars-col">Particulars</th>
                    <th className="amount-col">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {renderGroupedItems(liabilityGroups)}

                  {/* Net Profit from P&L */}
                  <tr className="profit-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col"><strong>Profit</strong></td>
                    <td className="amount-col"></td>
                  </tr>
                  <tr className="ledger-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col indent">Net Profit Brought from P&L A/c</td>
                    <td className="amount-col text-right">{formatCurrency(netProfit)}</td>
                  </tr>

                  {/* Grand Total */}
                  <tr className="grand-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col"><strong>GRAND TOTAL</strong></td>
                    <td className="amount-col text-right"><strong>{formatCurrency(grandTotal)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ASSETS SIDE */}
            <div className="assets-side">
              <h3 className="side-header">ASSETS</h3>
              <table className="balance-sheet-table">
                <thead>
                  <tr>
                    <th className="sl-col">Sl. No</th>
                    <th className="particulars-col">Particulars</th>
                    <th className="amount-col">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {renderGroupedItems(assetGroups)}

                  {/* Grand Total */}
                  <tr className="grand-total-row">
                    <td className="sl-no"></td>
                    <td className="particulars-col"><strong>GRAND TOTAL</strong></td>
                    <td className="amount-col text-right"><strong>{formatCurrency(totalAssets)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          {Math.abs(grandTotal - totalAssets) > 0.01 && (
            <div className="balance-mismatch-warning">
              <strong>⚠ Warning:</strong> Balance Sheet is not balanced.
              Liabilities: {formatCurrency(grandTotal)} | Assets: {formatCurrency(totalAssets)}
            </div>
          )}
        </div>

        <div className="report-footer">
          <div className="footer-left">Created on {dayjs().format('DD/MM/YYYY hh:mm A')}</div>
          <div className="footer-right">Page 1 of 1</div>
          <p className="footer-center">This is a computer-generated report</p>
        </div>
      </div>
    );
  };

  const renderCombinedView = () => (
    <div className="combined-view">
      {tradingData && renderTradingAccount()}
      {profitLossData && renderProfitLoss()}
      {balanceSheetData && renderBalanceSheet()}
    </div>
  );

  return (
    <div className="final-accounts-container">
      <PageHeader
        title="Final Accounts"
        subtitle="Trading Account, Profit & Loss, and Balance Sheet"
      />

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Combined View
        </button>
        <button
          className={`tab-btn ${activeTab === 'trading' ? 'active' : ''}`}
          onClick={() => setActiveTab('trading')}
        >
          Trading Account
        </button>
        <button
          className={`tab-btn ${activeTab === 'profitLoss' ? 'active' : ''}`}
          onClick={() => setActiveTab('profitLoss')}
        >
          Profit & Loss
        </button>
        <button
          className={`tab-btn ${activeTab === 'balanceSheet' ? 'active' : ''}`}
          onClick={() => setActiveTab('balanceSheet')}
        >
          Balance Sheet
        </button>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading final accounts...</div>
      )}

      {!loading && (tradingData || profitLossData || balanceSheetData) && (
        <>
          {activeTab === 'all' && renderCombinedView()}
          {activeTab === 'trading' && tradingData && renderTradingAccount()}
          {activeTab === 'profitLoss' && profitLossData && renderProfitLoss()}
          {activeTab === 'balanceSheet' && balanceSheetData && renderBalanceSheet()}
        </>
      )}

      {!loading && !tradingData && !profitLossData && !balanceSheetData && (
        <div className="no-data-message">
          Please select a date range to view the final accounts
        </div>
      )}
    </div>
  );
};

export default FinalAccounts;

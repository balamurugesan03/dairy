import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparSaleReport.css';

const VyaparProfitLoss = () => {
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
      const response = await reportAPI.vyaparProfitLoss(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch profit & loss report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const exportData = [
    { Section: 'Revenue', Account: 'Sales', Amount: reportData?.revenue?.sales || 0 },
    { Section: 'Revenue', Account: 'Other Income', Amount: reportData?.revenue?.otherIncome || 0 },
    { Section: 'Revenue', Account: 'Total Revenue', Amount: reportData?.revenue?.total || 0 },
    { Section: '', Account: '', Amount: '' },
    { Section: 'Expenses', Account: 'Cost of Goods Sold', Amount: reportData?.expenses?.cogs || 0 },
    { Section: 'Expenses', Account: 'Operating Expenses', Amount: reportData?.expenses?.operating || 0 },
    { Section: 'Expenses', Account: 'Other Expenses', Amount: reportData?.expenses?.other || 0 },
    { Section: 'Expenses', Account: 'Total Expenses', Amount: reportData?.expenses?.total || 0 },
    { Section: '', Account: '', Amount: '' },
    { Section: 'Net Profit/Loss', Account: '', Amount: reportData?.netProfit || 0 }
  ];

  return (
    <div className="vyapar-sale-report">
      <PageHeader
        title="Profit & Loss Statement"
        subtitle="Comprehensive profit and loss statement for the selected period"
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading profit & loss statement...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card success">
              <div className="card-label">Total Revenue</div>
              <div className="card-value">{formatCurrency(reportData?.revenue?.total)}</div>
              <div className="card-subtext">Sales + Other Income</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Expenses</div>
              <div className="card-value">{formatCurrency(reportData?.expenses?.total)}</div>
              <div className="card-subtext">COGS + Operating + Other</div>
            </div>
            <div className={`summary-card ${(reportData?.netProfit || 0) >= 0 ? 'success' : 'danger'}`}>
              <div className="card-label">Net {(reportData?.netProfit || 0) >= 0 ? 'Profit' : 'Loss'}</div>
              <div className="card-value">{formatCurrency(Math.abs(reportData?.netProfit || 0))}</div>
              <div className="card-subtext">
                {(reportData?.profitMargin || 0) >= 0 ? `${(reportData?.profitMargin || 0).toFixed(2)}% margin` : 'Loss'}
              </div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Gross Profit</div>
              <div className="card-value">{formatCurrency(reportData?.grossProfit)}</div>
              <div className="card-subtext">{(reportData?.grossMargin || 0).toFixed(2)}% margin</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="report-table-container">
            <div className="table-header">
              <div className="table-info">
                Profit & Loss Statement
              </div>
              <ExportButton data={exportData} filename="profit_loss" />
            </div>

            <div className="table-wrapper">
              <div className="pl-statement">
                {/* Revenue Section */}
                <div className="pl-section">
                  <h3 className="section-header">Revenue</h3>
                  <table className="report-table">
                    <tbody>
                      <tr>
                        <td>Sales</td>
                        <td className="text-right success-text">{formatCurrency(reportData?.revenue?.sales)}</td>
                      </tr>
                      <tr>
                        <td>Other Income</td>
                        <td className="text-right success-text">{formatCurrency(reportData?.revenue?.otherIncome)}</td>
                      </tr>
                      <tr className="totals-row">
                        <td><strong>Total Revenue</strong></td>
                        <td className="text-right success-text"><strong>{formatCurrency(reportData?.revenue?.total)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Expenses Section */}
                <div className="pl-section">
                  <h3 className="section-header">Expenses</h3>
                  <table className="report-table">
                    <tbody>
                      <tr>
                        <td>Cost of Goods Sold (COGS)</td>
                        <td className="text-right danger-text">{formatCurrency(reportData?.expenses?.cogs)}</td>
                      </tr>
                      <tr className="subtotal-row">
                        <td><strong>Gross Profit</strong></td>
                        <td className="text-right success-text"><strong>{formatCurrency(reportData?.grossProfit)}</strong></td>
                      </tr>
                      <tr>
                        <td>Operating Expenses</td>
                        <td className="text-right danger-text">{formatCurrency(reportData?.expenses?.operating)}</td>
                      </tr>
                      <tr>
                        <td>Other Expenses</td>
                        <td className="text-right danger-text">{formatCurrency(reportData?.expenses?.other)}</td>
                      </tr>
                      <tr className="totals-row">
                        <td><strong>Total Expenses</strong></td>
                        <td className="text-right danger-text"><strong>{formatCurrency(reportData?.expenses?.total)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Net Profit/Loss Section */}
                <div className="pl-section">
                  <table className="report-table">
                    <tbody>
                      <tr className={`net-profit-row ${(reportData?.netProfit || 0) >= 0 ? 'profit' : 'loss'}`}>
                        <td><strong>Net {(reportData?.netProfit || 0) >= 0 ? 'Profit' : 'Loss'}</strong></td>
                        <td className={`text-right ${(reportData?.netProfit || 0) >= 0 ? 'success-text' : 'danger-text'}`}>
                          <strong>{formatCurrency(Math.abs(reportData?.netProfit || 0))}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Expense Breakdown if available */}
                {reportData?.expenseBreakdown && reportData?.expenseBreakdown?.length > 0 && (
                  <div className="pl-section">
                    <h3 className="section-header">Expense Breakdown</h3>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData?.expenseBreakdown?.map((exp, idx) => (
                          <tr key={idx}>
                            <td>{exp.category}</td>
                            <td className="text-right danger-text">{formatCurrency(exp.amount)}</td>
                            <td className="text-right">{(exp.percentage || 0).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VyaparProfitLoss;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import ExportButton from '../../common/ExportButton';
import './VyaparBalanceSheet.css';

const VyaparBalanceSheet = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // Section configurations
  const liabilitySections = [
    { types: ['Grants & Aid', 'Subsidies'], displayName: 'Grants and Subsidies' },
    { types: ['Other Payable', 'Accounts Due To (Sundry Creditors)'], displayName: 'Advance due by Society' },
    { types: ['Profit & Loss A/c'], displayName: 'Profit' },
    { types: ['Share Capital', 'Capital'], displayName: 'Capital' },
    { types: ['Other Liabilities', 'Deposit A/c', 'Contingency Fund', 'Education Fund'], displayName: 'Other Liabilities' }
  ];

  const assetSections = [
    { types: ['Cash'], displayName: 'Cash' },
    { types: ['Bank'], displayName: 'Bank Accounts' },
    { types: ['Investment A/c', 'Other Investment', 'Government Securities'], displayName: 'Share in Other Institutions' },
    { types: ['Other Receivable'], displayName: 'Interest Receivable' },
    { types: ['Fixed Assets', 'Movable Assets'], displayName: 'Fixed Assets - Movables' },
    { types: ['Immovable Assets'], displayName: 'Fixed Assets - Immovables' },
    { types: ['Other Assets'], displayName: 'Advance due to Society' }
  ];

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
      // Extract date from filterData based on filterType
      let asOnDate = dayjs();

      if (filterData.filterType === 'custom' && filterData.customEnd) {
        asOnDate = dayjs(filterData.customEnd);
      } else if (filterData.filterType === 'month' && filterData.year && filterData.month) {
        asOnDate = dayjs(`${filterData.year}-${String(filterData.month).padStart(2, '0')}-01`).endOf('month');
      } else if (filterData.filterType === 'year' && filterData.year) {
        asOnDate = dayjs(`${filterData.year}-12-31`);
      } else if (filterData.filterType === 'preset') {
        // Handle preset filters
        const now = dayjs();
        switch (filterData.preset) {
          case 'thisMonth':
            asOnDate = now.endOf('month');
            break;
          case 'lastMonth':
            asOnDate = now.subtract(1, 'month').endOf('month');
            break;
          case 'thisQuarter':
            asOnDate = now.endOf('quarter');
            break;
          case 'thisYear':
            asOnDate = now.endOf('year');
            break;
          case 'financialYear':
            // Indian financial year: April to March
            const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
            asOnDate = dayjs(`${fyStart + 1}-03-31`);
            break;
          default:
            asOnDate = now;
        }
      }

      setSelectedDate(asOnDate);

      const response = await reportAPI.vyaparBalanceSheet({
        asOnDate: asOnDate.format('YYYY-MM-DD')
      });

      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  // Group ledgers into sections based on configuration
  const groupIntoSections = (ledgers, sectionConfig) => {
    const sections = [];
    const usedLedgerIds = new Set();

    sectionConfig.forEach(config => {
      const sectionLedgers = ledgers.filter(l =>
        config.types.includes(l.ledgerType) && !usedLedgerIds.has(l.ledgerId)
      );

      if (sectionLedgers.length > 0) {
        sectionLedgers.forEach(l => usedLedgerIds.add(l.ledgerId));
        const total = sectionLedgers.reduce((sum, l) => sum + l.balance, 0);

        sections.push({
          name: config.displayName,
          items: sectionLedgers,
          total
        });
      }
    });

    // Add ungrouped items to "Other" section
    const ungrouped = ledgers.filter(l => !usedLedgerIds.has(l.ledgerId));
    if (ungrouped.length > 0) {
      sections.push({
        name: 'Other',
        items: ungrouped,
        total: ungrouped.reduce((sum, l) => sum + l.balance, 0)
      });
    }

    return sections;
  };

  // Render one side of the balance sheet
  const renderBalanceSheetSide = (title, sections, grandTotal, bgColor) => {
    let slNo = 1;

    return (
      <div className="balance-sheet-side">
        <table className="balance-sheet-table">
          <thead>
            <tr className="header-row" style={{ backgroundColor: bgColor }}>
              <th colSpan="4">{title}</th>
            </tr>
            <tr className="column-header-row">
              <th style={{ width: '60px' }}>Sl. No</th>
              <th>Particulars</th>
              <th style={{ width: '120px' }}>Amount</th>
              <th style={{ width: '120px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sections.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center" style={{ padding: '20px', color: '#999' }}>
                  No data available
                </td>
              </tr>
            ) : (
              sections.map((section, idx) => (
                <React.Fragment key={idx}>
                  {/* Group Header */}
                  <tr className="group-header-row">
                    <td>{slNo++}</td>
                    <td colSpan="3"><strong>{section.name}</strong></td>
                  </tr>

                  {/* Group Items */}
                  {section.items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="group-item-row">
                      <td></td>
                      <td style={{ paddingLeft: '20px' }}>{item.ledgerName}</td>
                      <td className="text-right">
                        {item.balance < 0 && <span className="negative-amount">–</span>}
                        {formatCurrency(Math.abs(item.balance))}
                      </td>
                      <td></td>
                    </tr>
                  ))}

                  {/* Group Total (only if multiple items) */}
                  {section.items.length > 1 && (
                    <tr className="group-total-row">
                      <td></td>
                      <td style={{ paddingLeft: '20px' }}><strong>Total {section.name}</strong></td>
                      <td></td>
                      <td className="text-right"><strong>{formatCurrency(section.total)}</strong></td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="grand-total-row">
              <td></td>
              <td><strong>Grand Total</strong></td>
              <td></td>
              <td className="text-right"><strong>{formatCurrency(grandTotal)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  // Export data function
  const exportData = () => {
    if (!reportData) return [];

    const data = [];
    const liabilitySectionData = groupIntoSections(
      [...(reportData.liabilities || []), ...(reportData.capital || [])],
      liabilitySections
    );
    const assetSectionData = groupIntoSections(reportData.assets || [], assetSections);

    // Add liabilities
    data.push({ Side: 'LIABILITIES', Group: '', Item: '', Amount: '', Total: '' });
    liabilitySectionData.forEach(section => {
      data.push({ Side: '', Group: section.name, Item: '', Amount: '', Total: '' });
      section.items.forEach(item => {
        data.push({
          Side: '',
          Group: '',
          Item: item.ledgerName,
          Amount: item.balance.toFixed(2),
          Total: ''
        });
      });
      if (section.items.length > 1) {
        data.push({
          Side: '',
          Group: '',
          Item: `Total ${section.name}`,
          Amount: '',
          Total: section.total.toFixed(2)
        });
      }
    });
    data.push({
      Side: '',
      Group: '',
      Item: 'GRAND TOTAL',
      Amount: '',
      Total: ((reportData.summary?.totalLiabilities || 0) + (reportData.summary?.totalCapital || 0)).toFixed(2)
    });
    data.push({ Side: '', Group: '', Item: '', Amount: '', Total: '' });

    // Add assets
    data.push({ Side: 'ASSETS', Group: '', Item: '', Amount: '', Total: '' });
    assetSectionData.forEach(section => {
      data.push({ Side: '', Group: section.name, Item: '', Amount: '', Total: '' });
      section.items.forEach(item => {
        data.push({
          Side: '',
          Group: '',
          Item: item.ledgerName,
          Amount: item.balance.toFixed(2),
          Total: ''
        });
      });
      if (section.items.length > 1) {
        data.push({
          Side: '',
          Group: '',
          Item: `Total ${section.name}`,
          Amount: '',
          Total: section.total.toFixed(2)
        });
      }
    });
    data.push({
      Side: '',
      Group: '',
      Item: 'GRAND TOTAL',
      Amount: '',
      Total: (reportData.summary?.totalAssets || 0).toFixed(2)
    });

    return data;
  };

  // Get financial year string
  const getFinancialYear = (date) => {
    const month = date.month(); // 0-indexed (0 = Jan, 3 = Apr)
    const year = date.year();

    if (month >= 3) {
      // April to December: FY is current year to next year
      return `${year}–${String(year + 1).slice(-2)}`;
    } else {
      // January to March: FY is previous year to current year
      return `${year - 1}–${String(year).slice(-2)}`;
    }
  };

  return (
    <div className="balance-sheet-container">
      <div className="balance-sheet-header">
        <h2>BALANCE SHEET AS ON {selectedDate.format('DD-MMM-YYYY').toUpperCase()}</h2>
        <p>Financial Year: {getFinancialYear(selectedDate)}</p>
      </div>

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {loading && (
        <div className="loading-message">Loading balance sheet...</div>
      )}

      {reportData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card success">
              <div className="card-label">Total Assets</div>
              <div className="card-value">{formatCurrency(reportData.summary?.totalAssets || 0)}</div>
            </div>
            <div className="summary-card danger">
              <div className="card-label">Total Liabilities</div>
              <div className="card-value">{formatCurrency(reportData.summary?.totalLiabilities || 0)}</div>
            </div>
            <div className="summary-card info">
              <div className="card-label">Total Capital</div>
              <div className="card-value">{formatCurrency(reportData.summary?.totalCapital || 0)}</div>
            </div>
            <div className={`summary-card ${Math.abs(reportData.summary?.difference || 0) < 0.01 ? 'success' : 'danger'}`}>
              <div className="card-label">Balance Status</div>
              <div className="card-value">
                {Math.abs(reportData.summary?.difference || 0) < 0.01 ? 'Balanced' : 'Unbalanced'}
              </div>
              {Math.abs(reportData.summary?.difference || 0) >= 0.01 && (
                <div className="card-subtext">Diff: {formatCurrency(reportData.summary?.difference || 0)}</div>
              )}
            </div>
          </div>

          {/* Two-Sided Balance Sheet */}
          <div className="balance-sheet-wrapper">
            {renderBalanceSheetSide(
              'LIABILITIES',
              groupIntoSections(
                [...(reportData.liabilities || []), ...(reportData.capital || [])],
                liabilitySections
              ),
              (reportData.summary?.totalLiabilities || 0) + (reportData.summary?.totalCapital || 0),
              '#ffebee' // Light red
            )}

            {renderBalanceSheetSide(
              'ASSETS',
              groupIntoSections(reportData.assets || [], assetSections),
              reportData.summary?.totalAssets || 0,
              '#e8f5e9' // Light green
            )}
          </div>

          {/* Export Section */}
          <div className="export-section">
            <ExportButton data={exportData()} filename={`balance_sheet_${selectedDate.format('YYYY_MM_DD')}`} />
          </div>
        </>
      )}

      {!reportData && !loading && (
        <div className="no-data-message">
          No data available. Please select a date range to generate the balance sheet.
        </div>
      )}
    </div>
  );
};

export default VyaparBalanceSheet;

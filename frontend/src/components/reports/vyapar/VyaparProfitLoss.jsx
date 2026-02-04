import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Card,
  Grid,
  Table,
  Group,
  Badge,
  Button,
  LoadingOverlay,
  Center,
  Stack,
  Paper,
  Box,
  Divider,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Collapse
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileExport,
  IconCalendar,
  IconPrinter,
  IconChevronDown,
  IconChevronRight,
  IconArrowLeft,
  IconPlus,
  IconMinus,
  IconTrendingUp,
  IconTrendingDown
} from '@tabler/icons-react';

const VyaparProfitLoss = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [viewMode, setViewMode] = useState('vyapar');
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    purchaseDirectCost: true,
    directExpenses: true,
    taxPayable: true,
    taxReceivable: true,
    stockAdjustments: true,
    indirectIncome: true,
    indirectExpenses: true
  });

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
      const params = {
        ...filterData,
        viewMode
      };
      if (filterData.fromDate && filterData.toDate) {
        params.customStart = dayjs(filterData.fromDate).format('YYYY-MM-DD');
        params.customEnd = dayjs(filterData.toDate).format('YYYY-MM-DD');
        params.filterType = 'custom';
      }
      const response = await reportAPI.vyaparProfitLoss(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch profit & loss report');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (filterType) => {
    let newDateRange;
    switch (filterType) {
      case 'today':
        newDateRange = [dayjs().toDate(), dayjs().toDate()];
        break;
      case 'thisWeek':
        newDateRange = [dayjs().startOf('week').toDate(), dayjs().endOf('week').toDate()];
        break;
      case 'thisMonth':
        newDateRange = [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()];
        break;
      case 'thisQuarter':
        newDateRange = [dayjs().startOf('quarter').toDate(), dayjs().endOf('quarter').toDate()];
        break;
      case 'thisYear':
        newDateRange = [dayjs().startOf('year').toDate(), dayjs().endOf('year').toDate()];
        break;
      default:
        newDateRange = dateRange;
    }
    setDateRange(newDateRange);
    fetchReport({ filterType });
  };

  const handleApplyFilter = () => {
    if (dateRange[0] && dateRange[1]) {
      fetchReport({
        filterType: 'custom',
        customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        customEnd: dayjs(dateRange[1]).format('YYYY-MM-DD')
      });
    } else {
      message.warning('Please select both start and end dates');
    }
  };

  const formatCurrency = (amount) => {
    const value = parseFloat(amount || 0);
    return `₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const generatePrintContent = () => {
    if (!reportData) return '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profit and Loss Report</title>
        <style>
          @media print {
            @page { size: A4 portrait; margin: 15mm; }
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1976d2;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #1976d2;
            font-size: 18px;
          }
          .header p {
            margin: 5px 0 0;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 8px 12px;
            border: 1px solid #e0e0e0;
          }
          th {
            background-color: #f5f7fa;
            font-weight: 600;
            text-align: left;
          }
          .section-header {
            background-color: #e3f2fd;
            font-weight: 600;
          }
          .sub-item {
            padding-left: 30px !important;
          }
          .text-right {
            text-align: right;
          }
          .text-green {
            color: #2e7d32;
          }
          .text-red {
            color: #c62828;
          }
          .total-row {
            background-color: #e8f5e9;
            font-weight: 700;
          }
          .gross-profit-row {
            background-color: #fff3e0;
            font-weight: 700;
          }
          .net-profit-row {
            background-color: #1976d2;
            color: white;
            font-weight: 700;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PROFIT AND LOSS REPORT</h1>
          <p>${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 70%">Particulars</th>
              <th class="text-right" style="width: 30%">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${generatePrintRows()}
          </tbody>
        </table>
        <div class="footer">
          <p>Generated on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}</p>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          }
        </script>
      </body>
      </html>
    `;
  };

  const generatePrintRows = () => {
    if (!reportData) return '';
    let rows = '';

    // Income Section
    rows += `<tr class="section-header"><td>INCOME</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">Sale (+)</td><td class="text-right text-green">${formatCurrency(reportData.income?.sale || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Credit Note (-)</td><td class="text-right text-red">${formatCurrency(reportData.income?.creditNote || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Sale FA (+)</td><td class="text-right text-green">${formatCurrency(reportData.income?.saleFA || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Total Income</td><td class="text-right">${formatCurrency(reportData.income?.total || 0)}</td></tr>`;

    // Purchase & Direct Cost
    rows += `<tr class="section-header"><td>PURCHASE & DIRECT COST</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">Purchase (-)</td><td class="text-right text-red">${formatCurrency(reportData.purchaseDirectCost?.purchase || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Debit Note (+)</td><td class="text-right text-green">${formatCurrency(reportData.purchaseDirectCost?.debitNote || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Purchase FA (-)</td><td class="text-right text-red">${formatCurrency(reportData.purchaseDirectCost?.purchaseFA || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Total Purchase & Direct Cost</td><td class="text-right">${formatCurrency(reportData.purchaseDirectCost?.total || 0)}</td></tr>`;

    // Direct Expenses
    rows += `<tr class="section-header"><td>DIRECT EXPENSES (-)</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">Other Direct Expenses</td><td class="text-right text-red">${formatCurrency(reportData.directExpenses?.otherDirect || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Payment-in Discount</td><td class="text-right text-red">${formatCurrency(reportData.directExpenses?.paymentDiscount || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Total Direct Expenses</td><td class="text-right">${formatCurrency(reportData.directExpenses?.total || 0)}</td></tr>`;

    // Tax Payable
    rows += `<tr class="section-header"><td>TAX PAYABLE (-)</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">GST Payable</td><td class="text-right text-red">${formatCurrency(reportData.taxPayable?.gst || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">TCS Payable</td><td class="text-right text-red">${formatCurrency(reportData.taxPayable?.tcs || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">TDS Payable</td><td class="text-right text-red">${formatCurrency(reportData.taxPayable?.tds || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Total Tax Payable</td><td class="text-right">${formatCurrency(reportData.taxPayable?.total || 0)}</td></tr>`;

    // Tax Receivable
    rows += `<tr class="section-header"><td>TAX RECEIVABLE (+)</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">GST Receivable</td><td class="text-right text-green">${formatCurrency(reportData.taxReceivable?.gst || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">TCS Receivable</td><td class="text-right text-green">${formatCurrency(reportData.taxReceivable?.tcs || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">TDS Receivable</td><td class="text-right text-green">${formatCurrency(reportData.taxReceivable?.tds || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Total Tax Receivable</td><td class="text-right">${formatCurrency(reportData.taxReceivable?.total || 0)}</td></tr>`;

    // Stock Adjustments
    rows += `<tr class="section-header"><td>STOCK ADJUSTMENTS</td><td></td></tr>`;
    rows += `<tr><td class="sub-item">Opening Stock (-)</td><td class="text-right text-red">${formatCurrency(reportData.stockAdjustments?.openingStock || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Closing Stock (+)</td><td class="text-right text-green">${formatCurrency(reportData.stockAdjustments?.closingStock || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Opening Stock FA (-)</td><td class="text-right text-red">${formatCurrency(reportData.stockAdjustments?.openingStockFA || 0)}</td></tr>`;
    rows += `<tr><td class="sub-item">Closing Stock FA (+)</td><td class="text-right text-green">${formatCurrency(reportData.stockAdjustments?.closingStockFA || 0)}</td></tr>`;
    rows += `<tr class="total-row"><td>Net Stock Adjustment</td><td class="text-right">${formatCurrency(reportData.stockAdjustments?.netAdjustment || 0)}</td></tr>`;

    // Gross Profit
    const grossProfit = reportData.grossProfit || 0;
    rows += `<tr class="gross-profit-row"><td><strong>GROSS ${grossProfit >= 0 ? 'PROFIT' : 'LOSS'}</strong></td><td class="text-right">${formatCurrency(grossProfit)}</td></tr>`;

    // Indirect Income
    rows += `<tr class="section-header"><td>OTHER INCOME (+)</td><td></td></tr>`;
    if (reportData.indirectIncome?.items?.length > 0) {
      reportData.indirectIncome.items.forEach(item => {
        rows += `<tr><td class="sub-item">${item.name}</td><td class="text-right text-green">${formatCurrency(item.amount)}</td></tr>`;
      });
    }
    rows += `<tr class="total-row"><td>Total Other Income</td><td class="text-right">${formatCurrency(reportData.indirectIncome?.total || 0)}</td></tr>`;

    // Indirect Expenses
    rows += `<tr class="section-header"><td>INDIRECT EXPENSES (-)</td><td></td></tr>`;
    if (reportData.indirectExpenses?.items?.length > 0) {
      reportData.indirectExpenses.items.forEach(item => {
        rows += `<tr><td class="sub-item">${item.name}</td><td class="text-right text-red">${formatCurrency(item.amount)}</td></tr>`;
      });
    }
    rows += `<tr class="total-row"><td>Total Indirect Expenses</td><td class="text-right">${formatCurrency(reportData.indirectExpenses?.total || 0)}</td></tr>`;

    // Net Profit
    const netProfit = reportData.netProfit || 0;
    rows += `<tr class="net-profit-row"><td><strong>NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}</strong></td><td class="text-right">${formatCurrency(netProfit)}</td></tr>`;

    return rows;
  };

  // Export to Excel
  const handleExport = () => {
    if (!reportData) return;

    const exportData = [];

    // Income
    exportData.push({ Section: 'INCOME', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'Sale (+)', Amount: reportData.income?.sale || 0 });
    exportData.push({ Section: '', Particulars: 'Credit Note (-)', Amount: -(reportData.income?.creditNote || 0) });
    exportData.push({ Section: '', Particulars: 'Sale FA (+)', Amount: reportData.income?.saleFA || 0 });
    exportData.push({ Section: '', Particulars: 'Total Income', Amount: reportData.income?.total || 0 });

    // Purchase & Direct Cost
    exportData.push({ Section: 'PURCHASE & DIRECT COST', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'Purchase (-)', Amount: -(reportData.purchaseDirectCost?.purchase || 0) });
    exportData.push({ Section: '', Particulars: 'Debit Note (+)', Amount: reportData.purchaseDirectCost?.debitNote || 0 });
    exportData.push({ Section: '', Particulars: 'Purchase FA (-)', Amount: -(reportData.purchaseDirectCost?.purchaseFA || 0) });
    exportData.push({ Section: '', Particulars: 'Total Purchase & Direct Cost', Amount: reportData.purchaseDirectCost?.total || 0 });

    // Direct Expenses
    exportData.push({ Section: 'DIRECT EXPENSES', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'Other Direct Expenses', Amount: -(reportData.directExpenses?.otherDirect || 0) });
    exportData.push({ Section: '', Particulars: 'Payment-in Discount', Amount: -(reportData.directExpenses?.paymentDiscount || 0) });
    exportData.push({ Section: '', Particulars: 'Total Direct Expenses', Amount: reportData.directExpenses?.total || 0 });

    // Tax Payable
    exportData.push({ Section: 'TAX PAYABLE', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'GST Payable', Amount: -(reportData.taxPayable?.gst || 0) });
    exportData.push({ Section: '', Particulars: 'TCS Payable', Amount: -(reportData.taxPayable?.tcs || 0) });
    exportData.push({ Section: '', Particulars: 'TDS Payable', Amount: -(reportData.taxPayable?.tds || 0) });
    exportData.push({ Section: '', Particulars: 'Total Tax Payable', Amount: reportData.taxPayable?.total || 0 });

    // Tax Receivable
    exportData.push({ Section: 'TAX RECEIVABLE', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'GST Receivable', Amount: reportData.taxReceivable?.gst || 0 });
    exportData.push({ Section: '', Particulars: 'TCS Receivable', Amount: reportData.taxReceivable?.tcs || 0 });
    exportData.push({ Section: '', Particulars: 'TDS Receivable', Amount: reportData.taxReceivable?.tds || 0 });
    exportData.push({ Section: '', Particulars: 'Total Tax Receivable', Amount: reportData.taxReceivable?.total || 0 });

    // Stock Adjustments
    exportData.push({ Section: 'STOCK ADJUSTMENTS', Particulars: '', Amount: '' });
    exportData.push({ Section: '', Particulars: 'Opening Stock (-)', Amount: -(reportData.stockAdjustments?.openingStock || 0) });
    exportData.push({ Section: '', Particulars: 'Closing Stock (+)', Amount: reportData.stockAdjustments?.closingStock || 0 });
    exportData.push({ Section: '', Particulars: 'Opening Stock FA (-)', Amount: -(reportData.stockAdjustments?.openingStockFA || 0) });
    exportData.push({ Section: '', Particulars: 'Closing Stock FA (+)', Amount: reportData.stockAdjustments?.closingStockFA || 0 });
    exportData.push({ Section: '', Particulars: 'Net Stock Adjustment', Amount: reportData.stockAdjustments?.netAdjustment || 0 });

    // Gross Profit
    exportData.push({ Section: 'GROSS PROFIT/LOSS', Particulars: '', Amount: reportData.grossProfit || 0 });

    // Other Income
    exportData.push({ Section: 'OTHER INCOME', Particulars: '', Amount: '' });
    (reportData.indirectIncome?.items || []).forEach(item => {
      exportData.push({ Section: '', Particulars: item.name, Amount: item.amount });
    });
    exportData.push({ Section: '', Particulars: 'Total Other Income', Amount: reportData.indirectIncome?.total || 0 });

    // Indirect Expenses
    exportData.push({ Section: 'INDIRECT EXPENSES', Particulars: '', Amount: '' });
    (reportData.indirectExpenses?.items || []).forEach(item => {
      exportData.push({ Section: '', Particulars: item.name, Amount: -item.amount });
    });
    exportData.push({ Section: '', Particulars: 'Total Indirect Expenses', Amount: reportData.indirectExpenses?.total || 0 });

    // Net Profit
    exportData.push({ Section: 'NET PROFIT/LOSS', Particulars: '', Amount: reportData.netProfit || 0 });

    // Convert to CSV
    const headers = ['Section', 'Particulars', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => [
        `"${row.Section}"`,
        `"${row.Particulars}"`,
        row.Amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ProfitLoss_${dayjs().format('DDMMYYYY_HHmmss')}.csv`;
    link.click();
  };

  // Render section row with expand/collapse
  const renderSectionHeader = (title, sectionKey, icon, color = '#1976d2') => (
    <tr
      style={{
        backgroundColor: '#f5f7fa',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => toggleSection(sectionKey)}
    >
      <td
        style={{
          padding: '12px 16px',
          fontWeight: 600,
          color: color,
          fontSize: '13px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {expandedSections[sectionKey] ? (
          <IconChevronDown size={16} />
        ) : (
          <IconChevronRight size={16} />
        )}
        {icon}
        {title}
      </td>
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
          textAlign: 'right'
        }}
      ></td>
    </tr>
  );

  // Render sub-item row
  const renderSubItem = (label, amount, isPositive = true, visible = true) => {
    if (!visible) return null;
    return (
      <tr style={{ backgroundColor: '#ffffff' }}>
        <td
          style={{
            padding: '10px 16px 10px 44px',
            fontSize: '12px',
            color: '#455a64',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          {label} {isPositive ? '(+)' : '(-)'}
        </td>
        <td
          style={{
            padding: '10px 16px',
            textAlign: 'right',
            fontSize: '12px',
            fontWeight: 500,
            color: isPositive ? '#2e7d32' : '#c62828',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          {formatCurrency(amount)}
        </td>
      </tr>
    );
  };

  // Render total row
  const renderTotalRow = (label, amount, bgColor = '#e8f5e9', textColor = '#1b5e20') => (
    <tr style={{ backgroundColor: bgColor }}>
      <td
        style={{
          padding: '12px 16px 12px 28px',
          fontWeight: 600,
          fontSize: '12px',
          color: textColor,
          borderBottom: '2px solid #e0e0e0'
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: '12px 16px',
          textAlign: 'right',
          fontWeight: 700,
          fontSize: '13px',
          color: textColor,
          borderBottom: '2px solid #e0e0e0'
        }}
      >
        {formatCurrency(amount)}
      </td>
    </tr>
  );

  // Render highlighted row (Gross/Net Profit)
  const renderHighlightedRow = (label, amount, isProfit = true) => (
    <tr
      style={{
        backgroundColor: isProfit ? '#e3f2fd' : '#ffebee',
        borderTop: '2px solid ' + (isProfit ? '#1976d2' : '#c62828'),
        borderBottom: '2px solid ' + (isProfit ? '#1976d2' : '#c62828')
      }}
    >
      <td
        style={{
          padding: '14px 16px',
          fontWeight: 700,
          fontSize: '14px',
          color: isProfit ? '#1565c0' : '#c62828'
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: '14px 16px',
          textAlign: 'right',
          fontWeight: 700,
          fontSize: '15px',
          color: isProfit ? '#1565c0' : '#c62828'
        }}
      >
        {formatCurrency(amount)}
      </td>
    </tr>
  );

  const grossProfit = reportData?.grossProfit || 0;
  const netProfit = reportData?.netProfit || 0;

  return (
    <Container size="lg" py="md">
      <Stack spacing="md">
        {/* Page Header */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Group position="apart" align="flex-start">
            <Group spacing="md">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => navigate('/reports/vyapar')}
                size="lg"
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <div>
                <Title order={2} style={{ color: '#1976d2', fontWeight: 700 }}>
                  PROFIT AND LOSS REPORT
                </Title>
                <Text color="dimmed" size="sm" mt={4}>
                  {dateRange[0] && dateRange[1]
                    ? `${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`
                    : 'Select date range'}
                </Text>
              </div>
            </Group>
            <Group spacing="xs">
              <Tooltip label="Export to Excel">
                <ActionIcon
                  color="green"
                  variant="light"
                  size="lg"
                  onClick={handleExport}
                  disabled={!reportData}
                >
                  <IconFileExport size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print Report">
                <ActionIcon
                  color="blue"
                  variant="light"
                  size="lg"
                  onClick={handlePrint}
                  disabled={!reportData}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* Filters */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Stack spacing="sm">
            <Group position="apart">
              <Group spacing="md">
                <DatePickerInput
                  type="range"
                  label="Date Range"
                  placeholder="Select date range"
                  value={dateRange}
                  onChange={setDateRange}
                  icon={<IconCalendar size={16} />}
                  size="sm"
                  style={{ width: 280 }}
                  valueFormat="DD/MM/YYYY"
                />
                <Button
                  onClick={handleApplyFilter}
                  size="sm"
                  style={{ backgroundColor: '#1976d2', marginTop: 24 }}
                >
                  Apply Filter
                </Button>
              </Group>
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                data={[
                  { label: 'Vyapar', value: 'vyapar' },
                  { label: 'Accounting', value: 'accounting' }
                ]}
                size="sm"
              />
            </Group>
            <Group spacing="xs">
              <Text size="xs" color="dimmed">Quick Filters:</Text>
              {['today', 'thisWeek', 'thisMonth', 'thisQuarter', 'thisYear'].map((filter) => (
                <Button
                  key={filter}
                  compact
                  variant="subtle"
                  size="xs"
                  onClick={() => handleQuickFilter(filter)}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  {filter === 'today' ? 'Today' :
                   filter === 'thisWeek' ? 'This Week' :
                   filter === 'thisMonth' ? 'This Month' :
                   filter === 'thisQuarter' ? 'This Quarter' : 'This Year'}
                </Button>
              ))}
            </Group>
          </Stack>
        </Paper>

        <LoadingOverlay visible={loading} overlayBlur={2} />

        {reportData && !loading && (
          <>
            {/* Summary Cards */}
            <Grid>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: '4px solid #2e7d32' }}>
                  <Text size="xs" color="dimmed" weight={500} transform="uppercase">
                    Total Income
                  </Text>
                  <Title order={3} mt={4} style={{ color: '#2e7d32' }}>
                    {formatCurrency(reportData.income?.total || 0)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: '4px solid #c62828' }}>
                  <Text size="xs" color="dimmed" weight={500} transform="uppercase">
                    Total Expenses
                  </Text>
                  <Title order={3} mt={4} style={{ color: '#c62828' }}>
                    {formatCurrency(
                      (reportData.purchaseDirectCost?.total || 0) +
                      (reportData.directExpenses?.total || 0) +
                      (reportData.indirectExpenses?.total || 0)
                    )}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: '4px solid #ff9800' }}>
                  <Group spacing="xs">
                    {grossProfit >= 0 ? <IconTrendingUp size={20} color="#ff9800" /> : <IconTrendingDown size={20} color="#ff9800" />}
                    <Text size="xs" color="dimmed" weight={500} transform="uppercase">
                      Gross {grossProfit >= 0 ? 'Profit' : 'Loss'}
                    </Text>
                  </Group>
                  <Title order={3} mt={4} style={{ color: '#ff9800' }}>
                    {formatCurrency(grossProfit)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: `4px solid ${netProfit >= 0 ? '#1976d2' : '#c62828'}` }}>
                  <Group spacing="xs">
                    {netProfit >= 0 ? <IconTrendingUp size={20} color="#1976d2" /> : <IconTrendingDown size={20} color="#c62828" />}
                    <Text size="xs" color="dimmed" weight={500} transform="uppercase">
                      Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                    </Text>
                  </Group>
                  <Title order={3} mt={4} style={{ color: netProfit >= 0 ? '#1976d2' : '#c62828' }}>
                    {formatCurrency(netProfit)}
                  </Title>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Main Report Table */}
            <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden' }}>
              <Box p="md" style={{ backgroundColor: '#1976d2', color: 'white' }}>
                <Text weight={600} size="md">
                  Profit and Loss Statement
                </Text>
              </Box>
              <div style={{ overflowX: 'auto' }}>
                <Table
                  verticalSpacing="xs"
                  fontSize="sm"
                  style={{
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed'
                  }}
                >
                  <thead style={{ backgroundColor: '#f5f7fa' }}>
                    <tr>
                      <th
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: '#37474f',
                          borderBottom: '2px solid #1976d2',
                          width: '70%'
                        }}
                      >
                        Particulars
                      </th>
                      <th
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: '#37474f',
                          borderBottom: '2px solid #1976d2',
                          textAlign: 'right',
                          width: '30%'
                        }}
                      >
                        Amount (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* INCOME SECTION */}
                    {renderSectionHeader('INCOME', 'income', <IconPlus size={14} />, '#2e7d32')}
                    {expandedSections.income && (
                      <>
                        {renderSubItem('Sale', reportData.income?.sale || 0, true)}
                        {renderSubItem('Credit Note', reportData.income?.creditNote || 0, false)}
                        {renderSubItem('Sale FA', reportData.income?.saleFA || 0, true)}
                        {renderTotalRow('Total Income', reportData.income?.total || 0)}
                      </>
                    )}

                    {/* PURCHASE & DIRECT COST SECTION */}
                    {renderSectionHeader('PURCHASE & DIRECT COST', 'purchaseDirectCost', <IconMinus size={14} />, '#c62828')}
                    {expandedSections.purchaseDirectCost && (
                      <>
                        {renderSubItem('Purchase', reportData.purchaseDirectCost?.purchase || 0, false)}
                        {renderSubItem('Debit Note', reportData.purchaseDirectCost?.debitNote || 0, true)}
                        {renderSubItem('Purchase FA', reportData.purchaseDirectCost?.purchaseFA || 0, false)}
                        {renderTotalRow('Total Purchase & Direct Cost', reportData.purchaseDirectCost?.total || 0, '#ffebee', '#c62828')}
                      </>
                    )}

                    {/* DIRECT EXPENSES SECTION */}
                    {renderSectionHeader('DIRECT EXPENSES', 'directExpenses', <IconMinus size={14} />, '#c62828')}
                    {expandedSections.directExpenses && (
                      <>
                        {renderSubItem('Other Direct Expenses', reportData.directExpenses?.otherDirect || 0, false)}
                        {renderSubItem('Payment-in Discount', reportData.directExpenses?.paymentDiscount || 0, false)}
                        {renderTotalRow('Total Direct Expenses', reportData.directExpenses?.total || 0, '#ffebee', '#c62828')}
                      </>
                    )}

                    {/* TAX PAYABLE SECTION */}
                    {renderSectionHeader('TAX PAYABLE', 'taxPayable', <IconMinus size={14} />, '#c62828')}
                    {expandedSections.taxPayable && (
                      <>
                        {renderSubItem('GST Payable', reportData.taxPayable?.gst || 0, false)}
                        {renderSubItem('TCS Payable', reportData.taxPayable?.tcs || 0, false)}
                        {renderSubItem('TDS Payable', reportData.taxPayable?.tds || 0, false)}
                        {renderTotalRow('Total Tax Payable', reportData.taxPayable?.total || 0, '#ffebee', '#c62828')}
                      </>
                    )}

                    {/* TAX RECEIVABLE SECTION */}
                    {renderSectionHeader('TAX RECEIVABLE', 'taxReceivable', <IconPlus size={14} />, '#2e7d32')}
                    {expandedSections.taxReceivable && (
                      <>
                        {renderSubItem('GST Receivable', reportData.taxReceivable?.gst || 0, true)}
                        {renderSubItem('TCS Receivable', reportData.taxReceivable?.tcs || 0, true)}
                        {renderSubItem('TDS Receivable', reportData.taxReceivable?.tds || 0, true)}
                        {renderTotalRow('Total Tax Receivable', reportData.taxReceivable?.total || 0)}
                      </>
                    )}

                    {/* STOCK ADJUSTMENTS SECTION */}
                    {renderSectionHeader('STOCK ADJUSTMENTS', 'stockAdjustments', <IconChevronRight size={14} />, '#7b1fa2')}
                    {expandedSections.stockAdjustments && (
                      <>
                        {renderSubItem('Opening Stock', reportData.stockAdjustments?.openingStock || 0, false)}
                        {renderSubItem('Closing Stock', reportData.stockAdjustments?.closingStock || 0, true)}
                        {renderSubItem('Opening Stock FA', reportData.stockAdjustments?.openingStockFA || 0, false)}
                        {renderSubItem('Closing Stock FA', reportData.stockAdjustments?.closingStockFA || 0, true)}
                        {renderTotalRow(
                          'Net Stock Adjustment',
                          reportData.stockAdjustments?.netAdjustment || 0,
                          (reportData.stockAdjustments?.netAdjustment || 0) >= 0 ? '#e8f5e9' : '#ffebee',
                          (reportData.stockAdjustments?.netAdjustment || 0) >= 0 ? '#1b5e20' : '#c62828'
                        )}
                      </>
                    )}

                    {/* GROSS PROFIT */}
                    {renderHighlightedRow(
                      `GROSS ${grossProfit >= 0 ? 'PROFIT' : 'LOSS'}`,
                      grossProfit,
                      grossProfit >= 0
                    )}

                    {/* OTHER INCOME SECTION */}
                    {renderSectionHeader('OTHER INCOME', 'indirectIncome', <IconPlus size={14} />, '#2e7d32')}
                    {expandedSections.indirectIncome && (
                      <>
                        {(reportData.indirectIncome?.items || []).map((item, index) => (
                          renderSubItem(item.name, item.amount, true, true)
                        ))}
                        {(!reportData.indirectIncome?.items || reportData.indirectIncome.items.length === 0) && (
                          <tr style={{ backgroundColor: '#fafafa' }}>
                            <td colSpan="2" style={{ padding: '10px 16px 10px 44px', color: '#9e9e9e', fontSize: '12px' }}>
                              No other income recorded
                            </td>
                          </tr>
                        )}
                        {renderTotalRow('Total Other Income', reportData.indirectIncome?.total || 0)}
                      </>
                    )}

                    {/* INDIRECT EXPENSES SECTION */}
                    {renderSectionHeader('INDIRECT EXPENSES', 'indirectExpenses', <IconMinus size={14} />, '#c62828')}
                    {expandedSections.indirectExpenses && (
                      <>
                        {(reportData.indirectExpenses?.items || []).map((item, index) => (
                          renderSubItem(item.name, item.amount, false, true)
                        ))}
                        {(!reportData.indirectExpenses?.items || reportData.indirectExpenses.items.length === 0) && (
                          <tr style={{ backgroundColor: '#fafafa' }}>
                            <td colSpan="2" style={{ padding: '10px 16px 10px 44px', color: '#9e9e9e', fontSize: '12px' }}>
                              No indirect expenses recorded
                            </td>
                          </tr>
                        )}
                        {renderTotalRow('Total Indirect Expenses', reportData.indirectExpenses?.total || 0, '#ffebee', '#c62828')}
                      </>
                    )}

                    {/* NET PROFIT */}
                    <tr
                      style={{
                        backgroundColor: netProfit >= 0 ? '#1976d2' : '#c62828'
                      }}
                    >
                      <td
                        style={{
                          padding: '16px',
                          fontWeight: 700,
                          fontSize: '15px',
                          color: 'white',
                          borderTop: '3px solid ' + (netProfit >= 0 ? '#0d47a1' : '#b71c1c')
                        }}
                      >
                        NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}
                      </td>
                      <td
                        style={{
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '16px',
                          color: 'white',
                          borderTop: '3px solid ' + (netProfit >= 0 ? '#0d47a1' : '#b71c1c')
                        }}
                      >
                        {formatCurrency(netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Paper>

            {/* Profit Margin Summary */}
            <Paper withBorder p="md" style={{ borderColor: '#e0e0e0' }}>
              <Grid>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Gross Profit Margin</Text>
                  <Text size="lg" weight={600} color={grossProfit >= 0 ? 'green' : 'red'}>
                    {reportData.income?.total > 0
                      ? ((grossProfit / reportData.income.total) * 100).toFixed(2)
                      : 0}%
                  </Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Net Profit Margin</Text>
                  <Text size="lg" weight={600} color={netProfit >= 0 ? 'blue' : 'red'}>
                    {reportData.income?.total > 0
                      ? ((netProfit / reportData.income.total) * 100).toFixed(2)
                      : 0}%
                  </Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Operating Expense Ratio</Text>
                  <Text size="lg" weight={600}>
                    {reportData.income?.total > 0
                      ? (((reportData.directExpenses?.total || 0) + (reportData.indirectExpenses?.total || 0)) / reportData.income.total * 100).toFixed(2)
                      : 0}%
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>
          </>
        )}

        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">Select a date range to view the Profit & Loss report</Text>
              <Button
                variant="light"
                onClick={() => fetchReport({ filterType: 'thisMonth' })}
                style={{ backgroundColor: '#1976d2', color: 'white' }}
              >
                Load This Month's Report
              </Button>
            </Stack>
          </Center>
        )}
      </Stack>
    </Container>
  );
};

export default VyaparProfitLoss;

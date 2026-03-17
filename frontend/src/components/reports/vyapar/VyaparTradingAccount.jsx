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
  Button,
  LoadingOverlay,
  Center,
  Stack,
  Paper,
  Box,
  Flex,
  Divider,
  ActionIcon,
  Tooltip,
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
  IconTrendingUp,
  IconTrendingDown,
  IconScale
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';

const VyaparTradingAccount = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [expandedSections, setExpandedSections] = useState({
    openingStock: true,
    purchases: true,
    directExpenses: true,
    sales: true,
    closingStock: true
  });

  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => {
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const params = { ...filterData };
      if (filterData.fromDate && filterData.toDate) {
        params.customStart = dayjs(filterData.fromDate).format('YYYY-MM-DD');
        params.customEnd = dayjs(filterData.toDate).format('YYYY-MM-DD');
        params.filterType = 'custom';
      }
      const response = await reportAPI.vyaparTradingAccount(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch trading account');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (filterType) => {
    let newDateRange;
    switch (filterType) {
      case 'today': newDateRange = [dayjs().toDate(), dayjs().toDate()]; break;
      case 'thisWeek': newDateRange = [dayjs().startOf('week').toDate(), dayjs().endOf('week').toDate()]; break;
      case 'thisMonth': newDateRange = [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()]; break;
      case 'thisQuarter': newDateRange = [dayjs().startOf('quarter').toDate(), dayjs().endOf('quarter').toDate()]; break;
      case 'thisYear': newDateRange = [dayjs().startOf('year').toDate(), dayjs().endOf('year').toDate()]; break;
      case 'financialYear': {
        const now = dayjs();
        const fyStart = now.month() >= 3
          ? now.startOf('year').add(3, 'month')
          : now.subtract(1, 'year').startOf('year').add(3, 'month');
        newDateRange = [fyStart.toDate(), fyStart.add(1, 'year').subtract(1, 'day').toDate()];
        break;
      }
      default: newDateRange = dateRange;
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
    return `\u20B9${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePrint = () => {
    if (!reportData) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trading Account</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 15mm; } }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #1976d2; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #1976d2; font-size: 18px; }
          .header p { margin: 5px 0 0; color: #666; }
          .t-account { display: flex; gap: 0; border: 2px solid #333; }
          .t-side { flex: 1; }
          .t-side:first-child { border-right: 2px solid #333; }
          .t-side-header { text-align: center; font-weight: 700; padding: 10px; font-size: 14px; }
          .dr-header { background-color: #ffebee; color: #c62828; }
          .cr-header { background-color: #e8f5e9; color: #2e7d32; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
          th { background-color: #f5f7fa; font-weight: 600; text-align: left; }
          .text-right { text-align: right; }
          .total-row { background-color: #e3f2fd; font-weight: 700; border-top: 2px solid #1976d2; }
          .profit-row { background-color: #fff3e0; font-weight: 700; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${companyName ? `<h2 style="margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">${companyName}</h2>` : ''}
          <h1>TRADING ACCOUNT</h1>
          <p>For the period ${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}</p>
        </div>
        <div class="t-account">
          <div class="t-side">
            <div class="t-side-header dr-header">DEBIT SIDE (Expenses)</div>
            <table>
              <thead><tr><th style="width:70%">Particulars</th><th class="text-right">Amount (\u20B9)</th></tr></thead>
              <tbody>
                <tr><td>To Opening Stock</td><td class="text-right">${formatCurrency(reportData.debitSide?.openingStock)}</td></tr>
                <tr><td>To Purchases</td><td class="text-right">${formatCurrency(reportData.debitSide?.purchases)}</td></tr>
                <tr><td style="padding-left:30px">Less: Purchase Returns</td><td class="text-right" style="color:#c62828">- ${formatCurrency(reportData.debitSide?.purchaseReturns)}</td></tr>
                <tr><td><strong>Net Purchases</strong></td><td class="text-right"><strong>${formatCurrency(reportData.debitSide?.netPurchases)}</strong></td></tr>
                <tr><td>To Direct Expenses</td><td class="text-right">${formatCurrency(reportData.debitSide?.directExpenses)}</td></tr>
                ${reportData.summary?.isProfit ? `<tr class="profit-row"><td>To Gross Profit c/d</td><td class="text-right">${formatCurrency(reportData.summary?.grossProfit)}</td></tr>` : ''}
                <tr class="total-row"><td><strong>Total</strong></td><td class="text-right"><strong>${formatCurrency(reportData.debitSide?.total)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div class="t-side">
            <div class="t-side-header cr-header">CREDIT SIDE (Income)</div>
            <table>
              <thead><tr><th style="width:70%">Particulars</th><th class="text-right">Amount (\u20B9)</th></tr></thead>
              <tbody>
                <tr><td>By Sales</td><td class="text-right">${formatCurrency(reportData.creditSide?.sales)}</td></tr>
                <tr><td style="padding-left:30px">Less: Sales Returns</td><td class="text-right" style="color:#c62828">- ${formatCurrency(reportData.creditSide?.salesReturns)}</td></tr>
                <tr><td><strong>Net Sales</strong></td><td class="text-right"><strong>${formatCurrency(reportData.creditSide?.netSales)}</strong></td></tr>
                <tr><td>By Closing Stock</td><td class="text-right">${formatCurrency(reportData.creditSide?.closingStock)}</td></tr>
                ${!reportData.summary?.isProfit ? `<tr class="profit-row"><td>By Gross Loss c/d</td><td class="text-right">${formatCurrency(reportData.summary?.grossLoss)}</td></tr>` : ''}
                <tr class="total-row"><td><strong>Total</strong></td><td class="text-right"><strong>${formatCurrency(reportData.creditSide?.total)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="footer"><p>Generated on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}</p></div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExport = () => {
    if (!reportData) return;
    const exportData = [
      { Side: 'DEBIT', Particulars: 'Opening Stock', Amount: reportData.debitSide?.openingStock || 0 },
      { Side: '', Particulars: 'Purchases', Amount: reportData.debitSide?.purchases || 0 },
      { Side: '', Particulars: 'Less: Purchase Returns', Amount: -(reportData.debitSide?.purchaseReturns || 0) },
      { Side: '', Particulars: 'Net Purchases', Amount: reportData.debitSide?.netPurchases || 0 },
      { Side: '', Particulars: 'Direct Expenses', Amount: reportData.debitSide?.directExpenses || 0 },
      ...(reportData.summary?.isProfit ? [{ Side: '', Particulars: 'Gross Profit c/d', Amount: reportData.summary?.grossProfit || 0 }] : []),
      { Side: '', Particulars: 'TOTAL (Debit)', Amount: reportData.debitSide?.total || 0 },
      { Side: '', Particulars: '', Amount: '' },
      { Side: 'CREDIT', Particulars: 'Sales', Amount: reportData.creditSide?.sales || 0 },
      { Side: '', Particulars: 'Less: Sales Returns', Amount: -(reportData.creditSide?.salesReturns || 0) },
      { Side: '', Particulars: 'Net Sales', Amount: reportData.creditSide?.netSales || 0 },
      { Side: '', Particulars: 'Closing Stock', Amount: reportData.creditSide?.closingStock || 0 },
      ...(!reportData.summary?.isProfit ? [{ Side: '', Particulars: 'Gross Loss c/d', Amount: reportData.summary?.grossLoss || 0 }] : []),
      { Side: '', Particulars: 'TOTAL (Credit)', Amount: reportData.creditSide?.total || 0 },
      { Side: '', Particulars: '', Amount: '' },
      { Side: 'SUMMARY', Particulars: reportData.summary?.isProfit ? 'Gross Profit' : 'Gross Loss', Amount: reportData.summary?.grossAmount || 0 },
      { Side: '', Particulars: 'Gross Margin %', Amount: (reportData.summary?.grossMarginPercent || 0).toFixed(2) + '%' }
    ];
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trading Account');
    XLSX.writeFile(wb, `TradingAccount_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const debitSide = reportData?.debitSide || {};
  const creditSide = reportData?.creditSide || {};
  const summary = reportData?.summary || {};

  const renderSectionHeader = (title, sectionKey, color = '#1976d2') => (
    <tr
      style={{ backgroundColor: '#f5f7fa', cursor: 'pointer', userSelect: 'none' }}
      onClick={() => toggleSection(sectionKey)}
    >
      <td style={{ padding: '10px 16px', fontWeight: 600, color, fontSize: '13px', borderBottom: '1px solid #e0e0e0' }}>
        {expandedSections[sectionKey] ? <IconChevronDown size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> : <IconChevronRight size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />}
        {title}
      </td>
      <td style={{ padding: '10px 16px', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}></td>
    </tr>
  );

  return (
    <Container size="lg" py="md">
      <Stack spacing="md">
        {/* Header */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Group position="apart" align="flex-start">
            <Group spacing="md">
              <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/reports/vyapar')} size="lg">
                <IconArrowLeft size={20} />
              </ActionIcon>
              <div>
                <Title order={2} style={{ color: '#1976d2', fontWeight: 700 }}>TRADING ACCOUNT</Title>
                <Text color="dimmed" size="sm" mt={4}>
                  {dateRange[0] && dateRange[1]
                    ? `${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`
                    : 'Select date range'}
                </Text>
              </div>
            </Group>
            <Group spacing="xs">
              <Tooltip label="Export to Excel">
                <ActionIcon color="green" variant="light" size="lg" onClick={handleExport} disabled={!reportData}>
                  <IconFileExport size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print Report">
                <ActionIcon color="blue" variant="light" size="lg" onClick={handlePrint} disabled={!reportData}>
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
                <Button onClick={handleApplyFilter} size="sm" style={{ backgroundColor: '#1976d2', marginTop: 24 }}>
                  Apply Filter
                </Button>
              </Group>
            </Group>
            <Group spacing="xs">
              <Text size="xs" color="dimmed">Quick Filters:</Text>
              {['today', 'thisMonth', 'thisQuarter', 'thisYear', 'financialYear'].map((filter) => (
                <Button
                  key={filter}
                  variant="subtle"
                  size="compact-xs"
                  onClick={() => handleQuickFilter(filter)}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  {filter === 'today' ? 'Today' :
                   filter === 'thisMonth' ? 'This Month' :
                   filter === 'thisQuarter' ? 'This Quarter' :
                   filter === 'thisYear' ? 'This Year' : 'Financial Year'}
                </Button>
              ))}
            </Group>
          </Stack>
        </Paper>

        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
          <>
            {/* Summary Cards */}
            <Grid>
              <Grid.Col span={4}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: `4px solid ${summary.isProfit ? '#2e7d32' : '#c62828'}` }}>
                  <Group spacing="xs">
                    {summary.isProfit ? <IconTrendingUp size={20} color="#2e7d32" /> : <IconTrendingDown size={20} color="#c62828" />}
                    <Text size="xs" color="dimmed" weight={500} transform="uppercase">
                      Gross {summary.isProfit ? 'Profit' : 'Loss'}
                    </Text>
                  </Group>
                  <Title order={3} mt={4} style={{ color: summary.isProfit ? '#2e7d32' : '#c62828' }}>
                    {formatCurrency(summary.isProfit ? summary.grossProfit : summary.grossLoss)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: '4px solid #1976d2' }}>
                  <Group spacing="xs">
                    <IconScale size={20} color="#1976d2" />
                    <Text size="xs" color="dimmed" weight={500} transform="uppercase">Gross Margin</Text>
                  </Group>
                  <Title order={3} mt={4} style={{ color: '#1976d2' }}>
                    {(summary.grossMarginPercent || 0).toFixed(2)}%
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0', borderLeft: '4px solid #ff9800' }}>
                  <Text size="xs" color="dimmed" weight={500} transform="uppercase">Net Sales</Text>
                  <Title order={3} mt={4} style={{ color: '#ff9800' }}>
                    {formatCurrency(creditSide.netSales)}
                  </Title>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Trading Account - T-Format */}
            <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden' }}>
              <Box p="md" style={{ backgroundColor: '#1976d2', color: 'white' }}>
                <Text weight={600} size="md">Trading Account</Text>
              </Box>

              <Flex style={{ borderTop: '1px solid #e0e0e0' }}>
                {/* DEBIT SIDE */}
                <Box style={{ flex: 1, borderRight: '3px solid #1976d2' }}>
                  <Box p="sm" style={{ backgroundColor: '#ffebee', borderBottom: '2px solid #ef9a9a' }}>
                    <Text fw={700} c="red.8" ta="center" size="sm">DEBIT SIDE (Dr.)</Text>
                  </Box>
                  <div style={{ overflowX: 'auto' }}>
                    <Table verticalSpacing="xs" fontSize="sm" style={{ borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f5f7fa' }}>
                        <tr>
                          <th style={{ padding: '10px 16px', fontWeight: 600, color: '#37474f', borderBottom: '2px solid #ef5350', width: '65%' }}>Particulars</th>
                          <th style={{ padding: '10px 16px', fontWeight: 600, color: '#37474f', borderBottom: '2px solid #ef5350', textAlign: 'right', width: '35%' }}>Amount (\u20B9)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Purchases */}
                        {renderSectionHeader('To Purchases', 'purchases', '#c62828')}
                        {expandedSections.purchases && (
                          <>
                            <tr>
                              <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>
                                Gross Purchases
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
                                {formatCurrency(debitSide.purchases)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#c62828', borderBottom: '1px solid #f0f0f0' }}>
                                Less: Purchase Returns
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: '#c62828', borderBottom: '1px solid #f0f0f0' }}>
                                - {formatCurrency(debitSide.purchaseReturns)}
                              </td>
                            </tr>
                            <tr style={{ backgroundColor: '#fff3e0' }}>
                              <td style={{ padding: '10px 16px 10px 28px', fontWeight: 600, fontSize: '12px', color: '#e65100', borderBottom: '1px solid #ffe0b2' }}>
                                Net Purchases
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#e65100', borderBottom: '1px solid #ffe0b2' }}>
                                {formatCurrency(debitSide.netPurchases)}
                              </td>
                            </tr>
                          </>
                        )}

                        {/* Direct Expenses */}
                        {renderSectionHeader('To Direct Expenses', 'directExpenses', '#c62828')}
                        {expandedSections.directExpenses && (
                          <>
                            {(debitSide.directExpenseItems || []).map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
                                  {formatCurrency(item.amount)}
                                </td>
                              </tr>
                            ))}
                            {(!debitSide.directExpenseItems || debitSide.directExpenseItems.length === 0) && (
                              <tr>
                                <td colSpan="2" style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#9e9e9e' }}>
                                  No direct expenses recorded
                                </td>
                              </tr>
                            )}
                            <tr style={{ backgroundColor: '#ffebee' }}>
                              <td style={{ padding: '10px 16px 10px 28px', fontWeight: 600, fontSize: '12px', color: '#c62828', borderBottom: '1px solid #ef9a9a' }}>
                                Total Direct Expenses
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#c62828', borderBottom: '1px solid #ef9a9a' }}>
                                {formatCurrency(debitSide.directExpenses)}
                              </td>
                            </tr>
                          </>
                        )}

                        {/* Gross Profit (if profit) */}
                        {summary.isProfit && (
                          <tr style={{ backgroundColor: '#e8f5e9', borderTop: '2px solid #4caf50' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: '#2e7d32' }}>
                              To Gross Profit c/d
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#2e7d32' }}>
                              {formatCurrency(summary.grossProfit)}
                            </td>
                          </tr>
                        )}

                        {/* Opening Stock — last row before Total */}
                        {renderSectionHeader('To Opening Stock', 'openingStock', '#c62828')}
                        {expandedSections.openingStock && (
                          <tr>
                            <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>
                              Stock value at period start
                            </td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
                              {formatCurrency(debitSide.openingStock)}
                            </td>
                          </tr>
                        )}

                        {/* Total */}
                        <tr style={{ backgroundColor: '#1976d2' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: 'white', borderTop: '3px solid #0d47a1' }}>
                            TOTAL
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'white', borderTop: '3px solid #0d47a1' }}>
                            {formatCurrency(debitSide.total)}
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </Box>

                {/* CREDIT SIDE */}
                <Box style={{ flex: 1 }}>
                  <Box p="sm" style={{ backgroundColor: '#e8f5e9', borderBottom: '2px solid #a5d6a7' }}>
                    <Text fw={700} c="green.8" ta="center" size="sm">CREDIT SIDE (Cr.)</Text>
                  </Box>
                  <div style={{ overflowX: 'auto' }}>
                    <Table verticalSpacing="xs" fontSize="sm" style={{ borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f5f7fa' }}>
                        <tr>
                          <th style={{ padding: '10px 16px', fontWeight: 600, color: '#37474f', borderBottom: '2px solid #66bb6a', width: '65%' }}>Particulars</th>
                          <th style={{ padding: '10px 16px', fontWeight: 600, color: '#37474f', borderBottom: '2px solid #66bb6a', textAlign: 'right', width: '35%' }}>Amount (\u20B9)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Sales */}
                        {renderSectionHeader('By Sales', 'sales', '#2e7d32')}
                        {expandedSections.sales && (
                          <>
                            <tr>
                              <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>
                                Gross Sales
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
                                {formatCurrency(creditSide.sales)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#c62828', borderBottom: '1px solid #f0f0f0' }}>
                                Less: Sales Returns
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: '#c62828', borderBottom: '1px solid #f0f0f0' }}>
                                - {formatCurrency(creditSide.salesReturns)}
                              </td>
                            </tr>
                            <tr style={{ backgroundColor: '#e8f5e9' }}>
                              <td style={{ padding: '10px 16px 10px 28px', fontWeight: 600, fontSize: '12px', color: '#2e7d32', borderBottom: '1px solid #a5d6a7' }}>
                                Net Sales
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#2e7d32', borderBottom: '1px solid #a5d6a7' }}>
                                {formatCurrency(creditSide.netSales)}
                              </td>
                            </tr>
                          </>
                        )}

                        {/* Gross Loss (if loss) */}
                        {!summary.isProfit && summary.grossLoss > 0 && (
                          <tr style={{ backgroundColor: '#ffebee', borderTop: '2px solid #ef5350' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: '#c62828' }}>
                              By Gross Loss c/d
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#c62828' }}>
                              {formatCurrency(summary.grossLoss)}
                            </td>
                          </tr>
                        )}

                        {/* Closing Stock — last row before Total */}
                        {renderSectionHeader('By Closing Stock', 'closingStock', '#2e7d32')}
                        {expandedSections.closingStock && (
                          <tr>
                            <td style={{ padding: '8px 16px 8px 40px', fontSize: '12px', color: '#455a64', borderBottom: '1px solid #f0f0f0' }}>
                              Stock value at period end
                            </td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
                              {formatCurrency(creditSide.closingStock)}
                            </td>
                          </tr>
                        )}

                        {/* Total */}
                        <tr style={{ backgroundColor: '#1976d2' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: 'white', borderTop: '3px solid #0d47a1' }}>
                            TOTAL
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'white', borderTop: '3px solid #0d47a1' }}>
                            {formatCurrency(creditSide.total)}
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </Box>
              </Flex>
            </Paper>

            {/* Margin Summary */}
            <Paper withBorder p="md" style={{ borderColor: '#e0e0e0' }}>
              <Grid>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Gross Profit / Loss</Text>
                  <Text size="lg" weight={600} color={summary.isProfit ? 'green' : 'red'}>
                    {summary.isProfit ? 'Profit' : 'Loss'}: {formatCurrency(summary.isProfit ? summary.grossProfit : summary.grossLoss)}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Gross Margin %</Text>
                  <Text size="lg" weight={600} color={summary.isProfit ? 'green' : 'red'}>
                    {(summary.grossMarginPercent || 0).toFixed(2)}%
                  </Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" color="dimmed">Stock Difference</Text>
                  <Text size="lg" weight={600}>
                    {formatCurrency((creditSide.closingStock || 0) - (debitSide.openingStock || 0))}
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>
          </>
        )}

        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">Select a date range to view the Trading Account</Text>
              <Button variant="light" onClick={() => fetchReport({ filterType: 'thisMonth' })} style={{ backgroundColor: '#1976d2', color: 'white' }}>
                Load This Month's Report
              </Button>
            </Stack>
          </Center>
        )}
      </Stack>
    </Container>
  );
};

export default VyaparTradingAccount;

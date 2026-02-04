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
  Table,
  Group,
  Button,
  LoadingOverlay,
  Center,
  Stack,
  Paper,
  Box,
  ActionIcon,
  Tooltip,
  Checkbox,
  TextInput,
  Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileExport,
  IconCalendar,
  IconPrinter,
  IconArrowLeft,
  IconSearch,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending
} from '@tabler/icons-react';

const VyaparItemWiseProfit = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [itemsHavingSale, setItemsHavingSale] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('itemName');
  const [sortDirection, setSortDirection] = useState('asc');

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
        itemsHavingSale
      };
      if (filterData.fromDate && filterData.toDate) {
        params.customStart = dayjs(filterData.fromDate).format('YYYY-MM-DD');
        params.customEnd = dayjs(filterData.toDate).format('YYYY-MM-DD');
        params.filterType = 'custom';
      }
      const response = await reportAPI.vyaparItemWiseProfit(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch item-wise profit');
    } finally {
      setLoading(false);
    }
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

  const handleItemsHavingSaleChange = (e) => {
    setItemsHavingSale(e.target.checked);
  };

  const formatCurrency = (amount) => {
    const value = parseFloat(amount || 0);
    return `₹ ${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Sorting logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <IconArrowsSort size={14} style={{ opacity: 0.3 }} />;
    }
    return sortDirection === 'asc'
      ? <IconSortAscending size={14} color="#1976d2" />
      : <IconSortDescending size={14} color="#1976d2" />;
  };

  // Filter and sort items
  const getFilteredAndSortedItems = () => {
    if (!reportData?.items) return [];

    let filtered = [...reportData.items];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply items having sale filter
    if (itemsHavingSale) {
      filtered = filtered.filter(item => item.sale > 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const filteredItems = getFilteredAndSortedItems();

  // Calculate totals
  const calculateTotals = () => {
    return filteredItems.reduce((totals, item) => ({
      sale: totals.sale + (item.sale || 0),
      creditNote: totals.creditNote + (item.creditNote || 0),
      purchase: totals.purchase + (item.purchase || 0),
      debitNote: totals.debitNote + (item.debitNote || 0),
      openingStock: totals.openingStock + (item.openingStock || 0),
      closingStock: totals.closingStock + (item.closingStock || 0),
      taxReceivable: totals.taxReceivable + (item.taxReceivable || 0),
      taxPayable: totals.taxPayable + (item.taxPayable || 0),
      mfgCost: totals.mfgCost + (item.mfgCost || 0),
      consumptionCost: totals.consumptionCost + (item.consumptionCost || 0),
      netProfitLoss: totals.netProfitLoss + (item.netProfitLoss || 0)
    }), {
      sale: 0,
      creditNote: 0,
      purchase: 0,
      debitNote: 0,
      openingStock: 0,
      closingStock: 0,
      taxReceivable: 0,
      taxPayable: 0,
      mfgCost: 0,
      consumptionCost: 0,
      netProfitLoss: 0
    });
  };

  const totals = calculateTotals();

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const generatePrintContent = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Item Wise Profit & Loss Report</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10px;
            line-height: 1.3;
            color: #333;
            padding: 15px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1976d2;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h1 {
            margin: 0;
            color: #1976d2;
            font-size: 16px;
          }
          .header p {
            margin: 5px 0 0;
            color: #666;
            font-size: 11px;
          }
          .section-title {
            font-weight: 600;
            color: #37474f;
            font-size: 12px;
            margin: 10px 0;
            padding: 5px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          th, td {
            padding: 6px 8px;
            border: 1px solid #e0e0e0;
          }
          th {
            background-color: #f5f7fa;
            font-weight: 600;
            text-align: left;
            color: #37474f;
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
            background-color: #f8f9fa;
            font-weight: 700;
          }
          .footer-total {
            margin-top: 15px;
            text-align: right;
            font-size: 12px;
            font-weight: 700;
          }
          .footer-total span {
            color: #2e7d32;
          }
          .print-footer {
            margin-top: 15px;
            text-align: center;
            font-size: 9px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ITEM WISE PROFIT & LOSS REPORT</h1>
          <p>${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}</p>
        </div>
        <div class="section-title">DETAILS</div>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th class="text-right">Sale</th>
              <th class="text-right">Cr. Note / Sale Return</th>
              <th class="text-right">Purchase</th>
              <th class="text-right">Dr. Note / Purchase Return</th>
              <th class="text-right">Opening Stock</th>
              <th class="text-right">Closing Stock</th>
              <th class="text-right">Tax Receivable</th>
              <th class="text-right">Tax Payable</th>
              <th class="text-right">Mfg. Cost</th>
              <th class="text-right">Consumption Cost</th>
              <th class="text-right">Net Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => `
              <tr>
                <td>${item.itemName}</td>
                <td class="text-right">${formatNumber(item.sale)}</td>
                <td class="text-right">${formatNumber(item.creditNote)}</td>
                <td class="text-right">${formatNumber(item.purchase)}</td>
                <td class="text-right">${formatNumber(item.debitNote)}</td>
                <td class="text-right">${formatNumber(item.openingStock)}</td>
                <td class="text-right">${formatNumber(item.closingStock)}</td>
                <td class="text-right">${formatNumber(item.taxReceivable)}</td>
                <td class="text-right">${formatNumber(item.taxPayable)}</td>
                <td class="text-right">${formatNumber(item.mfgCost)}</td>
                <td class="text-right">${formatNumber(item.consumptionCost)}</td>
                <td class="text-right ${item.netProfitLoss >= 0 ? 'text-green' : 'text-red'}">${formatNumber(item.netProfitLoss)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.sale)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.creditNote)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.purchase)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.debitNote)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.openingStock)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.closingStock)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.taxReceivable)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.taxPayable)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.mfgCost)}</strong></td>
              <td class="text-right"><strong>${formatNumber(totals.consumptionCost)}</strong></td>
              <td class="text-right ${totals.netProfitLoss >= 0 ? 'text-green' : 'text-red'}"><strong>${formatNumber(totals.netProfitLoss)}</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="footer-total">
          Total Amount: <span>${formatCurrency(totals.netProfitLoss)}</span>
        </div>
        <div class="print-footer">
          Generated on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}
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

  // Export to Excel
  const handleExport = () => {
    if (!reportData) return;

    const exportData = filteredItems.map(item => ({
      'Item Name': item.itemName,
      'Sale': item.sale || 0,
      'Cr. Note / Sale Return': item.creditNote || 0,
      'Purchase': item.purchase || 0,
      'Dr. Note / Purchase Return': item.debitNote || 0,
      'Opening Stock': item.openingStock || 0,
      'Closing Stock': item.closingStock || 0,
      'Tax Receivable': item.taxReceivable || 0,
      'Tax Payable': item.taxPayable || 0,
      'Mfg. Cost': item.mfgCost || 0,
      'Consumption Cost': item.consumptionCost || 0,
      'Net Profit / Loss': item.netProfitLoss || 0
    }));

    // Add totals row
    exportData.push({
      'Item Name': 'TOTAL',
      'Sale': totals.sale,
      'Cr. Note / Sale Return': totals.creditNote,
      'Purchase': totals.purchase,
      'Dr. Note / Purchase Return': totals.debitNote,
      'Opening Stock': totals.openingStock,
      'Closing Stock': totals.closingStock,
      'Tax Receivable': totals.taxReceivable,
      'Tax Payable': totals.taxPayable,
      'Mfg. Cost': totals.mfgCost,
      'Consumption Cost': totals.consumptionCost,
      'Net Profit / Loss': totals.netProfitLoss
    });

    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string') {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ItemWiseProfit_${dayjs().format('DDMMYYYY_HHmmss')}.csv`;
    link.click();
  };

  // Column header style
  const headerCellStyle = {
    padding: '12px 10px',
    fontWeight: 600,
    color: '#37474f',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    backgroundColor: '#f5f7fa',
    borderBottom: '2px solid #e0e0e0',
    borderRight: '1px solid #e0e0e0',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none'
  };

  const dataCellStyle = {
    padding: '10px',
    fontSize: '12px',
    borderBottom: '1px solid #f0f0f0',
    borderRight: '1px solid #f0f0f0',
    color: '#455a64'
  };

  const numericCellStyle = {
    ...dataCellStyle,
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: '11px'
  };

  return (
    <Container size="xl" py="md" style={{ maxWidth: '100%' }}>
      <Stack spacing="md">
        {/* Page Header */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0', backgroundColor: '#ffffff' }}>
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
                <Title order={2} style={{ color: '#1976d2', fontWeight: 700, fontSize: '20px' }}>
                  ITEM WISE PROFIT & LOSS
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
                  style={{ border: '1px solid #e0e0e0' }}
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
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* Filters */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0', backgroundColor: '#ffffff' }}>
          <Group position="apart" align="flex-end">
            <Group spacing="md" align="flex-end">
              <DatePickerInput
                label="From Date"
                placeholder="DD/MM/YYYY"
                value={dateRange[0]}
                onChange={(date) => setDateRange([date, dateRange[1]])}
                icon={<IconCalendar size={16} />}
                size="sm"
                style={{ width: 160 }}
                valueFormat="DD/MM/YYYY"
                styles={{
                  input: { borderColor: '#e0e0e0' }
                }}
              />
              <DatePickerInput
                label="To Date"
                placeholder="DD/MM/YYYY"
                value={dateRange[1]}
                onChange={(date) => setDateRange([dateRange[0], date])}
                icon={<IconCalendar size={16} />}
                size="sm"
                style={{ width: 160 }}
                valueFormat="DD/MM/YYYY"
                styles={{
                  input: { borderColor: '#e0e0e0' }
                }}
              />
              <Button
                onClick={handleApplyFilter}
                size="sm"
                style={{ backgroundColor: '#1976d2' }}
              >
                Apply
              </Button>
              <Checkbox
                label="Items Having Sale"
                checked={itemsHavingSale}
                onChange={handleItemsHavingSaleChange}
                size="sm"
                styles={{
                  label: { fontSize: '12px', color: '#455a64' }
                }}
              />
            </Group>
            <TextInput
              placeholder="Search item..."
              icon={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="sm"
              style={{ width: 200 }}
              styles={{
                input: { borderColor: '#e0e0e0' }
              }}
            />
          </Group>
        </Paper>

        <LoadingOverlay visible={loading} overlayBlur={2} />

        {/* Main Content */}
        <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          {/* Section Title */}
          <Box
            p="md"
            style={{
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            <Text weight={600} size="sm" style={{ color: '#37474f', letterSpacing: '0.5px' }}>
              DETAILS
            </Text>
          </Box>

          {/* Table with Horizontal Scroll */}
          <div style={{ overflowX: 'auto' }}>
            <Table
              verticalSpacing="xs"
              fontSize="xs"
              style={{
                minWidth: 1400,
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{ ...headerCellStyle, minWidth: 180, position: 'sticky', left: 0, zIndex: 1 }}
                    onClick={() => handleSort('itemName')}
                  >
                    <Group spacing={4} position="apart">
                      <span>Item Name</span>
                      {getSortIcon('itemName')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 100 }}
                    onClick={() => handleSort('sale')}
                  >
                    <Group spacing={4} position="right">
                      <span>Sale</span>
                      {getSortIcon('sale')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 140 }}
                    onClick={() => handleSort('creditNote')}
                  >
                    <Group spacing={4} position="right">
                      <span>Cr. Note / Sale Return</span>
                      {getSortIcon('creditNote')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 100 }}
                    onClick={() => handleSort('purchase')}
                  >
                    <Group spacing={4} position="right">
                      <span>Purchase</span>
                      {getSortIcon('purchase')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 160 }}
                    onClick={() => handleSort('debitNote')}
                  >
                    <Group spacing={4} position="right">
                      <span>Dr. Note / Purchase Return</span>
                      {getSortIcon('debitNote')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 110 }}
                    onClick={() => handleSort('openingStock')}
                  >
                    <Group spacing={4} position="right">
                      <span>Opening Stock</span>
                      {getSortIcon('openingStock')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 110 }}
                    onClick={() => handleSort('closingStock')}
                  >
                    <Group spacing={4} position="right">
                      <span>Closing Stock</span>
                      {getSortIcon('closingStock')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 110 }}
                    onClick={() => handleSort('taxReceivable')}
                  >
                    <Group spacing={4} position="right">
                      <span>Tax Receivable</span>
                      {getSortIcon('taxReceivable')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 100 }}
                    onClick={() => handleSort('taxPayable')}
                  >
                    <Group spacing={4} position="right">
                      <span>Tax Payable</span>
                      {getSortIcon('taxPayable')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 100 }}
                    onClick={() => handleSort('mfgCost')}
                  >
                    <Group spacing={4} position="right">
                      <span>Mfg. Cost</span>
                      {getSortIcon('mfgCost')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 120 }}
                    onClick={() => handleSort('consumptionCost')}
                  >
                    <Group spacing={4} position="right">
                      <span>Consumption Cost</span>
                      {getSortIcon('consumptionCost')}
                    </Group>
                  </th>
                  <th
                    style={{ ...headerCellStyle, textAlign: 'right', minWidth: 120, borderRight: 'none' }}
                    onClick={() => handleSort('netProfitLoss')}
                  >
                    <Group spacing={4} position="right">
                      <span>Net Profit / Loss</span>
                      {getSortIcon('netProfitLoss')}
                    </Group>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        padding: '60px 20px',
                        textAlign: 'center',
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <Stack spacing="xs" align="center">
                        <Text color="dimmed" size="sm">
                          No items found for the selected period
                        </Text>
                        {searchTerm && (
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => setSearchTerm('')}
                          >
                            Clear Search
                          </Button>
                        )}
                      </Stack>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}
                    >
                      <td style={{
                        ...dataCellStyle,
                        fontWeight: 500,
                        position: 'sticky',
                        left: 0,
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        zIndex: 1
                      }}>
                        {item.itemName}
                      </td>
                      <td style={numericCellStyle}>{formatNumber(item.sale)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.creditNote)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.purchase)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.debitNote)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.openingStock)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.closingStock)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.taxReceivable)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.taxPayable)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.mfgCost)}</td>
                      <td style={numericCellStyle}>{formatNumber(item.consumptionCost)}</td>
                      <td style={{
                        ...numericCellStyle,
                        fontWeight: 600,
                        color: item.netProfitLoss >= 0 ? '#2e7d32' : '#c62828',
                        borderRight: 'none'
                      }}>
                        {formatNumber(item.netProfitLoss)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f5f7fa' }}>
                    <td style={{
                      ...dataCellStyle,
                      fontWeight: 700,
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f5f7fa',
                      zIndex: 1,
                      borderTop: '2px solid #e0e0e0'
                    }}>
                      TOTAL
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.sale)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.creditNote)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.purchase)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.debitNote)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.openingStock)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.closingStock)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.taxReceivable)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.taxPayable)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.mfgCost)}
                    </td>
                    <td style={{ ...numericCellStyle, fontWeight: 700, borderTop: '2px solid #e0e0e0' }}>
                      {formatNumber(totals.consumptionCost)}
                    </td>
                    <td style={{
                      ...numericCellStyle,
                      fontWeight: 700,
                      borderTop: '2px solid #e0e0e0',
                      color: totals.netProfitLoss >= 0 ? '#2e7d32' : '#c62828',
                      borderRight: 'none'
                    }}>
                      {formatNumber(totals.netProfitLoss)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>

          {/* Footer Summary */}
          <Box
            p="md"
            style={{
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center'
            }}
          >
            <Group spacing="xs">
              <Text size="sm" style={{ color: '#455a64', fontWeight: 500 }}>
                Total Amount:
              </Text>
              <Text
                size="lg"
                weight={700}
                style={{
                  color: totals.netProfitLoss >= 0 ? '#2e7d32' : '#c62828',
                  fontFamily: 'monospace'
                }}
              >
                {formatCurrency(totals.netProfitLoss)}
              </Text>
            </Group>
          </Box>
        </Paper>

        {/* Info Footer */}
        {reportData && (
          <Paper p="sm" withBorder style={{ borderColor: '#e0e0e0', backgroundColor: '#fafafa' }}>
            <Group position="apart">
              <Text size="xs" color="dimmed">
                Showing {filteredItems.length} of {reportData.items?.length || 0} items
              </Text>
              <Text size="xs" color="dimmed">
                Last updated: {dayjs().format('DD/MM/YYYY HH:mm')}
              </Text>
            </Group>
          </Paper>
        )}

        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">Select a date range to view Item-wise Profit report</Text>
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

export default VyaparItemWiseProfit;

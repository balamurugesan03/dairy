import { useState, useEffect, useRef } from 'react';
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
  Pagination,
  Select,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { 
  IconFileExport, 
  IconCalendar, 
  IconChartBar, 
  IconChevronLeft, 
  IconChevronRight,
  IconPrinter,
  IconDownload,
  IconEye
} from '@tabler/icons-react';

const VyaparSaleReport = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
      const response = await reportAPI.vyaparSaleReport(filterData);
      setReportData(response.data);
      setCurrentPage(1); // Reset to first page when new data loads
    } catch (error) {
      message.error(error.message || 'Failed to fetch sale report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getStatusBadge = (status) => {
    const statusColors = {
      'Paid': 'green',
      'Pending': 'red',
      'Partial': 'yellow'
    };
    return (
      <Badge 
        color={statusColors[status] || 'gray'} 
        variant="light"
        size="sm"
        radius="sm"
        style={{ minWidth: '70px' }}
      >
        {status}
      </Badge>
    );
  };

  const exportData = reportData?.records?.map(record => ({
    Date: formatDate(record.date),
    'Invoice No': record.invoiceNumber,
    'Party Name': record.partyName,
    'Items': record.itemCount,
    'Subtotal': record.subtotal.toFixed(2),
    'Tax': record.tax.toFixed(2),
    'Total': record.total.toFixed(2),
    'Paid': record.paid.toFixed(2),
    'Balance': record.balance.toFixed(2),
    'Status': record.paymentStatus
  })) || [];

  const handleQuickFilter = (filterType) => {
    fetchReport({ filterType });
  };

  // Calculate paginated data
  const totalRecords = reportData?.records?.length || 0;
  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  
  // Get current page records
  const getCurrentPageRecords = () => {
    if (!reportData?.records) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return reportData.records.slice(startIndex, endIndex);
  };

  const currentPageRecords = getCurrentPageRecords();

  // Calculate totals for current page
  const calculatePageTotals = () => {
    return {
      subtotal: currentPageRecords.reduce((sum, r) => sum + r.subtotal, 0),
      tax: currentPageRecords.reduce((sum, r) => sum + r.tax, 0),
      total: currentPageRecords.reduce((sum, r) => sum + r.total, 0),
      paid: currentPageRecords.reduce((sum, r) => sum + r.paid, 0),
      balance: currentPageRecords.reduce((sum, r) => sum + r.balance, 0)
    };
  };

  const pageTotals = calculatePageTotals();

  // Simple print functionality without react-to-print
  const handlePrint = () => {
    const printContent = document.createElement('div');
    printContent.style.padding = '20px';
    printContent.style.fontFamily = 'Arial, sans-serif';
    
    // Create print header
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
        <h2 style="margin: 0 0 5px 0;">Sales Report</h2>
        <p style="margin: 0; color: #666;">
          ${dateRange[0] && dateRange[1] 
            ? `Period: ${dayjs(dateRange[0]).format('DD/MM/YYYY')} - ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`
            : 'All Records'}
        </p>
        <p style="margin: 0; color: #666;">
          Generated on: ${dayjs().format('DD/MM/YYYY HH:mm')}
        </p>
      </div>
    `;
    printContent.appendChild(header);
    
    // Create summary info
    const summary = document.createElement('div');
    summary.style.display = 'flex';
    summary.style.justifyContent = 'space-between';
    summary.style.margin = '20px 0';
    summary.innerHTML = `
      <div><strong>Total Records:</strong> ${totalRecords}</div>
      <div><strong>Page:</strong> ${currentPage} of ${totalPages}</div>
    `;
    printContent.appendChild(summary);
    
    // Create table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontSize = '11px';
    
    // Table header
    table.innerHTML = `
      <thead>
        <tr>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5;">Date</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5;">Invoice No.</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5;">Party Name</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: center;">Items</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: right;">Subtotal</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: right;">Tax</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: right;">Total</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: right;">Paid</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: right;">Balance</th>
          <th style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; text-align: center;">Status</th>
        </tr>
      </thead>
    `;
    
    // Table body
    const tbody = document.createElement('tbody');
    currentPageRecords.forEach((record) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(record.date)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">${record.invoiceNumber}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${record.partyName}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${record.itemCount}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(record.subtotal)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(record.tax)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(record.total)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; color: #2e7d32;">${formatCurrency(record.paid)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; color: #c62828;">${formatCurrency(record.balance)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
          <span style="
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: bold;
            background-color: ${record.paymentStatus === 'Paid' ? '#e8f5e9' : record.paymentStatus === 'Pending' ? '#ffebee' : '#fff8e1'};
            color: ${record.paymentStatus === 'Paid' ? '#2e7d32' : record.paymentStatus === 'Pending' ? '#c62828' : '#f57c00'};
          ">
            ${record.paymentStatus}
          </span>
        </td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    // Table footer
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
      <tr>
        <td colspan="4" style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Page Totals:</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(pageTotals.subtotal)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(pageTotals.tax)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #1565c0;">${formatCurrency(pageTotals.total)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #2e7d32;">${formatCurrency(pageTotals.paid)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${formatCurrency(pageTotals.balance)}</td>
        <td style="border: 1px solid #000; padding: 8px;"></td>
      </tr>
      ${totalRecords > itemsPerPage ? `
        <tr>
          <td colspan="4" style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5;">Overall Totals:</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5;">${formatCurrency(reportData.records.reduce((sum, r) => sum + r.subtotal, 0))}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5;">${formatCurrency(reportData.records.reduce((sum, r) => sum + r.tax, 0))}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5; color: #1565c0;">${formatCurrency(reportData.records.reduce((sum, r) => sum + r.total, 0))}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5; color: #2e7d32;">${formatCurrency(reportData.records.reduce((sum, r) => sum + r.paid, 0))}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f5f5f5; color: #c62828;">${formatCurrency(reportData.records.reduce((sum, r) => sum + r.balance, 0))}</td>
          <td style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5;"></td>
        </tr>
      ` : ''}
    `;
    table.appendChild(tfoot);
    
    printContent.appendChild(table);
    
    // Add footer
    const footer = document.createElement('div');
    footer.style.marginTop = '20px';
    footer.style.fontSize = '10px';
    footer.style.color = '#666';
    footer.style.textAlign = 'center';
    footer.innerHTML = `Page ${currentPage} of ${totalPages} | Printed on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`;
    printContent.appendChild(footer);
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Report - ${dayjs().format('DD-MM-YYYY_HH-mm')}</title>
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 20mm;
              }
              body {
                font-family: 'Arial', sans-serif;
                font-size: 11px;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                font-size: 11px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 6px 8px;
                text-align: left;
              }
              th {
                background-color: #f5f5f5;
                font-weight: bold;
              }
            }
            @media screen {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Container size="xl" py="md">
      <Stack spacing="md">
        {/* Page Header */}
        <Box>
          <Group position="apart" align="flex-start">
            <div>
              <Title order={2} style={{ color: '#2c3e50' }}>Sales Report</Title>
              <Text color="dimmed" size="sm">
                Detailed sales transaction report with payment status
              </Text>
            </div>
            <Group spacing="xs">
              <Tooltip label="Print Report">
                <ActionIcon 
                  color="blue" 
                  variant="light" 
                  size="lg"
                  onClick={handlePrint}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftIcon={<IconFileExport size={16} />}
                variant="light"
                color="blue"
                onClick={() => {/* Export functionality */}}
              >
                Export
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Date Filter Toolbar */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Stack>
            <Group position="apart">
              <Text weight={600} size="sm" style={{ color: '#455a64' }}>Filter by Date Range</Text>
              <Group spacing="xs">
                <Button
                  compact
                  variant="subtle"
                  size="xs"
                  onClick={() => handleQuickFilter('today')}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  Today
                </Button>
                <Button
                  compact
                  variant="subtle"
                  size="xs"
                  onClick={() => handleQuickFilter('thisWeek')}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  This Week
                </Button>
                <Button
                  compact
                  variant="subtle"
                  size="xs"
                  onClick={() => handleQuickFilter('thisMonth')}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  This Month
                </Button>
              </Group>
            </Group>
            <Group>
              <DatePickerInput
                type="range"
                placeholder="Pick date range"
                value={dateRange}
                onChange={setDateRange}
                clearable
                icon={<IconCalendar size={16} />}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button
                leftIcon={<IconChartBar size={16} />}
                onClick={() => {
                  if (dateRange[0] && dateRange[1]) {
                    handleFilterChange({
                      filterType: 'custom',
                      customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
                      customEnd: dayjs(dateRange[1]).format('YYYY-MM-DD')
                    });
                  } else {
                    message.warning('Please select both start and end dates');
                  }
                }}
                size="sm"
                style={{ backgroundColor: '#1976d2' }}
              >
                Apply Filter
              </Button>
            </Group>
          </Stack>
        </Paper>

        <LoadingOverlay visible={loading} overlayBlur={2} />

        {reportData && !loading && (
          <>
            {/* Summary Cards */}
            <Grid>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" color="dimmed" weight={500}>
                    Total Sales
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#2e7d32' }}>
                    {formatCurrency(reportData.summary.totalSales)}
                  </Title>
                  <Text size="sm" color="dimmed" mt={4}>
                    {reportData.summary.totalBills} bills
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" color="dimmed" weight={500}>
                    Total Tax
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#1976d2' }}>
                    {formatCurrency(reportData.summary.totalTax)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" color="dimmed" weight={500}>
                    Paid Amount
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#2e7d32' }}>
                    {formatCurrency(reportData.summary.paidAmount)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" color="dimmed" weight={500}>
                    Pending Amount
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#d32f2f' }}>
                    {formatCurrency(reportData.summary.pendingAmount)}
                  </Title>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Report Table with Professional Styling */}
            <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden' }}>
              <Box p="md" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
                <Group position="apart">
                  <Text weight={600} style={{ color: '#455a64' }}>
                    Showing {totalRecords} total transactions
                    {totalRecords > itemsPerPage && (
                      <Text component="span" size="sm" color="dimmed" ml="xs">
                        ({currentPageRecords.length} on this page)
                      </Text>
                    )}
                  </Text>
                  <Group spacing="xs">
                    <Select
                      value={itemsPerPage.toString()}
                      onChange={(value) => {
                        setItemsPerPage(parseInt(value || '10'));
                        setCurrentPage(1);
                      }}
                      data={[
                        { value: '10', label: '10 per page' },
                        { value: '20', label: '20 per page' },
                        { value: '30', label: '30 per page' },
                        { value: '50', label: '50 per page' },
                        { value: '100', label: '100 per page' }
                      ]}
                      size="xs"
                      style={{ width: 120 }}
                    />
                    <Tooltip label="Print Current Page">
                      <ActionIcon 
                        color="gray" 
                        variant="subtle"
                        onClick={handlePrint}
                        size="sm"
                      >
                        <IconPrinter size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Button
                      leftIcon={<IconDownload size={14} />}
                      variant="subtle"
                      size="xs"
                      onClick={() => {/* Export functionality */}}
                    >
                      Export
                    </Button>
                  </Group>
                </Group>
              </Box>

              <div style={{ overflowX: 'auto' }}>
                <Table
                  verticalSpacing="xs"
                  fontSize="xs"
                  highlightOnHover
                  style={{ 
                    borderCollapse: 'separate',
                    borderSpacing: 0
                  }}
                >
                  <thead style={{ backgroundColor: '#f5f7fa' }}>
                    <tr>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}>Date</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}>Invoice No.</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}>Party Name</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>Items</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'right'
                      }}>Subtotal</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'right'
                      }}>Tax</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'right'
                      }}>Total</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'right'
                      }}>Paid</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRight: 'none',
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'right'
                      }}>Balance</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>Status</th>
                      <th style={{ 
                        border: '1px solid #e0e0e0', 
                        padding: '10px 12px',
                        color: '#455a64',
                        fontWeight: 600,
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageRecords.length === 0 ? (
                      <tr>
                        <td colSpan="11">
                          <Center py="xl">
                            <Text color="dimmed">No sales data available for the selected period</Text>
                          </Center>
                        </td>
                      </tr>
                    ) : (
                      currentPageRecords.map((record, idx) => (
                        <tr 
                          key={idx} 
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                          }}
                        >
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px'
                          }}>{formatDate(record.date)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            fontWeight: 500
                          }}>{record.invoiceNumber}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px'
                          }}>{record.partyName}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'center'
                          }}>{record.itemCount}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'right'
                          }}>{formatCurrency(record.subtotal)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'right'
                          }}>{formatCurrency(record.tax)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: '#1976d2'
                          }}>{formatCurrency(record.total)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'right',
                            color: '#2e7d32',
                            fontWeight: 500
                          }}>{formatCurrency(record.paid)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'right',
                            color: '#c62828',
                            fontWeight: 500
                          }}>{formatCurrency(record.balance)}</td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderRight: 'none',
                            padding: '10px 12px',
                            textAlign: 'center'
                          }}>
                            {getStatusBadge(record.paymentStatus)}
                          </td>
                          <td style={{ 
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            padding: '10px 12px',
                            textAlign: 'center'
                          }}>
                            <Tooltip label="View Details">
                              <ActionIcon
                                color="blue"
                                variant="subtle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/sales/view/${record._id}`);
                                }}
                                size="sm"
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f1f3f4' }}>
                      <td colSpan="4" style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#455a64'
                      }}>
                        Page Totals:
                      </td>
                      <td style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#455a64'
                      }}>
                        {formatCurrency(pageTotals.subtotal)}
                      </td>
                      <td style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#455a64'
                      }}>
                        {formatCurrency(pageTotals.tax)}
                      </td>
                      <td style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#1976d2'
                      }}>
                        {formatCurrency(pageTotals.total)}
                      </td>
                      <td style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#2e7d32'
                      }}>
                        {formatCurrency(pageTotals.paid)}
                      </td>
                      <td style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        borderRight: 'none',
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#c62828'
                      }}>
                        {formatCurrency(pageTotals.balance)}
                      </td>
                      <td colSpan="2" style={{ 
                        border: '1px solid #e0e0e0',
                        borderTop: 'none',
                        padding: '12px'
                      }}></td>
                    </tr>
                    {totalRecords > itemsPerPage && (
                      <tr style={{ backgroundColor: '#e8eaf6' }}>
                        <td colSpan="4" style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#37474f'
                        }}>
                          Overall Totals:
                        </td>
                        <td style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#37474f'
                        }}>
                          {formatCurrency(reportData.records.reduce((sum, r) => sum + r.subtotal, 0))}
                        </td>
                        <td style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#37474f'
                        }}>
                          {formatCurrency(reportData.records.reduce((sum, r) => sum + r.tax, 0))}
                        </td>
                        <td style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#1565c0'
                        }}>
                          {formatCurrency(reportData.records.reduce((sum, r) => sum + r.total, 0))}
                        </td>
                        <td style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#1b5e20'
                        }}>
                          {formatCurrency(reportData.records.reduce((sum, r) => sum + r.paid, 0))}
                        </td>
                        <td style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderRight: 'none',
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#b71c1c'
                        }}>
                          {formatCurrency(reportData.records.reduce((sum, r) => sum + r.balance, 0))}
                        </td>
                        <td colSpan="2" style={{ 
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          padding: '12px'
                        }}></td>
                      </tr>
                    )}
                  </tfoot>
                </Table>
              </div>

              {/* Pagination */}
              {totalRecords > 0 && (
                <>
                  <Divider />
                  <Box p="md" style={{ backgroundColor: '#f8f9fa' }}>
                    <Group position="apart">
                      <Text size="sm" color="dimmed">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                        {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} entries
                      </Text>
                      <Group spacing="xs">
                        <Button
                          variant="subtle"
                          size="xs"
                          leftIcon={<IconChevronLeft size={14} />}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{ border: '1px solid #e0e0e0' }}
                        >
                          Previous
                        </Button>
                        
                        <Pagination
                          page={currentPage}
                          onChange={setCurrentPage}
                          total={totalPages}
                          size="sm"
                          radius="sm"
                          siblings={1}
                          boundaries={1}
                          styles={(theme) => ({
                            control: {
                              border: '1px solid #e0e0e0',
                              '&[data-active]': {
                                backgroundColor: '#1976d2',
                                borderColor: '#1976d2'
                              }
                            }
                          })}
                        />
                        
                        <Button
                          variant="subtle"
                          size="xs"
                          rightIcon={<IconChevronRight size={14} />}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          style={{ border: '1px solid #e0e0e0' }}
                        >
                          Next
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </>
              )}
            </Paper>
          </>
        )}

        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">Select a date range to view Sales Report</Text>
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

export default VyaparSaleReport;
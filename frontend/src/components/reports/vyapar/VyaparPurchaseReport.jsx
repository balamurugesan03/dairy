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
  IconSettings
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';

const VyaparPurchaseReport = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const printRef = useRef();

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
      const response = await reportAPI.vyaparPurchaseReport(filterData);
      setReportData(response.data);
      setCurrentPage(1); // Reset to first page when new data loads
    } catch (error) {
      message.error(error.message || 'Failed to fetch purchase report');
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
    'Supplier Name': record.supplierName,
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

  // Print functionality
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Purchase_Report_${dayjs().format('DD-MM-YYYY_HH-mm')}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 20mm;
      }
      @media print {
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
        .print-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        .print-summary {
          margin: 20px 0;
          display: flex;
          justify-content: space-between;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  });

  // Print Component
  const PrintComponent = () => (
    <div style={{ display: 'none' }}>
      <div ref={printRef} style={{ padding: '20px' }}>
        <div className="print-header">
          <h2 style={{ margin: '0 0 5px 0' }}>Purchase Report</h2>
          <p style={{ margin: '0', color: '#666' }}>
            {dateRange[0] && dateRange[1] 
              ? `Period: ${dayjs(dateRange[0]).format('DD/MM/YYYY')} - ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`
              : 'All Records'}
          </p>
          <p style={{ margin: '0', color: '#666' }}>
            Generated on: {dayjs().format('DD/MM/YYYY HH:mm')}
          </p>
        </div>

        <div className="print-summary">
          <div>
            <strong>Total Records:</strong> {totalRecords}
          </div>
          <div>
            <strong>Page:</strong> {currentPage} of {totalPages}
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5' }}>Date</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5' }}>Invoice No.</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5' }}>Supplier Name</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'center' }}>Items</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Subtotal</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Tax</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Total</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Paid</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Balance</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentPageRecords.map((record, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: '6px' }}>{formatDate(record.date)}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', fontWeight: 'bold' }}>{record.invoiceNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px' }}>{record.supplierName}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>{record.itemCount}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{formatCurrency(record.subtotal)}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{formatCurrency(record.tax)}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                  {formatCurrency(record.total)}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', color: '#2e7d32' }}>
                  {formatCurrency(record.paid)}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', color: '#c62828' }}>
                  {formatCurrency(record.balance)}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    backgroundColor: 
                      record.paymentStatus === 'Paid' ? '#e8f5e9' :
                      record.paymentStatus === 'Pending' ? '#ffebee' : '#fff8e1',
                    color:
                      record.paymentStatus === 'Paid' ? '#2e7d32' :
                      record.paymentStatus === 'Pending' ? '#c62828' : '#f57c00'
                  }}>
                    {record.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="4" style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                Page Totals:
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(pageTotals.subtotal)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(pageTotals.tax)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1565c0' }}>
                {formatCurrency(pageTotals.total)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>
                {formatCurrency(pageTotals.paid)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#c62828' }}>
                {formatCurrency(pageTotals.balance)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px' }}></td>
            </tr>
            {totalRecords > itemsPerPage && (
              <tr>
                <td colSpan="4" style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  Overall Totals:
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  {formatCurrency(reportData.records.reduce((sum, r) => sum + r.subtotal, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  {formatCurrency(reportData.records.reduce((sum, r) => sum + r.tax, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5', color: '#1565c0' }}>
                  {formatCurrency(reportData.records.reduce((sum, r) => sum + r.total, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5', color: '#2e7d32' }}>
                  {formatCurrency(reportData.records.reduce((sum, r) => sum + r.paid, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f5f5f5', color: '#c62828' }}>
                  {formatCurrency(reportData.records.reduce((sum, r) => sum + r.balance, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f5f5f5' }}></td>
              </tr>
            )}
          </tfoot>
        </table>

        <div style={{ marginTop: '20px', fontSize: '10px', color: '#666', textAlign: 'center' }}>
          Page {currentPage} of {totalPages} | Printed on {dayjs().format('DD/MM/YYYY HH:mm:ss')}
        </div>
      </div>
    </div>
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Page Header */}
        <Box>
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={2} style={{ color: '#2c3e50' }}>Purchase Report</Title>
              <Text c="dimmed" size="sm">
                Detailed purchase transaction report with payment status
              </Text>
            </div>
            <Group gap="xs">
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
                leftSection={<IconFileExport size={16} />}
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
        <Paper p="md" bd="1px solid #e0e0e0">
          <Stack>
            <Group justify="space-between">
              <Text fw={600} size="sm" style={{ color: '#455a64' }}>Filter by Date Range</Text>
              <Group gap="xs">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => handleQuickFilter('today')}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  Today
                </Button>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => handleQuickFilter('thisWeek')}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  This Week
                </Button>
                <Button
                  size="compact-xs"
                  variant="subtle"
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
                leftSection={<IconCalendar size={16} />}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button
                leftSection={<IconChartBar size={16} />}
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

        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
          <>
            {/* Report Table with Professional Styling */}
            <Paper bd="1px solid #e0e0e0" style={{ overflow: 'hidden' }}>
              <Box p="md" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
                <Group justify="space-between">
                  <Text fw={600} style={{ color: '#455a64' }}>
                    Showing {totalRecords} total transactions
                    {totalRecords > itemsPerPage && (
                      <Text component="span" size="sm" c="dimmed" ml="xs">
                        ({currentPageRecords.length} on this page)
                      </Text>
                    )}
                  </Text>
                  <Group gap="xs">
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
                      leftSection={<IconDownload size={14} />}
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
                      }}>Supplier Name</th>
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
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageRecords.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <Center py="xl">
                            <Text c="dimmed">No purchase data available for the selected period</Text>
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
                          }}>{record.supplierName}</td>
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
                            padding: '10px 12px',
                            textAlign: 'center'
                          }}>
                            {getStatusBadge(record.paymentStatus)}
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
                      <td style={{ 
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
                        <td style={{ 
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
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                        {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} entries
                      </Text>
                      <Group gap="xs">
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={<IconChevronLeft size={14} />}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{ border: '1px solid #e0e0e0' }}
                        >
                          Previous
                        </Button>

                        <Pagination
                          value={currentPage}
                          onChange={setCurrentPage}
                          total={totalPages}
                          size="sm"
                          radius="sm"
                          siblings={1}
                          boundaries={1}
                        />

                        <Button
                          variant="subtle"
                          size="xs"
                          rightSection={<IconChevronRight size={14} />}
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

            {/* Summary Cards */}
            <Grid>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" c="dimmed" fw={500}>
                    Total Purchases
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#d32f2f' }}>
                    {formatCurrency(reportData.summary.totalPurchases)}
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    {reportData.summary.totalBills} bills
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" c="dimmed" fw={500}>
                    Total Tax
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#1976d2' }}>
                    {formatCurrency(reportData.summary.totalTax)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" c="dimmed" fw={500}>
                    Paid Amount
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#2e7d32' }}>
                    {formatCurrency(reportData.summary.paidAmount)}
                  </Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={3}>
                <Card withBorder padding="lg" radius="md" style={{ borderColor: '#e0e0e0' }}>
                  <Text size="sm" c="dimmed" fw={500}>
                    Pending Amount
                  </Text>
                  <Title order={3} mt="xs" style={{ color: '#f57c00' }}>
                    {formatCurrency(reportData.summary.pendingAmount)}
                  </Title>
                </Card>
              </Grid.Col>
            </Grid>
          </>
        )}

        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">Select a date range to view Purchase Report</Text>
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
      
      {/* Print Component - Hidden in normal view */}
      <PrintComponent />
    </Container>
  );
};

export default VyaparPurchaseReport;
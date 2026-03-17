import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, businessItemAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Paper,
  Text,
  Group,
  Table,
  Select,
  ActionIcon,
  Tooltip,
  Box,
  LoadingOverlay,
  Button
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconCalendar
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';

const VyaparStockStatement = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || '';
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateFilterType, setDateFilterType] = useState('thisMonth');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    fetchReport();
  }, [selectedCategory, fromDate, toDate, dateFilterType]);

  const fetchCategories = async () => {
    try {
      const response = await businessItemAPI.getAll({ limit: 1000 });
      const items = response.data?.items || response.data || [];
      const uniqueCategories = [...new Set(items.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories.map(cat => ({ value: cat, label: cat })));
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleQuickFilter = (type) => {
    setDateFilterType(type);
    const now = dayjs();
    switch (type) {
      case 'today':
        setFromDate(now.startOf('day').toDate());
        setToDate(now.endOf('day').toDate());
        break;
      case 'thisWeek':
        setFromDate(now.startOf('week').toDate());
        setToDate(now.endOf('week').toDate());
        break;
      case 'thisMonth':
        setFromDate(now.startOf('month').toDate());
        setToDate(now.endOf('month').toDate());
        break;
      case 'thisYear':
        setFromDate(now.startOf('year').toDate());
        setToDate(now.endOf('year').toDate());
        break;
      case 'custom':
        break;
      default:
        break;
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        filterType: 'custom',
        customStart: dayjs(fromDate).format('YYYY-MM-DD'),
        customEnd: dayjs(toDate).format('YYYY-MM-DD')
      };

      if (selectedCategory && selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      const response = await reportAPI.vyaparStockStatement(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock statement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatQuantity = (qty) => {
    const num = parseFloat(qty || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals
  const totals = {
    openingStock: (reportData?.items || []).reduce((sum, item) => sum + (item.openingStock || 0), 0),
    purchaseQty: (reportData?.items || []).reduce((sum, item) => sum + (item.purchaseQty || 0), 0),
    purchaseReturn: (reportData?.items || []).reduce((sum, item) => sum + (item.purchaseReturn || 0), 0),
    salesQty: (reportData?.items || []).reduce((sum, item) => sum + (item.salesQty || 0), 0),
    salesReturn: (reportData?.items || []).reduce((sum, item) => sum + (item.salesReturn || 0), 0),
    closingStock: (reportData?.items || []).reduce((sum, item) => sum + (item.closingStock || 0), 0),
    stockValue: (reportData?.items || []).reduce((sum, item) => sum + (item.stockValue || 0), 0)
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData?.items?.length) {
      message.warning('No data to export');
      return;
    }

    const exportData = reportData.items.map(item => ({
      'Item Name': item.itemName,
      'Opening Stock': item.openingStock || 0,
      'Purchase Qty': item.purchaseQty || 0,
      'Purchase Return': item.purchaseReturn || 0,
      'Sales Qty': item.salesQty || 0,
      'Sales Return': item.salesReturn || 0,
      'Closing Stock': item.closingStock || 0,
      'Stock Value': item.stockValue || 0
    }));

    exportData.push({
      'Item Name': 'Total',
      'Opening Stock': totals.openingStock,
      'Purchase Qty': totals.purchaseQty,
      'Purchase Return': totals.purchaseReturn,
      'Sales Qty': totals.salesQty,
      'Sales Return': totals.salesReturn,
      'Closing Stock': totals.closingStock,
      'Stock Value': totals.stockValue
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Statement');

    const fileName = `Stock_Statement_${dayjs(fromDate).format('DD-MM-YYYY')}_to_${dayjs(toDate).format('DD-MM-YYYY')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    message.success('Exported successfully');
  };

  // Print functionality
  const handlePrint = () => {
    const printContent = document.createElement('div');
    printContent.style.padding = '20px';
    printContent.style.fontFamily = 'Arial, sans-serif';
    printContent.style.backgroundColor = '#fff';

    printContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #000;">
        ${companyName ? `<h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">${companyName}</h1>` : ''}
        <h2 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; display: inline-block; border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 2px 10px;">STOCK STATEMENT</h2>
        <p style="margin: 0; font-size: 12px; color: #666;">
          Period: ${dayjs(fromDate).format('DD/MM/YYYY')} to ${dayjs(toDate).format('DD/MM/YYYY')}
        </p>
        ${selectedCategory && selectedCategory !== 'all' ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Category: ${selectedCategory}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-weight: 600;">Item Name</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Opening</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Purchase</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Pur. Return</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Sales</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Sales Return</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Closing</th>
            <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 600;">Stock Value</th>
          </tr>
        </thead>
        <tbody>
          ${(reportData?.items || []).map(item => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 6px 8px;">${item.itemName}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatQuantity(item.openingStock)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatQuantity(item.purchaseQty)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatQuantity(item.purchaseReturn)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatQuantity(item.salesQty)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatQuantity(item.salesReturn)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-weight: 500; ${item.closingStock <= 0 ? 'color: #dc3545;' : ''}">${formatQuantity(item.closingStock)}</td>
              <td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right;">${formatCurrency(item.stockValue)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; font-weight: 600;">
            <td style="border: 1px solid #ddd; padding: 8px;">Total</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.openingStock)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.purchaseQty)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.purchaseReturn)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.salesQty)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.salesReturn)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatQuantity(totals.closingStock)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(totals.stockValue)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 20px; font-size: 10px; color: #666; text-align: center;">
        Printed on ${dayjs().format('DD/MM/YYYY HH:mm')}
      </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Stock Statement - ${dayjs(fromDate).format('DD-MM-YYYY')} to ${dayjs(toDate).format('DD-MM-YYYY')}</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 10mm; }
              body { font-family: Arial, sans-serif; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const quickFilterButtons = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'thisWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'This Year', value: 'thisYear' },
    { label: 'Custom', value: 'custom' }
  ];

  const thStyle = {
    padding: '12px 12px',
    borderBottom: '2px solid #dee2e6',
    fontWeight: 600,
    fontSize: '11px',
    color: '#495057',
    textAlign: 'right'
  };

  const tdStyle = {
    padding: '10px 12px',
    borderBottom: '1px solid #e9ecef',
    fontSize: '12px',
    color: '#212529',
    textAlign: 'right'
  };

  return (
    <Container size="xl" py="md" style={{ maxWidth: '1200px' }}>
      <Paper
        shadow="xs"
        radius="sm"
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Filters Section */}
        <Box
          p="md"
          style={{
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#fafafa'
          }}
        >
          <Group position="apart" align="flex-end">
            <Group spacing="md" align="flex-end">
              <Text
                size="xs"
                weight={600}
                style={{
                  color: '#666',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}
              >
                FILTERS
              </Text>

              <DatePickerInput
                label="From"
                value={fromDate}
                onChange={(val) => {
                  setFromDate(val);
                  setDateFilterType('custom');
                }}
                valueFormat="DD/MM/YYYY"
                size="xs"
                icon={<IconCalendar size={14} />}
                style={{ width: 140 }}
                styles={{
                  input: {
                    border: '1px solid #d0d0d0',
                    backgroundColor: '#fff',
                    fontSize: '12px'
                  },
                  label: { fontSize: '11px', color: '#666' }
                }}
              />

              <DatePickerInput
                label="To"
                value={toDate}
                onChange={(val) => {
                  setToDate(val);
                  setDateFilterType('custom');
                }}
                valueFormat="DD/MM/YYYY"
                size="xs"
                icon={<IconCalendar size={14} />}
                style={{ width: 140 }}
                styles={{
                  input: {
                    border: '1px solid #d0d0d0',
                    backgroundColor: '#fff',
                    fontSize: '12px'
                  },
                  label: { fontSize: '11px', color: '#666' }
                }}
              />

              <Select
                placeholder="All Categories"
                value={selectedCategory}
                onChange={setSelectedCategory}
                data={[
                  { value: 'all', label: 'All Categories' },
                  ...categories
                ]}
                size="xs"
                style={{ width: 160 }}
                styles={{
                  input: {
                    border: '1px solid #d0d0d0',
                    backgroundColor: '#fff',
                    fontSize: '12px'
                  }
                }}
              />
            </Group>

            {/* Action Icons */}
            <Group spacing="xs">
              <Tooltip label="Export to Excel" position="bottom">
                <ActionIcon
                  variant="subtle"
                  color="green"
                  size="lg"
                  onClick={handleExportExcel}
                  style={{ border: '1px solid #d0d0d0' }}
                >
                  <IconFileSpreadsheet size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Print" position="bottom">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="lg"
                  onClick={handlePrint}
                  style={{ border: '1px solid #d0d0d0' }}
                >
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Quick Filter Buttons */}
          <Group spacing="xs" mt="sm">
            {quickFilterButtons.map(btn => (
              <Button
                key={btn.value}
                variant={dateFilterType === btn.value ? 'filled' : 'outline'}
                color={dateFilterType === btn.value ? 'blue' : 'gray'}
                size="compact-xs"
                onClick={() => handleQuickFilter(btn.value)}
                styles={{
                  root: {
                    fontSize: '11px',
                    height: '26px',
                    padding: '0 10px'
                  }
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Group>
        </Box>

        {/* Report Title */}
        <Box
          py="sm"
          px="md"
          style={{
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#fff'
          }}
        >
          <Group position="apart">
            <Text
              size="sm"
              weight={600}
              style={{
                color: '#333',
                letterSpacing: '0.3px'
              }}
            >
              STOCK STATEMENT
            </Text>
            <Text size="xs" color="dimmed">
              {dayjs(fromDate).format('DD/MM/YYYY')} - {dayjs(toDate).format('DD/MM/YYYY')}
            </Text>
          </Group>
        </Box>

        {/* Data Table */}
        <Box
          ref={printRef}
          style={{
            position: 'relative',
            minHeight: '200px',
            backgroundColor: '#fff'
          }}
        >
          <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />

          <div style={{ overflowX: 'auto' }}>
            <Table
              horizontalSpacing="sm"
              verticalSpacing="xs"
              fontSize="xs"
              style={{
                borderCollapse: 'collapse',
                width: '100%'
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Item Name</th>
                  <th style={thStyle}>Opening Stock</th>
                  <th style={thStyle}>Purchase Qty</th>
                  <th style={thStyle}>Purchase Return</th>
                  <th style={thStyle}>Sales Qty</th>
                  <th style={thStyle}>Sales Return</th>
                  <th style={thStyle}>Closing Stock</th>
                  <th style={thStyle}>Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {(!reportData?.items || reportData.items.length === 0) ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: '40px 16px',
                        textAlign: 'center',
                        color: '#868e96',
                        fontSize: '13px',
                        borderBottom: '1px solid #e9ecef'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 500 }}>No items found for the selected period</span>
                        <span style={{ fontSize: '12px' }}>
                          {dayjs(fromDate).format('DD/MM/YYYY')} - {dayjs(toDate).format('DD/MM/YYYY')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#adb5bd' }}>
                          Try adjusting the date range or category filter
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportData.items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa'
                      }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'left' }}>
                        {item.itemName}
                      </td>
                      <td style={tdStyle}>
                        {formatQuantity(item.openingStock)}
                      </td>
                      <td style={tdStyle}>
                        {formatQuantity(item.purchaseQty)}
                      </td>
                      <td style={{
                        ...tdStyle,
                        color: item.purchaseReturn > 0 ? '#dc3545' : '#212529'
                      }}>
                        {formatQuantity(item.purchaseReturn)}
                      </td>
                      <td style={tdStyle}>
                        {formatQuantity(item.salesQty)}
                      </td>
                      <td style={{
                        ...tdStyle,
                        color: item.salesReturn > 0 ? '#28a745' : '#212529'
                      }}>
                        {formatQuantity(item.salesReturn)}
                      </td>
                      <td style={{
                        ...tdStyle,
                        fontWeight: 500,
                        color: item.closingStock <= 0 ? '#dc3545' : '#212529'
                      }}>
                        {formatQuantity(item.closingStock)}
                      </td>
                      <td style={tdStyle}>
                        {formatCurrency(item.stockValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Total Row */}
              <tfoot>
                <tr style={{ backgroundColor: '#f1f3f5' }}>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#212529'
                  }}>
                    Total
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right'
                  }}>
                    {formatQuantity(totals.openingStock)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right'
                  }}>
                    {formatQuantity(totals.purchaseQty)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right',
                    color: totals.purchaseReturn > 0 ? '#dc3545' : '#212529'
                  }}>
                    {formatQuantity(totals.purchaseReturn)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right'
                  }}>
                    {formatQuantity(totals.salesQty)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right',
                    color: totals.salesReturn > 0 ? '#28a745' : '#212529'
                  }}>
                    {formatQuantity(totals.salesReturn)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right',
                    color: totals.closingStock <= 0 ? '#dc3545' : '#212529'
                  }}>
                    {formatQuantity(totals.closingStock)}
                  </td>
                  <td style={{
                    padding: '12px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'right'
                  }}>
                    {formatCurrency(totals.stockValue)}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </Box>
      </Paper>
    </Container>
  );
};

export default VyaparStockStatement;

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, itemAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Paper,
  Text,
  Group,
  Table,
  Checkbox,
  Select,
  ActionIcon,
  Tooltip,
  Box,
  LoadingOverlay
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconCalendar
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';

const VyaparStockSummary = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [enableDateFilter, setEnableDateFilter] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

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
  }, [selectedCategory, enableDateFilter, selectedDate, showOnlyInStock]);

  const fetchCategories = async () => {
    try {
      const response = await itemAPI.getAll({ limit: 1000 });
      const items = response.data?.items || response.data || [];
      const uniqueCategories = [...new Set(items.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories.map(cat => ({ value: cat, label: cat })));
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};

      if (selectedCategory && selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      if (enableDateFilter && selectedDate) {
        params.asOfDate = dayjs(selectedDate).format('YYYY-MM-DD');
      }

      if (showOnlyInStock) {
        params.showOnlyInStock = true;
      }

      const response = await reportAPI.vyaparStockSummary(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock summary');
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
    stockQty: (reportData?.items || []).reduce((sum, item) => sum + (item.stockQty || 0), 0),
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
      'Sale Price': item.salePrice || 0,
      'Purchase Price': item.purchasePrice || 0,
      'Stock Qty': item.stockQty || 0,
      'Stock Value': item.stockValue || 0
    }));

    // Add totals row
    exportData.push({
      'Item Name': 'Total',
      'Sale Price': '',
      'Purchase Price': '',
      'Stock Qty': totals.stockQty,
      'Stock Value': totals.stockValue
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Summary');

    const fileName = `Stock_Summary_${dayjs().format('DD-MM-YYYY')}.xlsx`;
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
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #000;">STOCK SUMMARY</h2>
        <p style="margin: 0; font-size: 12px; color: #666;">
          ${enableDateFilter && selectedDate ? `As on: ${dayjs(selectedDate).format('DD/MM/YYYY')}` : `As on: ${dayjs().format('DD/MM/YYYY')}`}
        </p>
        ${selectedCategory && selectedCategory !== 'all' ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Category: ${selectedCategory}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-weight: 600;">Item Name</th>
            <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-weight: 600;">Sale Price</th>
            <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-weight: 600;">Purchase Price</th>
            <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-weight: 600;">Stock Qty</th>
            <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-weight: 600;">Stock Value</th>
          </tr>
        </thead>
        <tbody>
          ${(reportData?.items || []).map(item => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px 12px;">${item.itemName}</td>
              <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${formatCurrency(item.salePrice)}</td>
              <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${formatCurrency(item.purchasePrice)}</td>
              <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; ${item.stockQty === 0 ? 'color: #dc3545;' : ''}">${formatQuantity(item.stockQty)}</td>
              <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${formatCurrency(item.stockValue)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; font-weight: 600;">
            <td style="border: 1px solid #ddd; padding: 10px 12px;">Total</td>
            <td style="border: 1px solid #ddd; padding: 10px 12px;"></td>
            <td style="border: 1px solid #ddd; padding: 10px 12px;"></td>
            <td style="border: 1px solid #ddd; padding: 10px 12px; text-align: right; ${totals.stockQty === 0 ? 'color: #dc3545;' : ''}">${formatQuantity(totals.stockQty)}</td>
            <td style="border: 1px solid #ddd; padding: 10px 12px; text-align: right;">${formatCurrency(totals.stockValue)}</td>
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
          <title>Stock Summary - ${dayjs().format('DD-MM-YYYY')}</title>
          <style>
            @media print {
              @page { size: A4 portrait; margin: 15mm; }
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

  return (
    <Container size="lg" py="md" style={{ maxWidth: '1000px' }}>
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
          <Group position="apart" align="flex-start">
            <Group spacing="lg" align="flex-end">
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

              <Group spacing="xs" align="center">
                <Checkbox
                  checked={enableDateFilter}
                  onChange={(e) => setEnableDateFilter(e.currentTarget.checked)}
                  label="Date filter"
                  size="xs"
                  styles={{
                    label: { fontSize: '12px', color: '#444' }
                  }}
                />

                {enableDateFilter && (
                  <DatePickerInput
                    value={selectedDate}
                    onChange={setSelectedDate}
                    placeholder="Select date"
                    valueFormat="DD/MM/YYYY"
                    size="xs"
                    icon={<IconCalendar size={14} />}
                    style={{ width: 140 }}
                    styles={{
                      input: {
                        border: '1px solid #d0d0d0',
                        backgroundColor: '#fff',
                        fontSize: '12px'
                      }
                    }}
                  />
                )}
              </Group>

              <Checkbox
                checked={showOnlyInStock}
                onChange={(e) => setShowOnlyInStock(e.currentTarget.checked)}
                label="Show items in stock"
                size="xs"
                styles={{
                  label: { fontSize: '12px', color: '#444' }
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
          <Text
            size="sm"
            weight={600}
            style={{
              color: '#333',
              letterSpacing: '0.3px'
            }}
          >
            STOCK SUMMARY
          </Text>
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
          <LoadingOverlay visible={loading} overlayBlur={1} />

          <div style={{ overflowX: 'auto' }}>
            <Table
              horizontalSpacing="md"
              verticalSpacing="xs"
              fontSize="xs"
              style={{
                borderCollapse: 'collapse',
                width: '100%'
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{
                    padding: '12px 16px',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#495057',
                    textAlign: 'left'
                  }}>
                    Item Name
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#495057',
                    textAlign: 'right'
                  }}>
                    Sale Price
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#495057',
                    textAlign: 'right'
                  }}>
                    Purchase Price
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#495057',
                    textAlign: 'right'
                  }}>
                    Stock Qty
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#495057',
                    textAlign: 'right'
                  }}>
                    Stock Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {(!reportData?.items || reportData.items.length === 0) ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: '40px 16px',
                        textAlign: 'center',
                        color: '#868e96',
                        fontSize: '13px',
                        borderBottom: '1px solid #e9ecef'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 500 }}>No items found for the selected filters</span>
                        {enableDateFilter && selectedDate && (
                          <span style={{ fontSize: '12px' }}>
                            As on: {dayjs(selectedDate).format('DD/MM/YYYY')}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#adb5bd' }}>
                          Try adjusting filters or check if stock data exists
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
                      <td style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #e9ecef',
                        fontSize: '12px',
                        color: '#212529'
                      }}>
                        {item.itemName}
                      </td>
                      <td style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #e9ecef',
                        fontSize: '12px',
                        color: '#212529',
                        textAlign: 'right'
                      }}>
                        {formatCurrency(item.salePrice)}
                      </td>
                      <td style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #e9ecef',
                        fontSize: '12px',
                        color: '#212529',
                        textAlign: 'right'
                      }}>
                        {formatCurrency(item.purchasePrice)}
                      </td>
                      <td style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #e9ecef',
                        fontSize: '12px',
                        color: item.stockQty === 0 ? '#dc3545' : '#212529',
                        textAlign: 'right',
                        fontWeight: item.stockQty === 0 ? 500 : 400
                      }}>
                        {formatQuantity(item.stockQty)}
                      </td>
                      <td style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #e9ecef',
                        fontSize: '12px',
                        color: '#212529',
                        textAlign: 'right'
                      }}>
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
                    padding: '12px 16px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#212529'
                  }}>
                    Total
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    borderTop: '2px solid #dee2e6'
                  }}>
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    borderTop: '2px solid #dee2e6'
                  }}>
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: totals.stockQty === 0 ? '#dc3545' : '#212529',
                    textAlign: 'right'
                  }}>
                    {formatQuantity(totals.stockQty)}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    borderTop: '2px solid #dee2e6',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#212529',
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

export default VyaparStockSummary;

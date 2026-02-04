import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, itemAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Paper,
  Box,
  Group,
  Stack,
  Select,
  TextInput,
  ActionIcon,
  Tooltip,
  Table,
  LoadingOverlay,
  Center,
  Divider,
  Badge,
  Pagination
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconSearch,
  IconFilter,
  IconCalendar,
  IconChevronDown,
  IconSortAscending,
  IconSortDescending,
  IconReportAnalytics
} from '@tabler/icons-react';

const VyaparItemReportByParty = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Filter states
  const [filterType, setFilterType] = useState('thisMonth');
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // Sorting
  const [sortField, setSortField] = useState('partyName');
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
        filterType: filterData.filterType || filterType,
        ...(filterData.customStart && { customStart: filterData.customStart }),
        ...(filterData.customEnd && { customEnd: filterData.customEnd }),
        ...(selectedCategory !== 'all' && { categoryId: selectedCategory }),
        ...(selectedItem !== 'all' && { itemId: selectedItem }),
        ...(searchQuery && { searchParty: searchQuery })
      };

      const response = await reportAPI.vyaparItemByParty(params);
      setReportData(response.data);
      setCurrentPage(1);
    } catch (error) {
      message.error(error.message || 'Failed to fetch party report by item');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRangeChange = (value) => {
    setFilterType(value);
    setDateRange([null, null]);
    fetchReport({ filterType: value });
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    if (range[0] && range[1]) {
      setFilterType('custom');
      fetchReport({
        filterType: 'custom',
        customStart: dayjs(range[0]).format('YYYY-MM-DD'),
        customEnd: dayjs(range[1]).format('YYYY-MM-DD')
      });
    }
  };

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    setSelectedItem('all');
    fetchReport({ filterType });
  };

  const handleItemChange = (value) => {
    setSelectedItem(value);
    fetchReport({ filterType });
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (reportData) {
        fetchReport({ filterType });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format quantity
  const formatQty = (qty) => {
    return parseFloat(qty || 0).toFixed(2);
  };

  // Sort and filter records
  const processedRecords = useMemo(() => {
    if (!reportData?.records) return [];

    let records = [...reportData.records];

    // Sort
    records.sort((a, b) => {
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

    return records;
  }, [reportData?.records, sortField, sortDirection]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedRecords.slice(start, start + itemsPerPage);
  }, [processedRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedRecords.length / itemsPerPage);

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export to Excel
  const handleExcelExport = () => {
    if (!reportData?.records?.length) {
      message.warning('No data to export');
      return;
    }

    const csvContent = [
      ['#', 'Party Name', 'Sale Quantity', 'Sale Amount', 'Purchase Quantity', 'Purchase Amount'],
      ...processedRecords.map((record, idx) => [
        idx + 1,
        record.partyName,
        record.saleQty,
        record.saleAmount.toFixed(2),
        record.purchaseQty,
        record.purchaseAmount.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Party_Report_By_Item_${dayjs().format('DD-MM-YYYY')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    message.success('Report exported successfully');
  };

  // Print handler
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Party Report By Item - ${dayjs().format('DD/MM/YYYY')}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1976d2; padding-bottom: 15px; }
            .header h1 { color: #1976d2; font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; }
            .filters { display: flex; gap: 20px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
            .filter-item { font-size: 11px; }
            .filter-label { font-weight: bold; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #1976d2; color: white; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; }
            th.right, td.right { text-align: right; }
            td { padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
            tr:nth-child(even) { background: #fafafa; }
            .footer-row { background: #e3f2fd !important; font-weight: bold; }
            .footer-row td { border-top: 2px solid #1976d2; padding: 12px 8px; }
            .amount { color: #2e7d32; font-weight: 500; }
            .purchase { color: #c62828; }
            .no-data { text-align: center; padding: 40px; color: #999; }
            @media print {
              @page { margin: 15mm; size: A4 landscape; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Party Report By Item</h1>
            <p>Generated on ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
          </div>
          <div class="filters">
            <div class="filter-item"><span class="filter-label">Period:</span> ${filterType === 'custom' && dateRange[0] && dateRange[1]
              ? `${dayjs(dateRange[0]).format('DD/MM/YYYY')} - ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`
              : filterType.replace(/([A-Z])/g, ' $1').trim()}</div>
            <div class="filter-item"><span class="filter-label">Category:</span> ${selectedCategory === 'all' ? 'All Categories' : selectedCategory}</div>
            <div class="filter-item"><span class="filter-label">Item:</span> ${selectedItem === 'all' ? 'All Items' : selectedItem}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Party Name</th>
                <th class="right">Sale Qty</th>
                <th class="right">Sale Amount</th>
                <th class="right">Purchase Qty</th>
                <th class="right">Purchase Amount</th>
              </tr>
            </thead>
            <tbody>
              ${processedRecords.length > 0 ? processedRecords.map((record, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${record.partyName}</td>
                  <td class="right">${formatQty(record.saleQty)}</td>
                  <td class="right amount">${formatCurrency(record.saleAmount)}</td>
                  <td class="right">${formatQty(record.purchaseQty)}</td>
                  <td class="right purchase">${formatCurrency(record.purchaseAmount)}</td>
                </tr>
              `).join('') : `<tr><td colspan="6" class="no-data">No data available</td></tr>`}
            </tbody>
            <tfoot>
              <tr class="footer-row">
                <td colspan="2"><strong>Total</strong></td>
                <td class="right"><strong>${formatQty(reportData?.summary?.totalSaleQty || 0)}</strong></td>
                <td class="right amount"><strong>${formatCurrency(reportData?.summary?.totalSaleAmount || 0)}</strong></td>
                <td class="right"><strong>${formatQty(reportData?.summary?.totalPurchaseQty || 0)}</strong></td>
                <td class="right purchase"><strong>${formatCurrency(reportData?.summary?.totalPurchaseAmount || 0)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    };
  };

  // Column header with sort
  const SortableHeader = ({ field, label, align = 'left' }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: align,
        whiteSpace: 'nowrap'
      }}
    >
      <Group spacing={4} position={align === 'right' ? 'right' : 'left'} noWrap>
        <span>{label}</span>
        {sortField === field ? (
          sortDirection === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />
        ) : (
          <IconFilter size={12} opacity={0.5} />
        )}
      </Group>
    </th>
  );

  // Category options
  const categoryOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Categories' }];
    if (reportData?.categories) {
      reportData.categories.forEach(cat => {
        options.push({ value: cat, label: cat });
      });
    }
    return options;
  }, [reportData?.categories]);

  // Item options filtered by category
  const itemOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Items' }];
    if (reportData?.items) {
      let filteredItems = reportData.items;
      if (selectedCategory !== 'all') {
        filteredItems = filteredItems.filter(item => item.category === selectedCategory);
      }
      filteredItems.forEach(item => {
        options.push({ value: item._id, label: item.itemName });
      });
    }
    return options;
  }, [reportData?.items, selectedCategory]);

  const quickRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} overlayBlur={2} />

      <Stack spacing="md">
        {/* Page Title */}
        <Group position="apart" align="center">
          <Group spacing="sm">
            <IconReportAnalytics size={28} color="#1976d2" />
            <div>
              <Title order={3} style={{ color: '#1976d2', margin: 0 }}>
                Party Report by Item
              </Title>
              <Text size="xs" color="dimmed">
                View party-wise sales and purchase summary
              </Text>
            </div>
          </Group>
        </Group>

        {/* Top Filter Row */}
        <Paper
          p="md"
          withBorder
          style={{
            borderColor: '#e0e0e0',
            background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)'
          }}
        >
          <Group position="apart" align="flex-end">
            <Group spacing="md">
              {/* Quick Range Dropdown */}
              <Select
                label="Quick Range"
                placeholder="Select range"
                value={filterType}
                onChange={handleQuickRangeChange}
                data={quickRangeOptions}
                size="sm"
                style={{ width: 150 }}
                rightSection={<IconChevronDown size={14} />}
                styles={{
                  label: { fontSize: '11px', color: '#666', marginBottom: 4 }
                }}
              />

              {/* Date Range Picker */}
              <div>
                <Text size="xs" color="dimmed" mb={4}>Between</Text>
                <Group spacing="xs">
                  <DatePickerInput
                    placeholder="DD/MM/YYYY"
                    value={dateRange[0]}
                    onChange={(date) => handleDateRangeChange([date, dateRange[1]])}
                    size="sm"
                    style={{ width: 130 }}
                    icon={<IconCalendar size={14} />}
                    valueFormat="DD/MM/YYYY"
                    clearable
                  />
                  <Text size="sm" color="dimmed">To</Text>
                  <DatePickerInput
                    placeholder="DD/MM/YYYY"
                    value={dateRange[1]}
                    onChange={(date) => handleDateRangeChange([dateRange[0], date])}
                    size="sm"
                    style={{ width: 130 }}
                    valueFormat="DD/MM/YYYY"
                    clearable
                  />
                </Group>
              </div>

              {/* Firm Dropdown */}
              <Select
                label="Firm"
                placeholder="Select firm"
                value={selectedFirm}
                onChange={setSelectedFirm}
                data={[{ value: 'all', label: 'All Firms' }]}
                size="sm"
                style={{ width: 140 }}
                styles={{
                  label: { fontSize: '11px', color: '#666', marginBottom: 4 }
                }}
              />
            </Group>

            {/* Action Buttons */}
            <Group spacing="xs">
              <Tooltip label="Export to Excel">
                <ActionIcon
                  color="green"
                  variant="light"
                  size="lg"
                  onClick={handleExcelExport}
                  style={{ border: '1px solid #c8e6c9' }}
                >
                  <IconFileSpreadsheet size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print Report">
                <ActionIcon
                  color="blue"
                  variant="light"
                  size="lg"
                  onClick={handlePrint}
                  style={{ border: '1px solid #bbdefb' }}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* Secondary Filter Row */}
        <Paper p="sm" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Group spacing="md">
            <Select
              placeholder="All Categories"
              value={selectedCategory}
              onChange={handleCategoryChange}
              data={categoryOptions}
              size="sm"
              style={{ width: 180 }}
              clearable={false}
              searchable
            />
            <Select
              placeholder="All Items"
              value={selectedItem}
              onChange={handleItemChange}
              data={itemOptions}
              size="sm"
              style={{ width: 200 }}
              clearable={false}
              searchable
            />
          </Group>
        </Paper>

        {/* Search Bar */}
        <TextInput
          placeholder="Search by Party Name..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          icon={<IconSearch size={16} />}
          size="sm"
          style={{ maxWidth: 350 }}
          styles={{
            input: {
              borderColor: '#e0e0e0',
              '&:focus': {
                borderColor: '#1976d2'
              }
            }
          }}
        />

        {/* Data Table */}
        <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden' }}>
          {/* Table Header Info */}
          <Box
            p="sm"
            style={{
              backgroundColor: '#f5f7fa',
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            <Group position="apart">
              <Text size="sm" weight={500} color="dimmed">
                {processedRecords.length} parties found
              </Text>
              <Text size="xs" color="dimmed">
                Page {currentPage} of {totalPages || 1}
              </Text>
            </Group>
          </Box>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <Table
              horizontalSpacing="md"
              verticalSpacing="sm"
              striped
              highlightOnHover
              style={{ minWidth: 700 }}
            >
              <thead style={{ backgroundColor: '#1976d2' }}>
                <tr>
                  <th style={{ color: 'white', fontWeight: 600, fontSize: '12px', width: 50 }}>#</th>
                  <SortableHeader field="partyName" label="Party Name" />
                  <th
                    style={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '12px',
                      textAlign: 'right',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSort('saleQty')}
                  >
                    <Group spacing={4} position="right" noWrap>
                      <span>Sale Quantity</span>
                      <IconFilter size={12} opacity={0.7} />
                    </Group>
                  </th>
                  <th
                    style={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '12px',
                      textAlign: 'right',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSort('saleAmount')}
                  >
                    <Group spacing={4} position="right" noWrap>
                      <span>Sale Amount</span>
                      <IconFilter size={12} opacity={0.7} />
                    </Group>
                  </th>
                  <th
                    style={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '12px',
                      textAlign: 'right',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSort('purchaseQty')}
                  >
                    <Group spacing={4} position="right" noWrap>
                      <span>Purchase Quantity</span>
                      <IconFilter size={12} opacity={0.7} />
                    </Group>
                  </th>
                  <th
                    style={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '12px',
                      textAlign: 'right',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSort('purchaseAmount')}
                  >
                    <Group spacing={4} position="right" noWrap>
                      <span>Purchase Amount</span>
                      <IconFilter size={12} opacity={0.7} />
                    </Group>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Center py={60}>
                        <Stack align="center" spacing="md">
                          <div
                            style={{
                              width: 120,
                              height: 120,
                              borderRadius: '50%',
                              backgroundColor: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <IconReportAnalytics size={50} color="#bdbdbd" />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <Text size="lg" weight={500} color="dimmed">
                              No data is available for Party Report by Item.
                            </Text>
                            <Text size="sm" color="dimmed" mt={4}>
                              Please try again after making relevant changes.
                            </Text>
                          </div>
                        </Stack>
                      </Center>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record, idx) => (
                    <tr key={record.partyId}>
                      <td style={{ fontWeight: 500, color: '#666' }}>
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td>
                        <Group spacing="xs">
                          <Text weight={500}>{record.partyName}</Text>
                          {record.partyType && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={record.partyType === 'Customer' ? 'blue' : record.partyType === 'Supplier' ? 'orange' : 'gray'}
                            >
                              {record.partyType}
                            </Badge>
                          )}
                        </Group>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatQty(record.saleQty)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>
                        {formatCurrency(record.saleAmount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatQty(record.purchaseQty)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#c62828' }}>
                        {formatCurrency(record.purchaseAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Footer Summary Row */}
          {processedRecords.length > 0 && (
            <Box
              p="md"
              style={{
                backgroundColor: '#e3f2fd',
                borderTop: '2px solid #1976d2'
              }}
            >
              <Group position="apart">
                <Text weight={700} size="sm" style={{ color: '#1565c0' }}>
                  Total
                </Text>
                <Group spacing={50}>
                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <Text size="xs" color="dimmed">Sale Qty</Text>
                    <Text weight={700}>{formatQty(reportData?.summary?.totalSaleQty || 0)}</Text>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <Text size="xs" color="dimmed">Sale Amount</Text>
                    <Text weight={700} style={{ color: '#2e7d32' }}>
                      {formatCurrency(reportData?.summary?.totalSaleAmount || 0)}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <Text size="xs" color="dimmed">Purchase Qty</Text>
                    <Text weight={700}>{formatQty(reportData?.summary?.totalPurchaseQty || 0)}</Text>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <Text size="xs" color="dimmed">Purchase Amount</Text>
                    <Text weight={700} style={{ color: '#c62828' }}>
                      {formatCurrency(reportData?.summary?.totalPurchaseAmount || 0)}
                    </Text>
                  </div>
                </Group>
              </Group>
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <Divider />
              <Box p="md" style={{ backgroundColor: '#f8f9fa' }}>
                <Group position="apart">
                  <Text size="sm" color="dimmed">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                    {Math.min(currentPage * itemsPerPage, processedRecords.length)} of{' '}
                    {processedRecords.length} entries
                  </Text>
                  <Pagination
                    page={currentPage}
                    onChange={setCurrentPage}
                    total={totalPages}
                    size="sm"
                    radius="sm"
                    styles={{
                      control: {
                        border: '1px solid #e0e0e0',
                        '&[data-active]': {
                          backgroundColor: '#1976d2',
                          borderColor: '#1976d2'
                        }
                      }
                    }}
                  />
                </Group>
              </Box>
            </>
          )}
        </Paper>
      </Stack>
    </Container>
  );
};

export default VyaparItemReportByParty;

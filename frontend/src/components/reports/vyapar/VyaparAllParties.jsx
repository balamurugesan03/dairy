import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Group,
  Stack,
  Text,
  Title,
  Select,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Flex,
  TextInput,
  Checkbox,
  LoadingOverlay,
  ThemeIcon,
  Menu,
  UnstyledButton,
  Divider
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconUsers,
  IconSearch,
  IconFileSpreadsheet,
  IconPrinter,
  IconFilter,
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconFileDescription,
  IconCalendar,
  IconUser,
  IconMail,
  IconPhone,
  IconCash,
  IconCreditCard
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';

const VyaparAllParties = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  // State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filter state
  const [dateFilterEnabled, setDateFilterEnabled] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [partyFilter, setPartyFilter] = useState('all'); // all, receivable, payable

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    partyName: '',
    email: '',
    phone: ''
  });

  const partyFilterOptions = [
    { value: 'all', label: 'All Parties' },
    { value: 'receivable', label: 'Receivable' },
    { value: 'payable', label: 'Payable' }
  ];

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount and when filters change
  useEffect(() => {
    fetchReport();
  }, [partyFilter, selectedDate, dateFilterEnabled]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        type: partyFilter === 'all' ? '' : partyFilter === 'receivable' ? 'customers' : 'suppliers'
      };

      // For "as of date" balance calculation, use date range from start of financial year to selected date
      if (dateFilterEnabled && selectedDate) {
        // Get financial year start (April 1st of current/previous year)
        const selectedDateObj = dayjs(selectedDate);
        const fyStart = selectedDateObj.month() >= 3
          ? selectedDateObj.startOf('year').add(3, 'month') // April 1st of current year
          : selectedDateObj.subtract(1, 'year').startOf('year').add(3, 'month'); // April 1st of previous year

        params.filterType = 'custom';
        params.customStart = fyStart.format('YYYY-MM-DD');
        params.customEnd = dayjs(selectedDate).endOf('day').format('YYYY-MM-DD');
      } else {
        params.filterType = 'thisYear';
      }

      const response = await reportAPI.vyaparAllParties(params);
      setReportData(response.data);
      setSelectedRows([]);
      setSelectAll(false);
    } catch (error) {
      message.error(error.message || 'Failed to fetch parties report');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchReport();
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportExcel = () => {
    if (!filteredParties?.length) {
      message.warning('No data to export');
      return;
    }

    const exportData = filteredParties.map((party, index) => ({
      '#': index + 1,
      'Party Name': party.name || '',
      'Email': party.email || '-',
      'Phone No': party.phone || '-',
      'Receivable Balance': party.closingBalance > 0 ? party.closingBalance : 0,
      'Payable Balance': party.closingBalance < 0 ? Math.abs(party.closingBalance) : 0,
      'Credit Limit': party.creditLimit || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Parties');
    XLSX.writeFile(wb, `All_Parties_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>All Parties Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .header { margin-bottom: 20px; }
            .footer { margin-top: 20px; display: flex; justify-content: space-between; }
            .total-box { padding: 10px 20px; background: #e8f5e9; border-radius: 4px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>All Parties Report</h2>
            <p>Date: ${dayjs(selectedDate).format('DD/MM/YYYY')}</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            <div class="total-box">
              <strong>Total Receivable:</strong> ${formatCurrency(totalReceivable)}
            </div>
            <div class="total-box">
              <strong>Total Payable:</strong> ${formatCurrency(totalPayable)}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedRows(filteredParties.map(p => p.ledgerId));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (ledgerId) => {
    setSelectedRows(prev => {
      if (prev.includes(ledgerId)) {
        return prev.filter(id => id !== ledgerId);
      } else {
        return [...prev, ledgerId];
      }
    });
  };

  const handlePartyClick = (party) => {
    navigate(`/reports/vyapar/party-statement?party=${party.ledgerId}`);
  };

  // Filter and sort parties
  const filteredParties = (reportData?.parties || [])
    .filter(party => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !party.name?.toLowerCase().includes(query) &&
          !party.email?.toLowerCase().includes(query) &&
          !party.phone?.includes(query)
        ) {
          return false;
        }
      }

      // Party type filter based on balance
      if (partyFilter === 'receivable' && party.closingBalance <= 0) return false;
      if (partyFilter === 'payable' && party.closingBalance >= 0) return false;

      // Column filters
      if (columnFilters.partyName && !party.name?.toLowerCase().includes(columnFilters.partyName.toLowerCase())) {
        return false;
      }
      if (columnFilters.email && !party.email?.toLowerCase().includes(columnFilters.email.toLowerCase())) {
        return false;
      }
      if (columnFilters.phone && !party.phone?.includes(columnFilters.phone)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'receivableBalance') {
        aVal = a.closingBalance > 0 ? a.closingBalance : 0;
        bVal = b.closingBalance > 0 ? b.closingBalance : 0;
      } else if (sortField === 'payableBalance') {
        aVal = a.closingBalance < 0 ? Math.abs(a.closingBalance) : 0;
        bVal = b.closingBalance < 0 ? Math.abs(b.closingBalance) : 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? (aVal || '').localeCompare(bVal || '')
          : (bVal || '').localeCompare(aVal || '');
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

  const getSortIcon = (field) => {
    if (sortField !== field) return <IconSelector size={14} color="#aaa" />;
    return sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  const SortableHeader = ({ field, children, align = 'left' }) => (
    <Table.Th style={{ cursor: 'pointer', textAlign: align }} onClick={() => handleSort(field)}>
      <Group gap={4} justify={align === 'right' ? 'flex-end' : 'flex-start'}>
        {children}
        {getSortIcon(field)}
      </Group>
    </Table.Th>
  );

  // Calculate totals from filtered data
  const totalReceivable = filteredParties.reduce((sum, p) => sum + (p.closingBalance > 0 ? p.closingBalance : 0), 0);
  const totalPayable = filteredParties.reduce((sum, p) => sum + (p.closingBalance < 0 ? Math.abs(p.closingBalance) : 0), 0);

  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder style={{ backgroundColor: '#fff' }}>
        <Group justify="space-between" align="center" mb="md">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue" radius="md">
              <IconUsers size={20} />
            </ThemeIcon>
            <Title order={3} fw={600} c="dark">All Parties</Title>
          </Group>
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" onClick={handleRefresh}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Export to Excel">
              <ActionIcon variant="light" color="green" size="lg" onClick={handleExportExcel}>
                <IconFileSpreadsheet size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print">
              <ActionIcon variant="light" color="blue" size="lg" onClick={handlePrint}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Filter Row */}
        <Flex gap="md" wrap="wrap" align="center">
          {/* Date Filter Checkbox */}
          <Checkbox
            label="Date Filter"
            checked={dateFilterEnabled}
            onChange={(e) => setDateFilterEnabled(e.currentTarget.checked)}
            styles={{
              label: { fontWeight: 500 }
            }}
          />

          {/* Date Selector */}
          <DatePickerInput
            label="Balance as of"
            placeholder="Select date"
            value={selectedDate}
            onChange={setSelectedDate}
            leftSection={<IconCalendar size={16} />}
            valueFormat="DD/MM/YYYY"
            disabled={!dateFilterEnabled}
            style={{ minWidth: 180 }}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />

          {/* Party Filter Dropdown */}
          <Select
            placeholder="Filter parties"
            data={partyFilterOptions}
            value={partyFilter}
            onChange={setPartyFilter}
            style={{ minWidth: 160 }}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />
        </Flex>
      </Paper>

      {/* Table Section */}
      <Paper shadow="xs" withBorder style={{ backgroundColor: '#fff' }}>
        {/* Search Bar */}
        <Box p="md" style={{ borderBottom: '1px solid #e0e0e0' }}>
          <TextInput
            placeholder="Search by party name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
            style={{ maxWidth: 400 }}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />
        </Box>

        {/* Table */}
        <Box style={{ overflowX: 'auto' }} ref={printRef}>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 900 }}>
            <Table.Thead style={{ backgroundColor: '#f5f5f5' }}>
              <Table.Tr>
                <Table.Th style={{ width: 40 }}>
                  <Checkbox
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                    size="sm"
                  />
                </Table.Th>
                <Table.Th style={{ width: 50 }}>#</Table.Th>
                <SortableHeader field="name">
                  <Group gap={4}>
                    Party Name
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={columnFilters.partyName ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <TextInput
                          placeholder="Filter party name..."
                          value={columnFilters.partyName}
                          onChange={(e) => setColumnFilters(f => ({ ...f, partyName: e.target.value }))}
                          size="xs"
                        />
                        <Menu.Divider />
                        <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, partyName: '' }))}>
                          Clear Filter
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </SortableHeader>
                <SortableHeader field="email">
                  <Group gap={4}>
                    Email
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={columnFilters.email ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <TextInput
                          placeholder="Filter email..."
                          value={columnFilters.email}
                          onChange={(e) => setColumnFilters(f => ({ ...f, email: e.target.value }))}
                          size="xs"
                        />
                        <Menu.Divider />
                        <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, email: '' }))}>
                          Clear Filter
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </SortableHeader>
                <SortableHeader field="phone">
                  <Group gap={4}>
                    Phone No
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={columnFilters.phone ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <TextInput
                          placeholder="Filter phone..."
                          value={columnFilters.phone}
                          onChange={(e) => setColumnFilters(f => ({ ...f, phone: e.target.value }))}
                          size="xs"
                        />
                        <Menu.Divider />
                        <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, phone: '' }))}>
                          Clear Filter
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </SortableHeader>
                <SortableHeader field="receivableBalance" align="right">
                  Receivable Balance
                </SortableHeader>
                <SortableHeader field="payableBalance" align="right">
                  Payable Balance
                </SortableHeader>
                <SortableHeader field="creditLimit" align="right">
                  Credit Limit
                </SortableHeader>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredParties.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Flex direction="column" align="center" justify="center" py={80}>
                      <ThemeIcon size={80} variant="light" color="gray" radius="xl" mb="md">
                        <IconFileDescription size={40} />
                      </ThemeIcon>
                      <Text c="dimmed" size="lg" fw={500} ta="center">
                        No parties found for the selected filters
                      </Text>
                      <Text c="dimmed" size="sm" ta="center">
                        {dateFilterEnabled
                          ? `As of ${dayjs(selectedDate).format('DD/MM/YYYY')} - Try selecting a different date or filter`
                          : 'Try adjusting your search or filter criteria'}
                      </Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredParties.map((party, idx) => {
                  const receivable = party.closingBalance > 0 ? party.closingBalance : 0;
                  const payable = party.closingBalance < 0 ? Math.abs(party.closingBalance) : 0;

                  return (
                    <Table.Tr
                      key={party.ledgerId || idx}
                      style={{ cursor: 'pointer' }}
                      bg={selectedRows.includes(party.ledgerId) ? 'blue.0' : undefined}
                    >
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.includes(party.ledgerId)}
                          onChange={() => handleSelectRow(party.ledgerId)}
                          size="sm"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{idx + 1}</Text>
                      </Table.Td>
                      <Table.Td onClick={() => handlePartyClick(party)}>
                        <Group gap="xs">
                          <Text size="sm" fw={500} c="blue" style={{ textDecoration: 'underline' }}>
                            {party.name || '-'}
                          </Text>
                          <Badge size="xs" variant="light" color={party.type === 'Customer' ? 'blue' : 'orange'}>
                            {party.type}
                          </Badge>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {party.email && <IconMail size={14} color="#666" />}
                          <Text size="sm">{party.email || '-'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {party.phone && <IconPhone size={14} color="#666" />}
                          <Text size="sm">{party.phone || '-'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {receivable > 0 ? (
                          <Text size="sm" fw={600} c="green.7">
                            {formatCurrency(receivable)}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {payable > 0 ? (
                          <Text size="sm" fw={600} c="red.7">
                            {formatCurrency(payable)}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm">{party.creditLimit ? formatCurrency(party.creditLimit) : '-'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {/* Footer Summary */}
        {filteredParties.length > 0 && (
          <Box p="md" style={{ borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
            <Flex justify="space-between" align="center">
              {/* Total Receivable */}
              <Box
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: 8,
                  border: '1px solid #c8e6c9'
                }}
              >
                <Group gap="sm">
                  <ThemeIcon size="md" variant="filled" color="green" radius="xl">
                    <IconCash size={16} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" c="green.8" fw={500}>Total Receivable</Text>
                    <Text size="lg" fw={700} c="green.8">
                      {formatCurrency(totalReceivable)}
                    </Text>
                  </Box>
                </Group>
              </Box>

              {/* Summary Info */}
              <Box ta="center">
                <Text size="sm" c="dimmed">
                  Showing {filteredParties.length} of {reportData?.parties?.length || 0} parties
                </Text>
                {selectedRows.length > 0 && (
                  <Text size="sm" c="blue" fw={500}>
                    {selectedRows.length} selected
                  </Text>
                )}
              </Box>

              {/* Total Payable */}
              <Box
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: 8,
                  border: '1px solid #c8e6c9'
                }}
              >
                <Group gap="sm">
                  <ThemeIcon size="md" variant="filled" color="teal" radius="xl">
                    <IconCreditCard size={16} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" c="teal.8" fw={500}>Total Payable</Text>
                    <Text size="lg" fw={700} c="teal.8">
                      {formatCurrency(totalPayable)}
                    </Text>
                  </Box>
                </Group>
              </Box>
            </Flex>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VyaparAllParties;

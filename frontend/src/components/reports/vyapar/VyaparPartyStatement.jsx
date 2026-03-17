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
  Collapse,
  Divider,
  Flex,
  LoadingOverlay,
  Card,
  SimpleGrid,
  ThemeIcon,
  Menu,
  UnstyledButton
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconUser,
  IconCalendar,
  IconFileSpreadsheet,
  IconPrinter,
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconRefresh,
  IconCash,
  IconReceipt,
  IconArrowUpRight,
  IconArrowDownRight,
  IconShoppingCart,
  IconPackage,
  IconReportMoney
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, businessCustomerAPI, supplierAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';
import { printVyaparReport } from '../../../utils/printReport';

const VyaparPartyStatement = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedParty, setSelectedParty] = useState('');
  const [parties, setParties] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // Date filter state
  const [dateFilterType, setDateFilterType] = useState('thisMonth');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);

  // Column filter
  const [txnTypeFilter, setTxnTypeFilter] = useState('');

  const dateFilterOptions = [
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

  // Redirect if not Private Firm
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Load parties on mount
  useEffect(() => {
    fetchParties();
  }, []);

  // Update dateRange when period dropdown changes
  useEffect(() => {
    if (dateFilterType === 'custom') return;
    const now = dayjs();
    let start, end;
    switch (dateFilterType) {
      case 'today':      start = now.startOf('day');    end = now.endOf('day');    break;
      case 'yesterday':  start = now.subtract(1,'day').startOf('day'); end = now.subtract(1,'day').endOf('day'); break;
      case 'thisWeek':   start = now.startOf('week');   end = now.endOf('week');   break;
      case 'lastWeek':   start = now.subtract(1,'week').startOf('week'); end = now.subtract(1,'week').endOf('week'); break;
      case 'thisMonth':  start = now.startOf('month');  end = now.endOf('month');  break;
      case 'lastMonth':  start = now.subtract(1,'month').startOf('month'); end = now.subtract(1,'month').endOf('month'); break;
      case 'thisQuarter':start = now.startOf('quarter'); end = now.endOf('quarter'); break;
      case 'thisYear':   start = now.startOf('year');   end = now.endOf('year');   break;
      default:           start = now.startOf('month');  end = now.endOf('month');
    }
    setDateRange([start.toDate(), end.toDate()]);
  }, [dateFilterType]);

  // Fetch report when party or date changes
  useEffect(() => {
    if (selectedParty) {
      fetchReport();
    }
  }, [selectedParty, dateRange]);

  const fetchParties = async () => {
    setPartiesLoading(true);
    try {
      const [custRes, suppRes] = await Promise.all([
        businessCustomerAPI.getAll({ limit: 1000 }),
        supplierAPI.getAll({ limit: 1000 })
      ]);

      const customers = custRes.data || custRes.customers || [];
      const suppliers = suppRes.data || suppRes.suppliers || [];

      const partyList = [
        ...customers.map(c => ({
          value: c._id?.toString(),
          label: `${c.name || c.customerName} (Customer)`,
          partyName: c.name || c.customerName,
          partyType: 'customer',
          phone: c.phone || c.mobileNumber || ''
        })),
        ...suppliers.map(s => ({
          value: s._id?.toString(),
          label: `${s.name || s.supplierName} (Supplier)`,
          partyName: s.name || s.supplierName,
          partyType: 'supplier',
          phone: s.phone || s.mobileNumber || ''
        }))
      ];

      setParties(partyList);
    } catch (error) {
      console.error('Failed to fetch parties:', error);
      message.error('Failed to load parties list');
    } finally {
      setPartiesLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!selectedParty) return;
    const partyData = parties.find(p => p.value === selectedParty);
    if (!partyData) return;

    setLoading(true);
    try {
      const response = await reportAPI.vyaparPartyStatement({
        partyId: selectedParty,
        partyType: partyData.partyType,
        filterType: 'custom',
        customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        customEnd: dayjs(dateRange[1]).format('YYYY-MM-DD')
      });
      setReportData(response.data);
    } catch (error) {
      console.error('Party statement error:', error);
      message.error(error.message || 'Failed to fetch party statement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const handleExportExcel = () => {
    if (!filteredTransactions.length) { message.warning('No data to export'); return; }
    const exportData = filteredTransactions.map(txn => ({
      'Date': formatDate(txn.date),
      'Type': txn.transactionType,
      'Reference No': txn.referenceNo || '-',
      'Payment Mode': txn.paymentType || '-',
      'Total Amount': txn.totalAmount || 0,
      'Received/Paid': txn.receivedAmount || 0,
      'Due Amount': txn.transactionBalance || 0,
      'Running Balance': txn.receivableBalance || txn.payableBalance || 0,
      'Status': txn.paymentStatus || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Statement');
    XLSX.writeFile(wb, `Party_Statement_${reportData?.party?.name || 'Report'}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const handlePrint = () => {
    printVyaparReport(printRef, {
      title: 'Party Statement',
      companyName: selectedCompany?.companyName || '',
      orientation: 'landscape'
    });
  };

  const getStatusBadge = (status) => {
    const cfg = {
      'Paid':    { color: 'green' },
      'Partial': { color: 'orange' },
      'Unpaid':  { color: 'red' }
    };
    const c = cfg[status] || { color: 'gray' };
    return <Badge variant="light" color={c.color} size="xs">{status || '-'}</Badge>;
  };

  const getTxnBadge = (type) => {
    const cfg = {
      'Sale':             { color: 'green' },
      'Purchase':         { color: 'red' },
      'Receipt':          { color: 'teal' },
      'Payment':          { color: 'orange' },
      'Estimate':         { color: 'yellow' },
      'Delivery Challan': { color: 'cyan' },
      'Proforma':         { color: 'violet' }
    };
    const c = cfg[type] || { color: 'gray' };
    return <Badge variant="light" color={c.color} size="sm">{type || '-'}</Badge>;
  };

  const selectedPartyData = parties.find(p => p.value === selectedParty);
  const isCustomer = selectedPartyData?.partyType === 'customer';

  const allTransactions = reportData?.transactions || [];
  const filteredTransactions = txnTypeFilter
    ? allTransactions.filter(t => t.transactionType === txnTypeFilter)
    : allTransactions;

  const txnTypes = [...new Set(allTransactions.map(t => t.transactionType).filter(Boolean))];
  const summary = reportData?.summary || {};

  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={loading || partiesLoading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder style={{ backgroundColor: '#fff' }}>
        <Group justify="space-between" align="center" mb="md">
          <Title order={3} fw={600} c="dark">Party Statement</Title>
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" onClick={() => { fetchParties(); if (selectedParty) fetchReport(); }}>
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

        {/* Filters */}
        <Flex gap="md" wrap="wrap" align="flex-end">
          {/* Party Select */}
          <Select
            label="Select Party"
            placeholder="Search customer / supplier..."
            data={parties}
            value={selectedParty}
            onChange={(val) => { setSelectedParty(val); setReportData(null); setTxnTypeFilter(''); }}
            searchable
            clearable
            nothingFoundMessage="No parties found"
            leftSection={<IconUser size={16} />}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            style={{ flex: 1, minWidth: 260 }}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />

          {/* Period */}
          <Select
            label="Period"
            data={dateFilterOptions}
            value={dateFilterType}
            onChange={setDateFilterType}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 155 }}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />

          {/* Date range — always enabled; switching dates auto-sets period to custom */}
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="From → To"
            value={dateRange}
            onChange={(val) => { setDateRange(val); setDateFilterType('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 280 }}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />
        </Flex>
      </Paper>

      {/* Party Info Bar */}
      {selectedPartyData && reportData && (
        <Paper shadow="xs" p="sm" mb="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" variant="light" color={isCustomer ? 'blue' : 'orange'} radius="xl">
                <IconUser size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">{reportData.party?.name || selectedPartyData.partyName}</Text>
                <Group gap="xs">
                  <Badge size="xs" variant="outline" color={isCustomer ? 'blue' : 'orange'}>
                    {isCustomer ? 'Customer' : 'Supplier'}
                  </Badge>
                  {selectedPartyData.phone && (
                    <Text size="xs" c="dimmed">{selectedPartyData.phone}</Text>
                  )}
                </Group>
              </Box>
            </Group>
            <Group gap="xl">
              <Box ta="right">
                <Text size="xs" c="dimmed">{isCustomer ? 'Total Sale' : 'Total Purchase'}</Text>
                <Text fw={600} size="sm" c={isCustomer ? 'green' : 'red'}>
                  {formatCurrency(isCustomer ? summary.totalSale : summary.totalPurchase)}
                </Text>
              </Box>
              <Box ta="right">
                <Text size="xs" c="dimmed">{isCustomer ? 'Received' : 'Paid'}</Text>
                <Text fw={600} size="sm">{formatCurrency(isCustomer ? summary.totalReceived : summary.totalPaid)}</Text>
              </Box>
              <Box ta="right" style={{ padding: '6px 14px', backgroundColor: isCustomer ? '#e8f5e9' : '#fff3e0', borderRadius: 8 }}>
                <Text size="xs" c="dimmed">{isCustomer ? 'Receivable' : 'Payable'}</Text>
                <Text fw={700} size="md" c={isCustomer ? 'green' : 'orange'}>
                  {formatCurrency(isCustomer ? summary.totalReceivable : summary.totalPayable)}
                </Text>
              </Box>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Table */}
      <Paper shadow="xs" withBorder style={{ backgroundColor: '#fff' }} ref={printRef}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 1000 }}>
            <Table.Thead style={{ backgroundColor: '#f5f5f5' }}>
              <Table.Tr>
                <Table.Th style={{ width: 100 }}>Date</Table.Th>
                <Table.Th style={{ width: 120 }}>
                  <Group gap={4}>
                    Type
                    <Menu shadow="md" width={140}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={txnTypeFilter ? 'blue' : 'gray'}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => setTxnTypeFilter('')}>All</Menu.Item>
                        <Menu.Divider />
                        {txnTypes.map(t => (
                          <Menu.Item key={t} onClick={() => setTxnTypeFilter(t)}>{t}</Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Th>
                <Table.Th style={{ width: 140 }}>Reference No</Table.Th>
                <Table.Th style={{ width: 110 }}>Payment Mode</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Total Amount</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  {isCustomer ? 'Received Amt' : 'Paid Amt'}
                </Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Due Amount</Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'right' }}>
                  {isCustomer ? 'Receivable Bal' : 'Payable Bal'}
                </Table.Th>
                <Table.Th style={{ width: 90, textAlign: 'center' }}>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!selectedParty ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Flex direction="column" align="center" justify="center" py={60}>
                      <IconUser size={48} color="#ccc" />
                      <Text c="dimmed" size="lg" mt="md">Select a party to view statement</Text>
                      <Text c="dimmed" size="sm">Choose a customer or supplier from the dropdown above</Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : filteredTransactions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Flex direction="column" align="center" justify="center" py={60}>
                      <IconReceipt size={48} color="#ccc" />
                      <Text c="dimmed" size="lg" mt="md">No transactions found</Text>
                      <Text c="dimmed" size="sm">No records for the selected period</Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredTransactions.map((txn, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td><Text size="sm">{formatDate(txn.date)}</Text></Table.Td>
                    <Table.Td>{getTxnBadge(txn.transactionType)}</Table.Td>
                    <Table.Td><Text size="sm" fw={500}>{txn.referenceNo || '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{txn.paymentType || '-'}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500}>{formatCurrency(txn.totalAmount)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" c="green" fw={500}>{formatCurrency(txn.receivedAmount)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" c={txn.transactionBalance > 0 ? 'red' : 'dimmed'} fw={500}>
                        {txn.transactionBalance > 0 ? formatCurrency(txn.transactionBalance) : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c={isCustomer ? 'green.7' : 'orange.7'}>
                        {formatCurrency(isCustomer ? txn.receivableBalance : txn.payableBalance)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {getStatusBadge(txn.paymentStatus)}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            {filteredTransactions.length > 0 && (
              <Table.Tfoot style={{ backgroundColor: '#f8f9fa' }}>
                <Table.Tr>
                  <Table.Td colSpan={4} style={{ textAlign: 'right' }}>
                    <Text fw={700}>Totals:</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700}>{formatCurrency(summary.totalDebits)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="green">{formatCurrency(summary.totalCredits)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="red">
                      {formatCurrency(isCustomer ? summary.totalReceivable : summary.totalPayable)}
                    </Text>
                  </Table.Td>
                  <Table.Td colSpan={2}></Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>
      </Paper>

      {/* Summary Panel */}
      {reportData && (
        <Paper shadow="xs" mt="md" withBorder style={{ backgroundColor: '#fff' }}>
          <UnstyledButton onClick={() => setSummaryExpanded(v => !v)} style={{ width: '100%' }}>
            <Group justify="space-between" p="md" style={{ backgroundColor: '#f5f5f5', borderBottom: summaryExpanded ? '1px solid #e0e0e0' : 'none' }}>
              <Group gap="sm">
                <IconReportMoney size={20} />
                <Text fw={600}>Party Summary</Text>
              </Group>
              {summaryExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
            </Group>
          </UnstyledButton>

          <Collapse in={summaryExpanded}>
            <Box p="md">
              <SimpleGrid cols={{ base: 2, sm: isCustomer ? 3 : 3 }} spacing="md">
                {isCustomer ? (
                  <>
                    <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e8f5e9' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="light" color="green" radius="xl"><IconShoppingCart size={16} /></ThemeIcon>
                        <Text size="xs" c="dimmed" fw={500}>Total Sale</Text>
                      </Group>
                      <Text fw={700} size="lg" c="green.7">{formatCurrency(summary.totalSale || 0)}</Text>
                    </Card>
                    <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e3f2fd' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="light" color="blue" radius="xl"><IconArrowDownRight size={16} /></ThemeIcon>
                        <Text size="xs" c="dimmed" fw={500}>Received</Text>
                      </Group>
                      <Text fw={700} size="lg" c="blue.7">{formatCurrency(summary.totalReceived || 0)}</Text>
                    </Card>
                    <Card shadow="sm" padding="md" radius="md" style={{ backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="filled" color="green" radius="xl"><IconCash size={16} /></ThemeIcon>
                        <Text size="xs" c="green.8" fw={600}>Receivable</Text>
                      </Group>
                      <Text fw={700} size="xl" c="green.8">{formatCurrency(summary.totalReceivable || 0)}</Text>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#ffebee' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="light" color="red" radius="xl"><IconPackage size={16} /></ThemeIcon>
                        <Text size="xs" c="dimmed" fw={500}>Total Purchase</Text>
                      </Group>
                      <Text fw={700} size="lg" c="red.7">{formatCurrency(summary.totalPurchase || 0)}</Text>
                    </Card>
                    <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e3f2fd' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="light" color="blue" radius="xl"><IconArrowUpRight size={16} /></ThemeIcon>
                        <Text size="xs" c="dimmed" fw={500}>Paid</Text>
                      </Group>
                      <Text fw={700} size="lg" c="blue.7">{formatCurrency(summary.totalPaid || 0)}</Text>
                    </Card>
                    <Card shadow="sm" padding="md" radius="md" style={{ backgroundColor: '#fff3e0', border: '2px solid #ff9800' }}>
                      <Group gap="sm" mb="xs">
                        <ThemeIcon size="md" variant="filled" color="orange" radius="xl"><IconCash size={16} /></ThemeIcon>
                        <Text size="xs" c="orange.9" fw={600}>Payable</Text>
                      </Group>
                      <Text fw={700} size="xl" c="orange.9">{formatCurrency(summary.totalPayable || 0)}</Text>
                    </Card>
                  </>
                )}
              </SimpleGrid>

              <Divider my="md" />
              <Flex justify="flex-end" gap="xl">
                <Box ta="right">
                  <Text size="sm" c="dimmed">Total Transactions</Text>
                  <Text fw={600}>{allTransactions.length}</Text>
                </Box>
                <Box ta="right">
                  <Text size="sm" c="dimmed">Period</Text>
                  <Text fw={600} size="sm">
                    {dayjs(dateRange[0]).format('DD MMM YYYY')} – {dayjs(dateRange[1]).format('DD MMM YYYY')}
                  </Text>
                </Box>
                <Box ta="right" style={{ padding: '8px 16px', backgroundColor: isCustomer ? '#e8f5e9' : '#fff3e0', borderRadius: 8 }}>
                  <Text size="sm" c="dimmed">{isCustomer ? 'Net Receivable' : 'Net Payable'}</Text>
                  <Text fw={700} size="lg" c={isCustomer ? 'green' : 'orange'}>
                    {formatCurrency(isCustomer ? summary.totalReceivable : summary.totalPayable)}
                  </Text>
                  <Badge size="sm" color={isCustomer ? 'green' : 'orange'} variant="filled">
                    {isCustomer ? 'To Receive' : 'To Pay'}
                  </Badge>
                </Box>
              </Flex>
            </Box>
          </Collapse>
        </Paper>
      )}
    </Box>
  );
};

export default VyaparPartyStatement;

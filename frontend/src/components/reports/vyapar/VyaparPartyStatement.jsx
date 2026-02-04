import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Button,
  ActionIcon,
  Tooltip,
  Collapse,
  Divider,
  Flex,
  TextInput,
  Radio,
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
  IconSearch,
  IconCash,
  IconReceipt,
  IconArrowUpRight,
  IconArrowDownRight,
  IconScale,
  IconShoppingCart,
  IconPackage,
  IconReportMoney
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, customerAPI, supplierAPI, ledgerAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';

const VyaparPartyStatement = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef();

  // State
  const [loading, setLoading] = useState(false);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedParty, setSelectedParty] = useState('');
  const [parties, setParties] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [viewMode, setViewMode] = useState('vyapar'); // vyapar or accounting

  // Date filter state
  const [dateFilterType, setDateFilterType] = useState('thisMonth');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);

  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    transactionType: '',
    paymentType: ''
  });

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

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch parties on mount
  useEffect(() => {
    fetchParties();
  }, []);

  // Check for party param from URL
  useEffect(() => {
    const partyFromUrl = searchParams.get('party');
    if (partyFromUrl && parties.length > 0) {
      setSelectedParty(partyFromUrl);
    }
  }, [searchParams, parties]);

  // Fetch report when party or date changes
  useEffect(() => {
    if (selectedParty && parties.length > 0) {
      fetchReport();
    }
  }, [selectedParty, dateRange, parties]);

  // Update date range when filter type changes
  useEffect(() => {
    const now = dayjs();
    let start, end;

    switch (dateFilterType) {
      case 'today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case 'yesterday':
        start = now.subtract(1, 'day').startOf('day');
        end = now.subtract(1, 'day').endOf('day');
        break;
      case 'thisWeek':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case 'lastWeek':
        start = now.subtract(1, 'week').startOf('week');
        end = now.subtract(1, 'week').endOf('week');
        break;
      case 'thisMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'thisQuarter':
        start = now.startOf('quarter');
        end = now.endOf('quarter');
        break;
      case 'thisYear':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      case 'custom':
        return; // Don't update for custom
      default:
        start = now.startOf('month');
        end = now.endOf('month');
    }

    setDateRange([start.toDate(), end.toDate()]);
  }, [dateFilterType]);

  const fetchParties = async () => {
    setPartiesLoading(true);
    try {
      const [customersRes, suppliersRes, ledgersRes] = await Promise.all([
        customerAPI.getAll({ limit: 1000 }),
        supplierAPI.getAll({ limit: 1000 }),
        ledgerAPI.getAll({ limit: 1000 })
      ]);

      const customers = customersRes.data || customersRes.customers || [];
      const suppliers = suppliersRes.data || suppliersRes.suppliers || [];
      const ledgers = ledgersRes.data?.ledgers || ledgersRes.ledgers || ledgersRes.data || [];

      // Create entity to ledger map
      const entityToLedger = new Map();
      ledgers.forEach(ledger => {
        if (ledger.linkedEntity?.entityId) {
          entityToLedger.set(ledger.linkedEntity.entityId.toString(), ledger._id);
        }
      });

      const partyList = [];

      // Add customers
      customers.forEach(customer => {
        const ledgerId = customer.ledgerId || entityToLedger.get(customer._id.toString());
        const ledgerIdStr = ledgerId ? (typeof ledgerId === 'object' ? ledgerId._id?.toString() || ledgerId.toString() : ledgerId.toString()) : null;

        partyList.push({
          value: ledgerIdStr || `customer_${customer._id}`,
          label: `${customer.name || customer.customerName} (Customer)`,
          type: 'Customer',
          phone: customer.phone || customer.mobileNumber,
          email: customer.email,
          hasLedger: !!ledgerIdStr
        });
      });

      // Add suppliers
      suppliers.forEach(supplier => {
        const ledgerId = supplier.dueToLedgerId || entityToLedger.get(supplier._id.toString());
        const ledgerIdStr = ledgerId ? (typeof ledgerId === 'object' ? ledgerId._id?.toString() || ledgerId.toString() : ledgerId.toString()) : null;

        partyList.push({
          value: ledgerIdStr || `supplier_${supplier._id}`,
          label: `${supplier.name || supplier.supplierName} (Supplier)`,
          type: 'Supplier',
          phone: supplier.phone || supplier.mobileNumber,
          email: supplier.email,
          hasLedger: !!ledgerIdStr
        });
      });

      // Add unlinked party ledgers
      ledgers.forEach(ledger => {
        if (['Sundry Debtors', 'Sundry Creditors'].includes(ledger.ledgerType)) {
          const ledgerIdStr = ledger._id?.toString() || ledger._id;
          const existing = partyList.find(p => p.value === ledgerIdStr);
          if (!existing) {
            partyList.push({
              value: ledgerIdStr,
              label: `${ledger.ledgerName} (${ledger.ledgerType === 'Sundry Debtors' ? 'Customer' : 'Supplier'})`,
              type: ledger.ledgerType === 'Sundry Debtors' ? 'Customer' : 'Supplier',
              phone: '',
              email: '',
              hasLedger: true
            });
          }
        }
      });

      setParties(partyList);
    } catch (error) {
      console.error('Failed to fetch parties:', error);
      message.error('Failed to load parties list');
    } finally {
      setPartiesLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!selectedParty) {
      message.warning('Please select a party');
      return;
    }

    const selectedPartyData = parties.find(p => p.value === selectedParty);
    if (selectedPartyData && !selectedPartyData.hasLedger) {
      message.warning('No ledger found for this party. Create a ledger first to view statement.');
      setReportData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await reportAPI.vyaparPartyStatement({
        ledgerId: selectedParty,
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

  const handleRefresh = () => {
    fetchParties();
    if (selectedParty) {
      fetchReport();
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const handleExportExcel = () => {
    if (!reportData?.transactions?.length) {
      message.warning('No data to export');
      return;
    }

    const exportData = reportData.transactions.map(txn => ({
      'Date': formatDate(txn.date),
      'Transaction Type': txn.transactionType || txn.voucherType,
      'Reference No': txn.referenceNo || txn.voucherNumber,
      'Payment Type': txn.paymentType || '-',
      'Total Amount': txn.totalAmount || txn.debitAmount || txn.creditAmount || 0,
      'Received Amount': txn.receivedAmount || 0,
      'Transaction Balance': txn.transactionBalance || 0,
      'Receivable Balance': txn.receivableBalance || 0,
      'Payable Balance': txn.payableBalance || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Statement');
    XLSX.writeFile(wb, `Party_Statement_${reportData.ledger?.ledgerName || 'Report'}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Party Statement - ${reportData?.ledger?.ledgerName || 'Report'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .header { margin-bottom: 20px; }
            .summary { margin-top: 20px; padding: 15px; background: #f9f9f9; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getTransactionTypeBadge = (type) => {
    const typeConfig = {
      'Sale': { color: 'green', label: 'Sale' },
      'Purchase': { color: 'red', label: 'Purchase' },
      'Receipt': { color: 'teal', label: 'Receipt' },
      'Payment': { color: 'orange', label: 'Payment' },
      'Journal': { color: 'blue', label: 'Journal' },
      'Credit Note': { color: 'pink', label: 'Credit Note' },
      'Debit Note': { color: 'grape', label: 'Debit Note' }
    };
    const config = typeConfig[type] || { color: 'gray', label: type || 'Other' };
    return <Badge variant="light" color={config.color} size="sm">{config.label}</Badge>;
  };

  const selectedPartyDetails = parties.find(p => p.value === selectedParty);

  // Filter transactions based on column filters
  const filteredTransactions = reportData?.transactions?.filter(txn => {
    if (columnFilters.transactionType && txn.transactionType !== columnFilters.transactionType) {
      return false;
    }
    if (columnFilters.paymentType && txn.paymentType !== columnFilters.paymentType) {
      return false;
    }
    return true;
  }) || [];

  const transactionTypes = [...new Set(reportData?.transactions?.map(t => t.transactionType || t.voucherType).filter(Boolean))];
  const paymentTypes = [...new Set(reportData?.transactions?.map(t => t.paymentType).filter(Boolean))];

  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={loading || partiesLoading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder style={{ backgroundColor: '#fff' }}>
        <Group justify="space-between" align="center" mb="md">
          <Title order={3} fw={600} c="dark">Party Statement</Title>
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

        {/* Filters Row */}
        <Flex gap="md" wrap="wrap" align="flex-end">
          {/* Date Filter Dropdown */}
          <Select
            label="Period"
            placeholder="Select period"
            data={dateFilterOptions}
            value={dateFilterType}
            onChange={setDateFilterType}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 150 }}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />

          {/* Date Range */}
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="Select date range"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 280 }}
            disabled={dateFilterType !== 'custom'}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />

          {/* Party Selection */}
          <Select
            label="Party"
            placeholder="Search and select party..."
            data={parties}
            value={selectedParty}
            onChange={setSelectedParty}
            searchable
            clearable
            nothingFoundMessage="No parties found"
            leftSection={<IconUser size={16} />}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            style={{ flex: 1, minWidth: 250 }}
            styles={{
              input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' }
            }}
          />

          {/* View Toggle */}
          <Box>
            <Text size="sm" fw={500} mb={4}>View</Text>
            <Radio.Group value={viewMode} onChange={setViewMode}>
              <Group gap="md">
                <Radio value="vyapar" label="Vyapar" size="sm" />
                <Radio value="accounting" label="Accounting" size="sm" />
              </Group>
            </Radio.Group>
          </Box>
        </Flex>
      </Paper>

      {/* Party Info Bar */}
      {selectedPartyDetails && reportData?.ledger && (
        <Paper shadow="xs" p="sm" mb="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" variant="light" color="blue" radius="xl">
                <IconUser size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">{reportData.ledger.ledgerName}</Text>
                <Group gap="xs">
                  <Badge size="xs" variant="outline" color={selectedPartyDetails.type === 'Customer' ? 'blue' : 'orange'}>
                    {selectedPartyDetails.type}
                  </Badge>
                  {selectedPartyDetails.phone && (
                    <Text size="xs" c="dimmed">{selectedPartyDetails.phone}</Text>
                  )}
                </Group>
              </Box>
            </Group>
            <Group gap="xl">
              <Box ta="right">
                <Text size="xs" c="dimmed">Opening Balance</Text>
                <Text fw={600} size="sm">
                  {formatCurrency(reportData.summary?.openingBalance)} {reportData.summary?.openingBalanceType}
                </Text>
              </Box>
              <Box ta="right">
                <Text size="xs" c="dimmed">Closing Balance</Text>
                <Text fw={700} size="md" c={reportData.summary?.closingBalanceType === 'Dr' ? 'green' : 'red'}>
                  {formatCurrency(reportData.summary?.closingBalance)} {reportData.summary?.closingBalanceType}
                </Text>
              </Box>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Main Table */}
      <Paper shadow="xs" withBorder style={{ backgroundColor: '#fff' }} ref={printRef}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 1200 }}>
            <Table.Thead style={{ backgroundColor: '#f5f5f5' }}>
              <Table.Tr>
                <Table.Th style={{ width: 100 }}>
                  <Group gap={4}>
                    Date
                  </Group>
                </Table.Th>
                <Table.Th style={{ width: 140 }}>
                  <Group gap={4}>
                    Transaction Type
                    <Menu shadow="md" width={150}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={columnFilters.transactionType ? 'blue' : 'gray'}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, transactionType: '' }))}>
                          All Types
                        </Menu.Item>
                        <Menu.Divider />
                        {transactionTypes.map(type => (
                          <Menu.Item
                            key={type}
                            onClick={() => setColumnFilters(f => ({ ...f, transactionType: type }))}
                          >
                            {type}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Th>
                <Table.Th style={{ width: 130 }}>Reference No</Table.Th>
                <Table.Th style={{ width: 120 }}>
                  <Group gap={4}>
                    Payment Type
                    <Menu shadow="md" width={150}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color={columnFilters.paymentType ? 'blue' : 'gray'}>
                          <IconFilter size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, paymentType: '' }))}>
                          All
                        </Menu.Item>
                        <Menu.Divider />
                        {paymentTypes.map(type => (
                          <Menu.Item
                            key={type}
                            onClick={() => setColumnFilters(f => ({ ...f, paymentType: type }))}
                          >
                            {type}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Total Amount</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Received Amt</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Txn Balance</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Receivable Bal</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Payable Bal</Table.Th>
                <Table.Th style={{ width: 60, textAlign: 'center' }}>Print</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!selectedParty ? (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Flex direction="column" align="center" justify="center" py={60}>
                      <IconUser size={48} color="#ccc" />
                      <Text c="dimmed" size="lg" mt="md">Select a party to view statement</Text>
                      <Text c="dimmed" size="sm">Choose a customer or supplier from the dropdown above</Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : filteredTransactions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Flex direction="column" align="center" justify="center" py={60}>
                      <IconReceipt size={48} color="#ccc" />
                      <Text c="dimmed" size="lg" mt="md">No transactions to show</Text>
                      <Text c="dimmed" size="sm">No transactions found for the selected period</Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredTransactions.map((txn, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="sm">{formatDate(txn.date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {getTransactionTypeBadge(txn.transactionType || txn.voucherType)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{txn.referenceNo || txn.voucherNumber}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{txn.paymentType || '-'}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500}>
                        {formatCurrency(txn.totalAmount || txn.debitAmount || txn.creditAmount)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" c="green">
                        {formatCurrency(txn.receivedAmount || txn.creditAmount || 0)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{formatCurrency(txn.transactionBalance || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" c="green" fw={500}>
                        {txn.receivableBalance > 0 ? formatCurrency(txn.receivableBalance) : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" c="red" fw={500}>
                        {txn.payableBalance > 0 ? formatCurrency(txn.payableBalance) : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Tooltip label="Print transaction">
                        <ActionIcon variant="subtle" size="sm" color="gray">
                          <IconPrinter size={14} />
                        </ActionIcon>
                      </Tooltip>
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
                    <Text fw={700}>{formatCurrency(reportData?.summary?.totalAmount || reportData?.summary?.totalDebits)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="green">{formatCurrency(reportData?.summary?.totalReceived || reportData?.summary?.totalCredits)}</Text>
                  </Table.Td>
                  <Table.Td colSpan={4}></Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>
      </Paper>

      {/* Collapsible Summary Panel */}
      {reportData && (
        <Paper shadow="xs" mt="md" withBorder style={{ backgroundColor: '#fff' }}>
          <UnstyledButton
            onClick={() => setSummaryExpanded(!summaryExpanded)}
            style={{ width: '100%' }}
          >
            <Group justify="space-between" p="md" style={{ backgroundColor: '#f5f5f5', borderBottom: summaryExpanded ? '1px solid #e0e0e0' : 'none' }}>
              <Group gap="sm">
                <IconReportMoney size={20} />
                <Text fw={600}>Party Statement Summary</Text>
              </Group>
              {summaryExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
            </Group>
          </UnstyledButton>

          <Collapse in={summaryExpanded}>
            <Box p="md">
              <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
                {/* Total Sale */}
                <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e8f5e9' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="light" color="green" radius="xl">
                      <IconShoppingCart size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" fw={500}>Total Sale</Text>
                  </Group>
                  <Text fw={700} size="lg" c="green.7">
                    {formatCurrency(reportData.summary?.totalSale || 0)}
                  </Text>
                </Card>

                {/* Total Purchase */}
                <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#ffebee' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="light" color="red" radius="xl">
                      <IconPackage size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" fw={500}>Total Purchase</Text>
                  </Group>
                  <Text fw={700} size="lg" c="red.7">
                    {formatCurrency(reportData.summary?.totalPurchase || 0)}
                  </Text>
                </Card>

                {/* Total Expense */}
                <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#fff3e0' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="light" color="orange" radius="xl">
                      <IconReceipt size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" fw={500}>Total Expense</Text>
                  </Group>
                  <Text fw={700} size="lg" c="orange.7">
                    {formatCurrency(reportData.summary?.totalExpense || 0)}
                  </Text>
                </Card>

                {/* Total Money-In */}
                <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e3f2fd' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="light" color="blue" radius="xl">
                      <IconArrowDownRight size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" fw={500}>Total Money-In</Text>
                  </Group>
                  <Text fw={700} size="lg" c="blue.7">
                    {formatCurrency(reportData.summary?.totalMoneyIn || reportData.summary?.totalCredits || 0)}
                  </Text>
                </Card>

                {/* Total Money-Out */}
                <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#fce4ec' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="light" color="pink" radius="xl">
                      <IconArrowUpRight size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" fw={500}>Total Money-Out</Text>
                  </Group>
                  <Text fw={700} size="lg" c="pink.7">
                    {formatCurrency(reportData.summary?.totalMoneyOut || reportData.summary?.totalDebits || 0)}
                  </Text>
                </Card>

                {/* Total Receivable - Highlighted */}
                <Card shadow="sm" padding="md" radius="md" style={{ backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="md" variant="filled" color="green" radius="xl">
                      <IconCash size={16} />
                    </ThemeIcon>
                    <Text size="xs" c="green.8" fw={600}>Total Receivable</Text>
                  </Group>
                  <Text fw={700} size="xl" c="green.8">
                    {formatCurrency(reportData.summary?.totalReceivable || reportData.summary?.closingBalance || 0)}
                  </Text>
                </Card>
              </SimpleGrid>

              {/* Balance Summary */}
              <Divider my="md" />
              <Flex justify="flex-end" gap="xl">
                <Box ta="right">
                  <Text size="sm" c="dimmed">Opening Balance</Text>
                  <Text fw={600}>
                    {formatCurrency(reportData.summary?.openingBalance)} {reportData.summary?.openingBalanceType}
                  </Text>
                </Box>
                <Box ta="right">
                  <Text size="sm" c="dimmed">Net Movement</Text>
                  <Text fw={600}>
                    {formatCurrency((reportData.summary?.totalDebits || 0) - (reportData.summary?.totalCredits || 0))}
                  </Text>
                </Box>
                <Box ta="right" style={{ padding: '8px 16px', backgroundColor: reportData.summary?.closingBalanceType === 'Dr' ? '#e8f5e9' : '#ffebee', borderRadius: 8 }}>
                  <Text size="sm" c="dimmed">Closing Balance</Text>
                  <Text fw={700} size="lg" c={reportData.summary?.closingBalanceType === 'Dr' ? 'green' : 'red'}>
                    {formatCurrency(reportData.summary?.closingBalance)} {reportData.summary?.closingBalanceType}
                  </Text>
                  <Badge size="sm" color={reportData.summary?.closingBalanceType === 'Dr' ? 'green' : 'red'} variant="filled">
                    {reportData.summary?.closingBalanceType === 'Dr' ? 'To Receive' : 'To Pay'}
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

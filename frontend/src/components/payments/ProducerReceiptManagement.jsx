import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, producerReceiptAPI, farmerLedgerAPI, ledgerAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  NumberInput,
  TextInput,
  Textarea,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  ActionIcon,
  Grid,
  Modal,
  ScrollArea,
  Pagination,
  Menu,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPlus,
  IconSearch,
  IconPrinter,
  IconX,
  IconDotsVertical,
  IconCurrencyRupee,
  IconCalendar,
  IconFilter,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react';

const RECEIPT_TYPE_OPTIONS = [
  { value: 'CF Advance',   label: 'CF Advance' },
  { value: 'Cash Advance', label: 'Cash Advance' },
  { value: 'Loan Advance', label: 'Loan Advance' },
];

const PAYMENT_MODE_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank', label: 'Bank Transfer' },
  { value: 'UPI',  label: 'UPI' },
];

const RECEIPT_TYPE_COLORS = {
  'CF Advance':   'orange',
  'Cash Advance': 'cyan',
  'Loan Advance': 'violet',
};

const FILTER_TYPE_OPTIONS = [
  { value: '',             label: 'All Types' },
  { value: 'CF Advance',   label: 'CF Advance' },
  { value: 'Cash Advance', label: 'Cash Advance' },
  { value: 'Loan Advance', label: 'Loan Advance' },
];

const emptyForm = () => ({
  receiptDate:  new Date(),
  farmerId:     '',
  receiptType:  'CF Advance',
  amount:       '',
  paymentMode:  'Cash',
  bankLedgerId: '',
  remarks:      '',
});

const ProducerReceiptManagement = () => {
  const { canWrite } = useAuth();

  // ── List state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(false);
  const [receipts, setReceipts]     = useState([]);
  const [summary, setSummary]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [filters, setFilters]       = useState({ receiptType: '', fromDate: null, toDate: null });

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [modalOpen,       setModalOpen]       = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [cancelReason,    setCancelReason]    = useState('');

  // ── Form state ───────────────────────────────────────────────────────────────
  const [formData,       setFormData]       = useState(emptyForm());
  const [formLoading,    setFormLoading]    = useState(false);
  const [farmers,        setFarmers]        = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [dueAmount,      setDueAmount]      = useState(null);   // null = not fetched yet
  const [dueLoading,     setDueLoading]     = useState(false);
  const [bankLedgers,    setBankLedgers]    = useState([]);

  // ── Refs for Enter-key navigation ────────────────────────────────────────────
  const farmerRef      = useRef(null);
  const receiptTypeRef = useRef(null);
  const amountRef      = useRef(null);
  const paymentModeRef = useRef(null);
  const bankLedgerRef  = useRef(null);
  const remarksRef     = useRef(null);
  const submitRef      = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount || 0);

  const focusRef = (ref) => {
    setTimeout(() => {
      const el = ref?.current;
      if (!el) return;
      const input = el.querySelector ? (el.querySelector('input') || el.querySelector('button') || el) : el;
      input?.focus();
    }, 50);
  };

  const advanceKey = (ref) => (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault();
      focusRef(ref);
    }
  };

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, sortBy: 'receiptDate', sortOrder: 'desc' };
      if (filters.receiptType) params.receiptType = filters.receiptType;
      if (filters.fromDate)    params.fromDate    = new Date(filters.fromDate).toISOString();
      if (filters.toDate)      params.toDate      = new Date(filters.toDate).toISOString();

      const response = await producerReceiptAPI.getAll(params);
      setReceipts(response.data || []);
      setSummary(response.summary || []);
      setPagination(prev => ({ ...prev, ...response.pagination }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filters]);  // eslint-disable-line

  useEffect(() => { fetchReceipts(); }, [pagination.page, filters]);  // eslint-disable-line

  const searchFarmers = async (query) => {
    try {
      setSearchLoading(true);
      const response = (query && query.trim())
        ? await farmerAPI.search(query.trim())
        : await farmerAPI.getAll({ status: 'Active', limit: 50 });
      setFarmers(response.data || []);
    } catch (err) {
      console.error('Failed to search farmers:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const res = await ledgerAPI.getAll({ ledgerType: 'Bank', status: 'Active' });
      setBankLedgers((res.data || []).map(l => ({ value: l._id, label: l.ledgerName })));
    } catch (err) {
      console.error('Failed to fetch bank ledgers:', err);
    }
  };

  const fetchDueAmount = async (farmerId, receiptType, date) => {
    if (!farmerId) return;
    setDueLoading(true);
    try {
      const params = {};
      if (date) params.asOfDate = new Date(date).toISOString();
      const res = await farmerLedgerAPI.getOutstandingByType(farmerId, params);
      const outstanding = res.data?.[receiptType]?.amount ?? 0;
      setDueAmount(outstanding);
    } catch (err) {
      console.error('Failed to fetch due amount:', err);
      setDueAmount(0);
    } finally {
      setDueLoading(false);
    }
  };

  // ── Form handlers ────────────────────────────────────────────────────────────
  const handleFarmerSelect = (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    setSelectedFarmer(farmer || null);
    setFormData(prev => ({ ...prev, farmerId: farmerId || '' }));
    setDueAmount(null);
    if (farmerId) {
      fetchDueAmount(farmerId, formData.receiptType, formData.receiptDate);
      focusRef(receiptTypeRef);
    }
  };

  const handleDateChange = (value) => {
    setFormData(prev => ({ ...prev, receiptDate: value }));
    if (formData.farmerId) {
      fetchDueAmount(formData.farmerId, formData.receiptType, value);
    }
  };

  const handleReceiptTypeChange = (value) => {
    setFormData(prev => ({ ...prev, receiptType: value }));
    setDueAmount(null);
    if (formData.farmerId) {
      fetchDueAmount(formData.farmerId, value, formData.receiptDate);
    }
  };

  const handlePaymentModeChange = (value) => {
    setFormData(prev => ({ ...prev, paymentMode: value, bankLedgerId: '' }));
    if (value !== 'Cash' && bankLedgers.length === 0) {
      fetchBankLedgers();
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setSelectedFarmer(null);
    setDueAmount(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.farmerId) return message.error('Please select a farmer');
    if (!formData.amount || formData.amount <= 0) return message.error('Please enter a valid amount');
    if (formData.paymentMode !== 'Cash' && !formData.bankLedgerId) {
      return message.error('Please select a bank ledger for Bank/UPI payment');
    }

    setFormLoading(true);
    try {
      const payload = {
        farmerId:     formData.farmerId,
        receiptDate:  formData.receiptDate,
        receiptType:  formData.receiptType,
        paymentMode:  formData.paymentMode,
        amount:       parseFloat(formData.amount),
        remarks:      formData.remarks,
      };
      if (formData.paymentMode !== 'Cash') {
        payload.bankLedgerId = formData.bankLedgerId;
      }

      await producerReceiptAPI.create(payload);
      message.success('Receipt created successfully');
      setModalOpen(false);
      resetForm();
      fetchReceipts();
    } catch (error) {
      message.error(error.message || 'Failed to create receipt');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelReceipt = async () => {
    if (!selectedReceipt || !cancelReason.trim()) {
      message.error('Please provide a cancellation reason');
      return;
    }
    try {
      await producerReceiptAPI.cancel(selectedReceipt._id, cancelReason);
      message.success('Receipt cancelled successfully');
      setCancelModalOpen(false);
      setSelectedReceipt(null);
      setCancelReason('');
      fetchReceipts();
    } catch (error) {
      message.error(error.message || 'Failed to cancel receipt');
    }
  };

  const handlePrint = async (receipt) => {
    try {
      const response = await producerReceiptAPI.getPrintData(receipt._id);
      const printData = response.data;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html><head><title>Receipt - ${printData.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
          .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
          .label { color: #666; font-size: 12px; }
          .value { font-weight: 500; }
          .amount-box { background: #f5f5f5; padding: 15px; text-align: center; margin: 15px 0; border-radius: 5px; }
          .amount { font-size: 24px; font-weight: bold; color: #2196f3; }
          @media print { body { padding: 10px; } }
        </style></head>
        <body>
          <div class="header">
            <p style="font-size:18px;font-weight:bold;margin:0">Dairy Society</p>
            <p style="font-size:14px;color:#666;margin:5px 0 0">${printData.receiptType} Receipt</p>
            <p style="font-size:12px">No: ${printData.receiptNumber}</p>
          </div>
          <div class="row"><span class="label">Date:</span><span class="value">${new Date(printData.receiptDate).toLocaleDateString('en-IN')}</span></div>
          <div class="row"><span class="label">Farmer:</span><span class="value">${printData.farmer.number} - ${printData.farmer.name}</span></div>
          <div class="row"><span class="label">Payment Mode:</span><span class="value">${printData.paymentMode}</span></div>
          <div class="amount-box">
            <p style="margin:0;color:#666">Amount Received</p>
            <p class="amount">₹${printData.amount.toFixed(2)}</p>
          </div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    } catch (error) {
      message.error('Failed to get print data');
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalReceived   = summary.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const farmerOptions   = farmers.filter(f => f && f._id).map(f => ({
    value: String(f._id),
    label: `${f.farmerNumber || ''} - ${f.personalDetails?.name || 'Unknown'}`
  }));
  const isBankMode      = formData.paymentMode !== 'Cash';
  const balance         = dueAmount !== null ? dueAmount - (parseFloat(formData.amount) || 0) : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title order={2}>Producer Receipt Management</Title>
            <Text c="dimmed" size="sm">Record advance/loan repayments from farmers</Text>
          </Box>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => { resetForm(); searchFarmers(''); fetchBankLedgers(); setModalOpen(true); }}
            disabled={!canWrite('payments')}
          >
            New Receipt
          </Button>
        </Group>

        {/* Summary Cards */}
        <Grid>
          {summary.map((s, index) => (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{s._id}</Text>
                    <Text size="xl" fw={700} c={RECEIPT_TYPE_COLORS[s._id]}>
                      {formatCurrency(s.totalAmount)}
                    </Text>
                    <Text size="xs" c="dimmed">{s.count} receipts</Text>
                  </Box>
                  <IconCurrencyRupee size={32} stroke={1.5} color={`var(--mantine-color-${RECEIPT_TYPE_COLORS[s._id]}-6)`} />
                </Group>
              </Card>
            </Grid.Col>
          ))}
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md" bg="green.0">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Received</Text>
                  <Text size="xl" fw={700} c="green">{formatCurrency(totalReceived)}</Text>
                </Box>
                <IconCurrencyRupee size={32} stroke={1.5} color="var(--mantine-color-green-6)" />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconFilter size={18} />
              <Text fw={600}>Filters</Text>
            </Group>
            <ActionIcon variant="subtle" onClick={fetchReceipts}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                placeholder="Receipt Type"
                value={filters.receiptType}
                onChange={(value) => setFilters(prev => ({ ...prev, receiptType: value }))}
                data={FILTER_TYPE_OPTIONS}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                placeholder="From Date"
                value={filters.fromDate}
                onChange={(value) => setFilters(prev => ({ ...prev, fromDate: value }))}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                placeholder="To Date"
                value={filters.toDate}
                onChange={(value) => setFilters(prev => ({ ...prev, toDate: value }))}
                clearable
                size="sm"
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Receipts Table */}
        <Card withBorder shadow="sm" radius="md">
          {loading ? (
            <Box py="xl" style={{ textAlign: 'center' }}><Loader size="md" /></Box>
          ) : receipts.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No receipts found</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Receipt No</Table.Th>
                      <Table.Th>Farmer</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {receipts.map((receipt) => (
                      <Table.Tr key={receipt._id}>
                        <Table.Td>{formatDate(receipt.receiptDate)}</Table.Td>
                        <Table.Td><Text size="sm" fw={500}>{receipt.receiptNumber}</Text></Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{receipt.farmerId?.farmerNumber || '-'}</Text>
                          <Text size="xs" c="dimmed">{receipt.farmerId?.personalDetails?.name || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={RECEIPT_TYPE_COLORS[receipt.receiptType]} variant="light" size="sm">
                            {receipt.receiptType}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600} c="green">{formatCurrency(receipt.amount)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">{receipt.paymentMode}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconPrinter size={14} />} onClick={() => handlePrint(receipt)}>
                                Print
                              </Menu.Item>
                              {receipt.status === 'Active' && canWrite('payments') && (
                                <Menu.Item
                                  leftSection={<IconX size={14} />}
                                  color="red"
                                  onClick={() => { setSelectedReceipt(receipt); setCancelModalOpen(true); }}
                                >
                                  Cancel
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              {pagination.pages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={pagination.pages}
                    value={pagination.page}
                    onChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* New Receipt Modal */}
        <Modal
          opened={modalOpen}
          onClose={() => { setModalOpen(false); resetForm(); }}
          title={<Text fw={600} size="lg">Create Receipt</Text>}
          size="lg"
          centered
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {/* Row 1: Date + Farmer */}
              <Grid>
                <Grid.Col span={5}>
                  <DatePickerInput
                    label="Receipt Date"
                    value={formData.receiptDate}
                    onChange={handleDateChange}
                    onKeyDown={advanceKey(farmerRef)}
                    leftSection={<IconCalendar size={16} />}
                    required
                    clearable={false}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <div ref={farmerRef}>
                    <Select
                      label="Farmer"
                      placeholder="Search farmer"
                      value={formData.farmerId}
                      onChange={handleFarmerSelect}
                      data={farmerOptions}
                      searchable
                      clearable
                      onSearchChange={searchFarmers}
                      nothingFoundMessage={searchLoading ? 'Searching…' : 'No farmers found'}
                      required
                      leftSection={<IconSearch size={16} />}
                      rightSection={searchLoading ? <Loader size="xs" /> : null}
                    />
                  </div>
                </Grid.Col>
              </Grid>

              {/* Farmer info strip */}
              {selectedFarmer && (
                <Paper withBorder p="sm" radius="md" bg="gray.0">
                  <Group justify="space-between">
                    <Box>
                      <Text size="xs" c="dimmed">Farmer</Text>
                      <Text size="sm" fw={500}>{selectedFarmer.personalDetails?.name}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">Village</Text>
                      <Text size="sm">{selectedFarmer.address?.village || '-'}</Text>
                    </Box>
                  </Group>
                </Paper>
              )}

              {/* Row 2: Receipt Type */}
              <div ref={receiptTypeRef}>
                <Select
                  label="Receipt Type"
                  value={formData.receiptType}
                  onChange={handleReceiptTypeChange}
                  data={RECEIPT_TYPE_OPTIONS}
                  required
                  onKeyDown={advanceKey(amountRef)}
                />
              </div>

              {/* Due Amount display */}
              {dueLoading && (
                <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Fetching outstanding…</Text></Group>
              )}
              {!dueLoading && dueAmount !== null && (
                <Alert
                  color={dueAmount > 0 ? 'blue' : 'green'}
                  icon={<IconAlertCircle size={16} />}
                  p="xs"
                >
                  <Group justify="space-between">
                    <Text size="sm">
                      Outstanding ({formData.receiptType}):&nbsp;
                      <Text span fw={700}>{formatCurrency(dueAmount)}</Text>
                    </Text>
                    {balance !== null && parseFloat(formData.amount) > 0 && (
                      <Text size="sm" c={balance < 0 ? 'red' : 'green'}>
                        Balance after:&nbsp;
                        <Text span fw={700}>{formatCurrency(balance)}</Text>
                      </Text>
                    )}
                  </Group>
                </Alert>
              )}

              {/* Row 3: Amount + Payment Mode */}
              <Grid>
                <Grid.Col span={6}>
                  <div ref={amountRef}>
                    <NumberInput
                      label="Amount Received"
                      value={formData.amount}
                      onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
                      onKeyDown={advanceKey(paymentModeRef)}
                      placeholder="Enter amount"
                      min={1}
                      required
                      leftSection={<IconCurrencyRupee size={16} />}
                      thousandSeparator=","
                    />
                  </div>
                </Grid.Col>
                <Grid.Col span={6}>
                  <div ref={paymentModeRef}>
                    <Select
                      label="Payment Mode"
                      value={formData.paymentMode}
                      onChange={handlePaymentModeChange}
                      data={PAYMENT_MODE_OPTIONS}
                      required
                      onKeyDown={advanceKey(isBankMode ? bankLedgerRef : remarksRef)}
                    />
                  </div>
                </Grid.Col>
              </Grid>

              {/* Bank Ledger (shown only for Bank/UPI) */}
              {isBankMode && (
                <div ref={bankLedgerRef}>
                  <Select
                    label="Bank Ledger"
                    placeholder="Select bank account"
                    value={formData.bankLedgerId}
                    onChange={(value) => setFormData(prev => ({ ...prev, bankLedgerId: value }))}
                    data={bankLedgers}
                    required
                    searchable
                    onKeyDown={advanceKey(remarksRef)}
                    rightSection={bankLedgers.length === 0 ? <Loader size="xs" /> : null}
                  />
                </div>
              )}

              {/* Remarks */}
              <div ref={remarksRef}>
                <Textarea
                  label="Remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional notes"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitRef.current?.click(); }
                  }}
                />
              </div>

              <Group justify="flex-end" mt="sm">
                <Button variant="light" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button
                  ref={submitRef}
                  type="submit"
                  loading={formLoading}
                  disabled={
                    !formData.farmerId ||
                    !formData.amount ||
                    (isBankMode && !formData.bankLedgerId)
                  }
                >
                  Create Receipt
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>

        {/* Cancel Modal */}
        <Modal
          opened={cancelModalOpen}
          onClose={() => { setCancelModalOpen(false); setSelectedReceipt(null); setCancelReason(''); }}
          title="Cancel Receipt"
          centered
        >
          <Stack>
            <Text size="sm">
              Cancel receipt <strong>{selectedReceipt?.receiptNumber}</strong>? This will reverse accounting entries.
            </Text>
            <TextInput
              label="Cancellation Reason"
              placeholder="Enter reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setCancelModalOpen(false)}>No, Keep It</Button>
              <Button color="red" onClick={handleCancelReceipt}>Yes, Cancel</Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

export default ProducerReceiptManagement;

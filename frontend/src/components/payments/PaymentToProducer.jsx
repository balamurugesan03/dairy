import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Grid,
  Card,
  Title,
  Text,
  Group,
  Stack,
  Box,
  Button,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Radio,
  Table,
  Badge,
  ActionIcon,
  Pagination,
  Loader,
  Center,
  Divider,
  Paper,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCash,
  IconPrinter,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconCheck,
  IconBuildingBank,
  IconUser,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { collectionCenterAPI, farmerAPI, producerPaymentAPI, producerOpeningAPI } from '../../services/api';

/* ─── Formatters ─────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '-');

/* ─── Print styles ────────────────────────────────────────────────────────────── */
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #ptp-print-area, #ptp-print-area * { visibility: visible !important; }
    #ptp-print-area { position: fixed; inset: 0; padding: 16px; }
    table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
    @page { size: A4 landscape; margin: 10mm; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
  }
`;

/* ════════════════════════════════════════════════════════════════════════════ */
export default function PaymentToProducer() {
  // ── Period / Filter state ───────────────────────────────────────────────────
  const [periodConfirmed, setPeriodConfirmed] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null); // { fromDate, toDate, label }
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [centerId, setCenterId] = useState(null);
  const [centerName, setCenterName] = useState('All');
  const [centers, setCenters] = useState([]);

  // ── Payment Details form state ──────────────────────────────────────────────
  const [last5Days, setLast5Days] = useState(false);
  const [producerIdInput, setProducerIdInput] = useState('');
  const [refNo, setRefNo] = useState('');
  const [abstractBalance, setAbstractBalance] = useState(0);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [printSlip, setPrintSlip] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [bankTransferPaid, setBankTransferPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Table state ─────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [bankTransferRows, setBankTransferRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [tableSearch, setTableSearch] = useState('');

  const printRef = useRef();
  const amountPaidWrapRef = useRef(null);

  // ─── Load collection centers + cycles on mount ───────────────────────────────
  useEffect(() => {
    collectionCenterAPI
      .getAll({ status: 'Active' })
      .then((res) => {
        const list = res?.data || [];
        setCenters(list.map((c) => ({ value: c._id, label: c.centerName })));
      })
      .catch(() => setCenters([]));

    producerPaymentAPI.getCycles()
      .then((res) => setCycles(res?.data || []))
      .catch(() => setCycles([]));
  }, []);

  // ─── Load payments when filters/pagination change (and period confirmed) ────
  const loadPayments = useCallback(async () => {
    if (!periodConfirmed) return;
    setTableLoading(true);
    try {
      const params = {
        page,
        limit,
        search: tableSearch || undefined,
        centerId: centerId || undefined,
      };

      if (last5Days) {
        params.last5Days = 'true';
      } else if (selectedCycle) {
        params.cycleFromDate = dayjs(selectedCycle.fromDate).format('YYYY-MM-DD');
        params.cycleToDate   = dayjs(selectedCycle.toDate).format('YYYY-MM-DD');
      }

      const res = await producerPaymentAPI.getAll(params);
      if (res?.success) {
        setPayments(res.data || []);
        setTotalPages(res.pagination?.pages || 1);
        setTotalCount(res.pagination?.total || 0);
        setGrandTotal(res.summary?.totalAmount || 0);
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load payments', color: 'red' });
    } finally {
      setTableLoading(false);
    }
  }, [periodConfirmed, page, limit, last5Days, selectedCycle, centerId, tableSearch]);

  // ─── Load bank-transfer-paid rows for the selected cycle ────────────────────
  const loadBankTransferRows = useCallback(async () => {
    if (!periodConfirmed || !selectedCycle) { setBankTransferRows([]); return; }
    try {
      const res = await producerPaymentAPI.getBankTransferPaid({
        cycleFromDate: dayjs(selectedCycle.fromDate).format('YYYY-MM-DD'),
        cycleToDate:   dayjs(selectedCycle.toDate).format('YYYY-MM-DD'),
      });
      setBankTransferRows(res?.data || []);
    } catch {
      setBankTransferRows([]);
    }
  }, [periodConfirmed, selectedCycle]);

  useEffect(() => {
    if (periodConfirmed) {
      loadPayments();
      loadBankTransferRows();
    }
  }, [loadPayments, loadBankTransferRows]);

  // ─── Handle period OK / Cancel ──────────────────────────────────────────────
  const handleOK = () => {
    if (!selectedCycle) {
      notifications.show({ title: 'Validation', message: 'Please select a payment cycle', color: 'orange' });
      return;
    }
    setPeriodConfirmed(true);
  };

  const handleCancel = () => {
    setPeriodConfirmed(false);
    resetDetailsForm();
  };

  // ─── Fetch producer balance on producer ID blur / Enter ──────────────────────
  const fetchProducerBalance = useCallback(async () => {
    if (!producerIdInput?.trim()) return null;

    setBalanceLoading(true);
    try {
      const searchRes = await farmerAPI.search(producerIdInput.trim());
      const farmers = searchRes?.data || [];
      if (farmers.length === 0) {
        notifications.show({ title: 'Not Found', message: `No producer found with ID "${producerIdInput}"`, color: 'orange' });
        setSelectedFarmer(null);
        setAbstractBalance(0);
        setBankTransferPaid(false);
        return null;
      }

      const farmer = farmers[0];
      const periodParams = {};
      if (selectedCycle) {
        periodParams.fromDate = dayjs(selectedCycle.fromDate).format('YYYY-MM-DD');
        periodParams.toDate   = dayjs(selectedCycle.toDate).format('YYYY-MM-DD');
      }

      const [balanceRes, openingRes] = await Promise.all([
        producerPaymentAPI.getProducerBalance(farmer._id, periodParams),
        producerOpeningAPI.getByFarmer(farmer._id),
      ]);

      if (balanceRes?.success) {
        const isBT = balanceRes.data?.bankTransferPaid || false;
        const payBalance = balanceRes.data?.balance || 0;
        const openingDue = Number(openingRes?.data?.dueAmount) || 0;

        setAbstractBalance(payBalance + openingDue);
        setSelectedFarmer({
          _id: farmer._id,
          farmerNumber: farmer.farmerNumber,
          name: farmer.personalDetails?.name || '',
          bankName: balanceRes.data?.farmer?.bankName || farmer.bankDetails?.bankName || '',
          accountNumber: balanceRes.data?.farmer?.accountNumber || farmer.bankDetails?.accountNumber || '',
        });
        setBankTransferPaid(isBT);

        if (isBT) {
          notifications.show({
            title: 'Already Paid',
            message: 'This producer has already been paid via Bank Transfer for this cycle.',
            color: 'orange',
            icon: <IconBuildingBank size={16} />,
          });
        }
        return { bankTransferPaid: isBT };
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to fetch producer balance', color: 'red' });
      setSelectedFarmer(null);
      setAbstractBalance(0);
      setBankTransferPaid(false);
    } finally {
      setBalanceLoading(false);
    }
    return null;
  }, [producerIdInput, selectedCycle]);

  // ─── Enter key on producer ID → fetch balance → focus amount paid ────────────
  const handleProducerIdKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const result = await fetchProducerBalance();
      if (result && !result.bankTransferPaid) {
        setTimeout(() => {
          amountPaidWrapRef.current?.querySelector('input')?.focus();
        }, 50);
      }
    }
  };

  // ─── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedFarmer) {
      notifications.show({ title: 'Validation', message: 'Please enter a valid Producer ID', color: 'orange' });
      return;
    }
    if (bankTransferPaid) {
      notifications.show({ title: 'Blocked', message: 'This producer is already paid via Bank Transfer', color: 'orange' });
      return;
    }
    const paid = parseFloat(amountPaid);
    if (!paid || paid <= 0) {
      notifications.show({ title: 'Validation', message: 'Amount Paid must be greater than 0', color: 'orange' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        farmerId: selectedFarmer._id,
        producerNumber: selectedFarmer.farmerNumber,
        producerName: selectedFarmer.name,
        amountPaid: paid,
        processingPeriod: {
          fromDate: dayjs(selectedCycle.fromDate).toISOString(),
          toDate:   dayjs(selectedCycle.toDate).toISOString(),
        },
        paymentDate:        dayjs(paymentDate).toISOString(),
        isPartialPayment,
        paymentCenter:     centerId || null,
        paymentCenterName: centerName || 'All',
        refNo,
        lastAbstractBalance: abstractBalance,
        printSlip,
        paymentMode,
      };

      const res = editingId
        ? await producerPaymentAPI.update(editingId, payload)
        : await producerPaymentAPI.create(payload);

      if (res?.success) {
        notifications.show({
          title: 'Success',
          message: editingId ? 'Payment updated' : 'Payment saved',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        resetDetailsForm();
        loadPayments();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to save payment', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (payment) => {
    setEditingId(payment._id);
    setProducerIdInput(payment.producerNumber || '');
    setSelectedFarmer({
      _id:          payment.farmerId?._id || payment.farmerId,
      farmerNumber: payment.producerNumber || '',
      name:         payment.producerName || '',
    });
    setRefNo(payment.refNo || '');
    setAbstractBalance(payment.lastAbstractBalance || 0);
    setAmountPaid(payment.amountPaid || '');
    setPaymentMode(payment.paymentMode || 'Cash');
    setPrintSlip(payment.printSlip || false);
    setBankTransferPaid(false);
  };

  // ─── Delete (permanent) ─────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this payment? This cannot be undone.')) return;
    try {
      const res = await producerPaymentAPI.delete(id);
      if (res?.success) {
        notifications.show({ title: 'Deleted', message: 'Payment has been permanently deleted', color: 'red' });
        loadPayments();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to delete payment', color: 'red' });
    }
  };

  // ─── Reset form ─────────────────────────────────────────────────────────────
  const resetDetailsForm = () => {
    setProducerIdInput('');
    setRefNo('');
    setAbstractBalance(0);
    setAmountPaid('');
    setPaymentMode('Cash');
    setPrintSlip(false);
    setSelectedFarmer(null);
    setEditingId(null);
    setBankTransferPaid(false);
  };

  // ─── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Payment to Producer',
    pageStyle: PRINT_STYLE,
  });

  // ─── Sheet total (current page) ─────────────────────────────────────────────
  const sheetTotal = payments
    .filter((p) => p.status !== 'Cancelled')
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  const cycleSelectData = cycles.map(c => ({
    value: `${dayjs(c.fromDate).format('YYYY-MM-DD')}|${dayjs(c.toDate).format('YYYY-MM-DD')}`,
    label: c.label,
  }));

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_STYLE}</style>

      <Grid gutter="md">
        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            {/* ── Card 1: Period setup ─────────────────────────────────────── */}
            <Card withBorder shadow="sm" radius="md" p="md">
              <Group gap="xs" mb="sm">
                <IconCash size={20} color="#228be6" />
                <Title order={5} c="blue" fw={700}>
                  Payment to Producer
                </Title>
              </Group>

              <Stack gap="sm">
                <Radio.Group
                  label="Payment Type"
                  value={isPartialPayment ? 'partial' : 'full'}
                  onChange={(val) => {
                    setIsPartialPayment(val === 'partial');
                    setPeriodConfirmed(false);
                  }}
                >
                  <Group mt="xs" gap="md">
                    <Radio value="full" label="Full Payment" />
                    <Radio value="partial" label="Partial Payment" />
                  </Group>
                </Radio.Group>

                <Select
                  label="Payment Cycle"
                  placeholder="Select cycle..."
                  data={cycleSelectData}
                  value={selectedCycle
                    ? `${dayjs(selectedCycle.fromDate).format('YYYY-MM-DD')}|${dayjs(selectedCycle.toDate).format('YYYY-MM-DD')}`
                    : null}
                  onChange={(val) => {
                    if (!val) { setSelectedCycle(null); setPeriodConfirmed(false); return; }
                    const [from, to] = val.split('|');
                    const found = cycles.find(c =>
                      dayjs(c.fromDate).format('YYYY-MM-DD') === from &&
                      dayjs(c.toDate).format('YYYY-MM-DD') === to
                    );
                    setSelectedCycle(found ? { fromDate: new Date(found.fromDate), toDate: new Date(found.toDate), label: found.label } : null);
                    setPeriodConfirmed(false);
                    resetDetailsForm();
                  }}
                  clearable
                  searchable
                  nothingFoundMessage="No saved cycles found"
                />

                <Select
                  label="Payment Center"
                  placeholder="All Centers"
                  data={centers}
                  value={centerId}
                  onChange={(val, option) => {
                    setCenterId(val);
                    setCenterName(option?.label || 'All');
                    setPeriodConfirmed(false);
                  }}
                  clearable
                  searchable
                />

                <DatePickerInput
                  label="Payment Date"
                  placeholder="Select payment date"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  clearable={false}
                  required
                />

                <Group justify="flex-start" mt="xs">
                  <Button color="blue" onClick={handleOK}>
                    OK
                  </Button>
                  <Button variant="outline" color="red" onClick={handleCancel}>
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Card>

            {/* ── Card 2: Payment Details form ─────────────────────────────── */}
            <Card withBorder shadow="sm" radius="md" p="md">
              <Title order={5} fw={600} mb="sm" c={periodConfirmed ? 'dark' : 'dimmed'}>
                Payment Details
              </Title>

              <Stack gap="sm" style={{ opacity: periodConfirmed ? 1 : 0.4, pointerEvents: periodConfirmed ? 'auto' : 'none' }}>
                <Checkbox
                  label="Display Last 5 Days Payments"
                  checked={last5Days}
                  onChange={(e) => {
                    setLast5Days(e.currentTarget.checked);
                    setPage(1);
                  }}
                />

                <Box pos="relative">
                  <TextInput
                    label="Producer ID"
                    placeholder="Enter Producer ID and press Enter"
                    value={producerIdInput}
                    onChange={(e) => {
                      setProducerIdInput(e.currentTarget.value);
                      setSelectedFarmer(null);
                      setBankTransferPaid(false);
                      setAbstractBalance(0);
                    }}
                    onBlur={fetchProducerBalance}
                    onKeyDown={handleProducerIdKeyDown}
                    rightSection={balanceLoading ? <Loader size="xs" /> : null}
                  />
                  {selectedFarmer && !bankTransferPaid && (
                    <Text size="xs" c="teal" mt={2}>
                      <IconUser size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {selectedFarmer.name}
                      {selectedFarmer.bankName ? ` — ${selectedFarmer.bankName}` : ''}
                    </Text>
                  )}
                  {bankTransferPaid && (
                    <Alert
                      mt={4}
                      p="xs"
                      color="orange"
                      icon={<IconBuildingBank size={14} />}
                    >
                      <Text size="xs" fw={600}>Already paid by Bank Transfer for this cycle</Text>
                    </Alert>
                  )}
                </Box>

                <TextInput
                  label="Ref No"
                  placeholder="Reference number (optional)"
                  value={refNo}
                  onChange={(e) => setRefNo(e.currentTarget.value)}
                />

                <NumberInput
                  label="Last Abstract Balance"
                  value={abstractBalance}
                  readOnly
                  decimalScale={2}
                  prefix="₹ "
                  styles={{ input: { backgroundColor: '#f8f9fa', color: '#495057', cursor: 'default' } }}
                />

                <Box ref={amountPaidWrapRef}>
                  <NumberInput
                    label="Amount Paid"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={setAmountPaid}
                    min={0}
                    decimalScale={2}
                    prefix="₹ "
                    disabled={bankTransferPaid}
                  />
                </Box>

                <Select
                  label="Payment Mode"
                  data={['Cash', 'Bank', 'Cheque', 'UPI', 'NEFT', 'RTGS']}
                  value={paymentMode}
                  onChange={setPaymentMode}
                  disabled={bankTransferPaid}
                />

                <Checkbox
                  label="Print Slip"
                  checked={printSlip}
                  onChange={(e) => setPrintSlip(e.currentTarget.checked)}
                />

                <Group justify="flex-start" mt="xs">
                  <Button color="blue" loading={saving} onClick={handleSave} disabled={bankTransferPaid}>
                    Save
                  </Button>
                  <Button variant="outline" onClick={resetDetailsForm}>
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder shadow="sm" radius="md" p="md" h="100%">
            {/* Header */}
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Title order={5} fw={600}>
                  Payment Details
                </Title>
                <Badge color="blue" variant="filled" size="sm">
                  {totalCount}
                </Badge>
                {selectedCycle && (
                  <Badge color="teal" variant="light" size="sm">
                    {selectedCycle.label}
                  </Badge>
                )}
              </Group>
              <Group gap="xs" className="no-print">
                <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => { loadPayments(); loadBankTransferRows(); }}>
                  Refresh
                </Button>
                <Button size="xs" variant="light" color="teal" leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
                  Print
                </Button>
              </Group>
            </Group>

            {/* Search + entries row */}
            <Group justify="space-between" mb="sm" className="no-print">
              <Group gap="xs">
                <Text size="sm">Show</Text>
                <Select
                  size="xs"
                  data={['10', '25', '50', '100']}
                  value={String(limit)}
                  onChange={(val) => { setLimit(parseInt(val)); setPage(1); }}
                  w={70}
                />
                <Text size="sm">entries</Text>
              </Group>
              <TextInput
                size="xs"
                placeholder="Search producer / ref..."
                leftSection={<IconSearch size={13} />}
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.currentTarget.value); setPage(1); }}
                w={220}
              />
            </Group>

            {/* Table */}
            <Box ref={printRef} id="ptp-print-area">
              {/* Print header (hidden on screen) */}
              <Box style={{ display: 'none' }} className="print-only" mb="sm">
                <Title order={4} ta="center">Payment to Producer</Title>
                <Text ta="center" size="sm">
                  Cycle: {selectedCycle?.label || '-'}
                </Text>
                <Divider my="xs" />
              </Box>

              {tableLoading ? (
                <Center py="xl"><Loader size="md" /></Center>
              ) : payments.length === 0 && bankTransferRows.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed" size="sm">
                    {periodConfirmed
                      ? 'No payments found for the selected cycle.'
                      : 'Select a payment cycle and click OK to load payments.'}
                  </Text>
                </Center>
              ) : (
                <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th ta="center" w={40}>Sl.No</Table.Th>
                      <Table.Th>Pro.No</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Ref No</Table.Th>
                      <Table.Th ta="right">Amt Paid</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="center" className="no-print">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.map((pmt, idx) => (
                      <Table.Tr
                        key={pmt._id}
                        style={{
                          textDecoration: pmt.status === 'Cancelled' ? 'line-through' : 'none',
                          color: pmt.status === 'Cancelled' ? '#adb5bd' : 'inherit',
                        }}
                      >
                        <Table.Td ta="center">{(page - 1) * limit + idx + 1}</Table.Td>
                        <Table.Td>{pmt.producerNumber || pmt.farmerId?.farmerNumber || '-'}</Table.Td>
                        <Table.Td>{pmt.producerName || pmt.farmerId?.personalDetails?.name || '-'}</Table.Td>
                        <Table.Td>{pmt.refNo || '-'}</Table.Td>
                        <Table.Td ta="right">₹ {fmt(pmt.amountPaid)}</Table.Td>
                        <Table.Td>{pmt.paymentMode || '-'}</Table.Td>
                        <Table.Td>{fmtDate(pmt.paymentDate)}</Table.Td>
                        <Table.Td ta="center" className="no-print">
                          {pmt.status !== 'Cancelled' && (
                            <Group gap={4} justify="center">
                              <ActionIcon size="sm" variant="subtle" color="blue" title="Edit" onClick={() => handleEdit(pmt)}>
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon size="sm" variant="subtle" color="red" title="Delete" onClick={() => handleDelete(pmt._id)}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                          {pmt.status === 'Cancelled' && (
                            <Badge size="xs" color="red" variant="light">Cancelled</Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {/* ── Bank Transfer rows ─────────────────────────────── */}
                    {bankTransferRows.length > 0 && (
                      <Table.Tr style={{ background: 'var(--mantine-color-indigo-0)' }}>
                        <Table.Td colSpan={8} py={4}>
                          <Group gap="xs">
                            <IconBuildingBank size={13} color="var(--mantine-color-indigo-6)" />
                            <Text size="xs" fw={700} c="indigo.7">
                              Already Paid via Bank Transfer ({bankTransferRows.length} farmer{bankTransferRows.length > 1 ? 's' : ''})
                            </Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {bankTransferRows.map((row, idx) => (
                      <Table.Tr key={row._id} style={{ background: 'var(--mantine-color-indigo-0)', color: '#495057' }}>
                        <Table.Td ta="center">
                          <Text size="xs" c="dimmed">{idx + 1}</Text>
                        </Table.Td>
                        <Table.Td><Text size="xs">{row.producerNumber || '-'}</Text></Table.Td>
                        <Table.Td><Text size="xs">{row.producerName || '-'}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                        <Table.Td ta="right"><Text size="xs">₹ {fmt(row.amountPaid)}</Text></Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="indigo" variant="filled" leftSection={<IconBuildingBank size={9} />}>
                            Bank Transfer
                          </Badge>
                        </Table.Td>
                        <Table.Td><Text size="xs">{fmtDate(row.paymentDate)}</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge size="xs" color="green" variant="light">Paid</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Group justify="center" mt="md" className="no-print">
                <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
              </Group>
            )}

            {/* Summary rows */}
            <Divider mt="md" mb="xs" />
            <Paper px="md" py="xs" bg="teal.0" radius="sm">
              <Group justify="space-between">
                <Text fw={600} size="sm" c="teal.8">Amount Total in Sheet:</Text>
                <Text fw={700} size="sm" c="teal.8">₹ {fmt(sheetTotal)}</Text>
              </Group>
              <Group justify="space-between" mt={4}>
                <Text fw={600} size="sm" c="teal.9">Grand Total:</Text>
                <Text fw={700} size="sm" c="teal.9">₹ {fmt(grandTotal)}</Text>
              </Group>
            </Paper>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

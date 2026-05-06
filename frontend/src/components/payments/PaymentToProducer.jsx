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
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());
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
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Table state ─────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [tableSearch, setTableSearch] = useState('');

  const printRef = useRef();

  // ─── Load collection centers on mount ──────────────────────────────────────
  useEffect(() => {
    collectionCenterAPI
      .getAll({ status: 'Active' })
      .then((res) => {
        const list = res?.data || [];
        setCenters(
          list.map((c) => ({ value: c._id, label: c.centerName }))
        );
      })
      .catch(() => setCenters([]));
  }, []);

  // ─── Load payments when filters/pagination change (and period confirmed) ────
  const loadPayments = useCallback(async () => {
    if (!periodConfirmed) return;
    setTableLoading(true);
    try {
      const params = {
        page,
        limit,
        last5Days: last5Days ? 'true' : 'false',
        search: tableSearch || undefined,
        centerId: centerId || undefined,
      };
      if (!last5Days) {
        if (fromDate) params.fromDate = dayjs(fromDate).format('YYYY-MM-DD');
        if (toDate) params.toDate = dayjs(toDate).format('YYYY-MM-DD');
      }

      const res = await producerPaymentAPI.getAll(params);
      if (res?.success) {
        setPayments(res.data || []);
        setTotalPages(res.pagination?.pages || 1);
        setTotalCount(res.pagination?.total || 0);
        setGrandTotal(res.summary?.totalAmount || 0);
      }
    } catch (err) {
      console.error('Error loading payments:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load payments',
        color: 'red',
      });
    } finally {
      setTableLoading(false);
    }
  }, [periodConfirmed, page, limit, last5Days, fromDate, toDate, centerId, tableSearch]);

  useEffect(() => {
    if (periodConfirmed) {
      loadPayments();
    }
  }, [loadPayments]);

  // ─── Handle period OK / Cancel ──────────────────────────────────────────────
  const handleOK = () => {
    if (!fromDate || !toDate) {
      notifications.show({
        title: 'Validation',
        message: 'Please select From Date and To Date',
        color: 'orange',
      });
      return;
    }
    setPeriodConfirmed(true);
    // loadPayments will trigger via the useEffect
  };

  const handleCancel = () => {
    setPeriodConfirmed(false);
    resetDetailsForm();
  };

  // ─── Fetch producer balance on producer ID blur ──────────────────────────────
  const fetchProducerBalance = async () => {
    if (!producerIdInput || !producerIdInput.trim()) return;

    setBalanceLoading(true);
    try {
      // Search farmer by farmerNumber
      const searchRes = await farmerAPI.search(producerIdInput.trim());
      const farmers = searchRes?.data || [];
      if (farmers.length === 0) {
        notifications.show({
          title: 'Not Found',
          message: `No producer found with ID "${producerIdInput}"`,
          color: 'orange',
        });
        setSelectedFarmer(null);
        setAbstractBalance(0);
        return;
      }

      const farmer = farmers[0];

      // Now get balance + opening — pass period so backend can filter to the current cycle
      const periodParams = {};
      if (fromDate) periodParams.fromDate = dayjs(fromDate).format('YYYY-MM-DD');
      if (toDate)   periodParams.toDate   = dayjs(toDate).format('YYYY-MM-DD');

      const [balanceRes, openingRes] = await Promise.all([
        producerPaymentAPI.getProducerBalance(farmer._id, periodParams),
        producerOpeningAPI.getByFarmer(farmer._id),
      ]);
      if (balanceRes?.success) {
        const payBalance     = balanceRes.data?.balance || 0;
        const openingDue     = Number(openingRes?.data?.dueAmount) || 0;
        setAbstractBalance(payBalance + openingDue);
        setSelectedFarmer({
          _id: farmer._id,
          farmerNumber: farmer.farmerNumber,
          name: farmer.personalDetails?.name || '',
          bankName: balanceRes.data?.farmer?.bankName || farmer.bankDetails?.bankName || '',
          accountNumber:
            balanceRes.data?.farmer?.accountNumber || farmer.bankDetails?.accountNumber || '',
        });
      }
    } catch (err) {
      console.error('Error fetching producer balance:', err);
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to fetch producer balance',
        color: 'red',
      });
      setSelectedFarmer(null);
      setAbstractBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  // ─── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedFarmer) {
      notifications.show({
        title: 'Validation',
        message: 'Please enter a valid Producer ID',
        color: 'orange',
      });
      return;
    }
    const paid = parseFloat(amountPaid);
    if (!paid || paid <= 0) {
      notifications.show({
        title: 'Validation',
        message: 'Amount Paid must be greater than 0',
        color: 'orange',
      });
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
          fromDate: dayjs(fromDate).toISOString(),
          toDate: dayjs(toDate).toISOString(),
        },
        paymentDate: dayjs(paymentDate).toISOString(),
        isPartialPayment,
        paymentCenter: centerId || null,
        paymentCenterName: centerName || 'All',
        refNo,
        lastAbstractBalance: abstractBalance,
        printSlip,
        paymentMode,
      };

      let res;
      if (editingId) {
        res = await producerPaymentAPI.update(editingId, payload);
      } else {
        res = await producerPaymentAPI.create(payload);
      }

      if (res?.success) {
        notifications.show({
          title: 'Success',
          message: editingId ? 'Payment updated successfully' : 'Payment saved successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        resetDetailsForm();
        loadPayments();
      }
    } catch (err) {
      console.error('Error saving payment:', err);
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to save payment',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (payment) => {
    setEditingId(payment._id);
    setProducerIdInput(payment.producerNumber || '');
    setSelectedFarmer({
      _id: payment.farmerId?._id || payment.farmerId,
      farmerNumber: payment.producerNumber || '',
      name: payment.producerName || '',
    });
    setRefNo(payment.refNo || '');
    setAbstractBalance(payment.lastAbstractBalance || 0);
    setAmountPaid(payment.amountPaid || '');
    setPaymentMode(payment.paymentMode || 'Cash');
    setPrintSlip(payment.printSlip || false);
  };

  // ─── Delete (cancel) ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this payment?')) return;
    try {
      const res = await producerPaymentAPI.cancel(id);
      if (res?.success) {
        notifications.show({
          title: 'Cancelled',
          message: 'Payment has been cancelled',
          color: 'orange',
        });
        loadPayments();
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to cancel payment',
        color: 'red',
      });
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

                <DatePickerInput
                  label="From Date"
                  placeholder="Select from date"
                  value={fromDate}
                  onChange={(val) => {
                    setFromDate(val);
                    setPeriodConfirmed(false);
                  }}
                  clearable={false}
                  required
                />

                <DatePickerInput
                  label="To Date"
                  placeholder="Select to date"
                  value={toDate}
                  onChange={(val) => {
                    setToDate(val);
                    setPeriodConfirmed(false);
                  }}
                  clearable={false}
                  required
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
                    placeholder="Enter Producer ID"
                    value={producerIdInput}
                    onChange={(e) => setProducerIdInput(e.currentTarget.value)}
                    onBlur={fetchProducerBalance}
                    rightSection={balanceLoading ? <Loader size="xs" /> : null}
                  />
                  {selectedFarmer && (
                    <Text size="xs" c="teal" mt={2}>
                      <IconUser size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {selectedFarmer.name}
                      {selectedFarmer.bankName ? ` — ${selectedFarmer.bankName}` : ''}
                    </Text>
                  )}
                </Box>

                <TextInput
                  label="Ref No"
                  placeholder="Reference number"
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

                <NumberInput
                  label="Amount Paid"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={setAmountPaid}
                  min={0}
                  decimalScale={2}
                  prefix="₹ "
                />

                <Select
                  label="Payment Mode"
                  data={['Cash', 'Bank', 'Cheque', 'UPI', 'NEFT', 'RTGS']}
                  value={paymentMode}
                  onChange={setPaymentMode}
                />

                <Checkbox
                  label="Print Slip"
                  checked={printSlip}
                  onChange={(e) => setPrintSlip(e.currentTarget.checked)}
                />

                <Group justify="flex-start" mt="xs">
                  <Button color="blue" loading={saving} onClick={handleSave}>
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
              </Group>
              <Group gap="xs" className="no-print">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  onClick={loadPayments}
                >
                  Refresh
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconPrinter size={14} />}
                  onClick={handlePrint}
                >
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
                  onChange={(val) => {
                    setLimit(parseInt(val));
                    setPage(1);
                  }}
                  w={70}
                />
                <Text size="sm">entries</Text>
              </Group>
              <TextInput
                size="xs"
                placeholder="Search producer / ref..."
                leftSection={<IconSearch size={13} />}
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.currentTarget.value);
                  setPage(1);
                }}
                w={220}
              />
            </Group>

            {/* Table */}
            <Box ref={printRef} id="ptp-print-area">
              {/* Print header (hidden on screen) */}
              <Box style={{ display: 'none' }} className="print-only" mb="sm">
                <Title order={4} ta="center">
                  Payment to Producer
                </Title>
                <Text ta="center" size="sm">
                  Period: {fmtDate(fromDate)} to {fmtDate(toDate)}
                </Text>
                <Divider my="xs" />
              </Box>

              {tableLoading ? (
                <Center py="xl">
                  <Loader size="md" />
                </Center>
              ) : payments.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed" size="sm">
                    {periodConfirmed
                      ? 'No payments found for the selected period.'
                      : 'Set the processing period and click OK to load payments.'}
                  </Text>
                </Center>
              ) : (
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                  verticalSpacing="xs"
                  fz="sm"
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th ta="center" w={40}>
                        Sl.No
                      </Table.Th>
                      <Table.Th>Pro.No</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Ref No</Table.Th>
                      <Table.Th ta="right">Amt Paid</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="center" className="no-print">
                        Action
                      </Table.Th>
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
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="blue"
                                title="Edit"
                                onClick={() => handleEdit(pmt)}
                              >
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                title="Cancel"
                                onClick={() => handleDelete(pmt._id)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                          {pmt.status === 'Cancelled' && (
                            <Badge size="xs" color="red" variant="light">
                              Cancelled
                            </Badge>
                          )}
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
                <Pagination
                  total={totalPages}
                  value={page}
                  onChange={setPage}
                  size="sm"
                />
              </Group>
            )}

            {/* Summary rows */}
            <Divider mt="md" mb="xs" />
            <Paper px="md" py="xs" bg="teal.0" radius="sm">
              <Group justify="space-between">
                <Text fw={600} size="sm" c="teal.8">
                  Amount Total in Sheet:
                </Text>
                <Text fw={700} size="sm" c="teal.8">
                  ₹ {fmt(sheetTotal)}
                </Text>
              </Group>
              <Group justify="space-between" mt={4}>
                <Text fw={600} size="sm" c="teal.9">
                  Grand Total:
                </Text>
                <Text fw={700} size="sm" c="teal.9">
                  ₹ {fmt(grandTotal)}
                </Text>
              </Group>
            </Paper>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

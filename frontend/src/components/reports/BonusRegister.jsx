import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Group,
  Stack,
  Box,
  Grid,
  TextInput,
  NumberInput,
  Select,
  SegmentedControl,
  Switch,
  Button,
  Table,
  Badge,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Pagination,
  Loader,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconGift,
  IconCalculator,
  IconPrinter,
  IconFileSpreadsheet,
  IconDeviceFloppy,
  IconX,
  IconSend,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { bonusRegisterAPI, collectionCenterAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

const fmt = (v) =>
  Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyTotals = { totalQty: 0, totalAmount: 0, totalBonusAmount: 0, totalDividendAmount: 0, totalPostAmount: 0 };

const BonusRegister = () => {
  const printRef = useRef();

  const [caption, setCaption] = useState('Bonus Register');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(new Date());

  const [rateMode, setRateMode] = useState('Percentage'); // 'Percentage' | 'Rate'
  const [bonusRate, setBonusRate] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  const [basis, setBasis] = useState('Qty');

  const [dividendEnabled, setDividendEnabled] = useState(false);
  const [dividendPercent, setDividendPercent] = useState('');

  const [partyFilter, setPartyFilter] = useState('All');
  const [centerId, setCenterId] = useState(null);
  const [centers, setCenters] = useState([]);

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(emptyTotals);

  const [registerId, setRegisterId] = useState(null);
  const [posted, setPosted] = useState(false);

  const [activatePost, setActivatePost] = useState(false);
  const [applyDate, setApplyDate] = useState(new Date());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [bankLedgerId, setBankLedgerId] = useState(null);
  const [bankLedgers, setBankLedgers] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  // ── Saved registers grid ────────────────────────────────────────────────
  const [savedList, setSavedList] = useState([]);
  const [savedPage, setSavedPage] = useState(1);
  const [savedTotalPages, setSavedTotalPages] = useState(1);
  const [savedLoading, setSavedLoading] = useState(false);

  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 500 })
      .then((res) => setCenters((res.data || []).map((c) => ({ value: c._id, label: c.centerName }))))
      .catch(() => setCenters([]));

    bonusRegisterAPI.getBankLedgers()
      .then((res) => setBankLedgers((res.data || []).map((l) => ({ value: l._id, label: l.ledgerName }))))
      .catch(() => setBankLedgers([]));
  }, []);

  const loadSaved = async (page = 1) => {
    setSavedLoading(true);
    try {
      const res = await bonusRegisterAPI.getAll({ page, limit: 10 });
      setSavedList(res.data || []);
      setSavedTotalPages(res.totalPages || 1);
      setSavedPage(page);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to load saved registers' });
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => { loadSaved(1); }, []);

  // A % bonus is always a % of the milk Amount — Qty has no currency meaning there.
  useEffect(() => {
    if (rateMode === 'Percentage') setBasis('Amount');
  }, [rateMode]);

  const resetResults = () => {
    setRows([]);
    setTotals(emptyTotals);
    setRegisterId(null);
    setPosted(false);
  };

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      notifications.show({ color: 'orange', title: 'Missing dates', message: 'Please select From Date and To Date' });
      return;
    }
    if (rateMode === 'Rate' && (!bonusRate || Number(bonusRate) < 0)) {
      notifications.show({ color: 'orange', title: 'Missing rate', message: 'Please enter the Bonus Rate/Ltr' });
      return;
    }
    if (rateMode === 'Percentage' && (!bonusPercent || Number(bonusPercent) < 0)) {
      notifications.show({ color: 'orange', title: 'Missing %', message: 'Please enter the Bonus %' });
      return;
    }
    if (dividendEnabled && (!dividendPercent || Number(dividendPercent) < 0)) {
      notifications.show({ color: 'orange', title: 'Missing dividend %', message: 'Please enter the Dividend %' });
      return;
    }

    setGenerating(true);
    try {
      const res = await bonusRegisterAPI.generate({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        rateMode,
        rate: rateMode === 'Rate' ? bonusRate : undefined,
        percent: rateMode === 'Percentage' ? bonusPercent : undefined,
        basis,
        partyFilter,
        centerId: centerId || undefined,
        dividendEnabled,
        dividendPercent: dividendEnabled ? dividendPercent : undefined,
      });
      const data = res.data || {};
      setRows(data.rows || []);
      setTotals({
        totalQty: data.totalQty || 0,
        totalAmount: data.totalAmount || 0,
        totalBonusAmount: data.totalBonusAmount || 0,
        totalDividendAmount: data.totalDividendAmount || 0,
        totalPostAmount: data.totalPostAmount || 0,
      });
      setRegisterId(null);
      setPosted(false);
      if (!data.rows || data.rows.length === 0) {
        notifications.show({ color: 'yellow', title: 'No records', message: 'No milk collections found for the selected filters' });
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to generate register' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      notifications.show({ color: 'orange', title: 'Nothing to save', message: 'Click Generate first' });
      return;
    }
    setSaving(true);
    try {
      const centerName = centerId ? centers.find((c) => c.value === centerId)?.label : undefined;
      const payload = {
        caption, fromDate, toDate,
        rateMode, bonusRate: rateMode === 'Rate' ? Number(bonusRate) : 0,
        bonusPercent: rateMode === 'Percentage' ? Number(bonusPercent) : 0,
        basis,
        dividendEnabled, dividendPercent: dividendEnabled ? Number(dividendPercent) : 0,
        partyFilter, centerId: centerId || undefined, centerName,
        rows, ...totals,
      };
      const res = registerId
        ? await bonusRegisterAPI.update(registerId, payload)
        : await bonusRegisterAPI.create(payload);
      setRegisterId(res.data._id);
      notifications.show({ color: 'green', title: 'Saved', message: `Register ${res.data.registerNumber} saved` });
      loadSaved(savedPage);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to save register' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCaption('Bonus Register');
    setFromDate(dayjs().startOf('month').toDate());
    setToDate(new Date());
    setRateMode('Percentage');
    setBonusRate('');
    setBonusPercent('');
    setBasis('Qty');
    setDividendEnabled(false);
    setDividendPercent('');
    setPartyFilter('All');
    setCenterId(null);
    setActivatePost(false);
    setApplyDate(new Date());
    setPaymentMode('Cash');
    setBankLedgerId(null);
    resetResults();
  };

  const handlePost = async () => {
    if (!registerId) {
      notifications.show({ color: 'orange', title: 'Save first', message: 'Please Save the register before posting to Daybook' });
      return;
    }
    if (paymentMode === 'Bank' && !bankLedgerId) {
      notifications.show({ color: 'orange', title: 'Select Bank Ledger', message: 'Please select a Bank Ledger' });
      return;
    }
    if (!applyDate) {
      notifications.show({ color: 'orange', title: 'Select Apply Date', message: 'Please select the Apply Date' });
      return;
    }
    setPosting(true);
    try {
      const res = await bonusRegisterAPI.postToDaybook(registerId, {
        paymentMode,
        bankLedgerId: paymentMode === 'Bank' ? bankLedgerId : undefined,
        applyDate: dayjs(applyDate).format('YYYY-MM-DD'),
      });
      setPosted(true);
      notifications.show({ color: 'green', title: 'Posted', message: `Posted to Daybook (${paymentMode}) — ₹${fmt(res.data.totalPostAmount)}` });
      loadSaved(savedPage);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to post to Daybook' });
    } finally {
      setPosting(false);
    }
  };

  // Opens a fresh, self-contained window and prints from there (see
  // utils/printReport.js) instead of react-to-print's iframe-cloning
  // approach — react-to-print's own docs warn that printing content styled
  // with `position: absolute` (which this print area used, to keep it
  // off-screen without collapsing to 0×0) "may result in reformatted,
  // rotated, or re-scaled content", which is what caused the blurry output.
  const handlePrint = () => printReport(printRef, { title: 'Bonus Register', orientation: 'portrait' });

  const handleExport = () => {
    if (rows.length === 0) {
      notifications.show({ color: 'orange', title: 'Nothing to export', message: 'Click Generate first' });
      return;
    }
    const data = rows.map((r) => ({
      'Sl.No': r.slNo,
      'Member No': r.memberNo,
      'Farmer Name': r.farmerName,
      'Milk Qty (Ltr)': r.milkQty,
      ...(rateMode === 'Percentage' ? { 'Bonus %': bonusPercent } : { 'Bonus Rate/Ltr': bonusRate }),
      'Bonus Amt': r.bonusAmount,
      ...(dividendEnabled ? { 'Dividend': r.dividendAmount, 'Total Amt': r.totalAmount } : {}),
      ...(paymentMode === 'Bank' ? {
        'Account Number': r.bankAccountNumber,
        'Bank Name': r.bankName,
        'Branch': r.bankBranch,
        'IFSC': r.bankIfsc,
      } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bonus Register');
    XLSX.writeFile(wb, `Bonus_Register_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.xlsx`);
  };

  const handleEdit = async (id) => {
    try {
      const res = await bonusRegisterAPI.getById(id);
      const r = res.data;
      setCaption(r.caption || 'Bonus Register');
      setFromDate(new Date(r.fromDate));
      setToDate(new Date(r.toDate));
      setRateMode(r.rateMode || 'Percentage');
      setBonusRate(r.bonusRate || '');
      setBonusPercent(r.bonusPercent || '');
      setBasis(r.basis || 'Qty');
      setDividendEnabled(!!r.dividendEnabled);
      setDividendPercent(r.dividendPercent || '');
      setPartyFilter(r.partyFilter === 'Center' ? 'All' : (r.partyFilter || 'All'));
      setCenterId(r.centerId || null);
      setRows(r.rows || []);
      setTotals({
        totalQty: r.totalQty || 0,
        totalAmount: r.totalAmount || 0,
        totalBonusAmount: r.totalBonusAmount || 0,
        totalDividendAmount: r.totalDividendAmount || 0,
        totalPostAmount: r.totalPostAmount || 0,
      });
      setRegisterId(r._id);
      setPosted(!!r.posted);
      setPaymentMode(r.paymentMode || 'Cash');
      setBankLedgerId(r.bankLedgerId || null);
      setActivatePost(false);
      notifications.show({ color: 'blue', title: 'Loaded', message: `Register ${r.registerNumber} loaded for editing` });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to load register' });
    }
  };

  const handleDelete = (r) => {
    if (r.posted) {
      notifications.show({ color: 'orange', title: 'Cannot delete', message: 'Cancel the posting before deleting a posted register' });
      return;
    }
    modals.openConfirmModal({
      title: 'Delete Bonus Register',
      children: <Text size="sm">Delete register <b>{r.registerNumber}</b> ({r.caption})? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await bonusRegisterAPI.delete(r._id);
          notifications.show({ color: 'green', title: 'Deleted', message: `Register ${r.registerNumber} deleted` });
          if (registerId === r._id) { handleClose(); }
          loadSaved(savedPage);
        } catch (err) {
          notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to delete register' });
        }
      },
    });
  };

  return (
    <Container fluid>
      <Box mb="lg">
        <Title order={2}>
          <IconGift size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Bonus Register
        </Title>
        <Text c="dimmed" size="sm" mt={4}>
          Generate and post farmer-wise bonus (and optional dividend) amounts for a date range
        </Text>
      </Box>

      <Card withBorder shadow="sm" radius="md" mb="md">
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput label="Caption" value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <DatePickerInput label="From Date" value={fromDate} onChange={setFromDate} valueFormat="DD/MM/YYYY" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <DatePickerInput label="To Date" value={toDate} onChange={setToDate} minDate={fromDate || undefined} valueFormat="DD/MM/YYYY" />
            </Grid.Col>
          </Grid>

          <Grid gutter="md" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Text size="sm" fw={500} mb={4}>Bonus Entered As</Text>
              <SegmentedControl fullWidth data={[{ value: 'Percentage', label: 'Percentage' }, { value: 'Rate', label: 'Rate/Ltr' }]} value={rateMode} onChange={setRateMode} />
            </Grid.Col>
            {rateMode === 'Rate' ? (
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput label="Bonus Rate/Ltr" placeholder="Enter rate" value={bonusRate} onChange={setBonusRate} prefix="₹ " decimalScale={2} min={0} />
              </Grid.Col>
            ) : (
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput label="Bonus %" placeholder="Enter %" value={bonusPercent} onChange={setBonusPercent} suffix=" %" decimalScale={2} min={0} max={100} />
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Text size="sm" fw={500} mb={4}>Calculation Basis</Text>
              <SegmentedControl
                fullWidth
                data={[{ value: 'Qty', label: 'By Qty' }, { value: 'Amount', label: 'By Amount' }]}
                value={basis}
                onChange={setBasis}
                disabled={rateMode === 'Percentage'}
              />
              {rateMode === 'Percentage' && (
                <Text size="xs" c="dimmed" mt={4}>
                  Locked to "By Amount" — a % bonus only has a currency meaning as a % of the milk bill amount, not of litres. Switch to "Rate/Ltr" to bonus by Qty.
                </Text>
              )}
            </Grid.Col>
          </Grid>

          <Grid gutter="md" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Farmer Type"
                data={[
                  { value: 'Member', label: 'Member' },
                  { value: 'All', label: 'All Farmers' },
                  { value: 'NonMember', label: 'Non-Member' },
                ]}
                value={partyFilter}
                onChange={setPartyFilter}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select label="Center" placeholder="All Centers" data={centers} value={centerId} onChange={setCenterId} searchable clearable />
            </Grid.Col>
          </Grid>

          <Grid gutter="md" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Text size="sm" fw={500} mb={4}>Payment Mode</Text>
              <SegmentedControl
                fullWidth
                data={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Bank', label: 'Bank' },
                ]}
                value={paymentMode}
                onChange={setPaymentMode}
              />
            </Grid.Col>
            {paymentMode === 'Bank' && (
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="Bank Ledger"
                  placeholder="Select bank ledger"
                  data={bankLedgers}
                  value={bankLedgerId}
                  onChange={setBankLedgerId}
                  searchable
                />
              </Grid.Col>
            )}
          </Grid>

          <Group align="flex-end" gap="md">
            <Switch
              label="Add Dividend"
              checked={dividendEnabled}
              onChange={(e) => setDividendEnabled(e.currentTarget.checked)}
            />
            {dividendEnabled && (
              <NumberInput
                label="Dividend %"
                placeholder="Enter %"
                value={dividendPercent}
                onChange={setDividendPercent}
                suffix=" %"
                decimalScale={2}
                min={0}
                max={100}
                w={160}
              />
            )}
          </Group>

          <Group>
            <Button leftSection={<IconCalculator size={16} />} onClick={handleGenerate} loading={generating}>
              Generate
            </Button>
            <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={handlePrint} disabled={rows.length === 0}>
              Print
            </Button>
            <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} onClick={handleExport} disabled={rows.length === 0}>
              Export
            </Button>
            <Button color="teal" leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={saving} disabled={rows.length === 0 || posted}>
              Save
            </Button>
            <Button variant="subtle" color="gray" leftSection={<IconX size={16} />} onClick={handleClose}>
              Close
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" mb="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon variant="light" size="md" radius="md" color="grape"><IconSend size={16} /></ThemeIcon>
              <Text fw={600}>Post to Daybook</Text>
              {posted && <Badge color="green">Posted</Badge>}
            </Group>
            <Switch
              label="Activate"
              checked={activatePost}
              onChange={(e) => setActivatePost(e.currentTarget.checked)}
              disabled={posted}
            />
          </Group>

          {activatePost && !posted && (
            <Grid gutter="md" align="flex-end">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  label="Apply Date"
                  description="Ledger entry will be dated as of this date"
                  value={applyDate}
                  onChange={setApplyDate}
                  valueFormat="DD/MM/YYYY"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  color="grape"
                  leftSection={<IconSend size={16} />}
                  onClick={handlePost}
                  loading={posting}
                >
                  Post ₹{fmt(totals.totalPostAmount)}
                </Button>
              </Grid.Col>
            </Grid>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" mb="md">
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sl.No</Table.Th>
              <Table.Th>Member No</Table.Th>
              <Table.Th>Farmer Name</Table.Th>
              <Table.Th ta="right">Milk Qty (Ltr)</Table.Th>
              <Table.Th ta="right">Bonus Amt</Table.Th>
              {dividendEnabled && <Table.Th ta="right">Dividend</Table.Th>}
              {dividendEnabled && <Table.Th ta="right">Total Amt</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={dividendEnabled ? 7 : 5}><Text ta="center" c="dimmed" py="md">No data — click Generate</Text></Table.Td>
              </Table.Tr>
            ) : rows.map((r) => (
              <Table.Tr key={r.farmerId}>
                <Table.Td>{r.slNo}</Table.Td>
                <Table.Td>{r.memberNo}</Table.Td>
                <Table.Td>{r.farmerName}</Table.Td>
                <Table.Td ta="right">{fmt(r.milkQty)}</Table.Td>
                <Table.Td ta="right">{fmt(r.bonusAmount)}</Table.Td>
                {dividendEnabled && <Table.Td ta="right">{fmt(r.dividendAmount)}</Table.Td>}
                {dividendEnabled && <Table.Td ta="right">{fmt(r.totalAmount)}</Table.Td>}
              </Table.Tr>
            ))}
          </Table.Tbody>
          {rows.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={3}>Total</Table.Th>
                <Table.Th ta="right">{fmt(totals.totalQty)}</Table.Th>
                <Table.Th ta="right">{fmt(totals.totalBonusAmount)}</Table.Th>
                {dividendEnabled && <Table.Th ta="right">{fmt(totals.totalDividendAmount)}</Table.Th>}
                {dividendEnabled && <Table.Th ta="right">{fmt(totals.totalPostAmount)}</Table.Th>}
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Card>

      <Card withBorder shadow="sm" radius="md" mb="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Saved Registers</Text>
            {savedLoading && <Loader size="xs" />}
          </Group>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Register No</Table.Th>
                <Table.Th>Caption</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {savedList.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}><Text ta="center" c="dimmed" py="sm">No saved registers yet</Text></Table.Td>
                </Table.Tr>
              ) : savedList.map((r) => (
                <Table.Tr key={r._id}>
                  <Table.Td>{r.registerNumber}</Table.Td>
                  <Table.Td>{r.caption}</Table.Td>
                  <Table.Td>{dayjs(r.fromDate).format('DD/MM/YYYY')}</Table.Td>
                  <Table.Td>{dayjs(r.toDate).format('DD/MM/YYYY')}</Table.Td>
                  <Table.Td ta="right">{fmt(r.totalPostAmount)}</Table.Td>
                  <Table.Td><Badge color={r.posted ? 'green' : 'gray'} variant="light">{r.status}</Badge></Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <Tooltip label="Edit">
                        <ActionIcon variant="light" color="blue" onClick={() => handleEdit(r._id)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={r.posted ? 'Cannot delete a posted register' : 'Delete'}>
                        <ActionIcon variant="light" color="red" disabled={r.posted} onClick={() => handleDelete(r)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {savedTotalPages > 1 && (
            <Group justify="flex-end">
              <Pagination total={savedTotalPages} value={savedPage} onChange={(p) => loadSaved(p)} size="sm" />
            </Group>
          )}
        </Stack>
      </Card>

      {/* ── Print area — Cash or Bank layout, selected by paymentMode.
             Hidden on-screen with display:none; printReport() clones this
             node's markup into a separate print window (see handlePrint). ── */}
      <div ref={printRef} style={{ display: 'none', padding: 16, background: '#fff' }}>
        <h3 style={{ textAlign: 'center', marginBottom: 4 }}>{caption}</h3>
        <p style={{ textAlign: 'center', marginTop: 0, marginBottom: 12 }}>
          {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')} —{' '}
          {rateMode === 'Percentage' ? `Bonus: ${fmt(bonusPercent)}%` : `Bonus Rate: ₹${fmt(bonusRate)}/Ltr`}
          {dividendEnabled ? ` — Dividend: ${fmt(dividendPercent)}%` : ''}
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Sl.No</th>
              <th style={thStyle}>Member No</th>
              <th style={thStyle}>Farmer Name</th>
              {paymentMode === 'Bank' ? (
                <>
                  <th style={thStyle}>Account Number</th>
                  <th style={thStyle}>Bank Name</th>
                  <th style={thStyle}>Branch</th>
                  <th style={thStyle}>IFSC</th>
                  <th style={thStyle}>Milk Qty (Ltr)</th>
                  {dividendEnabled && <th style={thStyle}>Dividend</th>}
                  <th style={thStyle}>Bonus Amt</th>
                  {dividendEnabled && <th style={thStyle}>Total Amt</th>}
                </>
              ) : (
                <>
                  <th style={thStyle}>Milk Qty (Ltr)</th>
                  <th style={thStyle}>Bonus %/Ltr</th>
                  {dividendEnabled && <th style={thStyle}>Dividend</th>}
                  <th style={thStyle}>Bonus Amt</th>
                  {dividendEnabled && <th style={thStyle}>Total Amt</th>}
                  <th style={thStyle}>Signature</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.farmerId}>
                <td style={tdStyle}>{r.slNo}</td>
                <td style={tdStyle}>{r.memberNo}</td>
                <td style={tdStyle}>{r.farmerName}</td>
                {paymentMode === 'Bank' ? (
                  <>
                    <td style={tdStyle}>{r.bankAccountNumber}</td>
                    <td style={tdStyle}>{r.bankName}</td>
                    <td style={tdStyle}>{r.bankBranch}</td>
                    <td style={tdStyle}>{r.bankIfsc}</td>
                    <td style={tdStyle}>{fmt(r.milkQty)}</td>
                    {dividendEnabled && <td style={tdStyle}>{fmt(r.dividendAmount)}</td>}
                    <td style={tdStyle}>{fmt(r.bonusAmount)}</td>
                    {dividendEnabled && <td style={tdStyle}>{fmt(r.totalAmount)}</td>}
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{fmt(r.milkQty)}</td>
                    <td style={tdStyle}>{rateMode === 'Percentage' ? `${fmt(bonusPercent)}%` : fmt(bonusRate)}</td>
                    {dividendEnabled && <td style={tdStyle}>{fmt(r.dividendAmount)}</td>}
                    <td style={tdStyle}>{fmt(r.bonusAmount)}</td>
                    {dividendEnabled && <td style={tdStyle}>{fmt(r.totalAmount)}</td>}
                    <td style={tdStyle}></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={tdStyle} colSpan={paymentMode === 'Bank' ? 8 : 5}><strong>Total</strong></td>
              {dividendEnabled && <td style={tdStyle}><strong>{fmt(totals.totalDividendAmount)}</strong></td>}
              <td style={tdStyle}><strong>{fmt(totals.totalBonusAmount)}</strong></td>
              {dividendEnabled && <td style={tdStyle}><strong>{fmt(totals.totalPostAmount)}</strong></td>}
              {paymentMode !== 'Bank' && <td style={tdStyle}></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </Container>
  );
};

const thStyle = { border: '1px solid #999', padding: '4px 6px', background: '#f1f3f5', textAlign: 'left' };
const tdStyle = { border: '1px solid #999', padding: '4px 6px' };

export default BonusRegister;

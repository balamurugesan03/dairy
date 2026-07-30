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
  Divider,
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
  IconReceipt2,
  IconCalculator,
  IconPrinter,
  IconFileSpreadsheet,
  IconDeviceFloppy,
  IconX,
  IconSend,
  IconCash,
  IconBuildingBank,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { incentiveRegisterAPI, collectionCenterAPI } from '../../services/api';

const fmt = (v) =>
  Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyTotals = { totalQty: 0, totalAmount: 0, totalIncentiveAmount: 0 };

// ── print-only stylesheet — content stays in normal (non display:none) layout
// so react-to-print's cloned document has real dimensions, then @media print
// hides everything else and reveals just the print area. ──────────────────────
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    .ir-print-area, .ir-print-area * { visibility: visible !important; }
    .ir-print-area {
      position: fixed !important; inset: 0 !important; left: 0 !important; top: 0 !important;
      padding: 10mm !important; background: #fff !important;
    }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 8mm; }
  }
`;

const IncentiveRegister = () => {
  const printRef = useRef();

  const [caption, setCaption] = useState('Incentive Register');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(new Date());
  const [rate, setRate] = useState('');
  const [partyFilter, setPartyFilter] = useState('All');
  const [centerId, setCenterId] = useState(null);
  const [centers, setCenters] = useState([]);
  const [basis, setBasis] = useState('Qty');

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

    incentiveRegisterAPI.getBankLedgers()
      .then((res) => setBankLedgers((res.data || []).map((l) => ({ value: l._id, label: l.ledgerName }))))
      .catch(() => setBankLedgers([]));
  }, []);

  const loadSaved = async (page = 1) => {
    setSavedLoading(true);
    try {
      const res = await incentiveRegisterAPI.getAll({ page, limit: 10 });
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
    if (!rate || Number(rate) < 0) {
      notifications.show({ color: 'orange', title: 'Missing rate', message: 'Please enter the Incentive Rate/Ltr' });
      return;
    }

    setGenerating(true);
    try {
      const res = await incentiveRegisterAPI.generate({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        rate,
        partyFilter,
        centerId: centerId || undefined,
        basis,
      });
      const data = res.data || {};
      setRows(data.rows || []);
      setTotals({
        totalQty: data.totalQty || 0,
        totalAmount: data.totalAmount || 0,
        totalIncentiveAmount: data.totalIncentiveAmount || 0,
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
        caption, fromDate, toDate, incentiveRate: Number(rate),
        partyFilter, centerId: centerId || undefined, centerName,
        basis, rows, ...totals,
      };
      const res = registerId
        ? await incentiveRegisterAPI.update(registerId, payload)
        : await incentiveRegisterAPI.create(payload);
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
    setCaption('Incentive Register');
    setFromDate(dayjs().startOf('month').toDate());
    setToDate(new Date());
    setRate('');
    setPartyFilter('All');
    setCenterId(null);
    setBasis('Qty');
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
      const res = await incentiveRegisterAPI.postToDaybook(registerId, {
        paymentMode,
        bankLedgerId: paymentMode === 'Bank' ? bankLedgerId : undefined,
        applyDate: dayjs(applyDate).format('YYYY-MM-DD'),
      });
      setPosted(true);
      notifications.show({ color: 'green', title: 'Posted', message: `Posted to Daybook (${paymentMode}) — ₹${fmt(res.data.totalIncentiveAmount)}` });
      loadSaved(savedPage);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to post to Daybook' });
    } finally {
      setPosting(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Incentive_Register_${dayjs(fromDate).format('YYYYMMDD')}`,
  });

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
      'Incentive Rate/Ltr': rate,
      'Incentive Amt': r.incentiveAmount,
      ...(paymentMode === 'Bank' ? {
        'Account Number': r.bankAccountNumber,
        'Bank Name': r.bankName,
        'Branch': r.bankBranch,
        'IFSC': r.bankIfsc,
      } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Incentive Register');
    XLSX.writeFile(wb, `Incentive_Register_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.xlsx`);
  };

  const handleEdit = async (id) => {
    try {
      const res = await incentiveRegisterAPI.getById(id);
      const r = res.data;
      setCaption(r.caption || 'Incentive Register');
      setFromDate(new Date(r.fromDate));
      setToDate(new Date(r.toDate));
      setRate(r.incentiveRate || '');
      setPartyFilter(r.partyFilter === 'Center' ? 'All' : (r.partyFilter || 'All'));
      setCenterId(r.centerId || null);
      setBasis(r.basis || 'Qty');
      setRows(r.rows || []);
      setTotals({
        totalQty: r.totalQty || 0,
        totalAmount: r.totalAmount || 0,
        totalIncentiveAmount: r.totalIncentiveAmount || 0,
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
      title: 'Delete Incentive Register',
      children: <Text size="sm">Delete register <b>{r.registerNumber}</b> ({r.caption})? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await incentiveRegisterAPI.delete(r._id);
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
      <style>{PRINT_CSS}</style>
      <Box mb="lg">
        <Title order={2}>
          <IconReceipt2 size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Incentive Register
        </Title>
        <Text c="dimmed" size="sm" mt={4}>
          Generate and post farmer-wise milk incentive amounts for a date range
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
              <NumberInput label="Incentive Rate/Ltr" placeholder="Enter rate" value={rate} onChange={setRate} prefix="₹ " decimalScale={2} min={0} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Farmer Type"
                data={[
                  { value: 'All', label: 'All Farmers' },
                  { value: 'Member', label: 'Member' },
                  { value: 'NonMember', label: 'Non-Member' },
                ]}
                value={partyFilter}
                onChange={setPartyFilter}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select label="Center" placeholder="All Centers" data={centers} value={centerId} onChange={setCenterId} searchable clearable />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Text size="sm" fw={500} mb={4}>Calculation Basis</Text>
              <SegmentedControl fullWidth data={[{ value: 'Qty', label: 'By Qty' }, { value: 'Amount', label: 'By Amount' }]} value={basis} onChange={setBasis} />
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
                  Post ₹{fmt(totals.totalIncentiveAmount)}
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
              <Table.Th ta="right">Rate</Table.Th>
              <Table.Th ta="right">Incentive Amt</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">No data — click Generate</Text></Table.Td>
              </Table.Tr>
            ) : rows.map((r) => (
              <Table.Tr key={r.farmerId}>
                <Table.Td>{r.slNo}</Table.Td>
                <Table.Td>{r.memberNo}</Table.Td>
                <Table.Td>{r.farmerName}</Table.Td>
                <Table.Td ta="right">{fmt(r.milkQty)}</Table.Td>
                <Table.Td ta="right">{fmt(rate)}</Table.Td>
                <Table.Td ta="right">{fmt(r.incentiveAmount)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          {rows.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={3}>Total</Table.Th>
                <Table.Th ta="right">{fmt(totals.totalQty)}</Table.Th>
                <Table.Th />
                <Table.Th ta="right">{fmt(totals.totalIncentiveAmount)}</Table.Th>
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
                  <Table.Td ta="right">{fmt(r.totalIncentiveAmount)}</Table.Td>
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
             Kept in normal layout (not display:none) and hidden via
             visibility in PRINT_CSS so react-to-print gets real dimensions. ── */}
      <div ref={printRef} className="ir-print-area" style={{ position: 'absolute', left: -99999, top: 0, padding: 16, background: '#fff' }}>
        <h3 style={{ textAlign: 'center', marginBottom: 4 }}>{caption}</h3>
        <p style={{ textAlign: 'center', marginTop: 0, marginBottom: 12 }}>
          {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')} — Rate: ₹{fmt(rate)}/Ltr
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
                  <th style={thStyle}>Incentive Amt</th>
                </>
              ) : (
                <>
                  <th style={thStyle}>Milk Qty (Ltr)</th>
                  <th style={thStyle}>Incentive Rate/Ltr</th>
                  <th style={thStyle}>Incentive Amt</th>
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
                    <td style={tdStyle}>{fmt(r.incentiveAmount)}</td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{fmt(r.milkQty)}</td>
                    <td style={tdStyle}>{fmt(rate)}</td>
                    <td style={tdStyle}>{fmt(r.incentiveAmount)}</td>
                    <td style={tdStyle}></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={tdStyle} colSpan={paymentMode === 'Bank' ? 8 : 5}><strong>Total</strong></td>
              <td style={tdStyle}><strong>{fmt(totals.totalIncentiveAmount)}</strong></td>
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

export default IncentiveRegister;

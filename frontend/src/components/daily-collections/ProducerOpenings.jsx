import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Group, Title, Button, NumberInput, TextInput,
  Paper, Table, Box, Divider, Grid, Text, Stack, ThemeIcon,
  ActionIcon, Tooltip, Pagination, Badge, Loader,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconDeviceFloppy, IconX, IconDoorExit,
  IconUsers, IconCalendarEvent, IconRefresh, IconTrash, IconEdit,
} from '@tabler/icons-react';
import { farmerAPI, producerOpeningAPI } from '../../services/api';

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const EMPTY_FORM = {
  date:          null,
  farmerId:      null,
  dueAmount:     '',
  cfAdvance:     '',
  loanAdvance:   '',
  cashAdvance:   '',
  revolvingFund: '',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtAmt = (v) =>
  v != null && v !== '' ? `₹ ${Number(v).toFixed(2)}` : '—';

function FieldLabel({ children }) {
  return (
    <Text size="xs" fw={600} c="dimmed" mb={3}>{children}</Text>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────
export default function ProducerOpenings() {
  const navigate = useNavigate();
  const [form, setForm]           = useState({ ...EMPTY_FORM, date: new Date() });
  const [records, setRecords]     = useState([]);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // farmer lookup by number
  const [farmerNumberInput, setFarmerNumberInput] = useState('');
  const [farmerLoading, setFarmerLoading]         = useState(false);
  const [selectedFarmer, setSelectedFarmer]       = useState(null);

  const farmerInputRef  = useRef(null);
  const dueAmountRef    = useRef(null);
  const cfAdvanceRef    = useRef(null);
  const loanAdvanceRef  = useRef(null);
  const cashAdvanceRef  = useRef(null);
  const revolvingRef    = useRef(null);
  const saveButtonRef   = useRef(null);

  const focusRef = (ref) => {
    const el = ref?.current;
    if (!el) return;
    const input = el.tagName === 'INPUT' ? el : el.querySelector('input');
    (input || el).focus();
  };

  const tabTo = (nextRef) => (e) => {
    if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); focusRef(nextRef); }
  };

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  // ── Derived totals ──────────────────────────────────────────────
  const totalRecovery =
    (Number(form.cfAdvance)   || 0) +
    (Number(form.loanAdvance) || 0) +
    (Number(form.cashAdvance) || 0);

  // ── Load records ────────────────────────────────────────────────
  const fetchRecords = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await producerOpeningAPI.getAll({ page: pg, limit: PAGE_SIZE });
      setRecords(res.data || []);
      setTotalPages(res.pagination?.pages || 1);
      setTotalRecords(res.pagination?.total || 0);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to load records' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(page); }, [page, fetchRecords]);

  // ── Farmer lookup on Enter / Tab ────────────────────────────────
  const handleFarmerNumberKeyDown = async (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    const query = farmerNumberInput.trim();
    if (!query) return;

    setFarmerLoading(true);
    try {
      const res   = await farmerAPI.search(query);
      const found = res?.data || [];

      if (found.length === 0) {
        notifications.show({ color: 'orange', title: 'Not Found', message: `Farmer "${query}" not found` });
        setSelectedFarmer(null);
        setField('farmerId', null);
        return;
      }

      // Prefer exact farmerNumber match, fall back to first result
      const farmer = found.find((f) => f.farmerNumber === query) || found[0];
      setFarmerNumberInput(farmer.farmerNumber);
      setSelectedFarmer(farmer);
      setField('farmerId', farmer._id);

      // Auto-load existing opening for this farmer
      try {
        const opening = await producerOpeningAPI.getByFarmer(farmer._id);
        const existing = opening?.data;
        if (existing) {
          setEditId(existing._id);
          setForm({
            date:          existing.date ? new Date(existing.date) : null,
            farmerId:      farmer._id,
            dueAmount:     existing.dueAmount     ?? '',
            cfAdvance:     existing.cfAdvance     ?? '',
            loanAdvance:   existing.loanAdvance   ?? '',
            cashAdvance:   existing.cashAdvance   ?? '',
            revolvingFund: existing.revolvingFund ?? '',
          });
          notifications.show({ color: 'blue', title: 'Opening Loaded', message: 'Existing opening loaded — make changes and click Update', autoClose: 3000 });
        } else {
          setEditId(null);
          setForm((prev) => ({ ...EMPTY_FORM, farmerId: farmer._id, date: prev.date }));
        }
      } catch { /* ignore */ }

      setTimeout(() => focusRef(dueAmountRef), 150);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to search farmer' });
    } finally {
      setFarmerLoading(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    if (!form.date) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Date is required' });
      return false;
    }
    if (!form.farmerId) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Producer is required' });
      return false;
    }
    const amountFields = [form.dueAmount, form.cfAdvance, form.loanAdvance, form.cashAdvance, form.revolvingFund];
    const hasNonZeroAmount = amountFields.some((v) => v !== '' && v != null && Number(v) !== 0);
    if (!hasNonZeroAmount) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Enter at least one amount — all amount fields cannot be 0 or blank' });
      return false;
    }
    return true;
  };

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        farmerId:      form.farmerId,
        date:          form.date,
        dueAmount:     form.dueAmount || 0,
        cfAdvance:     form.cfAdvance || 0,
        loanAdvance:   form.loanAdvance || 0,
        cashAdvance:   form.cashAdvance || 0,
        revolvingFund: form.revolvingFund || 0,
      };

      if (editId) {
        await producerOpeningAPI.update(editId, payload);
        notifications.show({ color: 'green', title: 'Updated', message: 'Producer opening updated' });
      } else {
        await producerOpeningAPI.create(payload);
        notifications.show({ color: 'green', title: 'Saved', message: 'Producer opening saved' });
      }

      // Preserve the selected date — only reset farmer/amounts for next entry
      const savedDate = form.date;
      setForm({ ...EMPTY_FORM, date: savedDate });
      setSelectedFarmer(null);
      setFarmerNumberInput('');
      setEditId(null);
      const goPage = editId ? page : 1;
      setPage(goPage);
      fetchRecords(goPage);
      // Move cursor to Farmer Number field for next record
      setTimeout(() => focusRef(farmerInputRef), 100);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }, [form, editId, page, fetchRecords]);

  // ── Cancel ─────────────────────────────────────────────────────
  const handleCancel = () => {
    const savedDate = form.date;
    setForm({ ...EMPTY_FORM, date: savedDate });
    setSelectedFarmer(null);
    setFarmerNumberInput('');
    setEditId(null);
    setTimeout(() => focusRef(farmerInputRef), 100);
  };

  // ── Close ──────────────────────────────────────────────────────
  const handleClose = () => {
    modals.openConfirmModal({
      title: 'Close Form',
      centered: true,
      children: <Text size="sm">Any unsaved changes will be lost. Continue?</Text>,
      labels: { confirm: 'Close', cancel: 'Stay' },
      confirmProps: { color: 'red' },
      onConfirm: () => { setForm({ ...EMPTY_FORM, date: new Date() }); setSelectedFarmer(null); setFarmerNumberInput(''); setEditId(null); },
    });
  };

  // ── Edit row ───────────────────────────────────────────────────
  const openEdit = (rec) => {
    setEditId(rec._id);
    setForm({
      date:          rec.date ? new Date(rec.date) : null,
      farmerId:      rec.farmerId?._id || rec.farmerId,
      dueAmount:     rec.dueAmount,
      cfAdvance:     rec.cfAdvance,
      loanAdvance:   rec.loanAdvance,
      cashAdvance:   rec.cashAdvance,
      revolvingFund: rec.revolvingFund,
    });
    const farmer = rec.farmerId;
    if (farmer?._id) {
      setSelectedFarmer(farmer);
      setFarmerNumberInput(rec.producerNumber || farmer.farmerNumber || '');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Delete row ─────────────────────────────────────────────────
  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      centered: true,
      children: (
        <Text size="sm">
          Delete opening for <strong>{rec.producerName}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await producerOpeningAPI.delete(rec._id);
          notifications.show({ color: 'orange', title: 'Deleted', message: 'Record removed' });
          fetchRecords(page);
        } catch (err) {
          notifications.show({ color: 'red', title: 'Error', message: err.message || 'Delete failed' });
        }
      },
    });
  };

  // ── Table rows ─────────────────────────────────────────────────
  const rows = records.map((rec, i) => (
    <Table.Tr key={rec._id} bg={editId === rec._id ? '#edf2ff' : undefined}>
      <Table.Td c="dimmed" fz="xs">{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
      <Table.Td fz="sm">{fmtDate(rec.date)}</Table.Td>
      <Table.Td fz="sm" fw={600} c="blue.8">{rec.producerNumber}</Table.Td>
      <Table.Td fz="sm">{rec.producerName}</Table.Td>
      <Table.Td fz="sm" ta="right" c="red.7" fw={500}>{fmtAmt(rec.dueAmount)}</Table.Td>
      <Table.Td fz="sm" ta="right">{fmtAmt(rec.cfAdvance)}</Table.Td>
      <Table.Td fz="sm" ta="right">{fmtAmt(rec.loanAdvance)}</Table.Td>
      <Table.Td fz="sm" ta="right">{fmtAmt(rec.cashAdvance)}</Table.Td>
      <Table.Td fz="sm" ta="right">{fmtAmt(rec.revolvingFund)}</Table.Td>
      <Table.Td fz="sm" ta="right" fw={700} c="blue.7">{fmtAmt(rec.totalRecovery)}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEdit(rec)}>
              <IconEdit size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(rec)}>
              <IconTrash size={13} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Container size="lg" py="md">

      {/* ══════════════════════════════════════════════════════════
           FORM CARD
        ══════════════════════════════════════════════════════════ */}
      <Paper shadow="sm" radius="md" withBorder style={{ overflow: 'hidden' }}>

        {/* Form Header */}
        <Box
          px="lg" py="sm"
          style={{ background: 'linear-gradient(90deg, #1971c2 0%, #1864ab 100%)', borderBottom: '1px solid #1864ab' }}
        >
          <Group gap="sm" align="center">
            <ThemeIcon size={36} radius="md" color="white" variant="white" style={{ color: '#1971c2' }}>
              <IconUsers size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} c="white" lh={1.2}>PRODUCER OPENINGS</Title>
              <Text size="xs" c="blue.1" mt={1}>Backup Details</Text>
            </Box>
            <Badge color={editId ? 'yellow' : 'teal'} variant="filled" size="sm" ml="auto">
              {editId ? 'Editing — Click Update to Save' : 'New Record'}
            </Badge>
            <Button
              size="xs"
              variant="white"
              leftSection={<IconX size={13} />}
              onClick={() => navigate('/')}
              style={{ color: '#1971c2' }}
            >
              Close
            </Button>
          </Group>
        </Box>

        {/* Form Body */}
        <Box p="md" bg="#f5f7fa">
          <Stack gap={10}>

            {/* ROW 1 : Date */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <FieldLabel>Date</FieldLabel>
                  <DatePickerInput
                    placeholder="DD/MM/YYYY"
                    value={form.date}
                    onChange={(val) => setField('date', val)}
                    valueFormat="DD/MM/YYYY"
                    leftSection={<IconCalendarEvent size={14} />}
                    size="sm" radius="sm" clearable
                    styles={{ input: { fontWeight: 500 } }}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* ROW 2 : Producer Number TextInput */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <FieldLabel>Producer Number (press Enter to search)</FieldLabel>
                  <TextInput
                    ref={farmerInputRef}
                    placeholder="Type farmer number and press Enter"
                    value={farmerNumberInput}
                    onChange={(e) => setFarmerNumberInput(e.currentTarget.value)}
                    onKeyDown={handleFarmerNumberKeyDown}
                    rightSection={farmerLoading ? <Loader size={14} /> : null}
                    size="sm" radius="sm"
                  />
                </Grid.Col>

                {/* Show selected farmer info */}
                {selectedFarmer && (
                  <Grid.Col span={{ base: 12, sm: 8 }}>
                    <Paper withBorder radius="xs" p="xs" bg="#f0f4ff">
                      <Group gap="xs">
                        <Box>
                          <Text size="xs" c="dimmed">Farmer No.</Text>
                          <Text size="sm" fw={700} c="blue.8">{selectedFarmer.farmerNumber}</Text>
                        </Box>
                        <Divider orientation="vertical" />
                        <Box>
                          <Text size="xs" c="dimmed">Name</Text>
                          <Text size="sm" fw={600}>{selectedFarmer.personalDetails?.name}</Text>
                        </Box>
                        {selectedFarmer.personalDetails?.phone && (
                          <>
                            <Divider orientation="vertical" />
                            <Box>
                              <Text size="xs" c="dimmed">Phone</Text>
                              <Text size="sm">{selectedFarmer.personalDetails.phone}</Text>
                            </Box>
                          </>
                        )}
                        <Badge
                          color={selectedFarmer.status === 'Active' ? 'green' : 'red'}
                          variant="light" size="xs" ml="auto"
                        >
                          {selectedFarmer.status}
                        </Badge>
                      </Group>
                    </Paper>
                  </Grid.Col>
                )}
              </Grid>
            </Paper>

            {/* ROW 3 : Due Amount */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <FieldLabel>Producers Due Amount</FieldLabel>
                  <NumberInput
                    ref={dueAmountRef}
                    placeholder="0.00"
                    value={form.dueAmount}
                    onChange={(val) => setField('dueAmount', val)}
                    onKeyDown={tabTo(cfAdvanceRef)}
                    decimalScale={2} min={0} hideControls prefix="₹ "
                    size="sm" radius="sm"
                    styles={{ input: { fontWeight: 600, color: '#c92a2a', textAlign: 'right' } }}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* RECOVERY SECTION */}
            <Paper withBorder radius="xs" style={{ borderColor: '#228be6', overflow: 'hidden' }}>
              <Box px="md" py={8} style={{ background: '#e8f0fe', borderBottom: '1px solid #c5d8fd' }}>
                <Text fw={700} size="sm" c="blue.8">Recovery</Text>
              </Box>

              <Box bg="white" px="md" py="sm">
                <Grid gutter="xl">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Stack gap={10}>
                      <Box>
                        <FieldLabel>CF Advance</FieldLabel>
                        <NumberInput
                          ref={cfAdvanceRef}
                          placeholder="0.00" value={form.cfAdvance}
                          onChange={(val) => setField('cfAdvance', val)}
                          onKeyDown={tabTo(cashAdvanceRef)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Loan Advance</FieldLabel>
                        <NumberInput
                          ref={loanAdvanceRef}
                          placeholder="0.00" value={form.loanAdvance}
                          onChange={(val) => setField('loanAdvance', val)}
                          onKeyDown={tabTo(saveButtonRef)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                    </Stack>
                  </Grid.Col>

                  <Grid.Col span="content" style={{ display: 'flex', alignItems: 'stretch' }}>
                    <Divider orientation="vertical" />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <Stack gap={10}>
                      <Box>
                        <FieldLabel>Cash Advance</FieldLabel>
                        <NumberInput
                          ref={cashAdvanceRef}
                          placeholder="0.00" value={form.cashAdvance}
                          onChange={(val) => setField('cashAdvance', val)}
                          onKeyDown={tabTo(loanAdvanceRef)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Revolving Fund</FieldLabel>
                        <NumberInput
                          ref={revolvingRef}
                          placeholder="0.00" value={form.revolvingFund}
                          onChange={(val) => setField('revolvingFund', val)}
                          onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); saveButtonRef.current?.focus(); } }}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm" disabled
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                    </Stack>
                  </Grid.Col>
                </Grid>

                {totalRecovery > 0 && (
                  <Box mt="sm" pt="xs" style={{ borderTop: '1px dashed #dee2e6' }}>
                    <Group justify="flex-end" gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>Total Recovery:</Text>
                      <Text size="sm" fw={700} c="blue.7">₹ {totalRecovery.toFixed(2)}</Text>
                    </Group>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* ACTION BUTTONS */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Group gap="sm">
                <Button
                  ref={saveButtonRef}
                  color="blue" radius="sm" size="sm" loading={saving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSave}
                >
                  {editId ? 'Update' : 'Save'}
                </Button>
                <Button
                  variant="default" radius="sm" size="sm"
                  leftSection={<IconX size={16} />}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="subtle" color="gray" radius="sm" size="sm"
                  leftSection={<IconDoorExit size={16} />}
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Box ml="auto">
                  <Tooltip label="Refresh Grid">
                    <ActionIcon
                      variant="light" color="blue" radius="sm" size="lg"
                      loading={loading}
                      onClick={() => fetchRecords(page)}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
              </Group>
            </Paper>

          </Stack>
        </Box>
      </Paper>

      {/* ══════════════════════════════════════════════════════════
           GRID AREA
        ══════════════════════════════════════════════════════════ */}
      <Paper shadow="sm" radius="md" withBorder mt="md" style={{ overflow: 'hidden' }}>

        <Box px="md" py="sm" style={{ background: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text fw={700} size="sm" c="dark.6">Grid</Text>
              <Badge color="blue" variant="light" size="sm" radius="sm">
                {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
              </Badge>
            </Group>
            {totalPages > 1 && (
              <Text size="xs" c="dimmed">Page {page} of {totalPages}</Text>
            )}
          </Group>
        </Box>

        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
            <Table.Thead>
              <Table.Tr style={{ background: '#f8f9fa' }}>
                <Table.Th w={50} fz="xs">Sl.</Table.Th>
                <Table.Th w={110} fz="xs">Date</Table.Th>
                <Table.Th w={110} fz="xs">Producer ID</Table.Th>
                <Table.Th fz="xs">Producer Name</Table.Th>
                <Table.Th w={120} fz="xs" ta="right">Due Amount</Table.Th>
                <Table.Th w={110} fz="xs" ta="right">CF Advance</Table.Th>
                <Table.Th w={110} fz="xs" ta="right">Loan Advance</Table.Th>
                <Table.Th w={110} fz="xs" ta="right">Cash Advance</Table.Th>
                <Table.Th w={120} fz="xs" ta="right">Revolving Fund</Table.Th>
                <Table.Th w={120} fz="xs" ta="right">Total Recovery</Table.Th>
                <Table.Th w={80} fz="xs">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={11} ta="center" py="xl">
                    <Loader size="sm" />
                  </Table.Td>
                </Table.Tr>
              ) : records.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={11} ta="center" py="xl" c="dimmed">
                    <Stack align="center" gap={4}>
                      <IconUsers size={28} opacity={0.3} />
                      <Text size="sm">No producer opening records yet.</Text>
                      <Text size="xs">Fill the form above and click <strong>Save</strong>.</Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows
              )}
            </Table.Tbody>

            {records.length > 0 && (
              <Table.Tfoot>
                <Table.Tr style={{ background: '#e8f0fe' }}>
                  <Table.Th colSpan={4} fz="xs" fw={700} c="blue.8">Page Total</Table.Th>
                  <Table.Th fz="xs" ta="right" fw={700} c="red.7">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.cfAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.loanAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.cashAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.revolvingFund) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={700} c="blue.7">
                    {fmtAmt(records.reduce((s, r) => s + (Number(r.totalRecovery) || 0), 0))}
                  </Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>

        {totalPages > 1 && (
          <Group justify="center" py="sm" style={{ borderTop: '1px solid #dee2e6' }}>
            <Pagination
              total={totalPages} value={page} onChange={setPage}
              color="blue" radius="md" size="sm"
            />
          </Group>
        )}
      </Paper>

    </Container>
  );
}

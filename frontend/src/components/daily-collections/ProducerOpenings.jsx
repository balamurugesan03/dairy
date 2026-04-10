import { useState, useCallback, useEffect } from 'react';
import {
  Container, Group, Title, Button, NumberInput,
  Paper, Table, Box, Divider, Grid, Text, Stack, ThemeIcon,
  ActionIcon, Tooltip, Pagination, Badge, Select, Loader,
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
  const [form, setForm]           = useState(EMPTY_FORM);
  const [records, setRecords]     = useState([]);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // farmer search
  const [farmers, setFarmers]         = useState([]);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

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

  // ── Farmer search ────────────────────────────────────────────────
  const searchFarmers = async (query) => {
    try {
      setFarmerLoading(true);
      let response;
      if (query && query.trim().length > 0) {
        response = await farmerAPI.search(query.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active', limit: 50 });
      }
      setFarmers(response.data || []);
    } catch {
      setFarmers([]);
    } finally {
      setFarmerLoading(false);
    }
  };

  useEffect(() => { searchFarmers(''); }, []);

  const farmerOptions = farmers.map((f) => ({
    value: f._id,
    label: `${f.farmerNumber} - ${f.personalDetails?.name || ''}`,
  }));

  const handleFarmerSelect = async (val) => {
    const farmer = farmers.find((f) => f._id === val);
    setSelectedFarmer(farmer || null);
    setField('farmerId', val);
    if (!val) { setEditId(null); return; }

    // Auto-fetch existing opening for this farmer and pre-fill the form
    try {
      const res = await producerOpeningAPI.getByFarmer(val);
      const existing = res?.data;
      if (existing) {
        setEditId(existing._id);
        setForm({
          date:          existing.date ? new Date(existing.date) : null,
          farmerId:      val,
          dueAmount:     existing.dueAmount     ?? '',
          cfAdvance:     existing.cfAdvance     ?? '',
          loanAdvance:   existing.loanAdvance   ?? '',
          cashAdvance:   existing.cashAdvance   ?? '',
          revolvingFund: existing.revolvingFund ?? '',
        });
        notifications.show({ color: 'blue', title: 'Opening Loaded', message: 'Existing opening loaded — make changes and click Update', autoClose: 3000 });
      } else {
        // No existing opening — keep form fresh (only farmerId set)
        setEditId(null);
        setForm((prev) => ({ ...EMPTY_FORM, farmerId: val, date: prev.date }));
      }
    } catch { /* ignore — let user fill manually */ }
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

      setForm(EMPTY_FORM);
      setSelectedFarmer(null);
      setEditId(null);
      const goPage = editId ? page : 1;
      setPage(goPage);
      fetchRecords(goPage);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }, [form, editId, page, fetchRecords]);

  // ── Cancel ─────────────────────────────────────────────────────
  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setSelectedFarmer(null);
    setEditId(null);
  };

  // ── Close ──────────────────────────────────────────────────────
  const handleClose = () => {
    modals.openConfirmModal({
      title: 'Close Form',
      centered: true,
      children: <Text size="sm">Any unsaved changes will be lost. Continue?</Text>,
      labels: { confirm: 'Close', cancel: 'Stay' },
      confirmProps: { color: 'red' },
      onConfirm: () => { setForm(EMPTY_FORM); setSelectedFarmer(null); setEditId(null); },
    });
  };

  // ── Edit row ───────────────────────────────────────────────────
  const openEdit = async (rec) => {
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
    // Ensure this farmer is in the dropdown
    const farmer = rec.farmerId;
    if (farmer?._id) {
      setFarmers((prev) => {
        const exists = prev.find((f) => f._id === farmer._id);
        if (!exists) return [farmer, ...prev];
        return prev;
      });
      setSelectedFarmer(farmer);
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

            {/* ROW 2 : Producer Select */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <FieldLabel>Producer (Farmer)</FieldLabel>
                  <Select
                    placeholder="Search by farmer number or name"
                    value={form.farmerId}
                    onChange={handleFarmerSelect}
                    data={farmerOptions}
                    searchable
                    clearable
                    onSearchChange={searchFarmers}
                    rightSection={farmerLoading ? <Loader size={14} /> : undefined}
                    nothingFoundMessage={farmerLoading ? 'Searching...' : 'No farmers found'}
                    size="sm" radius="sm"
                  />
                </Grid.Col>

                {/* Show selected farmer info */}
                {selectedFarmer && (
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                    placeholder="0.00"
                    value={form.dueAmount}
                    onChange={(val) => setField('dueAmount', val)}
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
                          placeholder="0.00" value={form.cfAdvance}
                          onChange={(val) => setField('cfAdvance', val)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Loan Advance</FieldLabel>
                        <NumberInput
                          placeholder="0.00" value={form.loanAdvance}
                          onChange={(val) => setField('loanAdvance', val)}
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
                          placeholder="0.00" value={form.cashAdvance}
                          onChange={(val) => setField('cashAdvance', val)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Revolving Fund</FieldLabel>
                        <NumberInput
                          placeholder="0.00" value={form.revolvingFund}
                          onChange={(val) => setField('revolvingFund', val)}
                          decimalScale={2} min={0} hideControls prefix="₹ "
                          size="sm" radius="sm"
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

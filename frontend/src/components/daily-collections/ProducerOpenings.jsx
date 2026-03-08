import { useState, useCallback } from 'react';
import {
  Container, Group, Title, Button, TextInput, NumberInput,
  Paper, Table, Box, Divider, Grid, Text, Stack, ThemeIcon,
  ActionIcon, Tooltip, Pagination, Badge,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconDeviceFloppy, IconX, IconDoorExit,
  IconUsers, IconCalendarEvent, IconRefresh, IconTrash, IconEdit,
} from '@tabler/icons-react';

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const EMPTY_FORM = {
  date:            null,
  producerId:      '',
  producerName:    '',
  dueAmount:       '',
  cfAdvance:       '',
  loanAdvance:     '',
  cashAdvance:     '',
  revolvingFund:   '',
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '—';

const fmtAmt = (v) =>
  v != null && v !== '' ? `₹ ${Number(v).toFixed(2)}` : '—';

// ─────────────────────────────────────────────────────────────────
//  Compact label helper
// ─────────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <Text size="xs" fw={600} c="dimmed" mb={3}>
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────
export default function ProducerOpenings() {
  const [form, setForm]         = useState(EMPTY_FORM);
  const [records, setRecords]   = useState([]);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [page, setPage]         = useState(1);

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  // ── Derived totals ──────────────────────────────────────────────
  const totalRecovery =
    (Number(form.cfAdvance)     || 0) +
    (Number(form.loanAdvance)   || 0) +
    (Number(form.cashAdvance)   || 0) +
    (Number(form.revolvingFund) || 0);

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    if (!form.date) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Date is required' });
      return false;
    }
    if (!form.producerId.trim()) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Producer ID is required' });
      return false;
    }
    if (!form.producerName.trim()) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Producer Name is required' });
      return false;
    }
    return true;
  };

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const record = {
        ...form,
        totalRecovery,
        _id: editId || Date.now().toString(),
      };

      if (editId) {
        setRecords((prev) => prev.map((r) => (r._id === editId ? record : r)));
        notifications.show({ color: 'green', title: 'Updated', message: 'Producer opening updated successfully' });
      } else {
        setRecords((prev) => [record, ...prev]);
        notifications.show({ color: 'green', title: 'Saved', message: 'Producer opening saved successfully' });
      }

      setForm(EMPTY_FORM);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }, [form, editId, totalRecovery]);

  // ── Cancel ─────────────────────────────────────────────────────
  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  // ── Close (navigate back / clear) ──────────────────────────────
  const handleClose = () => {
    modals.openConfirmModal({
      title:    'Close Form',
      centered: true,
      children: (
        <Text size="sm">Any unsaved changes will be lost. Continue?</Text>
      ),
      labels:       { confirm: 'Close', cancel: 'Stay' },
      confirmProps: { color: 'red' },
      onConfirm:    () => { setForm(EMPTY_FORM); setEditId(null); },
    });
  };

  // ── Edit row ───────────────────────────────────────────────────
  const openEdit = (rec) => {
    setEditId(rec._id);
    setForm({
      date:          rec.date,
      producerId:    rec.producerId,
      producerName:  rec.producerName,
      dueAmount:     rec.dueAmount,
      cfAdvance:     rec.cfAdvance,
      loanAdvance:   rec.loanAdvance,
      cashAdvance:   rec.cashAdvance,
      revolvingFund: rec.revolvingFund,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Delete row ─────────────────────────────────────────────────
  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title:    'Delete Record',
      centered: true,
      children: (
        <Text size="sm">
          Delete opening for <strong>{rec.producerName}</strong>? This cannot be undone.
        </Text>
      ),
      labels:       { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setRecords((prev) => prev.filter((r) => r._id !== rec._id));
        notifications.show({ color: 'orange', title: 'Deleted', message: 'Record removed' });
      },
    });
  };

  // ── Pagination slice ───────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageSlice  = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Table rows ─────────────────────────────────────────────────
  const rows = pageSlice.map((rec, i) => (
    <Table.Tr key={rec._id} bg={editId === rec._id ? '#edf2ff' : undefined}>
      <Table.Td c="dimmed" fz="xs">{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
      <Table.Td fz="sm">{fmtDate(rec.date)}</Table.Td>
      <Table.Td fz="sm" fw={600} c="blue.8">{rec.producerId}</Table.Td>
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

        {/* ── Form Header ── */}
        <Box
          px="lg"
          py="sm"
          style={{
            background:   'linear-gradient(90deg, #1971c2 0%, #1864ab 100%)',
            borderBottom: '1px solid #1864ab',
          }}
        >
          <Group gap="sm" align="center">
            <ThemeIcon size={36} radius="md" color="white" variant="white" style={{ color: '#1971c2' }}>
              <IconUsers size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} c="white" lh={1.2}>
                PRODUCER OPENINGS
              </Title>
              <Text size="xs" c="blue.1" mt={1}>
                Backup Details
              </Text>
            </Box>
            {editId && (
              <Badge color="yellow" variant="filled" size="sm" ml="auto">
                Editing Record
              </Badge>
            )}
          </Group>
        </Box>

        {/* ── Form Body ── */}
        <Box p="md" bg="#f5f7fa">
          <Stack gap={10}>

            {/* ── ROW 1 : Date ── */}
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
                    size="sm"
                    radius="sm"
                    clearable
                    styles={{ input: { fontWeight: 500 } }}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* ── ROW 2 : Producer ID + Producer Name ── */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <FieldLabel>Producer ID</FieldLabel>
                  <TextInput
                    placeholder="e.g. PRD-0001"
                    value={form.producerId}
                    onChange={(e) => setField('producerId', e.currentTarget.value)}
                    size="sm"
                    radius="sm"
                    styles={{ input: { fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 } }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 9 }}>
                  <FieldLabel>Producer Name</FieldLabel>
                  <TextInput
                    placeholder="Enter full producer name"
                    value={form.producerName}
                    onChange={(e) => setField('producerName', e.currentTarget.value)}
                    size="sm"
                    radius="sm"
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* ── ROW 3 : Due Amount ── */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Grid gutter="md" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <FieldLabel>Producers Due Amount</FieldLabel>
                  <NumberInput
                    placeholder="0.00"
                    value={form.dueAmount}
                    onChange={(val) => setField('dueAmount', val)}
                    decimalScale={2}
                    min={0}
                    hideControls
                    prefix="₹ "
                    size="sm"
                    radius="sm"
                    styles={{
                      input: {
                        fontWeight:  600,
                        color:       '#c92a2a',
                        textAlign:   'right',
                      },
                    }}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* ── RECOVERY SECTION ── */}
            <Paper
              withBorder
              radius="xs"
              style={{ borderColor: '#228be6', overflow: 'hidden' }}
            >
              {/* Recovery header */}
              <Box
                px="md"
                py={8}
                style={{
                  background:   '#e8f0fe',
                  borderBottom: '1px solid #c5d8fd',
                }}
              >
                <Text fw={700} size="sm" c="blue.8">
                  Recovery
                </Text>
              </Box>

              {/* Recovery fields */}
              <Box bg="white" px="md" py="sm">
                <Grid gutter="xl">

                  {/* LEFT column */}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Stack gap={10}>
                      <Box>
                        <FieldLabel>CF Advance</FieldLabel>
                        <NumberInput
                          placeholder="0.00"
                          value={form.cfAdvance}
                          onChange={(val) => setField('cfAdvance', val)}
                          decimalScale={2}
                          min={0}
                          hideControls
                          prefix="₹ "
                          size="sm"
                          radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Loan Advance</FieldLabel>
                        <NumberInput
                          placeholder="0.00"
                          value={form.loanAdvance}
                          onChange={(val) => setField('loanAdvance', val)}
                          decimalScale={2}
                          min={0}
                          hideControls
                          prefix="₹ "
                          size="sm"
                          radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                    </Stack>
                  </Grid.Col>

                  {/* Vertical divider */}
                  <Grid.Col span="content" style={{ display: 'flex', alignItems: 'stretch' }}>
                    <Divider orientation="vertical" />
                  </Grid.Col>

                  {/* RIGHT column */}
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <Stack gap={10}>
                      <Box>
                        <FieldLabel>Cash Advance</FieldLabel>
                        <NumberInput
                          placeholder="0.00"
                          value={form.cashAdvance}
                          onChange={(val) => setField('cashAdvance', val)}
                          decimalScale={2}
                          min={0}
                          hideControls
                          prefix="₹ "
                          size="sm"
                          radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                      <Box>
                        <FieldLabel>Revolving Fund</FieldLabel>
                        <NumberInput
                          placeholder="0.00"
                          value={form.revolvingFund}
                          onChange={(val) => setField('revolvingFund', val)}
                          decimalScale={2}
                          min={0}
                          hideControls
                          prefix="₹ "
                          size="sm"
                          radius="sm"
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Box>
                    </Stack>
                  </Grid.Col>
                </Grid>

                {/* Recovery total footer */}
                {totalRecovery > 0 && (
                  <Box
                    mt="sm"
                    pt="xs"
                    style={{ borderTop: '1px dashed #dee2e6' }}
                  >
                    <Group justify="flex-end" gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>Total Recovery:</Text>
                      <Text size="sm" fw={700} c="blue.7">
                        ₹ {totalRecovery.toFixed(2)}
                      </Text>
                    </Group>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* ── ACTION BUTTONS ── */}
            <Paper withBorder radius="xs" bg="white" px="md" py="sm">
              <Group gap="sm">
                <Button
                  color="blue"
                  radius="sm"
                  size="sm"
                  loading={saving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSave}
                >
                  {editId ? 'Update' : 'Save'}
                </Button>
                <Button
                  variant="default"
                  radius="sm"
                  size="sm"
                  leftSection={<IconX size={16} />}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  radius="sm"
                  size="sm"
                  leftSection={<IconDoorExit size={16} />}
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Box ml="auto">
                  <Tooltip label="Refresh Grid">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      radius="sm"
                      size="lg"
                      onClick={() => setPage(1)}
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

        {/* Grid header */}
        <Box
          px="md"
          py="sm"
          style={{
            background:   '#f1f3f5',
            borderBottom: '2px solid #dee2e6',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text fw={700} size="sm" c="dark.6">
                Grid
              </Text>
              <Badge color="blue" variant="light" size="sm" radius="sm">
                {records.length} {records.length === 1 ? 'record' : 'records'}
              </Badge>
            </Group>
            {records.length > 0 && (
              <Text size="xs" c="dimmed">
                Page {page} of {totalPages}
              </Text>
            )}
          </Group>
        </Box>

        {/* Table */}
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
              {records.length === 0 ? (
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

            {/* Totals footer */}
            {records.length > 0 && (
              <Table.Tfoot>
                <Table.Tr style={{ background: '#e8f0fe' }}>
                  <Table.Th colSpan={4} fz="xs" fw={700} c="blue.8">
                    Page Total
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={700} c="red.7">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.cfAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.loanAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.cashAdvance) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={600} c="dark">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.revolvingFund) || 0), 0))}
                  </Table.Th>
                  <Table.Th fz="xs" ta="right" fw={700} c="blue.7">
                    {fmtAmt(pageSlice.reduce((s, r) => s + (Number(r.totalRecovery) || 0), 0))}
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
              total={totalPages}
              value={page}
              onChange={setPage}
              color="blue"
              radius="md"
              size="sm"
            />
          </Group>
        )}
      </Paper>

    </Container>
  );
}

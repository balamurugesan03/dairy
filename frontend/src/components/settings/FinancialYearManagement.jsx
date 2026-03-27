import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  Modal, TextInput, Select, Textarea, Grid, Card, Divider, Tooltip,
  Table, Alert, ThemeIcon, Loader, Center
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconCalendarEvent, IconLock, IconLockOpen, IconEdit, IconTrash,
  IconCheck, IconAlertTriangle, IconPlus, IconRefresh, IconCalendarStats,
  IconSnowflake, IconFlame, IconChevronRight
} from '@tabler/icons-react';
import { financialYearAPI } from '../../services/api';

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, isFrozen }) => {
  if (status === 'Active') return <Badge color="green" variant="filled" radius="sm">Active</Badge>;
  if (status === 'Upcoming') return <Badge color="blue" variant="light" radius="sm">Upcoming</Badge>;
  if (status === 'Closed' && isFrozen) return <Badge color="red" variant="filled" radius="sm" leftSection={<IconLock size={10} />}>Closed & Frozen</Badge>;
  if (status === 'Closed') return <Badge color="orange" variant="light" radius="sm">Closed</Badge>;
  return null;
};

// ── Format date ───────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Default April-to-March financial year name from today ─────────────────────
const defaultFYName = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
};

const emptyForm = {
  name: '',
  startDate: null,
  endDate: null,
  status: 'Upcoming',
  notes: ''
};

export default function FinancialYearManagement() {
  const [years, setYears]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);

  const activeYear   = years.find(y => y.status === 'Active');
  const upcomingYear = years.find(y => y.status === 'Upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await financialYearAPI.getAll();
    if (res?.success) setYears(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Open Add / Edit modal ─────────────────────────────────────────────────
  const openAdd = () => {
    const nextYear = activeYear
      ? (() => {
          const end   = new Date(activeYear.endDate);
          const start = new Date(end);
          start.setDate(start.getDate() + 1);
          const ey    = new Date(start);
          ey.setFullYear(ey.getFullYear() + 1);
          ey.setDate(ey.getDate() - 1);
          const sy = start.getFullYear();
          return { name: `${sy}-${String(sy + 1).slice(2)}`, startDate: start, endDate: ey };
        })()
      : { name: defaultFYName(), startDate: null, endDate: null };

    setForm({ ...emptyForm, ...nextYear });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (yr) => {
    setForm({
      name: yr.name,
      startDate: new Date(yr.startDate),
      endDate: new Date(yr.endDate),
      status: yr.status,
      notes: yr.notes || ''
    });
    setEditId(yr._id);
    setModalOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      notifications.show({ color: 'red', message: 'Name, Start Date and End Date are required.' });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      startDate: form.startDate instanceof Date ? form.startDate.toISOString() : form.startDate,
      endDate:   form.endDate instanceof Date   ? form.endDate.toISOString()   : form.endDate,
    };
    const res = editId
      ? await financialYearAPI.update(editId, payload)
      : await financialYearAPI.create(payload);
    setSaving(false);

    if (res?.success) {
      notifications.show({ color: 'green', message: editId ? 'Financial year updated.' : 'Financial year created.' });
      setModalOpen(false);
      load();
    } else {
      notifications.show({ color: 'red', message: res?.message || 'Failed to save.' });
    }
  };

  // ── Close FY ──────────────────────────────────────────────────────────────
  const handleClose = (yr) => {
    modals.openConfirmModal({
      title: <Text fw={600} size="sm">Close Financial Year</Text>,
      children: (
        <Stack gap="xs">
          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            Closing <strong>{yr.name}</strong> will freeze all transactions in this period.
            No new entries can be made for this year until unfrozen.
          </Alert>
          <Text size="sm">Affected modules: Milk Purchase & Sales, Inventory, Producer Dues, Accounting Vouchers.</Text>
        </Stack>
      ),
      labels: { confirm: 'Yes, Close & Freeze', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await financialYearAPI.close(yr._id);
        if (res?.success) {
          notifications.show({ color: 'red', icon: <IconLock size={16} />, message: res.message });
          load();
        } else {
          notifications.show({ color: 'red', message: res?.message || 'Failed to close.' });
        }
      }
    });
  };

  // ── Toggle Freeze ─────────────────────────────────────────────────────────
  const handleToggleFreeze = (yr) => {
    const action = yr.isFrozen ? 'Unfreeze' : 'Freeze';
    modals.openConfirmModal({
      title: <Text fw={600} size="sm">{action} Financial Year</Text>,
      children: (
        <Text size="sm">
          {yr.isFrozen
            ? `Unfreezing "${yr.name}" will allow editing transactions in this period.`
            : `Freezing "${yr.name}" will block new entries in this period.`}
        </Text>
      ),
      labels: { confirm: action, cancel: 'Cancel' },
      confirmProps: { color: yr.isFrozen ? 'teal' : 'orange' },
      onConfirm: async () => {
        const res = await financialYearAPI.toggleFreeze(yr._id);
        if (res?.success) {
          notifications.show({ color: 'teal', message: res.message });
          load();
        } else {
          notifications.show({ color: 'red', message: res?.message || 'Failed.' });
        }
      }
    });
  };

  // ── Activate ──────────────────────────────────────────────────────────────
  const handleActivate = (yr) => {
    modals.openConfirmModal({
      title: <Text fw={600} size="sm">Activate Financial Year</Text>,
      children: <Text size="sm">Set <strong>{yr.name}</strong> as the Active financial year?</Text>,
      labels: { confirm: 'Activate', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        const res = await financialYearAPI.activate(yr._id);
        if (res?.success) {
          notifications.show({ color: 'green', message: res.message });
          load();
        } else {
          notifications.show({ color: 'red', message: res?.message || 'Failed.' });
        }
      }
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (yr) => {
    modals.openConfirmModal({
      title: <Text fw={600} size="sm">Delete Financial Year</Text>,
      children: <Text size="sm">Delete <strong>{yr.name}</strong>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await financialYearAPI.delete(yr._id);
        if (res?.success) {
          notifications.show({ color: 'teal', message: res.message });
          load();
        } else {
          notifications.show({ color: 'red', message: res?.message || 'Failed.' });
        }
      }
    });
  };

  // ── Summary cards ─────────────────────────────────────────────────────────
  const SummaryCard = ({ label, year, color, icon }) => (
    <Card withBorder p="md" radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${color}-6)` }}>
      <Group gap="sm" mb={6}>
        <ThemeIcon color={color} variant="light" size="lg" radius="md">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed" fw={500} tt="uppercase">{label}</Text>
      </Group>
      {year ? (
        <>
          <Text fw={700} size="xl">{year.name}</Text>
          <Text size="xs" c="dimmed">{fmt(year.startDate)} — {fmt(year.endDate)}</Text>
          <Group mt={6} gap={6}>
            <StatusBadge status={year.status} isFrozen={year.isFrozen} />
            {year.isFrozen && <Badge color="red" variant="dot" size="xs">Frozen</Badge>}
          </Group>
        </>
      ) : (
        <Text c="dimmed" size="sm">None</Text>
      )}
    </Card>
  );

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon color="indigo" variant="light" size="xl" radius="md">
            <IconCalendarEvent size={22} />
          </ThemeIcon>
          <div>
            <Title order={3}>Financial Year Management</Title>
            <Text size="xs" c="dimmed">Manage accounting periods and freeze closed years</Text>
          </div>
        </Group>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={load} title="Refresh">
            <IconRefresh size={18} />
          </ActionIcon>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd} size="sm">
            Add Financial Year
          </Button>
        </Group>
      </Group>

      {/* Summary Cards */}
      <Grid mb="md" gutter="sm">
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <SummaryCard label="Active Financial Year" year={activeYear} color="green" icon={<IconCalendarStats size={18} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <SummaryCard label="Next / Upcoming Year" year={upcomingYear} color="blue" icon={<IconChevronRight size={18} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder p="md" radius="md" style={{ borderLeft: '4px solid var(--mantine-color-gray-4)' }}>
            <Group gap="sm" mb={6}>
              <ThemeIcon color="gray" variant="light" size="lg" radius="md">
                <IconCalendarEvent size={18} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={500} tt="uppercase">Total Years</Text>
            </Group>
            <Text fw={700} size="xl">{years.length}</Text>
            <Text size="xs" c="dimmed">
              {years.filter(y => y.status === 'Closed').length} closed &nbsp;·&nbsp;
              {years.filter(y => y.isFrozen).length} frozen
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Freeze Notice */}
      {activeYear && (
        <Alert color="blue" icon={<IconCalendarStats size={16} />} mb="md" radius="md">
          Current active period: <strong>{activeYear.name}</strong> ({fmt(activeYear.startDate)} — {fmt(activeYear.endDate)}).
          All new transactions will be recorded in this year. Close it when the period ends to freeze accounts.
        </Alert>
      )}

      {/* Financial Years Grid */}
      <Paper withBorder radius="md">
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Text fw={600} size="sm">All Financial Years</Text>
        </Box>

        {loading ? (
          <Center p="xl"><Loader size="sm" /></Center>
        ) : years.length === 0 ? (
          <Center p="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                <IconCalendarEvent size={24} />
              </ThemeIcon>
              <Text c="dimmed" size="sm">No financial years added yet.</Text>
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openAdd}>Add First Year</Button>
            </Stack>
          </Center>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Year</Table.Th>
                  <Table.Th>Start Date</Table.Th>
                  <Table.Th>End Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Closed On</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {years.map(yr => (
                  <Table.Tr key={yr._id} style={yr.status === 'Active' ? { background: 'var(--mantine-color-green-0)' } : {}}>
                    <Table.Td>
                      <Text fw={600} size="sm">{yr.name}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{fmt(yr.startDate)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{fmt(yr.endDate)}</Text></Table.Td>
                    <Table.Td>
                      <StatusBadge status={yr.status} isFrozen={yr.isFrozen} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{yr.closedAt ? fmt(yr.closedAt) : '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={1}>{yr.notes || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {/* Activate button — only for Upcoming */}
                        {yr.status === 'Upcoming' && (
                          <Tooltip label="Activate this year">
                            <ActionIcon
                              color="green"
                              variant="light"
                              size="sm"
                              onClick={() => handleActivate(yr)}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        {/* Close button — only for Active */}
                        {yr.status === 'Active' && (
                          <Tooltip label="Close & Freeze this year">
                            <Button
                              size="xs"
                              color="red"
                              variant="filled"
                              leftSection={<IconLock size={12} />}
                              onClick={() => handleClose(yr)}
                            >
                              Close
                            </Button>
                          </Tooltip>
                        )}

                        {/* Freeze / Unfreeze — only for Closed */}
                        {yr.status === 'Closed' && (
                          <Tooltip label={yr.isFrozen ? 'Unfreeze — allow editing' : 'Freeze — block editing'}>
                            <ActionIcon
                              color={yr.isFrozen ? 'teal' : 'orange'}
                              variant="light"
                              size="sm"
                              onClick={() => handleToggleFreeze(yr)}
                            >
                              {yr.isFrozen ? <IconLockOpen size={14} /> : <IconSnowflake size={14} />}
                            </ActionIcon>
                          </Tooltip>
                        )}

                        {/* Edit — not allowed when closed & frozen */}
                        <Tooltip label={yr.status === 'Closed' && yr.isFrozen ? 'Unfreeze to edit' : 'Edit'}>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            disabled={yr.status === 'Closed' && yr.isFrozen}
                            onClick={() => openEdit(yr)}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>

                        {/* Delete — only Upcoming */}
                        {yr.status === 'Upcoming' && (
                          <Tooltip label="Delete">
                            <ActionIcon color="red" variant="light" size="sm" onClick={() => handleDelete(yr)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Frozen Modules Info */}
      <Paper withBorder radius="md" mt="md" p="md">
        <Group gap="xs" mb="xs">
          <IconLock size={16} color="var(--mantine-color-red-6)" />
          <Text fw={600} size="sm">What gets frozen when a year is closed?</Text>
        </Group>
        <Grid gutter="xs">
          {[
            'Milk Purchase & Sales',
            'Dairy Inventory (Stock In / Out)',
            'Producer Dues & Payments',
            'Accounting Vouchers (Receipt / Payment / Journal)',
            'Farmer Loans & Advances',
            'Bank Transfers',
            'Producer Receipts'
          ].map(m => (
            <Grid.Col key={m} span={{ base: 12, sm: 6, md: 4 }}>
              <Group gap={6}>
                <IconLock size={12} color="var(--mantine-color-red-5)" />
                <Text size="xs" c="dimmed">{m}</Text>
              </Group>
            </Grid.Col>
          ))}
        </Grid>
      </Paper>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Group gap="xs">
            <IconCalendarEvent size={18} />
            <Text fw={600}>{editId ? 'Edit Financial Year' : 'Add Financial Year'}</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Year Name"
            placeholder="e.g. 2025-26"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Start Date"
                placeholder="01 Apr 2025"
                value={form.startDate}
                onChange={d => setForm(f => ({ ...f, startDate: d }))}
                valueFormat="DD MMM YYYY"
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="31 Mar 2026"
                value={form.endDate}
                onChange={d => setForm(f => ({ ...f, endDate: d }))}
                valueFormat="DD MMM YYYY"
                required
              />
            </Grid.Col>
          </Grid>
          <Select
            label="Status"
            data={[
              { value: 'Upcoming', label: 'Upcoming' },
              { value: 'Active',   label: 'Active' },
            ]}
            value={form.status}
            onChange={v => setForm(f => ({ ...f, status: v }))}
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
          <Divider />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} leftSection={<IconCheck size={16} />}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

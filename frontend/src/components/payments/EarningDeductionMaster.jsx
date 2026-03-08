import { useState, useEffect } from 'react';
import {
  Container, Card, Title, Text, Group, Stack, Grid,
  TextInput, Textarea, Select, Checkbox, Button, Divider,
  Badge, Box, Table, ActionIcon, Menu, ScrollArea,
  ThemeIcon, Loader, Center, Pagination, Modal,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconDotsVertical, IconEdit, IconTrash,
  IconCalculator, IconListDetails, IconSearch, IconRefresh,
  IconDeviceFloppy, IconX,
} from '@tabler/icons-react';
import { earningDeductionAPI } from '../../services/api';

const CATEGORIES = [
  { value: 'BONUS_INCENTIVE_HISTORICAL', label: 'BONUS / INCENTIVE (HISTORICAL)' },
  { value: 'DEPOSIT_SCHEME',             label: 'DEPOSIT SCHEME'                 },
  { value: 'HISTORICAL_DEDUCTIONS',      label: 'HISTORICAL DEDUCTIONS'          },
  { value: 'INDIVIDUAL_DEDUCTIONS',      label: 'INDIVIDUAL DEDUCTIONS'          },
  { value: 'INDIVIDUAL_EARNINGS',        label: 'INDIVIDUAL EARNINGS'            },
  { value: 'LOAN_RECOVERY',             label: 'LOAN RECOVERY'                  },
  { value: 'PERIODICAL_DEDUCTIONS',      label: 'PERIODICAL DEDUCTIONS'          },
  { value: 'PERIODICAL_EARNINGS',        label: 'PERIODICAL EARNINGS'            },
];

const LEDGER_GROUPS = [
  { value: 'advance_due_to_society',       label: 'Advance due to Society'       },
  { value: 'share_capital',                label: 'Share Capital'                },
  { value: 'statutory_funds_and_reserves', label: 'Statutory Funds and Reserves' },
  { value: 'advance_due_by_society',       label: 'Advance due by Society'       },
  { value: 'contingencies',               label: 'Contingencies'                },
  { value: 'trade_expenses',               label: 'Trade Expenses'               },
];

const EMPTY = {
  name: '', nameMl: '', shortName: '', category: '',
  ledgerGroup: '', formula: '', active: true,
};

const PAGE_SIZE = 15;

const EarningDeductionMaster = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [errors, setErrors]       = useState({});

  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');

  useEffect(() => { fetchRecords(); }, [page, catFilter]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await earningDeductionAPI.getAll({ page, limit: PAGE_SIZE, search, category: catFilter });
      setRecords(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => { const n = { ...p }; delete n[field]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())      e.name        = 'Required';
    if (!form.shortName.trim()) e.shortName   = 'Required';
    if (!form.category)         e.category    = 'Required';
    if (!form.ledgerGroup)      e.ledgerGroup = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => {
    setForm(EMPTY); setEditId(null); setErrors({}); setModalOpen(true);
  };

  const openEdit = (rec) => {
    setForm({
      name: rec.name, nameMl: rec.nameMl || '', shortName: rec.shortName,
      category: rec.category, ledgerGroup: rec.ledgerGroup,
      formula: rec.formula || '', active: rec.active,
    });
    setEditId(rec._id); setErrors({}); setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(EMPTY); setErrors({}); };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        await earningDeductionAPI.update(editId, form);
        notifications.show({ title: 'Updated', message: `"${form.name}" updated`, color: 'teal' });
      } else {
        await earningDeductionAPI.create(form);
        notifications.show({ title: 'Saved', message: `"${form.name}" added`, color: 'green' });
      }
      closeModal(); fetchRecords();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      children: <Text size="sm">Delete <b>{name}</b>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await earningDeductionAPI.delete(id);
          notifications.show({ title: 'Deleted', message: `"${name}" removed`, color: 'red' });
          fetchRecords();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      },
    });
  };

  const handleToggleStatus = async (rec) => {
    try {
      await earningDeductionAPI.toggleStatus(rec._id);
      notifications.show({ title: 'Updated', message: 'Status changed', color: 'blue' });
      fetchRecords();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const getCategoryLabel = (val) => CATEGORIES.find(c => c.value === val)?.label || val;
  const getLedgerLabel   = (val) => LEDGER_GROUPS.find(g => g.value === val)?.label || val;

  return (
    <Container size="xl" py="xl">

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="blue">
              <IconCalculator size={16} />
            </ThemeIcon>
            <Text fw={600}>{editId ? 'Edit' : 'Add'} Earning / Deduction</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Grid gutter="sm">
            <Grid.Col span={8}>
              <TextInput
                label="Earning / Deduction"
                placeholder="e.g. House Rent Allowance"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                error={errors.name}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Short Name"
                placeholder="e.g. HRA"
                value={form.shortName}
                onChange={e => set('shortName', e.target.value.toUpperCase())}
                error={errors.shortName}
                required
                maxLength={10}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Name (ML)"
                placeholder="Regional language name (optional)"
                value={form.nameMl}
                onChange={e => set('nameMl', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Category"
                placeholder="Select category"
                data={CATEGORIES}
                value={form.category}
                onChange={v => set('category', v || '')}
                error={errors.category}
                required
                searchable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Ledger Group"
                placeholder="Select ledger group"
                data={LEDGER_GROUPS}
                value={form.ledgerGroup}
                onChange={v => set('ledgerGroup', v || '')}
                error={errors.ledgerGroup}
                required
                searchable
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Formula"
                placeholder="e.g. AMMHS * RATE"
                value={form.formula}
                onChange={e => set('formula', e.target.value)}
                minRows={2}
                autosize
                styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Checkbox
                label={<Text fw={600} size="sm">Active</Text>}
                checked={form.active}
                onChange={e => set('active', e.currentTarget.checked)}
                color="green"
              />
            </Grid.Col>
          </Grid>
          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" leftSection={<IconX size={15} />} onClick={closeModal}>
              Cancel
            </Button>
            <Button color="blue" leftSection={<IconDeviceFloppy size={15} />} onClick={handleSave} loading={saving}>
              {editId ? 'Update' : 'Save'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Page Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" color="blue">
            <IconCalculator size={20} />
          </ThemeIcon>
          <div>
            <Title order={4} fw={600}>Earnings / Deductions Master</Title>
            <Text size="xs" c="dimmed">Payroll earning and deduction configuration</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add New
        </Button>
      </Group>

      {/* Table Card */}
      <Card withBorder shadow="sm" radius="md" p={0}>
        <Group px="lg" py="sm" justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="blue" variant="light">
              <IconListDetails size={16} />
            </ThemeIcon>
            <Text fw={600} size="sm">Earning / Deduction List</Text>
            <Badge color="blue" variant="light">{total} records</Badge>
          </Group>
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Search..."
              value={search}
              leftSection={<IconSearch size={14} />}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchRecords())}
              style={{ width: 180 }}
            />
            <Select
              size="xs"
              placeholder="All Categories"
              data={CATEGORIES}
              value={catFilter}
              onChange={v => { setCatFilter(v || ''); setPage(1); }}
              clearable
              style={{ width: 210 }}
            />
            <ActionIcon variant="light" onClick={() => { setPage(1); fetchRecords(); }} size="md">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Divider />

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="sm" /></Center>
          ) : records.length === 0 ? (
            <Center py="xl"><Text c="dimmed" size="sm">No records found</Text></Center>
          ) : (
            <Table striped highlightOnHover withColumnBorders style={{ fontSize: 13 }}>
              <Table.Thead bg="gray.0">
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Short</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Ledger Group</Table.Th>
                  <Table.Th>Formula</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th ta="center" w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((r, i) => (
                  <Table.Tr key={r._id}>
                    <Table.Td>{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
                    <Table.Td fw={500}>
                      {r.name}
                      {r.nameMl && <Text span size="xs" c="dimmed"> ({r.nameMl})</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="outline" color="gray">{r.shortName}</Badge>
                    </Table.Td>
                    <Table.Td><Text size="xs">{getCategoryLabel(r.category)}</Text></Table.Td>
                    <Table.Td><Text size="xs">{getLedgerLabel(r.ledgerGroup)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="violet">{r.formula || '—'}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        size="sm"
                        color={r.active ? 'green' : 'gray'}
                        variant="light"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleStatus(r)}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="sm">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => openEdit(r)}>
                            Edit
                          </Menu.Item>
                          <Divider />
                          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => handleDelete(r._id, r.name)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>

        {total > PAGE_SIZE && (
          <Group justify="center" py="sm">
            <Pagination total={Math.ceil(total / PAGE_SIZE)} value={page} onChange={setPage} size="sm" />
          </Group>
        )}
      </Card>
    </Container>
  );
};

export default EarningDeductionMaster;

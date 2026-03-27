import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Title, Text, Group, Stack, Grid,
  TextInput, Textarea, Select, NumberInput, Button, Divider,
  Badge, Box, Table, ActionIcon, Menu, ScrollArea,
  ThemeIcon, Loader, Center, Pagination,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconUser, IconUsers, IconDeviceFloppy, IconX,
  IconPlus, IconDotsVertical, IconEdit, IconTrash,
  IconSearch, IconRefresh, IconCalendar, IconCheck,
} from '@tabler/icons-react';
import { individualTransactionAPI, earningDeductionAPI } from '../../services/api';

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  producerCode:       '',
  producerName:       '',
  earningDeductionId: '',
  amount:             '',
  description:        '',
};

const IndividualDeductionEarning = () => {
  const [activeTab, setActiveTab]     = useState('DEDUCTION');
  const [date, setDate]               = useState(new Date());
  const [form, setForm]               = useState(EMPTY_FORM);
  const [errors, setErrors]           = useState({});
  const [saving, setSaving]           = useState(false);
  const [editId, setEditId]           = useState(null);

  // Lookup state
  const [lookingUp, setLookingUp]     = useState(false);

  // EarningDeduction items for dropdown
  const [earningItems, setEarningItems]     = useState([]);
  const [deductionItems, setDeductionItems] = useState([]);

  // Table state
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [searchDate, setSearchDate] = useState(new Date());

  const producerInputRef = useRef(null);

  useEffect(() => {
    loadDropdownItems();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [page, activeTab, searchDate]);

  const loadDropdownItems = async () => {
    try {
      const res = await earningDeductionAPI.getActive();
      const all = res.data || [];
      setEarningItems(
        all
          .filter(i => ['INDIVIDUAL_EARNINGS', 'PERIODICAL_EARNINGS', 'BONUS_INCENTIVE_HISTORICAL'].includes(i.category))
          .map(i => ({ value: String(i._id), label: i.name || '(Unnamed)' }))
      );
      setDeductionItems(
        all
          .filter(i => ['INDIVIDUAL_DEDUCTIONS', 'PERIODICAL_DEDUCTIONS', 'HISTORICAL_DEDUCTIONS', 'LOAN_RECOVERY', 'DEPOSIT_SCHEME'].includes(i.category))
          .map(i => ({ value: String(i._id), label: i.name || '(Unnamed)' }))
      );
    } catch {/* silent */}
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await individualTransactionAPI.getAll({
        page,
        limit: PAGE_SIZE,
        type:  activeTab,
        date:  searchDate?.toISOString(),
      });
      setRecords(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => { const n = { ...p }; delete n[field]; return n; });
  };

  // Lookup producer on Enter / blur
  const handleProducerLookup = async () => {
    if (!form.producerCode.trim()) return;
    setLookingUp(true);
    try {
      const res = await individualTransactionAPI.lookupProducer(form.producerCode.trim());
      if (res.success) {
        setForm(p => ({ ...p, producerName: res.data.name }));
        setErrors(p => { const n = { ...p }; delete n.producerCode; return n; });
      }
    } catch {
      setForm(p => ({ ...p, producerName: '' }));
      setErrors(p => ({ ...p, producerCode: 'Producer not found' }));
    } finally {
      setLookingUp(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.producerCode.trim())   e.producerCode       = 'Required';
    if (!form.earningDeductionId)    e.earningDeductionId = 'Required';
    if (!form.amount || form.amount <= 0) e.amount        = 'Enter valid amount';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        date:               date,
        type:               activeTab,
        producerCode:       form.producerCode,
        earningDeductionId: form.earningDeductionId,
        amount:             form.amount,
        description:        form.description,
      };

      if (editId) {
        await individualTransactionAPI.update(editId, payload);
        notifications.show({ title: 'Updated', message: 'Record updated', color: 'teal' });
      } else {
        await individualTransactionAPI.create(payload);
        notifications.show({ title: 'Saved', message: 'Record saved', color: 'green' });
      }
      handleCancel();
      fetchRecords();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setDate(new Date(rec.date));
    setActiveTab(rec.type);
    setForm({
      producerCode:       rec.producerCode || '',
      producerName:       rec.producerName || '',
      earningDeductionId: rec.earningDeductionId || '',
      amount:             rec.amount,
      description:        rec.description || '',
    });
    setEditId(rec._id);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      children: <Text size="sm">Delete this record? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await individualTransactionAPI.delete(id);
          notifications.show({ title: 'Deleted', message: 'Record removed', color: 'red' });
          fetchRecords();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      },
    });
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setErrors({});
  };

  const dropdownItems = activeTab === 'EARNING' ? earningItems : deductionItems;
  const tabColor      = activeTab === 'EARNING' ? 'teal' : 'red';

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Container size="lg" py="xl">

      {/* ── Entry Card ──────────────────────────────────────────── */}
      <Card withBorder shadow="md" radius="md" p={0} mb="xl">

        {/* Card Header */}
        <Box
          px="xl" py="md"
          style={{
            background:   'linear-gradient(135deg, #1c7ed6 0%, #1971c2 100%)',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Title order={4} c="white" fw={700}>Individual Deductions / Earnings</Title>
          <Text size="xs" c="rgba(255,255,255,0.75)">Enter producer-wise deduction or earning entries</Text>
        </Box>

        <Stack px="xl" py="md" gap="md">

          {/* Date + OK / Cancel row */}
          <Group align="flex-end" gap="sm">
            <DateInput
              label="Date"
              placeholder="dd/mm/yyyy"
              value={date}
              onChange={setDate}
              valueFormat="DD/MM/YYYY"
              leftSection={<IconCalendar size={16} />}
              style={{ width: 180 }}
              required
            />
            <Button
              color="blue"
              leftSection={<IconCheck size={15} />}
              onClick={() => { setSearchDate(date); setPage(1); }}
            >
              OK
            </Button>
            <Button variant="default" leftSection={<IconX size={15} />} onClick={handleCancel}>
              Cancel
            </Button>
          </Group>

          <Divider />

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <Group gap="xs">
            {[
              { key: 'DEDUCTION', label: 'Deductions', icon: <IconUser size={16} />,  color: 'red'  },
              { key: 'EARNING',   label: 'Earnings',   icon: <IconUsers size={16} />, color: 'teal' },
            ].map(tab => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'filled' : 'light'}
                color={tab.color}
                leftSection={tab.icon}
                onClick={() => { setActiveTab(tab.key); handleCancel(); }}
                radius="md"
                style={{
                  border: activeTab === tab.key ? `2px solid var(--mantine-color-${tab.color}-6)` : '2px solid transparent',
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Group>

          {/* ── Form ─────────────────────────────────────────────── */}
          <Grid gutter="sm">
            {/* Producer ID */}
            <Grid.Col span={6}>
              <TextInput
                ref={producerInputRef}
                label="Member ID"
                placeholder="Enter member ID"
                value={form.producerCode}
                onChange={e => set('producerCode', e.target.value)}
                onBlur={handleProducerLookup}
                onKeyDown={e => e.key === 'Enter' && handleProducerLookup()}
                error={errors.producerCode}
                rightSection={lookingUp ? <Loader size={14} /> : null}
                required
              />
            </Grid.Col>

            {/* Producer Name (auto-filled) */}
            <Grid.Col span={6}>
              <TextInput
                label="Producer Name"
                value={form.producerName}
                readOnly
                styles={{ input: { backgroundColor: 'var(--mantine-color-gray-0)', color: 'var(--mantine-color-gray-7)' } }}
              />
            </Grid.Col>

            {/* Earning / Deduction Item */}
            <Grid.Col span={12}>
              <Select
                label={activeTab === 'EARNING' ? 'Earning Item' : 'Deduction Item'}
                placeholder={activeTab === 'EARNING' ? 'Select earning item' : 'Select deduction item'}
                data={dropdownItems}
                value={form.earningDeductionId}
                onChange={v => set('earningDeductionId', v || '')}
                error={errors.earningDeductionId}
                searchable
                required
              />
            </Grid.Col>

            {/* Amount */}
            <Grid.Col span={6}>
              <NumberInput
                label="Amount"
                placeholder="0.00"
                value={form.amount}
                onChange={v => set('amount', v)}
                error={errors.amount}
                min={0}
                decimalScale={2}
                prefix="₹"
                required
              />
            </Grid.Col>

            {/* Description */}
            <Grid.Col span={12}>
              <Textarea
                label="Description"
                placeholder="Optional remarks..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                minRows={2}
                autosize
              />
            </Grid.Col>
          </Grid>

          {/* Action Buttons */}
          <Group gap="sm">
            <Button
              color={tabColor}
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              {editId ? 'Update' : 'Save'}
            </Button>
            {editId && (
              <Button variant="default" leftSection={<IconX size={15} />} onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </Group>

        </Stack>
      </Card>

      {/* ── Records Table ───────────────────────────────────────── */}
      <Card withBorder shadow="sm" radius="md" p={0}>
        <Group px="lg" py="sm" justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color={tabColor} variant="light">
              {activeTab === 'EARNING' ? <IconUsers size={16} /> : <IconUser size={16} />}
            </ThemeIcon>
            <Text fw={600} size="sm">
              {activeTab === 'EARNING' ? 'Earnings' : 'Deductions'} List
            </Text>
            <Badge color={tabColor} variant="light">{total} records</Badge>
          </Group>
          <Group gap="xs">
            <DateInput
              value={searchDate}
              onChange={v => { setSearchDate(v); setPage(1); }}
              valueFormat="DD/MM/YYYY"
              placeholder="Filter by date"
              size="xs"
              clearable
              style={{ width: 140 }}
            />
            <ActionIcon variant="light" color={tabColor} onClick={() => { setPage(1); fetchRecords(); }} size="md">
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
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Producer ID</Table.Th>
                  <Table.Th>Producer Name</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Amount (₹)</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th ta="center" w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((r, i) => (
                  <Table.Tr key={r._id}>
                    <Table.Td>{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
                    <Table.Td>{formatDate(r.date)}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="outline" color="gray">{r.producerCode || '—'}</Badge>
                    </Table.Td>
                    <Table.Td fw={500}>{r.producerName || '—'}</Table.Td>
                    <Table.Td><Text size="xs">{r.itemName || '—'}</Text></Table.Td>
                    <Table.Td ta="right" fw={600} c={activeTab === 'EARNING' ? 'teal' : 'red'}>
                      {Number(r.amount).toFixed(2)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={1}>{r.description || '—'}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="sm">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleEdit(r)}>
                            Edit
                          </Menu.Item>
                          <Divider />
                          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => handleDelete(r._id)}>
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

export default IndividualDeductionEarning;

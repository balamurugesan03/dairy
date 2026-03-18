import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Group,
  Title,
  Button,
  TextInput,
  Select,
  Modal,
  Stack,
  Text,
  Badge,
  NumberInput,
  ActionIcon,
  Pagination,
  Paper,
  Table,
  Tooltip,
  Box,
  Divider,
  Grid,
  ThemeIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconSearch,
  IconRefresh,
  IconCurrencyRupee,
  IconCalendarEvent,
  IconUser,
  IconHistory,
} from '@tabler/icons-react';
import { milkSalesRateAPI, customerAPI } from '../../services/api';

// ────────────────────────────────────────────────────────────────
//  Constants
// ────────────────────────────────────────────────────────────────
const SALES_ITEMS = [ 'Local Sales', 'Sample Sales', 'Credit Sales'];

// Category is auto-derived from salesItem selection
const CATEGORY_MAP = {
  // 'Customer Sale': 'School',
  'Local Sales':   'Local Sales',
  'Sample Sales':  'Sample Sales',
  'Credit Sales':  'Credit Sales',
};

const PAGE_SIZE = 15;

// ────────────────────────────────────────────────────────────────
//  Main Component
// ────────────────────────────────────────────────────────────────
export default function MilkSalesRateList() {
  // ── List state ──────────────────────────────────────────────
  const [rates, setRates] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterSalesItem, setFilterSalesItem] = useState('');
  const [filterPartyType, setFilterPartyType] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // ── Party data ───────────────────────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [partiesLoading, setPartiesLoading] = useState(false);

  // ── Modal state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Form ─────────────────────────────────────────────────────
  const form = useForm({
    initialValues: {
      partyType: 'Customer',
      partyId: '',
      partyName: '',
      salesItem: '',
      category: '',
      wefDate: null,
      rate: '',
    },
    validate: {
      partyId: (v, values) => (['Local Sales', 'Sample Sales'].includes(values.salesItem) ? null : (!v ? 'Please select a customer or agent' : null)),
      salesItem: (v) => (!v ? 'Please select a sales item' : null),
      category: (v) => (!v ? 'Category is required' : null),
      wefDate: (v) => (!v ? 'Date W.E.F is required' : null),
      rate: (v) =>
        v === '' || v === null || v === undefined || Number(v) < 0
          ? 'Enter a valid rate (≥ 0)'
          : null,
    },
  });

  // ── Fetch party lists ────────────────────────────────────────
  useEffect(() => {
    setPartiesLoading(true);
    customerAPI.getAll({ limit: 1000 })
      .then((res) => setCustomers(res.data || []))
      .catch(() => setCustomers([]))
      .finally(() => setPartiesLoading(false));
  }, []);

  // ── Fetch rate list ──────────────────────────────────────────
  const fetchRates = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (filterSalesItem) params.salesItem = filterSalesItem;
      if (filterPartyType) params.partyType = filterPartyType;

      const res = await milkSalesRateAPI.getAll(params);
      setRates(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Error', message: e.message || 'Failed to load rates' });
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterSalesItem, filterPartyType]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  // ── Build select options ──────────────────────────────────────
  const partySelectData = customers.map((c) => ({ value: c._id, label: c.name }));

  // ── Open Add Modal ────────────────────────────────────────────
  const openAdd = () => {
    setEditRecord(null);
    form.reset();
    setModalOpen(true);
  };

  // ── Open Edit Modal ───────────────────────────────────────────
  const openEdit = (rec) => {
    setEditRecord(rec);
    form.setValues({
      partyType: rec.partyType,
      partyId: rec.partyId,
      partyName: rec.partyName,
      salesItem: rec.salesItem,
      category: rec.category,
      wefDate: rec.wefDate ? new Date(rec.wefDate) : null,
      rate: rec.rate,
    });
    setModalOpen(true);
  };

  // ── Handle party selection ────────────────────────────────────
  const handlePartyChange = (val) => {
    if (!val) return;
    const customer = customers.find((c) => c._id === val);
    if (customer) {
      form.setValues({ ...form.values, partyId: val, partyName: customer.name, partyType: 'Customer' });
    }
  };

  // ── Handle sales item selection (auto-fill category) ──────────
  const handleSalesItemChange = (val) => {
    const isNoParty = ['Local Sales', 'Sample Sales'].includes(val);
    form.setValues({
      ...form.values,
      salesItem: val,
      category: CATEGORY_MAP[val] || '',
      partyId: isNoParty ? '' : form.values.partyId,
      partyName: isNoParty ? '' : form.values.partyName,
    });
  };

  // ── Save (create or update) ───────────────────────────────────
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        partyType: values.partyType,
        partyId: values.partyId,
        partyName: values.partyName,
        salesItem: values.salesItem,
        category: values.category,
        // Normalize to IST noon (06:30 UTC) so timezone never shifts the date
        wefDate: (() => {
          const d = values.wefDate instanceof Date ? values.wefDate : new Date(values.wefDate);
          const ist = new Date(d.getTime() + 5.5 * 60 * 60000); // shift to IST
          return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 30, 0, 0)).toISOString(); // noon IST = 06:30 UTC
        })(),
        rate: Number(values.rate),
      };

      if (editRecord) {
        await milkSalesRateAPI.update(editRecord._id, payload);
        notifications.show({ color: 'green', title: 'Updated', message: 'Rate updated successfully' });
      } else {
        await milkSalesRateAPI.create(payload);
        notifications.show({ color: 'green', title: 'Saved', message: 'New rate added successfully' });
      }

      setModalOpen(false);
      setPage(1);
      fetchRates();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Save Failed',
        message: e.message || 'Could not save rate',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const isActiveRate = (wefDate) => new Date(wefDate) <= new Date();

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  // ── Table rows ────────────────────────────────────────────────
  const rows = rates.map((rec, i) => (
    <Table.Tr key={rec._id}>
      <Table.Td c="dimmed" fz="sm">
        {(page - 1) * PAGE_SIZE + i + 1}
      </Table.Td>

      <Table.Td fw={600}>{rec.partyName}</Table.Td>

      <Table.Td>{rec.salesItem}</Table.Td>

      <Table.Td>
        <Badge
          color={
            rec.category === 'School' ? 'blue'
            : rec.category === 'Sample Sales' ? 'grape'
            : rec.category === 'Credit Sales' ? 'orange'
            : 'teal'
          }
          variant="light"
          size="sm"
        >
          {rec.category}
        </Badge>
      </Table.Td>

      <Table.Td fw={700} c="green">
        ₹{Number(rec.rate).toFixed(2)}
      </Table.Td>

      <Table.Td>{formatDate(rec.wefDate)}</Table.Td>

      <Table.Td>
        <Badge
          color={rec.partyType === 'Customer' ? 'violet' : 'orange'}
          variant="dot"
          size="sm"
        >
          {rec.partyType}
        </Badge>
      </Table.Td>

      <Table.Td>
        {isActiveRate(rec.wefDate) ? (
          <Badge color="green" variant="light" size="xs">
            Active
          </Badge>
        ) : (
          <Badge color="gray" variant="light" size="xs">
            Upcoming
          </Badge>
        )}
      </Table.Td>

      <Table.Td>
        <Tooltip label="Edit Rate">
          <ActionIcon
            variant="light"
            color="blue"
            size="sm"
            onClick={() => openEdit(rec)}
          >
            <IconEdit size={15} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ));

  // ── Render ────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Paper shadow="sm" radius="md" p="lg" withBorder>
        {/* ── Page Header ── */}
        <Group justify="space-between" mb="md" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="teal" variant="light">
              <IconCurrencyRupee size={22} />
            </ThemeIcon>
            <Box>
              <Title order={3} lh={1}>Milk Sales Rate</Title>
              <Text size="xs" c="dimmed">
                Manage customer milk sales rates (W.E.F based)
              </Text>
            </Box>
          </Group>

          <Group gap="sm">
            <Text size="sm" c="dimmed" fw={500}>
              {total} {total === 1 ? 'entry' : 'entries'}
            </Text>
            <Button
              leftSection={<IconPlus size={16} />}
              color="teal"
              radius="md"
              onClick={openAdd}
            >
              Add Rate
            </Button>
          </Group>
        </Group>

        <Divider mb="md" />

        {/* ── Filters ── */}
        <Grid mb="md" gutter="sm">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              placeholder="All Sales Items"
              data={['', ...SALES_ITEMS].map((v) => ({ value: v, label: v || 'All Sales Items' }))}
              value={filterSalesItem}
              onChange={(v) => { setFilterSalesItem(v || ''); setPage(1); }}
              radius="md"
              clearable
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 7 }}>
            <TextInput
              placeholder="Search by customer name..."
              leftSection={<IconSearch size={15} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              radius="md"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 1 }}>
            <Tooltip label="Refresh">
              <ActionIcon
                variant="light"
                color="teal"
                size="lg"
                onClick={fetchRates}
                loading={listLoading}
                radius="md"
                style={{ width: '100%', height: 36 }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Grid.Col>
        </Grid>

        {/* ── Table ── */}
        <Box style={{ overflowX: 'auto' }}>
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            fz="sm"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={55}>Sl.No</Table.Th>
                <Table.Th>Customer Name</Table.Th>
                <Table.Th>Sales Item</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Rate (₹)</Table.Th>
                <Table.Th>Date W.E.F</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={70}>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {listLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">
                    Loading...
                  </Table.Td>
                </Table.Tr>
              ) : rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">
                    No rate records found.{' '}
                    <Text span c="teal" style={{ cursor: 'pointer' }} onClick={openAdd}>
                      Add the first one.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <Group justify="center" mt="lg">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              color="teal"
              radius="md"
              size="sm"
            />
          </Group>
        )}
      </Paper>

      {/* ══════════════════════════════════════════════════════════
           ADD / EDIT MODAL
         ══════════════════════════════════════════════════════════ */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size={28} radius="md" color="teal" variant="light">
              {editRecord ? <IconEdit size={16} /> : <IconPlus size={16} />}
            </ThemeIcon>
            <Text fw={700} size="md">
              {editRecord ? 'Edit Milk Sales Rate' : 'Add Milk Sales Rate'}
            </Text>
          </Group>
        }
        size="md"
        centered
        radius="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Sales Item — first */}
            <Select
              label="Sales Item"
              placeholder="Select sales item"
              data={SALES_ITEMS}
              value={form.values.salesItem || null}
              onChange={handleSalesItemChange}
              required
              error={form.errors.salesItem}
              radius="md"
            />

            {/* Customer Select */}
            <Select
              label="Customer"
              placeholder={partiesLoading ? 'Loading customers...' : 'Search and select...'}
              description={['Local Sales', 'Sample Sales'].includes(form.values.salesItem) ? 'Not applicable for Local / Sample Sales' : undefined}
              data={partySelectData}
              value={form.values.partyId || null}
              onChange={handlePartyChange}
              searchable
              clearable
              required
              disabled={partiesLoading || ['Local Sales', 'Sample Sales'].includes(form.values.salesItem)}
              leftSection={<IconUser size={15} />}
              error={form.errors.partyId}
              radius="md"
              nothingFoundMessage="No customers found"
              maxDropdownHeight={260}
            />

            {/* Category (read-only, auto-filled) */}
            <TextInput
              label="Category"
              description="Auto-filled from Sales Item selection"
              value={form.values.category}
              readOnly
              radius="md"
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  cursor: 'not-allowed',
                  fontWeight: 600,
                  color:
                    form.values.category === 'School'
                      ? 'var(--mantine-color-blue-7)'
                      : form.values.category === 'Sample Sales'
                      ? 'var(--mantine-color-grape-7)'
                      : form.values.category === 'Credit Sales'
                      ? 'var(--mantine-color-orange-7)'
                      : 'var(--mantine-color-teal-7)',
                },
              }}
              rightSection={
                form.values.category ? (
                  <Badge
                    color={
                      form.values.category === 'School' ? 'blue'
                      : form.values.category === 'Sample Sales' ? 'grape'
                      : form.values.category === 'Credit Sales' ? 'orange'
                      : 'teal'
                    }
                    size="xs"
                    variant="light"
                    mr={4}
                  >
                    {form.values.category}
                  </Badge>
                ) : null
              }
            />

            {/* Date W.E.F */}
            <DatePickerInput
              label="Date W.E.F (With Effect From)"
              placeholder="DD/MM/YYYY"
              value={form.values.wefDate}
              onChange={(v) => form.setFieldValue('wefDate', v)}
              required
              error={form.errors.wefDate}
              leftSection={<IconCalendarEvent size={15} />}
              valueFormat="DD/MM/YYYY"
              radius="md"
              clearable
            />

            {/* Rate */}
            <NumberInput
              label="Rate (₹ per litre)"
              placeholder="Enter rate e.g. 42.50"
              value={form.values.rate}
              onChange={(v) => form.setFieldValue('rate', v)}
              min={0}
              decimalScale={2}
              fixedDecimalScale
              required
              error={form.errors.rate}
              leftSection={<IconCurrencyRupee size={15} />}
              radius="md"
            />

            {/* Info note */}
            {!editRecord && (
              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                <IconHistory size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Previous rates for this party are preserved. Only one rate per party +
                sales item + date is allowed.
              </Text>
            )}

            {/* Actions */}
            <Divider />
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                radius="md"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saving}
                color="teal"
                radius="md"
                leftSection={editRecord ? <IconEdit size={15} /> : <IconPlus size={15} />}
              >
                {editRecord ? 'Update Rate' : 'Save Rate'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}

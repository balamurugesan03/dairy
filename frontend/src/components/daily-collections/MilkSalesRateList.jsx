import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  Progress,
  ScrollArea,
  Alert,
  List,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconRefresh,
  IconCurrencyRupee,
  IconCalendarEvent,
  IconUser,
  IconHistory,
  IconUpload,
  IconFileImport,
  IconX,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
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

// Maps OpenLyssa category name → salesItem for the import
const IMPORT_SALES_ITEM_MAP = {
  'local sale':    'Local Sales',
  'local sales':   'Local Sales',
  'sample sale':   'Sample Sales',
  'sample sales':  'Sample Sales',
};
const getSalesItemFromCatName = (catName = '') => IMPORT_SALES_ITEM_MAP[catName.trim().toLowerCase()] || 'Credit Sales';

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

  // ── Import state ─────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [catRawRows, setCatRawRows] = useState([]);   // { id, name }
  const [custRawRows, setCustRawRows] = useState([]); // { custId, name, catId }
  const [rateRawRows, setRateRawRows] = useState([]); // { custId, rate, wefDate }
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const catFileRef  = useRef(null);
  const custFileRef = useRef(null);
  const rateFileRef = useRef(null);

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

  // ── Import helpers ───────────────────────────────────────────
  const parseXlsxRows = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const handleCatFile = async (file) => {
    const rows = await parseXlsxRows(file);
    const parsed = rows.map(row => {
      const idKey   = Object.keys(row).find(k => ['cat_id','id'].includes(k.toLowerCase().trim()));
      const nameKey = Object.keys(row).find(k => ['name','cat_name','category_name','category'].includes(k.toLowerCase().trim()));
      return { id: String(row[idKey] ?? '').trim(), name: String(row[nameKey] ?? '').trim() };
    }).filter(r => r.id && r.name);
    setCatRawRows(parsed);
    return parsed;
  };

  const handleCustFile = async (file) => {
    const rows = await parseXlsxRows(file);
    const parsed = rows.map(row => {
      const custIdKey = Object.keys(row).find(k => ['cust_id','customer_id','id'].includes(k.toLowerCase().trim()));
      const nameKey   = Object.keys(row).find(k => ['name','customer_name','cust_name'].includes(k.toLowerCase().trim()));
      const catIdKey  = Object.keys(row).find(k => ['cat_id','category_id'].includes(k.toLowerCase().trim()));
      return {
        custId: String(row[custIdKey] ?? '').trim(),
        name:   String(row[nameKey]   ?? '').trim(),
        catId:  String(row[catIdKey]  ?? '').trim(),
      };
    }).filter(r => r.custId);
    setCustRawRows(parsed);
    return parsed;
  };

  const handleRateFile = async (file) => {
    const rows = await parseXlsxRows(file);
    const parsed = rows.map(row => {
      const custIdKey = Object.keys(row).find(k => ['cust_id','customer_id'].includes(k.toLowerCase().trim()));
      const rateKey   = Object.keys(row).find(k => ['rate','price'].includes(k.toLowerCase().trim()));
      const dateKey   = Object.keys(row).find(k => ['wef_date','date_entry','date_from','eff_date','effective_date','date'].includes(k.toLowerCase().trim()));
      const rawDate   = row[dateKey];
      let wefDate = null;
      if (rawDate instanceof Date) {
        wefDate = rawDate;
      } else if (typeof rawDate === 'number') {
        const d = XLSX.SSF.parse_date_code(rawDate);
        wefDate = new Date(d.y, d.m - 1, d.d);
      } else if (rawDate) {
        wefDate = new Date(rawDate);
      }
      return {
        custId:  String(row[custIdKey] ?? '').trim(),
        rate:    parseFloat(row[rateKey]) || 0,
        wefDate,
      };
    }).filter(r => r.custId);
    setRateRawRows(parsed);
    return parsed;
  };

  const buildImportPreview = (catRows, custRows, rateRows) => {
    const catMap  = new Map(catRows.map(r => [r.id, r.name]));
    const custMap = new Map(custRows.map(r => [r.custId, { name: r.name, catId: r.catId }]));
    // System customers (already loaded) override parsed file
    customers.forEach(c => custMap.set(String(c.customerId), { name: c.name, catId: '', _id: c._id }));

    const preview = rateRows.map(r => {
      const custInfo = custMap.get(r.custId) || {};
      const catName  = catMap.get(custInfo.catId) || '';
      const salesItem = getSalesItemFromCatName(catName);
      const sysCust  = customers.find(c => String(c.customerId) === r.custId);
      return {
        custId:   r.custId,
        custName: custInfo.name || '(not found)',
        catName:  catName || '(unknown)',
        salesItem,
        category: salesItem,
        rate:     r.rate,
        wefDate:  r.wefDate,
        partyId:  sysCust?._id || null,
        partyName: custInfo.name || '',
        _matched: !!sysCust,
      };
    });
    setImportPreview(preview);
    return preview;
  };

  const handleImportSubmit = async () => {
    const validRows = importPreview.filter(r => r.rate > 0 && r.wefDate);
    if (validRows.length === 0) {
      notifications.show({ color: 'red', title: 'Nothing to import', message: 'No valid rate rows found.' });
      return;
    }
    setImportLoading(true);
    try {
      const normalizeWef = (d) => {
        const date = d instanceof Date ? d : new Date(d);
        const ist  = new Date(date.getTime() + 5.5 * 60 * 60000);
        return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 30, 0, 0)).toISOString();
      };
      const rates = validRows.map(r => ({
        partyType: 'Customer',
        ...(r.partyId   ? { partyId:   r.partyId   } : {}),
        ...(r.partyName ? { partyName: r.partyName } : {}),
        salesItem: r.salesItem,
        category:  r.category,
        wefDate:   normalizeWef(r.wefDate),
        rate:      r.rate,
      }));
      const res = await milkSalesRateAPI.bulkImport(rates);
      setImportStats(res.data);
      notifications.show({ color: 'green', title: 'Import Done', message: `${res.data.created} created, ${res.data.skipped} skipped` });
      fetchRates();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Import Failed', message: e.message });
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setCatRawRows([]);
    setCustRawRows([]);
    setRateRawRows([]);
    setImportPreview([]);
    setImportStats(null);
    if (catFileRef.current)  catFileRef.current.value  = '';
    if (custFileRef.current) custFileRef.current.value = '';
    if (rateFileRef.current) rateFileRef.current.value = '';
  };

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

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title: 'Delete Rate',
      children: (
        <Text size="sm">
          Delete rate <b>₹{Number(rec.rate).toFixed(2)}</b> for <b>{rec.partyName || rec.salesItem}</b>?
          This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await milkSalesRateAPI.delete(rec._id);
          notifications.show({ color: 'green', title: 'Deleted', message: 'Rate deleted successfully' });
          fetchRates();
        } catch (e) {
          notifications.show({ color: 'red', title: 'Error', message: e.message || 'Delete failed' });
        }
      },
    });
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
        <Group gap={4}>
          <Tooltip label="Edit Rate">
            <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEdit(rec)}>
              <IconEdit size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Rate">
            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(rec)}>
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
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
              leftSection={<IconFileImport size={16} />}
              color="indigo"
              variant="light"
              radius="md"
              onClick={() => { resetImport(); setImportOpen(true); }}
            >
              Import
            </Button>
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
           IMPORT MODAL
         ══════════════════════════════════════════════════════════ */}
      <Modal
        opened={importOpen}
        onClose={() => { setImportOpen(false); resetImport(); }}
        title={
          <Group gap="sm">
            <ThemeIcon size={28} radius="md" color="indigo" variant="light">
              <IconFileImport size={16} />
            </ThemeIcon>
            <Text fw={700} size="md">Import Milk Sales Rates (OpenLyssa)</Text>
          </Group>
        }
        size="xl"
        centered
        radius="md"
      >
        <Stack gap="md">
          {/* ─ File upload buttons ─ */}
          <Text size="sm" c="dimmed">
            Upload the <b>milksales_rate</b> file. Optionally attach the <b>customers</b> and
            <b> category</b> files to auto-resolve party names and sales types.
          </Text>

          <Grid gutter="sm">
            {/* Category file */}
            <Grid.Col span={4}>
              <input type="file" accept=".xlsx,.xls" ref={catFileRef} style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  try {
                    const catRows = await handleCatFile(f);
                    buildImportPreview(catRows, custRawRows, rateRawRows);
                  } catch (err) {
                    notifications.show({ color: 'red', title: 'Parse error', message: err.message });
                  }
                }}
              />
              <Button
                fullWidth
                variant={catRawRows.length > 0 ? 'filled' : 'default'}
                color="teal"
                radius="md"
                size="sm"
                leftSection={catRawRows.length > 0 ? <IconCheck size={14} /> : <IconUpload size={14} />}
                onClick={() => catFileRef.current?.click()}
              >
                {catRawRows.length > 0 ? `Category (${catRawRows.length})` : 'Category File'}
              </Button>
            </Grid.Col>

            {/* Customers file */}
            <Grid.Col span={4}>
              <input type="file" accept=".xlsx,.xls" ref={custFileRef} style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  try {
                    const custRows = await handleCustFile(f);
                    buildImportPreview(catRawRows, custRows, rateRawRows);
                  } catch (err) {
                    notifications.show({ color: 'red', title: 'Parse error', message: err.message });
                  }
                }}
              />
              <Button
                fullWidth
                variant={custRawRows.length > 0 ? 'filled' : 'default'}
                color="blue"
                radius="md"
                size="sm"
                leftSection={custRawRows.length > 0 ? <IconCheck size={14} /> : <IconUpload size={14} />}
                onClick={() => custFileRef.current?.click()}
              >
                {custRawRows.length > 0 ? `Customers (${custRawRows.length})` : 'Customers File'}
              </Button>
            </Grid.Col>

            {/* milksales_rate file */}
            <Grid.Col span={4}>
              <input type="file" accept=".xlsx,.xls" ref={rateFileRef} style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  try {
                    const rateRows = await handleRateFile(f);
                    buildImportPreview(catRawRows, custRawRows, rateRows);
                  } catch (err) {
                    notifications.show({ color: 'red', title: 'Parse error', message: err.message });
                  }
                }}
              />
              <Button
                fullWidth
                variant={rateRawRows.length > 0 ? 'filled' : 'default'}
                color="indigo"
                radius="md"
                size="sm"
                leftSection={rateRawRows.length > 0 ? <IconCheck size={14} /> : <IconUpload size={14} />}
                onClick={() => rateFileRef.current?.click()}
              >
                {rateRawRows.length > 0 ? `Rates (${rateRawRows.length} rows)` : 'milksales_rate File *'}
              </Button>
            </Grid.Col>
          </Grid>

          {/* ─ Preview table ─ */}
          {importPreview.length > 0 && (
            <>
              <Divider label={`Preview — ${importPreview.length} rows`} labelPosition="left" />

              {/* Stats badges */}
              <Group gap="xs">
                <Badge color="green" variant="light">
                  {importPreview.filter(r => r._matched).length} matched
                </Badge>
                <Badge color="orange" variant="light">
                  {importPreview.filter(r => !r._matched).length} unmatched
                </Badge>
                <Badge color="blue" variant="light">
                  {importPreview.filter(r => r.salesItem === 'Credit Sales').length} Credit
                </Badge>
                <Badge color="teal" variant="light">
                  {importPreview.filter(r => r.salesItem === 'Local Sales').length} Local
                </Badge>
                <Badge color="grape" variant="light">
                  {importPreview.filter(r => r.salesItem === 'Sample Sales').length} Sample
                </Badge>
              </Group>

              {catRawRows.length === 0 && (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />} radius="md">
                  Category file not uploaded — all rows will be imported as <b>Credit Sales</b>.
                </Alert>
              )}

              <ScrollArea h={260} type="auto">
                <Table fz="xs" withTableBorder withColumnBorders striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Cust ID</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Sales Item</Table.Th>
                      <Table.Th>Rate (₹)</Table.Th>
                      <Table.Th>W.E.F Date</Table.Th>
                      <Table.Th>Match</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {importPreview.map((r, i) => (
                      <Table.Tr key={i}>
                        <Table.Td c="dimmed">{r.custId}</Table.Td>
                        <Table.Td fw={600} c={r._matched ? 'dark' : 'red'}>{r.custName}</Table.Td>
                        <Table.Td c="dimmed">{r.catName}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={r.salesItem === 'Credit Sales' ? 'orange' : r.salesItem === 'Sample Sales' ? 'grape' : 'teal'}
                            variant="light"
                          >
                            {r.salesItem}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={600} c="green">₹{Number(r.rate).toFixed(2)}</Table.Td>
                        <Table.Td>
                          {r.wefDate
                            ? new Date(r.wefDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : <Text c="red" size="xs">missing</Text>
                          }
                        </Table.Td>
                        <Table.Td>
                          {r._matched
                            ? <Badge size="xs" color="green" variant="dot">Found</Badge>
                            : <Badge size="xs" color="gray" variant="dot">Not in DB</Badge>
                          }
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}

          {/* ─ Import result ─ */}
          {importStats && (
            <Alert color="green" icon={<IconCheck size={16} />} radius="md" title="Import Complete">
              <List size="sm">
                <List.Item>{importStats.created} rate(s) created</List.Item>
                <List.Item>{importStats.skipped} duplicate(s) skipped</List.Item>
                {importStats.errors?.length > 0 && (
                  <List.Item c="red">{importStats.errors.length} error(s) — check console</List.Item>
                )}
              </List>
            </Alert>
          )}

          {importLoading && <Progress value={100} animated color="indigo" radius="md" />}

          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" radius="md" onClick={() => { setImportOpen(false); resetImport(); }}>
              Close
            </Button>
            <Button
              color="indigo"
              radius="md"
              loading={importLoading}
              disabled={rateRawRows.length === 0}
              leftSection={<IconFileImport size={15} />}
              onClick={handleImportSubmit}
            >
              Import {importPreview.length > 0 ? `(${importPreview.length} rows)` : ''}
            </Button>
          </Group>
        </Stack>
      </Modal>

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

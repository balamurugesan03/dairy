import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Group, Text, Title, Badge, ActionIcon, TextInput,
  Select, Modal, Stack, Grid, Divider, NumberInput, Textarea,
  Paper, Pagination, Tooltip, LoadingOverlay
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconUser
} from '@tabler/icons-react';
import { businessCustomerAPI } from '../../services/api';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry'
];

const EMPTY_FORM = {
  name: '', phone: '', email: '', gstNumber: '', panNumber: '',
  address: '', state: '', district: '', pincode: '',
  openingBalance: 0, creditLimit: 0, active: 'true'
};

export default function BusinessCustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    initialValues: EMPTY_FORM,
    validate: {
      name: (v) => (!v || !v.trim() ? 'Name is required' : null),
      phone: (v) => (!v || !/^\d{10}$/.test(v) ? 'Valid 10-digit phone required' : null),
      email: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email' : null),
      pincode: (v) => (v && !/^\d{6}$/.test(v) ? 'Pincode must be 6 digits' : null),
      panNumber: (v) => (v && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) ? 'Invalid PAN format (e.g. ABCDE1234F)' : null),
      gstNumber: (v) => (v && v.length !== 15 ? 'GST must be 15 characters' : null),
    }
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await businessCustomerAPI.getAll({ page, limit: 15, search, active: activeFilter });
      if (res.success) {
        setCustomers(res.data || []);
        setTotalPages(res.pagination?.pages || 1);
        setTotal(res.pagination?.total || 0);
      }
    } catch {
      notifications.show({ color: 'red', title: 'Error', message: 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  }, [page, search, activeFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => {
    setEditingId(null);
    form.setValues(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditingId(customer._id);
    form.setValues({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gstNumber: customer.gstNumber || '',
      panNumber: customer.panNumber || '',
      address: customer.address || '',
      state: customer.state || '',
      district: customer.district || '',
      pincode: customer.pincode || '',
      openingBalance: customer.openingBalance || 0,
      creditLimit: customer.creditLimit || 0,
      active: String(customer.active ?? 'true')
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        active: values.active === 'true',
        openingBalance: Number(values.openingBalance) || 0,
        creditLimit: Number(values.creditLimit) || 0
      };
      let res;
      if (editingId) {
        res = await businessCustomerAPI.update(editingId, payload);
      } else {
        res = await businessCustomerAPI.create(payload);
      }
      if (res.success) {
        notifications.show({ color: 'green', title: 'Success', message: editingId ? 'Customer updated' : 'Customer created' });
        setModalOpen(false);
        fetchCustomers();
      } else {
        notifications.show({ color: 'red', title: 'Error', message: res.message || 'Operation failed' });
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Operation failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    modals.openConfirmModal({
      title: 'Deactivate Customer',
      children: <Text size="sm">Deactivate <strong>{name}</strong>? They will be marked inactive.</Text>,
      labels: { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await businessCustomerAPI.delete(id);
        if (res.success) {
          notifications.show({ color: 'green', title: 'Success', message: 'Customer deactivated' });
          fetchCustomers();
        }
      }
    });
  };

  const handleSearch = (val) => { setSearch(val); setPage(1); };

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconUser size={24} color="var(--mantine-color-blue-6)" />
          <Title order={3}>Customers</Title>
          <Badge color="blue" variant="light">{total} Total</Badge>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Customer</Button>
      </Group>

      {/* Filters */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Group gap="sm">
          <TextInput
            placeholder="Search by name, phone, ID, email..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Status"
            data={[{ value: '', label: 'All Status' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
            value={activeFilter}
            onChange={(v) => { setActiveFilter(v || ''); setPage(1); }}
            w={140}
            clearable
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" onClick={fetchCustomers} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder radius="md" style={{ position: 'relative', overflowX: 'auto' }}>
        <LoadingOverlay visible={loading} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--mantine-color-gray-0)', borderBottom: '2px solid var(--mantine-color-gray-2)' }}>
              {['#', 'Customer ID', 'Name', 'Phone', 'Email', 'GST No.', 'State', 'District', 'Opening Balance', 'Status', 'Actions'].map(col => (
                <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--mantine-color-gray-7)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--mantine-color-gray-5)' }}>
                  No customers found
                </td>
              </tr>
            ) : customers.map((c, idx) => (
              <tr key={c._id} style={{ borderBottom: '1px solid var(--mantine-color-gray-1)', background: idx % 2 === 0 ? 'white' : 'var(--mantine-color-gray-0)' }}>
                <td style={{ padding: '8px 12px' }}>{(page - 1) * 15 + idx + 1}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 500 }}>{c.customerId}</td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: '8px 12px' }}>{c.phone}</td>
                <td style={{ padding: '8px 12px', color: 'var(--mantine-color-gray-6)' }}>{c.email || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{c.gstNumber || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{c.state || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{c.district || '-'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{(c.openingBalance || 0).toFixed(2)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <Badge color={c.active ? 'green' : 'red'} variant="light" size="sm">
                    {c.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <Group gap={4}>
                    <Tooltip label="Edit">
                      <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEdit(c)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Deactivate">
                      <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(c._id, c.name)} disabled={!c.active}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={600}>{editingId ? 'Edit Customer' : 'Add New Customer'}</Text>}
        size="lg"
        centered
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="xs">
            {/* Basic Info */}
            <Divider label="Basic Information" labelPosition="left" />
            <Grid>
              <Grid.Col span={6}>
                <TextInput label="Name" placeholder="Customer name" required {...form.getInputProps('name')} />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput label="Phone" placeholder="10-digit phone" required {...form.getInputProps('phone')} />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput label="Email" placeholder="Email address" {...form.getInputProps('email')} />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Status"
                  data={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
                  {...form.getInputProps('active')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput label="Opening Balance (₹)" min={0} {...form.getInputProps('openingBalance')} />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput label="Credit Limit (₹)" min={0} {...form.getInputProps('creditLimit')} />
              </Grid.Col>
            </Grid>

            {/* Address */}
            <Divider label="Address" labelPosition="left" mt="xs" />
            <Textarea label="Address" placeholder="Full address" rows={2} {...form.getInputProps('address')} />
            <Grid>
              <Grid.Col span={4}>
                <Select
                  label="State"
                  placeholder="Select state"
                  data={INDIAN_STATES}
                  searchable
                  clearable
                  {...form.getInputProps('state')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput label="District" placeholder="District" {...form.getInputProps('district')} />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput label="Pincode" placeholder="6-digit pincode" {...form.getInputProps('pincode')} />
              </Grid.Col>
            </Grid>

            {/* Tax Info */}
            <Divider label="Tax Information" labelPosition="left" mt="xs" />
            <Grid>
              <Grid.Col span={6}>
                <TextInput label="GST Number" placeholder="15-character GST" {...form.getInputProps('gstNumber')} />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput label="PAN Number" placeholder="ABCDE1234F" {...form.getInputProps('panNumber')} />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editingId ? 'Update Customer' : 'Add Customer'}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Box>
  );
}

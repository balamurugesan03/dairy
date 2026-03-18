import { useState, useEffect } from 'react';
import {
  Box, Text, TextInput, Button, Group, Badge, ActionIcon,
  Table, Pagination, Card, Grid, Modal, Stack, NumberInput,
  Textarea, Title, Loader, Center, Select
} from '@mantine/core';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconUser,
  IconPhone, IconMail, IconMapPin, IconRefresh, IconX, IconCheck
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { businessSupplierAPI } from '../../services/api';

const EMPTY_FORM = {
  supplierId: '', name: '', phone: '', email: '', gstNumber: '', panNumber: '',
  address: '', state: '', district: '', pincode: '',
  openingBalance: 0, creditLimit: 0, creditDays: 0,
  bankName: '', accountNumber: '', ifscCode: ''
};

const BusinessSupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const LIMIT = 15;

  useEffect(() => { fetchSuppliers(); }, [page, search]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await businessSupplierAPI.getAll({ page, limit: LIMIT, search });
      setSuppliers(res?.data || []);
      setTotal(res?.pagination?.total || 0);
      setTotalPages(res?.pagination?.pages || 1);
    } catch {
      notifications.show({ message: 'Failed to fetch suppliers', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const openAdd = async () => {
    const res = await businessSupplierAPI.getNextId();
    setForm({ ...EMPTY_FORM, supplierId: res?.data?.supplierId || '' });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = async (supplier) => {
    setForm({
      supplierId: supplier.supplierId || '',
      name: supplier.name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      gstNumber: supplier.gstNumber || '',
      panNumber: supplier.panNumber || '',
      address: supplier.address || '',
      state: supplier.state || '',
      district: supplier.district || '',
      pincode: supplier.pincode || '',
      openingBalance: supplier.openingBalance || 0,
      creditLimit: supplier.creditLimit || 0,
      creditDays: supplier.creditDays || 0,
      bankName: supplier.bankName || '',
      accountNumber: supplier.accountNumber || '',
      ifscCode: supplier.ifscCode || ''
    });
    setEditId(supplier._id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return notifications.show({ message: 'Name is required', color: 'red' });
    if (!form.phone.trim()) return notifications.show({ message: 'Phone is required', color: 'red' });

    setSaving(true);
    try {
      if (editId) {
        await businessSupplierAPI.update(editId, form);
        notifications.show({ message: 'Supplier updated successfully', color: 'green' });
      } else {
        await businessSupplierAPI.create(form);
        notifications.show({ message: 'Supplier created successfully', color: 'green' });
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      notifications.show({ message: err?.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this supplier?')) return;
    try {
      await businessSupplierAPI.delete(id);
      notifications.show({ message: 'Supplier deactivated', color: 'orange' });
      fetchSuppliers();
    } catch {
      notifications.show({ message: 'Failed to deactivate', color: 'red' });
    }
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={3} fw={700} c="#1e293b">Business Suppliers</Title>
          <Text size="sm" c="dimmed">{total} suppliers registered</Text>
        </Box>
        <Group>
          <ActionIcon variant="light" color="blue" onClick={fetchSuppliers}><IconRefresh size={16} /></ActionIcon>
          <Button leftSection={<IconPlus size={15} />} onClick={openAdd} size="sm">Add Supplier</Button>
        </Group>
      </Group>

      {/* Search */}
      <Card withBorder mb="md" p="sm" radius="md">
        <TextInput
          placeholder="Search by ID, name, phone..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => { setSearch(e.currentTarget.value); setPage(1); }}
          rightSection={search ? <ActionIcon size={18} variant="subtle" onClick={() => setSearch('')}><IconX size={12} /></ActionIcon> : null}
          style={{ maxWidth: 360 }}
        />
      </Card>

      {/* Table */}
      <Card withBorder p={0} radius="md">
        {loading ? (
          <Center p="xl"><Loader size="sm" /></Center>
        ) : suppliers.length === 0 ? (
          <Center p="xl"><Text c="dimmed">No suppliers found</Text></Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead style={{ background: '#f8fafc' }}>
              <Table.Tr>
                <Table.Th>Supplier ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>GST Number</Table.Th>
                <Table.Th>Opening Balance</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {suppliers.map(s => (
                <Table.Tr key={s._id}>
                  <Table.Td><Badge size="sm" variant="light" color="violet">{s.supplierId}</Badge></Table.Td>
                  <Table.Td fw={600}>{s.name}</Table.Td>
                  <Table.Td>{s.phone}</Table.Td>
                  <Table.Td>{s.email || '-'}</Table.Td>
                  <Table.Td>{s.gstNumber || '-'}</Table.Td>
                  <Table.Td>₹{(s.openingBalance || 0).toFixed(2)}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={s.active ? 'green' : 'red'} variant="light">
                      {s.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="light" color="blue" onClick={() => openEdit(s)}><IconEdit size={14} /></ActionIcon>
                      <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDelete(s._id)}><IconTrash size={14} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700} size="lg">{editId ? 'Edit Supplier' : 'Add Business Supplier'}</Text>}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Grid>
            <Grid.Col span={6}>
              <TextInput label="Supplier ID" value={form.supplierId} onChange={e => f('supplierId', e.currentTarget.value)} required />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput label="Name" value={form.name} onChange={e => f('name', e.currentTarget.value)} required leftSection={<IconUser size={14} />} />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput label="Phone" value={form.phone} onChange={e => f('phone', e.currentTarget.value)} required leftSection={<IconPhone size={14} />} />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput label="Email" value={form.email} onChange={e => f('email', e.currentTarget.value)} leftSection={<IconMail size={14} />} />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput label="GST Number" value={form.gstNumber} onChange={e => f('gstNumber', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput label="PAN Number" value={form.panNumber} onChange={e => f('panNumber', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea label="Address" value={form.address} onChange={e => f('address', e.currentTarget.value)} rows={2} leftSection={<IconMapPin size={14} />} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="State" value={form.state} onChange={e => f('state', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="District" value={form.district} onChange={e => f('district', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Pincode" value={form.pincode} onChange={e => f('pincode', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput label="Opening Balance (₹)" value={form.openingBalance} onChange={v => f('openingBalance', v || 0)} min={0} />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput label="Credit Limit (₹)" value={form.creditLimit} onChange={v => f('creditLimit', v || 0)} min={0} />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput label="Credit Days" value={form.creditDays} onChange={v => f('creditDays', v || 0)} min={0} />
            </Grid.Col>
            <Grid.Col span={12}>
              <Text size="sm" fw={600} c="dimmed" mb={4}>Bank Details</Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Bank Name" value={form.bankName} onChange={e => f('bankName', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Account Number" value={form.accountNumber} onChange={e => f('accountNumber', e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="IFSC Code" value={form.ifscCode} onChange={e => f('ifscCode', e.currentTarget.value)} />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="sm">
            <Button variant="light" color="gray" onClick={() => setModalOpen(false)} leftSection={<IconX size={14} />}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} leftSection={<IconCheck size={14} />}>
              {editId ? 'Update' : 'Save'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};

export default BusinessSupplierList;

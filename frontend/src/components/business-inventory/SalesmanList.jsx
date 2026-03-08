import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Table,
  TextInput,
  NumberInput,
  Select,
  Badge,
  ActionIcon,
  Modal,
  Pagination,
  Loader,
  Center,
  Alert
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconUserOff,
  IconSearch,
  IconUser,
  IconPhone,
  IconMail,
  IconPercentage,
  IconAlertCircle
} from '@tabler/icons-react';
import { salesmanAPI } from '../../services/api';

const SalesmanList = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [saving, setSaving] = useState(false);

  const LIMIT = 15;

  const form = useForm({
    initialValues: {
      name: '',
      phone: '',
      email: '',
      commission: 0,
      status: 'Active'
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      commission: (v) => (v >= 0 && v <= 100 ? null : 'Commission must be 0-100')
    }
  });

  const fetchSalesmen = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await salesmanAPI.getAll(params);
      setSalesmen(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load salesmen', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
  }, [page, search, statusFilter]);

  const openAdd = () => {
    setEditTarget(null);
    form.reset();
    openModal();
  };

  const openEdit = (salesman) => {
    setEditTarget(salesman);
    form.setValues({
      name: salesman.name || '',
      phone: salesman.phone || '',
      email: salesman.email || '',
      commission: salesman.commission ?? 0,
      status: salesman.status || 'Active'
    });
    openModal();
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editTarget) {
        await salesmanAPI.update(editTarget._id, values);
        notifications.show({ title: 'Success', message: 'Salesman updated', color: 'green' });
      } else {
        await salesmanAPI.create(values);
        notifications.show({ title: 'Success', message: 'Salesman created', color: 'green' });
      }
      closeModal();
      fetchSalesmen();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (salesman) => {
    modals.openConfirmModal({
      title: 'Deactivate Salesman',
      children: (
        <Text size="sm">
          Are you sure you want to deactivate <strong>{salesman.name}</strong>?
        </Text>
      ),
      labels: { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await salesmanAPI.delete(salesman._id);
          notifications.show({ title: 'Success', message: 'Salesman deactivated', color: 'green' });
          fetchSalesmen();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Failed to deactivate', color: 'red' });
        }
      }
    });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Salesman Management</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
            Add Salesman
          </Button>
        </Group>

        {/* Filters */}
        <Paper withBorder p="sm" radius="md">
          <Group gap="sm">
            <TextInput
              placeholder="Search by name, phone, ID..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="All Status"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
              data={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              clearable
              w={160}
            />
          </Group>
        </Paper>

        {/* Table */}
        <Paper withBorder radius="md">
          {loading ? (
            <Center py="xl">
              <Loader size="md" />
            </Center>
          ) : salesmen.length === 0 ? (
            <Center py="xl">
              <Alert icon={<IconAlertCircle size={16} />} color="gray">
                No salesmen found. Click "Add Salesman" to get started.
              </Alert>
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Salesman ID</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Commission %</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {salesmen.map((s, i) => (
                  <Table.Tr key={s._id}>
                    <Table.Td>{(page - 1) * LIMIT + i + 1}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{s.salesmanId}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{s.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{s.phone || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{s.email || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{s.commission ?? 0}%</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={s.status === 'Active' ? 'green' : 'gray'} size="sm">
                        {s.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          onClick={() => openEdit(s)}
                          title="Edit"
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                        {s.status === 'Active' && (
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleDeactivate(s)}
                            title="Deactivate"
                          >
                            <IconUserOff size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </Paper>
      </Stack>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editTarget ? 'Edit Salesman' : 'Add Salesman'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              placeholder="Salesman name"
              required
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Phone"
              placeholder="Phone number"
              leftSection={<IconPhone size={16} />}
              {...form.getInputProps('phone')}
            />
            <TextInput
              label="Email"
              placeholder="Email address"
              leftSection={<IconMail size={16} />}
              {...form.getInputProps('email')}
            />
            <NumberInput
              label="Commission %"
              placeholder="0"
              min={0}
              max={100}
              decimalScale={2}
              leftSection={<IconPercentage size={16} />}
              {...form.getInputProps('commission')}
            />
            <Select
              label="Status"
              data={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              {...form.getInputProps('status')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="light" onClick={closeModal}>Cancel</Button>
              <Button type="submit" loading={saving}>
                {editTarget ? 'Update' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
};

export default SalesmanList;

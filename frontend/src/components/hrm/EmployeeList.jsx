import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon,
  TextInput, Modal, NumberInput, Textarea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconEdit, IconTrash, IconUsers, IconUserCheck,
  IconUserOff, IconSearch, IconBriefcase, IconPhone, IconUser
} from '@tabler/icons-react';
import { employeeAPI } from '../../services/api';

const DEPARTMENTS = ['Administration', 'Dairy', 'Finance', 'HR', 'IT', 'Operations', 'Production', 'Sales'];
const ROLES = ['Manager', 'Supervisor', 'Operator', 'Accountant', 'Driver', 'Helper', 'Clerk', 'Other'];

const defaultForm = {
  name: '', mobile: '', address: '', department: '', role: '',
  salary: '', joiningDate: new Date(), status: 'Active'
};

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  useEffect(() => { fetchEmployees(); }, [search, statusFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await employeeAPI.getAll(params);
      setEmployees(res.data || []);
      if (res.statistics) setStats(res.statistics);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load employees', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.mobile || !form.salary) {
      return notifications.show({ title: 'Validation', message: 'Name, mobile and salary are required', color: 'orange' });
    }
    try {
      const payload = { ...form, joiningDate: form.joiningDate };
      if (editId) {
        await employeeAPI.update(editId, payload);
        notifications.show({ title: 'Success', message: 'Employee updated', color: 'green' });
      } else {
        await employeeAPI.create(payload);
        notifications.show({ title: 'Success', message: 'Employee added', color: 'green' });
      }
      closeModal();
      setForm(defaultForm);
      setEditId(null);
      fetchEmployees();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save', color: 'red' });
    }
  };

  const handleEdit = (emp) => {
    setForm({
      name: emp.name, mobile: emp.mobile, address: emp.address || '',
      department: emp.department || '', role: emp.role || '',
      salary: emp.salary, joiningDate: emp.joiningDate ? new Date(emp.joiningDate) : new Date(),
      status: emp.status
    });
    setEditId(emp._id);
    openModal();
  };

  const handleDelete = (emp) => {
    modals.openConfirmModal({
      title: 'Delete Employee',
      children: <Text size="sm">Delete <b>{emp.name}</b>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await employeeAPI.delete(emp._id);
          notifications.show({ title: 'Deleted', message: 'Employee removed', color: 'green' });
          fetchEmployees();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const openAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    openModal();
  };

  const StatCard = ({ icon, label, value, color }) => (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
        <div>
          <Text fw={700} size="xl">{value}</Text>
          <Text size="sm" c="dimmed">{label}</Text>
        </div>
      </Group>
    </Card>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Employee Management</Title>
          <Text c="dimmed" size="sm">Manage dairy society employees</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={openAdd}>Add Employee</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <StatCard icon={<IconUsers size={22} />} label="Total Employees" value={stats.total} color="blue" />
        <StatCard icon={<IconUserCheck size={22} />} label="Active" value={stats.active} color="green" />
        <StatCard icon={<IconUserOff size={22} />} label="Inactive" value={stats.inactive} color="gray" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group>
          <TextInput
            placeholder="Search by name..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="All Status"
            data={['Active', 'Inactive']}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {employees.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconUsers size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No employees found</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Employee</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Mobile</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th ta="right">Salary</Table.Th>
                  <Table.Th>Joining Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {employees.map((emp, i) => (
                  <Table.Tr key={emp._id}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <ThemeIcon size={28} radius="xl" variant="light" color="blue"><IconUser size={14} /></ThemeIcon>
                        <Text size="sm" fw={600}>{emp.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm">{emp.mobile}</Text></Table.Td>
                    <Table.Td>
                      {emp.department && <Badge variant="light" color="indigo" size="sm">{emp.department}</Badge>}
                    </Table.Td>
                    <Table.Td><Text size="sm">{emp.role || '-'}</Text></Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600} c="teal">₹{(emp.salary || 0).toLocaleString('en-IN')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={emp.status === 'Active' ? 'green' : 'gray'} size="sm">
                        {emp.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon variant="light" color="blue" size="sm" onClick={() => handleEdit(emp)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(emp)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={<Text fw={600}>{editId ? 'Edit Employee' : 'Add Employee'}</Text>}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name" placeholder="Employee name" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextInput
            label="Mobile" placeholder="10-digit mobile" required
            value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Textarea
            label="Address" placeholder="Full address" rows={2}
            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <SimpleGrid cols={2}>
            <Select
              label="Department" placeholder="Select department"
              data={DEPARTMENTS} value={form.department}
              onChange={(val) => setForm({ ...form, department: val })}
              clearable
            />
            <Select
              label="Role" placeholder="Select role"
              data={ROLES} value={form.role}
              onChange={(val) => setForm({ ...form, role: val })}
              clearable
            />
          </SimpleGrid>
          <SimpleGrid cols={2}>
            <NumberInput
              label="Salary (₹)" placeholder="Monthly salary" required min={0}
              value={form.salary} onChange={(val) => setForm({ ...form, salary: val })}
            />
            <DatePickerInput
              label="Joining Date"
              value={form.joiningDate}
              onChange={(val) => setForm({ ...form, joiningDate: val })}
            />
          </SimpleGrid>
          <Select
            label="Status"
            data={['Active', 'Inactive']}
            value={form.status}
            onChange={(val) => setForm({ ...form, status: val })}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add Employee'}</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default EmployeeList;

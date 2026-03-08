import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon, Modal
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCurrencyRupee, IconPlus, IconCheck, IconCash, IconReceipt,
  IconEye, IconFilter, IconFilterOff, IconFileInvoice, IconTrash
} from '@tabler/icons-react';
import { salaryAPI, employeeAPI } from '../../services/api';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const monthLabel = (m) => MONTHS.find(x => x.value === String(m))?.label?.substring(0, 3) || '';
const getStatusColor = (s) => ({ Pending: 'yellow', Approved: 'indigo', Paid: 'green' }[s] || 'gray');

const SalaryList = () => {
  const navigate = useNavigate();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewSalary, setViewSalary] = useState(null);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);

  const [filters, setFilters] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    employee: null,
    status: null
  });

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchSalaries(); }, [filters]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll({ status: 'Active', limit: 500 });
      setEmployees(res.data || []);
    } catch {}
  };

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const params = { month: parseInt(filters.month), year: parseInt(filters.year) };
      if (filters.employee) params.employee = filters.employee;
      if (filters.status) params.status = filters.status;
      const res = await salaryAPI.getAll(params);
      setSalaries(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load payroll', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (id, name) => {
    modals.openConfirmModal({
      title: 'Approve Salary',
      children: <Text size="sm">Approve salary for <b>{name}</b>?</Text>,
      labels: { confirm: 'Approve', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        try {
          await salaryAPI.approve(id, 'Admin');
          notifications.show({ title: 'Approved', message: 'Salary approved', color: 'green' });
          fetchSalaries();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleMarkPaid = (id, name) => {
    modals.openConfirmModal({
      title: 'Mark as Paid',
      children: <Text size="sm">Mark salary as paid for <b>{name}</b>?</Text>,
      labels: { confirm: 'Mark Paid', cancel: 'Cancel' },
      confirmProps: { color: 'teal' },
      onConfirm: async () => {
        try {
          await salaryAPI.markPaid(id, { paidDate: new Date() });
          notifications.show({ title: 'Success', message: 'Salary marked as paid', color: 'green' });
          fetchSalaries();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleDelete = (id) => {
    modals.openConfirmModal({
      title: 'Delete Payroll',
      children: <Text size="sm">Delete this payroll record?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await salaryAPI.delete(id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Record removed' });
          fetchSalaries();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { value: String(y), label: String(y) };
  });

  const totalNet = salaries.reduce((s, r) => s + (r.netSalary || 0), 0);
  const totalDeductions = salaries.reduce((s, r) => s + (r.deduction || 0), 0);
  const totalBasic = salaries.reduce((s, r) => s + (r.basicSalary || 0), 0);
  const paidCount = salaries.filter(r => r.status === 'Paid').length;

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
          <Title order={2}>Salary / Payroll</Title>
          <Text c="dimmed" size="sm">Generate and manage employee payroll</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/hrm/salary/process')}>
          Process Salary
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Basic Salary" value={fmt(totalBasic)} color="blue" />
        <StatCard icon={<IconCash size={22} />} label="Net Payable" value={fmt(totalNet)} color="green" />
        <StatCard icon={<IconReceipt size={22} />} label="Deductions" value={fmt(totalDeductions)} color="orange" />
        <StatCard icon={<IconCheck size={22} />} label="Paid" value={`${paidCount} / ${salaries.length}`} color="teal" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Select label="Month" data={MONTHS} value={filters.month}
            onChange={(v) => setFilters({ ...filters, month: v })} />
          <Select label="Year" data={yearOptions} value={filters.year}
            onChange={(v) => setFilters({ ...filters, year: v })} />
          <Select label="Employee" placeholder="All Employees"
            data={employees.map(e => ({ value: e._id, label: e.name }))}
            value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })}
            clearable searchable />
          <Select label="Status" placeholder="All Status"
            data={['Pending', 'Approved', 'Paid']}
            value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
            clearable />
        </SimpleGrid>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {salaries.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconFileInvoice size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No payroll records</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => navigate('/hrm/salary/process')}>
              Process Salary
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th ta="right">Basic</Table.Th>
                  <Table.Th ta="right">Overtime</Table.Th>
                  <Table.Th ta="right">Deduction</Table.Th>
                  <Table.Th ta="right">Net Salary</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {salaries.map((s) => (
                  <Table.Tr key={s._id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={600}>{s.employeeId?.name || '-'}</Text>
                        <Text size="xs" c="dimmed">{s.employeeId?.department || ''}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue" size="sm">{monthLabel(s.month)} {s.year}</Badge>
                    </Table.Td>
                    <Table.Td ta="right"><Text size="sm">{fmt(s.basicSalary)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" c="green">{fmt(s.overtime)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" c="red">{fmt(s.deduction)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" fw={700} c="teal">{fmt(s.netSalary)}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={getStatusColor(s.status)} size="sm">{s.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        {s.status === 'Pending' && (
                          <Tooltip label="Approve">
                            <ActionIcon variant="light" color="green" size="sm"
                              onClick={() => handleApprove(s._id, s.employeeId?.name)}>
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {s.status === 'Approved' && (
                          <Tooltip label="Mark Paid">
                            <ActionIcon variant="light" color="teal" size="sm"
                              onClick={() => handleMarkPaid(s._id, s.employeeId?.name)}>
                              <IconCash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="View">
                          <ActionIcon variant="light" color="blue" size="sm"
                            onClick={() => { setViewSalary(s); openView(); }}>
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" size="sm"
                            onClick={() => handleDelete(s._id)}>
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

      {/* View Modal */}
      <Modal opened={viewOpened} onClose={closeView} title={<Text fw={600}>Payroll Details</Text>} size="md">
        {viewSalary && (
          <Stack gap="sm">
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Employee</Text>
                  <Text fw={600}>{viewSalary.employeeId?.name}</Text>
                  <Text size="xs" c="dimmed">{viewSalary.employeeId?.department}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="sm" c="dimmed">Period</Text>
                  <Badge variant="light" color="blue" size="lg">{monthLabel(viewSalary.month)} {viewSalary.year}</Badge>
                </div>
              </Group>
            </Paper>
            <Paper p="sm" withBorder radius="sm">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="sm">Basic Salary</Text>
                  <Text size="sm">{fmt(viewSalary.basicSalary)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Overtime</Text>
                  <Text size="sm" c="green">{fmt(viewSalary.overtime)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Deduction</Text>
                  <Text size="sm" c="red">{fmt(viewSalary.deduction)}</Text>
                </Group>
              </Stack>
            </Paper>
            <Paper p="md" bg="teal.0" radius="sm">
              <Group justify="space-between">
                <Text fw={600} size="lg">Net Salary</Text>
                <Text fw={700} size="xl" c="teal">{fmt(viewSalary.netSalary)}</Text>
              </Group>
            </Paper>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status</Text>
              <Badge variant="light" color={getStatusColor(viewSalary.status)} size="lg">{viewSalary.status}</Badge>
            </Group>
            {viewSalary.paidDate && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Paid Date</Text>
                <Text size="sm">{new Date(viewSalary.paidDate).toLocaleDateString('en-IN')}</Text>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default SalaryList;

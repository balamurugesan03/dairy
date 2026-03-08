import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon,
  Modal, NumberInput, Textarea, Progress
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconEye, IconCurrencyRupee, IconCheck,
  IconCoin, IconWallet, IconFilter
} from '@tabler/icons-react';
import { loanAPI, employeeAPI } from '../../services/api';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

const LoanList = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewLoan, setViewLoan] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [form, setForm] = useState({ employeeId: null, totalAmount: 0, purpose: '' });
  const [statusFilter, setStatusFilter] = useState(null);
  const [empFilter, setEmpFilter] = useState(null);

  useEffect(() => { fetchEmployees(); fetchLoans(); }, []);
  useEffect(() => { fetchLoans(); }, [statusFilter, empFilter]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll({ status: 'Active', limit: 500 });
      setEmployees(res.data || []);
    } catch {}
  };

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (empFilter) params.employeeId = empFilter;
      const res = await loanAPI.getAll(params);
      setLoans(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load loans', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.employeeId || !form.totalAmount) {
      return notifications.show({ title: 'Validation', message: 'Employee and amount are required', color: 'orange' });
    }
    try {
      await loanAPI.create({ employeeId: form.employeeId, totalAmount: form.totalAmount, purpose: form.purpose });
      notifications.show({ title: 'Success', message: 'Loan added', color: 'green' });
      closeAdd();
      setForm({ employeeId: null, totalAmount: 0, purpose: '' });
      fetchLoans();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handlePayment = async () => {
    if (!payAmount || payAmount <= 0) {
      return notifications.show({ title: 'Validation', message: 'Enter a valid payment amount', color: 'orange' });
    }
    try {
      await loanAPI.makePayment(viewLoan._id, payAmount);
      notifications.show({ title: 'Success', message: 'Payment recorded', color: 'green' });
      setPayAmount(0);
      closeView();
      fetchLoans();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDelete = (loan) => {
    modals.openConfirmModal({
      title: 'Delete Loan',
      children: <Text size="sm">Delete loan for <b>{loan.employeeId?.name}</b>?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await loanAPI.delete(loan._id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Loan removed' });
          fetchLoans();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const totalLoaned = loans.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const totalPaid = loans.reduce((s, l) => s + (l.paidAmount || 0), 0);
  const totalRemaining = loans.reduce((s, l) => s + (l.remainingAmount || 0), 0);
  const activeCount = loans.filter(l => l.status === 'Active').length;

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
          <Title order={2}>Loan / Advance</Title>
          <Text c="dimmed" size="sm">Manage employee loans and salary advances</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={openAdd}>Add Loan</Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Total Loaned" value={fmt(totalLoaned)} color="blue" />
        <StatCard icon={<IconCheck size={22} />} label="Total Paid" value={fmt(totalPaid)} color="green" />
        <StatCard icon={<IconWallet size={22} />} label="Outstanding" value={fmt(totalRemaining)} color="red" />
        <StatCard icon={<IconCoin size={22} />} label="Active Loans" value={activeCount} color="orange" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group>
          <Select
            label="Employee" placeholder="All Employees"
            data={employees.map(e => ({ value: e._id, label: e.name }))}
            value={empFilter} onChange={setEmpFilter}
            clearable searchable w={220}
          />
          <Select
            label="Status" placeholder="All Status"
            data={['Active', 'Closed']}
            value={statusFilter} onChange={setStatusFilter}
            clearable w={160}
          />
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {loans.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCurrencyRupee size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No loan records</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Loan</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Purpose</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th ta="right">Paid</Table.Th>
                  <Table.Th ta="right">Remaining</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loans.map((loan, i) => {
                  const pct = loan.totalAmount > 0 ? Math.round((loan.paidAmount / loan.totalAmount) * 100) : 0;
                  return (
                    <Table.Tr key={loan._id}>
                      <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{loan.employeeId?.name || '-'}</Text>
                        <Text size="xs" c="dimmed">{loan.employeeId?.department || ''}</Text>
                      </Table.Td>
                      <Table.Td><Text size="sm">{loan.purpose || '-'}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm">{fmt(loan.totalAmount)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="green">{fmt(loan.paidAmount)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="red" fw={600}>{fmt(loan.remainingAmount)}</Text></Table.Td>
                      <Table.Td maw={120}>
                        <Progress value={pct} color={pct === 100 ? 'green' : 'blue'} size="sm" radius="xl" />
                        <Text size="xs" c="dimmed" ta="center">{pct}%</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={loan.status === 'Active' ? 'orange' : 'green'} size="sm">
                          {loan.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center">
                          {loan.status === 'Active' && (
                            <Tooltip label="Record Payment">
                              <ActionIcon variant="light" color="teal" size="sm"
                                onClick={() => { setViewLoan(loan); setPayAmount(0); openView(); }}>
                                <IconCurrencyRupee size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label="Delete">
                            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(loan)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* Add Loan Modal */}
      <Modal opened={addOpened} onClose={closeAdd} title={<Text fw={600}>Add Loan / Advance</Text>} size="sm">
        <Stack gap="sm">
          <Select
            label="Employee" placeholder="Select employee" required
            data={employees.map(e => ({ value: e._id, label: `${e.name}${e.department ? ` (${e.department})` : ''}` }))}
            value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })}
            searchable
          />
          <NumberInput
            label="Loan Amount (₹)" required min={1}
            value={form.totalAmount} onChange={(v) => setForm({ ...form, totalAmount: v })}
            leftSection={<IconCurrencyRupee size={16} />}
          />
          <Textarea
            label="Purpose" placeholder="Reason for loan/advance..."
            rows={2} value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeAdd}>Cancel</Button>
            <Button onClick={handleAdd}>Add Loan</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Payment Modal */}
      <Modal opened={viewOpened} onClose={closeView} title={<Text fw={600}>Record Payment</Text>} size="sm">
        {viewLoan && (
          <Stack gap="sm">
            <Paper p="sm" bg="gray.0" radius="sm">
              <Text size="sm" fw={600}>{viewLoan.employeeId?.name}</Text>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">Remaining: <b>{fmt(viewLoan.remainingAmount)}</b></Text>
                <Text size="xs" c="dimmed">Paid: <b>{fmt(viewLoan.paidAmount)}</b></Text>
              </Group>
            </Paper>
            <NumberInput
              label="Payment Amount (₹)" required min={1} max={viewLoan.remainingAmount}
              value={payAmount} onChange={setPayAmount}
              leftSection={<IconCurrencyRupee size={16} />}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={closeView}>Cancel</Button>
              <Button color="teal" leftSection={<IconCheck size={16} />} onClick={handlePayment}>
                Record Payment
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default LoanList;

import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon,
  Modal, NumberInput, Textarea, Progress
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconCurrencyRupee, IconCheck,
  IconCoin, IconWallet, IconHandGrab
} from '@tabler/icons-react';
import { loanAPI, employeeAPI } from '../../services/api';
import dayjs from 'dayjs';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

const LOAN_TYPE_OPTIONS = [
  { value: 'Loan',    label: 'Loan' },
  { value: 'Advance', label: 'Advance' },
];

const TYPE_COLOR = { Loan: 'blue', Advance: 'violet' };

const LoanList = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewLoan, setViewLoan] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [form, setForm] = useState({ employeeId: null, loanType: 'Loan', loanDate: new Date(), totalAmount: 0, purpose: '' });
  const [statusFilter, setStatusFilter] = useState(null);
  const [empFilter, setEmpFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => { fetchEmployees(); fetchLoans(); }, []);
  useEffect(() => { fetchLoans(); }, [statusFilter, empFilter, typeFilter]);

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
      if (statusFilter) params.status   = statusFilter;
      if (empFilter)    params.employeeId = empFilter;
      if (typeFilter)   params.loanType  = typeFilter;
      const res = await loanAPI.getAll(params);
      setLoans(res.data || []);
    } catch {
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
      await loanAPI.create({
        employeeId:  form.employeeId,
        loanType:    form.loanType,
        loanDate:    form.loanDate ? dayjs(form.loanDate).format('YYYY-MM-DD') : undefined,
        totalAmount: form.totalAmount,
        purpose:     form.purpose
      });
      notifications.show({ title: 'Success', message: `${form.loanType} added and recorded in accounts`, color: 'green' });
      closeAdd();
      setForm({ employeeId: null, loanType: 'Loan', loanDate: new Date(), totalAmount: 0, purpose: '' });
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
      notifications.show({ title: 'Success', message: 'Payment recorded and reflected in Cash Book', color: 'green' });
      setPayAmount(0);
      closeView();
      fetchLoans();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDelete = (loan) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      children: <Text size="sm">Delete {loan.loanType?.toLowerCase()} for <b>{loan.employeeId?.name}</b>?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await loanAPI.delete(loan._id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Record removed' });
          fetchLoans();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const totalLoaned    = loans.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const totalPaid      = loans.reduce((s, l) => s + (l.paidAmount || 0), 0);
  const totalRemaining = loans.reduce((s, l) => s + (l.remainingAmount || 0), 0);
  const activeCount    = loans.filter(l => l.status === 'Active').length;

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
          <Text c="dimmed" size="sm">Manage employee loans and salary advances — entries auto-posted to Day Book & Cash Book</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={openAdd}>Add Loan / Advance</Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Total Disbursed" value={fmt(totalLoaned)}    color="blue" />
        <StatCard icon={<IconCheck size={22} />}         label="Total Recovered" value={fmt(totalPaid)}      color="green" />
        <StatCard icon={<IconWallet size={22} />}        label="Outstanding"     value={fmt(totalRemaining)} color="red" />
        <StatCard icon={<IconCoin size={22} />}          label="Active"          value={activeCount}         color="orange" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group gap="md" wrap="wrap">
          <Select
            label="Employee" placeholder="All Employees"
            data={employees.map(e => ({ value: e._id, label: e.name }))}
            value={empFilter} onChange={setEmpFilter}
            clearable searchable w={220}
          />
          <Select
            label="Type" placeholder="All Types"
            data={LOAN_TYPE_OPTIONS}
            value={typeFilter} onChange={setTypeFilter}
            clearable w={140}
          />
          <Select
            label="Status" placeholder="All Status"
            data={['Active', 'Closed']}
            value={statusFilter} onChange={setStatusFilter}
            clearable w={140}
          />
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {loans.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCurrencyRupee size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No loan / advance records</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Loan / Advance</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Date</Table.Th>
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
                        <Badge variant="light" color={TYPE_COLOR[loan.loanType] || 'gray'} size="sm">
                          {loan.loanType || 'Loan'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{loan.employeeId?.name || '-'}</Text>
                        <Text size="xs" c="dimmed">{loan.employeeId?.department || ''}</Text>
                      </Table.Td>
                      <Table.Td><Text size="sm">{fmtDate(loan.loanDate || loan.createdAt)}</Text></Table.Td>
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
                            <Tooltip label="Record Recovery">
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

      {/* Add Loan / Advance Modal */}
      <Modal opened={addOpened} onClose={closeAdd} title={<Text fw={600}>Add Loan / Advance</Text>} size="sm">
        <Stack gap="sm">
          <Select
            label="Type" required
            data={LOAN_TYPE_OPTIONS}
            value={form.loanType}
            onChange={(v) => setForm({ ...form, loanType: v })}
          />
          <Select
            label="Employee" placeholder="Select employee" required
            data={employees.map(e => ({ value: e._id, label: `${e.name}${e.department ? ` (${e.department})` : ''}` }))}
            value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })}
            searchable
          />
          <DatePickerInput
            label="Date" required
            value={form.loanDate}
            onChange={(v) => setForm({ ...form, loanDate: v })}
            size="sm"
          />
          <NumberInput
            label={`${form.loanType} Amount (₹)`} required min={1}
            value={form.totalAmount} onChange={(v) => setForm({ ...form, totalAmount: v })}
            leftSection={<IconCurrencyRupee size={16} />}
          />
          <Textarea
            label="Purpose" placeholder="Reason..."
            rows={2} value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          />
          <Text size="xs" c="dimmed">A Payment voucher will be auto-created and posted to Day Book / Cash Book.</Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeAdd}>Cancel</Button>
            <Button onClick={handleAdd} leftSection={<IconHandGrab size={16} />}>
              Add {form.loanType}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Recovery Modal */}
      <Modal opened={viewOpened} onClose={closeView} title={<Text fw={600}>Record Recovery</Text>} size="sm">
        {viewLoan && (
          <Stack gap="sm">
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>{viewLoan.employeeId?.name}</Text>
                <Badge variant="light" color={TYPE_COLOR[viewLoan.loanType] || 'blue'} size="sm">{viewLoan.loanType}</Badge>
              </Group>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">Remaining: <b>{fmt(viewLoan.remainingAmount)}</b></Text>
                <Text size="xs" c="dimmed">Recovered: <b>{fmt(viewLoan.paidAmount)}</b></Text>
              </Group>
            </Paper>
            <NumberInput
              label="Recovery Amount (₹)" required min={1} max={viewLoan.remainingAmount}
              value={payAmount} onChange={setPayAmount}
              leftSection={<IconCurrencyRupee size={16} />}
            />
            <Text size="xs" c="dimmed">A Receipt voucher will be auto-created and posted to Day Book / Cash Book.</Text>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={closeView}>Cancel</Button>
              <Button color="teal" leftSection={<IconCheck size={16} />} onClick={handlePayment}>
                Record Recovery
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default LoanList;

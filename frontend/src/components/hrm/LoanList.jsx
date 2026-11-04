import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge, Table, ActionIcon,
  SimpleGrid, LoadingOverlay, Tooltip, ThemeIcon, Modal, NumberInput, Textarea, Progress,
  Switch, SegmentedControl, Divider, TextInput
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconCurrencyRupee, IconCheck, IconCoin, IconWallet, IconHandGrab, IconEye, IconEdit
} from '@tabler/icons-react';
import { loanAPI, employeeAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import {
  fmt, fmtDate, useBankLedgers
} from './hrmShared';
import StatCard from './HrmStatCard';

const TYPE_COLOR = { Loan: 'blue', Advance: 'violet' };
const emptyForm = () => ({
  employeeId: null, loanType: 'Advance', loanDate: new Date(), totalAmount: 0, emiAmount: 0, months: 0,
  deductFromSalary: true, purpose: '', disbursalMode: 'Cash', bankLedgerId: null
});

const LoanList = () => {
  const banks = useBankLedgers();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [detail, setDetail] = useState(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [rec, setRec] = useState({ amount: 0, date: new Date(), mode: 'Cash', bankLedgerId: null, remarks: '' });
  const [statusFilter, setStatusFilter] = useState('Active');
  const [empFilter, setEmpFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { employeeAPI.getAll({ status: 'Active', limit: 1000 }).then(r => setEmployees(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { fetchLoans(); }, [statusFilter, empFilter, typeFilter]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (empFilter) params.employeeId = empFilter;
      if (typeFilter) params.loanType = typeFilter;
      const res = await loanAPI.getAll(params);
      setLoans(res.data || []);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load loans', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => {
    const n = { ...f, [k]: v };
    // EMI ↔ months helper
    if (k === 'months' && v > 0 && n.totalAmount > 0) n.emiAmount = Math.ceil(n.totalAmount / v);
    if (k === 'totalAmount' && n.months > 0 && v > 0) n.emiAmount = Math.ceil(v / n.months);
    if (k === 'emiAmount') n.months = v > 0 && n.totalAmount > 0 ? Math.ceil(n.totalAmount / v) : 0;
    return n;
  });

  const startAdd = () => { setForm(emptyForm()); setEditId(null); openAdd(); };
  const startEdit = (loan) => {
    setForm({
      employeeId: loan.employeeId?._id, loanType: loan.loanType, loanDate: new Date(loan.loanDate || loan.createdAt),
      totalAmount: loan.totalAmount, emiAmount: loan.emiAmount || 0,
      months: loan.emiAmount ? Math.ceil(loan.totalAmount / loan.emiAmount) : 0,
      deductFromSalary: loan.deductFromSalary !== false, purpose: loan.purpose || '',
      disbursalMode: loan.disbursalMode || 'Cash', bankLedgerId: null, locked: (loan.paidAmount || 0) > 0
    });
    setEditId(loan._id);
    openAdd();
  };

  const handleSave = async () => {
    if (!form.employeeId || !(form.totalAmount > 0)) {
      return notifications.show({ title: 'Validation', message: 'Employee and amount are required', color: 'orange' });
    }
    if (form.emiAmount > form.totalAmount) {
      return notifications.show({ title: 'Validation', message: 'Instalment cannot exceed the amount', color: 'orange' });
    }
    setBusy(true);
    try {
      const payload = {
        employeeId: form.employeeId, loanType: form.loanType, loanDate: localDateStr(form.loanDate),
        totalAmount: form.totalAmount, emiAmount: form.emiAmount, deductFromSalary: form.deductFromSalary,
        purpose: form.purpose, disbursalMode: form.disbursalMode, bankLedgerId: form.bankLedgerId
      };
      if (editId) {
        await loanAPI.update(editId, payload);
        notifications.show({ title: 'Saved', message: 'Loan updated', color: 'green' });
      } else {
        await loanAPI.create(payload);
        notifications.show({ title: 'Saved', message: `${form.loanType} disbursed — Payment voucher posted to ${form.disbursalMode} Book`, color: 'green' });
      }
      closeAdd();
      fetchLoans();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  const showDetail = async (loan) => {
    setDetail(loan);
    setRec({ amount: Math.min(loan.emiAmount || loan.remainingAmount, loan.remainingAmount), date: new Date(), mode: 'Cash', bankLedgerId: banks[0]?.value || null, remarks: '' });
    openDetail();
    try { const r = await loanAPI.getById(loan._id); setDetail(r.data); } catch { /* keep list copy */ }
  };

  const recordRecovery = async () => {
    if (!(rec.amount > 0)) return notifications.show({ title: 'Validation', message: 'Enter a valid amount', color: 'orange' });
    setBusy(true);
    try {
      const r = await loanAPI.makePayment(detail._id, { ...rec, date: localDateStr(rec.date) });
      notifications.show({ title: 'Recovery recorded', message: `Receipt voucher posted to ${rec.mode} Book`, color: 'green' });
      const fresh = await loanAPI.getById(detail._id).catch(() => r);
      setDetail(fresh.data);
      setRec(x => ({ ...x, amount: 0, remarks: '' }));
      fetchLoans();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  const removeRecovery = (rp) => modals.openConfirmModal({
    title: 'Delete Recovery',
    children: <Text size="sm">Delete the {fmt(rp.amount)} recovery of {fmtDate(rp.date)}? Its receipt voucher is reversed.</Text>,
    labels: { confirm: 'Delete', cancel: 'Close' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await loanAPI.deleteRepayment(detail._id, rp._id);
        const fresh = await loanAPI.getById(detail._id);
        setDetail(fresh.data);
        fetchLoans();
      } catch (err) {
        notifications.show({ title: 'Error', message: err.message, color: 'red' });
      }
    }
  });

  const handleDelete = (loan) => modals.openConfirmModal({
    title: 'Delete Record',
    children: <Text size="sm">Delete this {loan.loanType?.toLowerCase()} of {fmt(loan.totalAmount)} for <b>{loan.employeeId?.name}</b>? The disbursal and cash/bank recovery vouchers are reversed in accounts.</Text>,
    labels: { confirm: 'Delete', cancel: 'Close' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await loanAPI.delete(loan._id);
        notifications.show({ title: 'Deleted', color: 'green', message: 'Record removed and accounts reversed' });
        closeDetail();
        fetchLoans();
      } catch (err) {
        notifications.show({ title: 'Cannot delete', message: err.message, color: 'red' });
      }
    }
  });

  const totalLoaned = loans.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const totalPaid = loans.reduce((s, l) => s + (l.paidAmount || 0), 0);
  const totalRemaining = loans.reduce((s, l) => s + (l.remainingAmount || 0), 0);
  const monthlyEmi = loans.filter(l => l.status === 'Active' && l.deductFromSalary !== false)
    .reduce((s, l) => s + Math.min(l.emiAmount || (l.loanType === 'Advance' ? l.remainingAmount : 0), l.remainingAmount), 0);

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Loan / Advance</Title>
          <Text c="dimmed" size="sm">Staff loans & salary advances — EMI is recovered automatically when salary is paid</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={startAdd}>Add Loan / Advance</Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Disbursed" value={fmt(totalLoaned)} color="blue" />
        <StatCard icon={<IconCheck size={22} />} label="Recovered" value={fmt(totalPaid)} color="green" />
        <StatCard icon={<IconWallet size={22} />} label="Outstanding" value={fmt(totalRemaining)} color="red" />
        <StatCard icon={<IconCoin size={22} />} label="Next Salary Recovery" value={fmt(monthlyEmi)} color="orange" sub="EMI + advances due" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Employee" placeholder="All Employees" searchable clearable w={240}
            data={employees.map(e => ({ value: e._id, label: `${e.employeeCode ? e.employeeCode + ' · ' : ''}${e.name}` }))}
            value={empFilter} onChange={setEmpFilter} />
          <Select label="Type" placeholder="All Types" data={['Loan', 'Advance']} value={typeFilter} onChange={setTypeFilter} clearable w={140} />
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} data={['Active', 'Closed', 'All']} />
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {loans.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCurrencyRupee size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No loan / advance records</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={startAdd}>Add Loan / Advance</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={1000}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Purpose</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th ta="right">EMI</Table.Th>
                  <Table.Th ta="right">Recovered</Table.Th>
                  <Table.Th ta="right">Balance</Table.Th>
                  <Table.Th w={110}>Progress</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loans.map((loan) => {
                  const pct = loan.totalAmount > 0 ? Math.round(((loan.paidAmount || 0) / loan.totalAmount) * 100) : 0;
                  return (
                    <Table.Tr key={loan._id}>
                      <Table.Td><Text size="sm">{fmtDate(loan.loanDate || loan.createdAt)}</Text></Table.Td>
                      <Table.Td><Badge variant="light" color={TYPE_COLOR[loan.loanType] || 'gray'} size="sm">{loan.loanType || 'Loan'}</Badge></Table.Td>
                      <Table.Td style={{ cursor: 'pointer' }} onClick={() => showDetail(loan)}>
                        <Text size="sm" fw={600} c="blue">{loan.employeeId?.name || '-'}</Text>
                        <Text size="xs" c="dimmed">{loan.employeeId?.employeeCode || loan.employeeId?.department || ''}</Text>
                      </Table.Td>
                      <Table.Td><Text size="sm" lineClamp={1} maw={160}>{loan.purpose || '-'}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm">{fmt(loan.totalAmount)}</Text></Table.Td>
                      <Table.Td ta="right">
                        {loan.deductFromSalary === false
                          ? <Text size="xs" c="dimmed">manual</Text>
                          : <Text size="sm">{loan.emiAmount ? fmt(loan.emiAmount) : (loan.loanType === 'Advance' ? 'Full' : '—')}</Text>}
                      </Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="green">{fmt(loan.paidAmount)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="red" fw={600}>{fmt(loan.remainingAmount)}</Text></Table.Td>
                      <Table.Td>
                        <Progress value={pct} color={pct === 100 ? 'green' : 'blue'} size="sm" radius="xl" />
                        <Text size="xs" c="dimmed" ta="center">{pct}%</Text>
                      </Table.Td>
                      <Table.Td><Badge variant="light" color={loan.status === 'Active' ? 'orange' : 'green'} size="sm">{loan.status}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center" wrap="nowrap">
                          <Tooltip label="Details / Recovery"><ActionIcon variant="light" color="teal" size="sm" onClick={() => showDetail(loan)}><IconEye size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Edit"><ActionIcon variant="light" color="blue" size="sm" onClick={() => startEdit(loan)}><IconEdit size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Delete"><ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(loan)}><IconTrash size={16} /></ActionIcon></Tooltip>
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

      {/* Add / Edit */}
      <Modal opened={addOpened} onClose={closeAdd} title={<Text fw={600}>{editId ? 'Edit' : 'Add'} Loan / Advance</Text>} size="md">
        <Stack gap="sm">
          <SegmentedControl value={form.loanType} onChange={(v) => set('loanType', v)} disabled={!!editId}
            data={[{ value: 'Advance', label: 'Salary Advance' }, { value: 'Loan', label: 'Loan (EMI)' }]} />
          <Select label="Employee" placeholder="Select employee" required searchable disabled={!!editId}
            data={employees.map(e => ({ value: e._id, label: `${e.employeeCode ? e.employeeCode + ' · ' : ''}${e.name}` }))}
            value={form.employeeId} onChange={(v) => set('employeeId', v)} />
          <SimpleGrid cols={2}>
            <DatePickerInput label="Date" required value={form.loanDate} onChange={(v) => set('loanDate', v || new Date())} valueFormat="DD/MM/YYYY" disabled={form.locked} />
            <NumberInput label="Amount (₹)" required min={1} value={form.totalAmount} onChange={(v) => set('totalAmount', Number(v) || 0)} disabled={form.locked} thousandSeparator="," />
          </SimpleGrid>
          <Switch label="Recover from salary automatically" checked={form.deductFromSalary} onChange={(e) => set('deductFromSalary', e.currentTarget.checked)} />
          {form.deductFromSalary && (
            <SimpleGrid cols={2}>
              <NumberInput label="Monthly Instalment (₹)" min={0} value={form.emiAmount} onChange={(v) => set('emiAmount', Number(v) || 0)}
                description={form.loanType === 'Advance' ? '0 = full balance next salary' : '0 = no auto recovery'} />
              <NumberInput label="No. of Months" min={0} value={form.months} onChange={(v) => set('months', Number(v) || 0)} description="Fills the instalment" />
            </SimpleGrid>
          )}
          {!editId && (
            <>
              <SegmentedControl value={form.disbursalMode} onChange={(v) => set('disbursalMode', v)} data={[{ value: 'Cash', label: 'Paid in Cash' }, { value: 'Bank', label: 'Paid from Bank' }]} />
              {form.disbursalMode === 'Bank' && <Select label="Bank" data={banks} value={form.bankLedgerId} onChange={(v) => set('bankLedgerId', v)} placeholder="Select bank" />}
            </>
          )}
          <Textarea label="Purpose" rows={2} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} />
          <Text size="xs" c="dimmed">
            {editId ? (form.locked ? 'Amount and date are locked because recoveries exist.' : 'Changing amount/date re-posts the disbursal voucher.')
              : `Posts a Payment voucher: Dr Employee ${form.loanType === 'Advance' ? 'Advance' : 'Loan'} A/c, Cr ${form.disbursalMode === 'Cash' ? 'Cash in Hand' : 'Bank'}.`}
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeAdd}>Close</Button>
            <Button onClick={handleSave} loading={busy} leftSection={<IconHandGrab size={16} />}>{editId ? 'Save' : `Disburse ${form.loanType}`}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Detail + recovery */}
      <Modal opened={detailOpened} onClose={closeDetail} size="lg"
        title={<Text fw={600}>{detail?.loanType} — {detail?.employeeId?.name}</Text>}>
        {detail && (
          <Stack gap="sm">
            <SimpleGrid cols={4}>
              <div><Text size="xs" c="dimmed">Amount</Text><Text fw={600}>{fmt(detail.totalAmount)}</Text></div>
              <div><Text size="xs" c="dimmed">Recovered</Text><Text fw={600} c="green">{fmt(detail.paidAmount)}</Text></div>
              <div><Text size="xs" c="dimmed">Balance</Text><Text fw={700} c="red">{fmt(detail.remainingAmount)}</Text></div>
              <div><Text size="xs" c="dimmed">EMI</Text><Text fw={600}>{detail.deductFromSalary === false ? 'Manual' : detail.emiAmount ? fmt(detail.emiAmount) : (detail.loanType === 'Advance' ? 'Full balance' : '—')}</Text></div>
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Disbursed {fmtDate(detail.loanDate)} by {detail.disbursalMode || 'Cash'}{detail.disbursalVoucherId?.voucherNumber ? ` · Voucher ${detail.disbursalVoucherId.voucherNumber}` : ''}{detail.purpose ? ` · ${detail.purpose}` : ''}
            </Text>

            <Divider label="Recovery history" labelPosition="left" />
            {(detail.repayments || []).length || detail.legacyPaid ? (
              <Table fz="sm" verticalSpacing={4}>
                <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Mode</Table.Th><Table.Th>Voucher</Table.Th><Table.Th>Remarks</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {detail.legacyPaid > 0 && (
                    <Table.Tr><Table.Td colSpan={4}><Text size="xs" c="dimmed">Recovered before history tracking</Text></Table.Td><Table.Td ta="right">{fmt(detail.legacyPaid)}</Table.Td><Table.Td /></Table.Tr>
                  )}
                  {[...(detail.repayments || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).map(rp => (
                    <Table.Tr key={rp._id}>
                      <Table.Td>{fmtDate(rp.date)}</Table.Td>
                      <Table.Td><Badge size="xs" variant="light" color={rp.mode === 'Salary' ? 'indigo' : rp.mode === 'Bank' ? 'cyan' : 'gray'}>{rp.mode}</Badge></Table.Td>
                      <Table.Td><Text size="xs">{rp.voucherId?.voucherNumber || '-'}</Text></Table.Td>
                      <Table.Td><Text size="xs">{rp.remarks || ''}</Text></Table.Td>
                      <Table.Td ta="right">{fmt(rp.amount)}</Table.Td>
                      <Table.Td>
                        {rp.mode !== 'Salary' && <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeRecovery(rp)}><IconTrash size={12} /></ActionIcon>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : <Text size="sm" c="dimmed">No recoveries yet</Text>}

            {detail.status === 'Active' && (
              <>
                <Divider label="Record cash / bank recovery" labelPosition="left" />
                <SimpleGrid cols={3}>
                  <NumberInput label="Amount (₹)" min={1} max={detail.remainingAmount} value={rec.amount} onChange={(v) => setRec({ ...rec, amount: Number(v) || 0 })} />
                  <DatePickerInput label="Date" value={rec.date} onChange={(v) => setRec({ ...rec, date: v || new Date() })} valueFormat="DD/MM/YYYY" maxDate={new Date()} />
                  <Select label="Received in" data={['Cash', 'Bank']} value={rec.mode} onChange={(v) => setRec({ ...rec, mode: v })} />
                </SimpleGrid>
                {rec.mode === 'Bank' && <Select label="Bank" data={banks} value={rec.bankLedgerId} onChange={(v) => setRec({ ...rec, bankLedgerId: v })} />}
                <TextInput label="Remarks" value={rec.remarks} onChange={(e) => setRec({ ...rec, remarks: e.target.value })} />
                <Text size="xs" c="dimmed">Salary recoveries happen automatically on salary payment — use this only for money paid back directly.</Text>
              </>
            )}
            <Group justify="space-between" mt="xs">
              <Button variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(detail)}>Delete</Button>
              <Group gap="xs">
                <Button variant="default" onClick={closeDetail}>Close</Button>
                {detail.status === 'Active' && <Button color="teal" leftSection={<IconCheck size={16} />} loading={busy} onClick={recordRecovery}>Record Recovery</Button>}
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default LoanList;

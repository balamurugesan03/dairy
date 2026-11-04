import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge, Table, ActionIcon,
  SimpleGrid, LoadingOverlay, Tooltip, ThemeIcon, Modal, Checkbox, SegmentedControl,
  NumberInput, Textarea, Divider, Menu, Alert
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCurrencyRupee, IconPlus, IconCheck, IconCash, IconReceipt, IconEye, IconFileInvoice,
  IconTrash, IconPrinter, IconArrowBackUp, IconEdit, IconChevronDown, IconInfoCircle
} from '@tabler/icons-react';
import { salaryAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import { useCompany } from '../../context/CompanyContext';
import {
  MONTHS, yearOptions, fmt, num, fmtDate, periodLabel, monthName, payrollStatusColor, useBankLedgers, payrollLines, grossOf, printPayslips, printSalaryRegister
} from './hrmShared';
import StatCard from './HrmStatCard';

const SalaryList = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { selectedCompany } = useCompany();
  const orgName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const banks = useBankLedgers();

  const now = new Date();
  const month = params.get('month') || String(now.getMonth() + 1);
  const year = params.get('year') || String(now.getFullYear());
  const setPeriod = (m, y) => setParams({ month: m, year: y });

  const [salaries, setSalaries] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [view, setView] = useState(null);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [pay, setPay] = useState(null);          // { ids, mode, bankLedgerId, date }
  const [payOpened, { open: openPay, close: closePay }] = useDisclosure(false);
  const [editRec, setEditRec] = useState(null);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchSalaries(); }, [month, year]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await salaryAPI.getAll({ month: Number(month), year: Number(year) });
      setSalaries(res.data || []);
      setTotals(res.totals || {});
      setSelected(new Set());
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load payroll', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const shown = useMemo(() => (statusFilter === 'All' ? salaries : salaries.filter(s => s.status === statusFilter)), [salaries, statusFilter]);
  const count = (s) => salaries.filter(r => r.status === s).length;
  const selectedRecs = salaries.filter(s => selected.has(s._id));
  const selPending = selectedRecs.filter(s => s.status === 'Pending');
  const selApproved = selectedRecs.filter(s => s.status === 'Approved');
  const allShownSelected = shown.length > 0 && shown.every(s => selected.has(s._id));
  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      const errs = res?.errors || [];
      notifications.show({
        title: okMsg(res), color: errs.length ? 'orange' : 'green', autoClose: errs.length ? false : 4000,
        message: errs.length ? errs.map(e => `${e.name}: ${e.message}`).join('\n') : ''
      });
      fetchSalaries();
      return true;
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const approve = (recs) => modals.openConfirmModal({
    title: 'Approve Salary',
    children: <Text size="sm">Approve salary for {recs.length === 1 ? <b>{recs[0].employeeId?.name}</b> : `${recs.length} employees`} — net {fmt(recs.reduce((s, r) => s + r.netSalary, 0))}?</Text>,
    labels: { confirm: 'Approve', cancel: 'Close' },
    confirmProps: { color: 'green' },
    onConfirm: () => run(
      () => (recs.length === 1 ? salaryAPI.approve(recs[0]._id) : salaryAPI.bulkApprove({ ids: recs.map(r => r._id) })),
      (r) => `Approved ${r?.count ?? 1}`
    )
  });

  const startPay = (recs) => {
    const modes = [...new Set(recs.map(r => r.employeeId?.paymentMode || 'Cash'))];
    setPay({ recs, mode: recs.length > 1 ? 'Employee' : modes[0], bankLedgerId: banks[0]?.value || null, date: new Date() });
    openPay();
  };

  const confirmPay = async () => {
    const { recs, mode, bankLedgerId, date } = pay;
    const needsBank = mode === 'Bank' || (mode === 'Employee' && recs.some(r => r.employeeId?.paymentMode === 'Bank'));
    if (needsBank && !bankLedgerId && banks.length) {
      return notifications.show({ title: 'Select bank', message: 'Choose the bank account to pay from', color: 'orange' });
    }
    const body = { paymentMode: mode, bankLedgerId, paidDate: localDateStr(date) };
    const ok = await run(
      () => (recs.length === 1
        ? salaryAPI.markPaid(recs[0]._id, { ...body, paymentMode: mode === 'Employee' ? (recs[0].employeeId?.paymentMode || 'Cash') : mode })
        : salaryAPI.bulkPay({ ...body, ids: recs.map(r => r._id) })),
      (r) => `Salary paid${r?.count != null ? ` for ${r.count}` : ''} — posted to Cash/Bank Book`
    );
    if (ok) { closePay(); closeView(); }
  };

  const revert = (rec) => modals.openConfirmModal({
    title: 'Revert Payment',
    children: <Text size="sm">Undo the salary payment for <b>{rec.employeeId?.name}</b>? The payment voucher {rec.voucherId?.voucherNumber ? <b>{rec.voucherId.voucherNumber}</b> : ''} is deleted and any loan recoveries from this salary are reversed. Status goes back to Approved.</Text>,
    labels: { confirm: 'Revert', cancel: 'Close' },
    confirmProps: { color: 'orange' },
    onConfirm: async () => { if (await run(() => salaryAPI.revertPayment(rec._id), () => 'Payment reverted')) closeView(); }
  });

  const remove = (rec) => modals.openConfirmModal({
    title: 'Delete Payroll',
    children: <Text size="sm">Delete the {periodLabel(rec.month, rec.year)} payroll of <b>{rec.employeeId?.name}</b>?</Text>,
    labels: { confirm: 'Delete', cancel: 'Close' },
    confirmProps: { color: 'red' },
    onConfirm: async () => { if (await run(() => salaryAPI.delete(rec._id), () => 'Payroll deleted')) closeView(); }
  });

  const startEdit = (rec) => {
    setEditRec({
      id: rec._id, name: rec.employeeId?.name,
      bonus: rec.earnings?.bonus || 0, arrears: rec.earnings?.arrears || 0,
      otherDeduction: rec.deductions?.other || 0, overtimeHours: rec.earnings?.overtimeHours || 0,
      remarks: rec.remarks || '', otTouched: false
    });
    openEdit();
  };
  const saveEdit = async () => {
    const { id, bonus, arrears, otherDeduction, overtimeHours, remarks, otTouched } = editRec;
    const overrides = { bonus, arrears, otherDeduction, remarks, ...(otTouched ? { overtimeHours } : {}) };
    if (await run(() => salaryAPI.update(id, { overrides }), () => 'Payroll recalculated')) { closeEdit(); closeView(); }
  };

  const openRecord = (rec) => { setView(rec); openView(); };
  const printSel = () => printPayslips((selectedRecs.length ? selectedRecs : shown), orgName);

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Payroll — {monthName(month)} {year}</Title>
          <Text c="dimmed" size="sm">Process → Approve → Pay. Paying posts a Payment voucher (Salary Dr / Cash-Bank, PF, ESI, PT, Loan Cr) and recovers loan EMIs.</Text>
        </div>
        <Group>
          <Menu shadow="md">
            <Menu.Target><Button variant="default" leftSection={<IconPrinter size={16} />} rightSection={<IconChevronDown size={14} />} disabled={!salaries.length}>Print</Button></Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => printSalaryRegister(shown, { orgName, month, year })}>Salary Register (A4 landscape)</Menu.Item>
              <Menu.Item onClick={printSel}>Payslips {selectedRecs.length ? `(${selectedRecs.length} selected)` : `(all ${shown.length})`}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate(`/hrm/salary/process?month=${month}&year=${year}`)}>Process Salary</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Gross Salary" value={fmt(totals.gross)} color="blue" sub={`${totals.count || 0} employees`} />
        <StatCard icon={<IconReceipt size={22} />} label="Deductions" value={fmt(totals.deductions)} color="orange" sub={`PF ${fmt(totals.pf)} · Loans ${fmt(totals.loanRecovery)}`} />
        <StatCard icon={<IconCash size={22} />} label="Net Payable" value={fmt(totals.net)} color="teal" />
        <StatCard icon={<IconCheck size={22} />} label="Paid" value={`${totals.paid || 0} / ${totals.count || 0}`} color="green" sub={fmt(totals.paidAmount)} />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <Group justify="space-between" align="flex-end">
          <Group align="flex-end">
            <Select label="Month" data={MONTHS} value={month} onChange={(v) => v && setPeriod(v, year)} w={150} />
            <Select label="Year" data={yearOptions()} value={year} onChange={(v) => v && setPeriod(month, v)} w={110} />
            <SegmentedControl value={statusFilter} onChange={setStatusFilter}
              data={['All', 'Pending', 'Approved', 'Paid'].map(s => ({ value: s, label: s === 'All' ? `All (${salaries.length})` : `${s} (${count(s)})` }))} />
          </Group>
          {selected.size > 0 && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">{selected.size} selected</Text>
              <Button size="xs" color="green" variant="light" leftSection={<IconCheck size={14} />} disabled={!selPending.length || busy} onClick={() => approve(selPending)}>
                Approve ({selPending.length})
              </Button>
              <Button size="xs" color="teal" leftSection={<IconCash size={14} />} disabled={!selApproved.length || busy} onClick={() => startPay(selApproved)}>
                Pay ({selApproved.length})
              </Button>
            </Group>
          )}
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {salaries.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconFileInvoice size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No payroll for {monthName(month)} {year}</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => navigate(`/hrm/salary/process?month=${month}&year=${year}`)}>Process Salary</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={1100}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36}><Checkbox checked={allShownSelected} indeterminate={!allShownSelected && selected.size > 0}
                    onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map(s => s._id)))} /></Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th ta="center">Paid Days</Table.Th>
                  <Table.Th ta="right">Gross</Table.Th>
                  <Table.Th ta="right">PF/ESI/PT</Table.Th>
                  <Table.Th ta="right">Loan/Adv</Table.Th>
                  <Table.Th ta="right">Other</Table.Th>
                  <Table.Th ta="right">Net Salary</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((s) => {
                  const d = s.deductions || {};
                  const structured = !!s.earnings && (s.grossSalary > 0);
                  return (
                    <Table.Tr key={s._id}>
                      <Table.Td><Checkbox checked={selected.has(s._id)} onChange={() => toggle(s._id)} /></Table.Td>
                      <Table.Td style={{ cursor: 'pointer' }} onClick={() => openRecord(s)}>
                        <Text size="sm" fw={600} c="blue">{s.employeeId?.name || '-'}</Text>
                        <Text size="xs" c="dimmed">{[s.employeeId?.employeeCode, s.employeeId?.role].filter(Boolean).join(' · ')}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        {s.attendance?.daysInMonth ? (
                          <Text size="sm">{num(s.attendance.paidDays)}<Text span size="xs" c="dimmed">/{s.attendance.daysInMonth}</Text>
                            {s.attendance.lopDays > 0 && <Text size="xs" c="red">LOP {num(s.attendance.lopDays)}</Text>}</Text>
                        ) : <Text size="xs" c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td ta="right"><Text size="sm">{fmt(grossOf(s))}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="red">{fmt((d.pf || 0) + (d.esi || 0) + (d.professionalTax || 0))}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="red">{fmt((d.loanRecovery || 0) + (d.advanceRecovery || 0))}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="red">{fmt(structured ? d.other : s.deduction)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" fw={700} c="teal">{fmt(s.netSalary)}</Text></Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={payrollStatusColor(s.status)} size="sm">{s.status}</Badge>
                        {s.status === 'Paid' && <Text size="xs" c="dimmed">{fmtDate(s.paidDate)} · {s.paymentMode || 'Cash'}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {s.status === 'Pending' && <Tooltip label="Approve"><ActionIcon variant="light" color="green" size="sm" onClick={() => approve([s])}><IconCheck size={16} /></ActionIcon></Tooltip>}
                          {s.status === 'Approved' && <Tooltip label="Pay"><ActionIcon variant="light" color="teal" size="sm" onClick={() => startPay([s])}><IconCash size={16} /></ActionIcon></Tooltip>}
                          {s.status !== 'Paid' && <Tooltip label="Edit bonus / deductions"><ActionIcon variant="light" color="blue" size="sm" onClick={() => startEdit(s)}><IconEdit size={16} /></ActionIcon></Tooltip>}
                          {s.status === 'Paid' && <Tooltip label="Revert payment"><ActionIcon variant="light" color="orange" size="sm" onClick={() => revert(s)}><IconArrowBackUp size={16} /></ActionIcon></Tooltip>}
                          <Tooltip label="Payslip"><ActionIcon variant="light" color="gray" size="sm" onClick={() => openRecord(s)}><IconEye size={16} /></ActionIcon></Tooltip>
                          {s.status !== 'Paid' && <Tooltip label="Delete"><ActionIcon variant="light" color="red" size="sm" onClick={() => remove(s)}><IconTrash size={16} /></ActionIcon></Tooltip>}
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

      {/* Payslip view */}
      <Modal opened={viewOpened} onClose={closeView} size="lg" title={<Text fw={600}>Payslip — {view && periodLabel(view.month, view.year)}</Text>}>
        {view && <PayslipView rec={view} />}
        {view && (
          <Group justify="space-between" mt="md">
            <Group gap="xs">
              {view.status === 'Pending' && <Button size="xs" color="green" variant="light" leftSection={<IconCheck size={14} />} onClick={() => { closeView(); approve([view]); }}>Approve</Button>}
              {view.status === 'Approved' && <Button size="xs" color="teal" leftSection={<IconCash size={14} />} onClick={() => startPay([view])}>Pay</Button>}
              {view.status !== 'Paid' && <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={() => startEdit(view)}>Edit</Button>}
              {view.status === 'Paid' && <Button size="xs" color="orange" variant="light" leftSection={<IconArrowBackUp size={14} />} onClick={() => revert(view)}>Revert Payment</Button>}
            </Group>
            <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />} onClick={() => printPayslips([view], orgName)}>Print Payslip</Button>
          </Group>
        )}
      </Modal>

      {/* Pay */}
      <Modal opened={payOpened} onClose={closePay} title={<Text fw={600}>Pay Salary</Text>} size="md">
        {pay && (
          <Stack gap="sm">
            <Paper p="sm" bg="teal.0" radius="sm">
              <Group justify="space-between">
                <Text size="sm">{pay.recs.length === 1 ? pay.recs[0].employeeId?.name : `${pay.recs.length} employees`}</Text>
                <Text fw={700} c="teal">{fmt(pay.recs.reduce((s, r) => s + r.netSalary, 0))}</Text>
              </Group>
            </Paper>
            <SegmentedControl value={pay.mode} onChange={(v) => setPay({ ...pay, mode: v })}
              data={[...(pay.recs.length > 1 ? [{ value: 'Employee', label: 'As per employee' }] : []), { value: 'Cash', label: 'Cash' }, { value: 'Bank', label: 'Bank' }]} />
            {pay.mode === 'Employee' && (
              <Text size="xs" c="dimmed">
                Cash: {pay.recs.filter(r => (r.employeeId?.paymentMode || 'Cash') === 'Cash').length} ·
                Bank: {pay.recs.filter(r => r.employeeId?.paymentMode === 'Bank').length}
              </Text>
            )}
            {(pay.mode === 'Bank' || (pay.mode === 'Employee' && pay.recs.some(r => r.employeeId?.paymentMode === 'Bank'))) && (
              <Select label="Pay from Bank" data={banks} value={pay.bankLedgerId} onChange={(v) => setPay({ ...pay, bankLedgerId: v })}
                placeholder={banks.length ? 'Select bank' : 'No bank ledger — a "Bank Account" ledger will be created'} />
            )}
            <DatePickerInput label="Payment Date" value={pay.date} onChange={(v) => setPay({ ...pay, date: v || new Date() })} valueFormat="DD/MM/YYYY" maxDate={new Date()} />
            <Alert icon={<IconInfoCircle size={16} />} variant="light" color="blue">
              A Payment voucher is posted per employee: Dr SALARY & ALLOWANCES, Cr {pay.mode === 'Cash' ? 'Cash in Hand' : pay.mode === 'Bank' ? 'Bank' : 'Cash/Bank'} (net), with PF / ESI / PT / Loan recoveries credited to their ledgers.
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" onClick={closePay}>Close</Button>
              <Button color="teal" leftSection={<IconCash size={16} />} loading={busy} onClick={confirmPay}>Confirm Payment</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Edit */}
      <Modal opened={editOpened} onClose={closeEdit} title={<Text fw={600}>Edit Payroll — {editRec?.name}</Text>} size="sm">
        {editRec && (
          <Stack gap="sm">
            <SimpleGrid cols={2}>
              <NumberInput label="Bonus / Incentive" min={0} value={editRec.bonus} onChange={(v) => setEditRec({ ...editRec, bonus: Number(v) || 0 })} />
              <NumberInput label="Arrears" min={0} value={editRec.arrears} onChange={(v) => setEditRec({ ...editRec, arrears: Number(v) || 0 })} />
              <NumberInput label="Overtime Hours" min={0} decimalScale={1} value={editRec.overtimeHours} onChange={(v) => setEditRec({ ...editRec, overtimeHours: Number(v) || 0, otTouched: true })} />
              <NumberInput label="Other Deduction" min={0} value={editRec.otherDeduction} onChange={(v) => setEditRec({ ...editRec, otherDeduction: Number(v) || 0 })} />
            </SimpleGrid>
            <Textarea label="Remarks" autosize minRows={2} value={editRec.remarks} onChange={(e) => setEditRec({ ...editRec, remarks: e.target.value })} />
            <Text size="xs" c="dimmed">Saving recalculates from the latest attendance and sets the status back to Pending. Loan recovery amounts are changed from Process Salary.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeEdit}>Close</Button>
              <Button loading={busy} onClick={saveEdit}>Recalculate & Save</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

const LineList = ({ items, color }) => (
  <Stack gap={4}>
    {items.length ? items.map(([l, v]) => (
      <Group key={l} justify="space-between"><Text size="sm">{l}</Text><Text size="sm" c={color}>{fmt(v)}</Text></Group>
    )) : <Text size="sm" c="dimmed">—</Text>}
  </Stack>
);

const PayslipView = ({ rec }) => {
  const emp = rec.employeeId || {};
  const a = rec.attendance || {};
  const { earnings, deductions } = payrollLines(rec);
  return (
    <Stack gap="sm">
      <Paper p="sm" bg="gray.0" radius="sm">
        <Group justify="space-between">
          <div>
            <Text fw={600}>{emp.name} <Text span size="xs" c="dimmed">{emp.employeeCode}</Text></Text>
            <Text size="xs" c="dimmed">{[emp.department, emp.role].filter(Boolean).join(' · ')}</Text>
          </div>
          <Stack gap={2} align="flex-end">
            <Badge variant="light" color={payrollStatusColor(rec.status)}>{rec.status}</Badge>
            {rec.status === 'Paid' && <Text size="xs" c="dimmed">{fmtDate(rec.paidDate)} · {rec.paymentMode}{rec.bankLedgerId?.ledgerName ? ` · ${rec.bankLedgerId.ledgerName}` : ''}{rec.voucherId?.voucherNumber ? ` · ${rec.voucherId.voucherNumber}` : ''}</Text>}
          </Stack>
        </Group>
      </Paper>
      {a.daysInMonth > 0 && (
        <Group gap="xs">
          <Badge variant="outline">Days {a.daysInMonth}</Badge>
          <Badge variant="light" color="green">Paid {num(a.paidDays)}</Badge>
          {a.lopDays > 0 && <Badge variant="light" color="red">LOP {num(a.lopDays)}</Badge>}
          <Badge variant="light" color="gray">P {a.present} · H {a.halfDay} · A {a.absent} · L {a.paidLeave + a.unpaidLeave}</Badge>
        </Group>
      )}
      <SimpleGrid cols={2}>
        <Paper withBorder p="sm" radius="sm">
          <Text fw={600} size="sm" mb={6}>Earnings</Text>
          <LineList items={earnings} />
          <Divider my={6} />
          <Group justify="space-between"><Text size="sm" fw={700}>Gross</Text><Text size="sm" fw={700}>{fmt(grossOf(rec))}</Text></Group>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text fw={600} size="sm" mb={6}>Deductions</Text>
          <LineList items={deductions} color="red" />
          <Divider my={6} />
          <Group justify="space-between"><Text size="sm" fw={700}>Total</Text><Text size="sm" fw={700} c="red">{fmt(rec.deduction)}</Text></Group>
        </Paper>
      </SimpleGrid>
      <Paper p="md" bg="teal.0" radius="sm">
        <Group justify="space-between"><Text fw={600} size="lg">Net Pay</Text><Text fw={700} size="xl" c="teal">{fmt(rec.netSalary)}</Text></Group>
      </Paper>
      {rec.remarks && <Text size="sm" c="dimmed">Remarks: {rec.remarks}</Text>}
    </Stack>
  );
};

export default SalaryList;

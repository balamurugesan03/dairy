import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, NumberInput, Table, Checkbox,
  Badge, Tooltip, Switch, LoadingOverlay, Alert, SimpleGrid, HoverCard
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalculator, IconInfoCircle, IconRefresh, IconCurrencyRupee, IconUsers, IconCash, IconReceipt } from '@tabler/icons-react';
import { salaryAPI } from '../../services/api';
import {
  MONTHS, yearOptions, fmt, num, monthName, payrollStatusColor
} from './hrmShared';
import StatCard from './HrmStatCard';

/** Spread a total recovery across the employee's loans in order, up to each balance. */
const distribute = (total, loans) => {
  let left = Number(total) || 0;
  return loans.map(l => {
    const amt = Math.min(left, l.remaining);
    left -= amt;
    return { loanId: l.loanId, amount: Math.max(0, Math.round(amt)) };
  });
};

const ProcessSalary = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const now = new Date();
  // Default: previous month until the 20th, then current month
  const defMonth = now.getDate() < 20 ? (now.getMonth() === 0 ? 12 : now.getMonth()) : now.getMonth() + 1;
  const defYear = now.getDate() < 20 && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [month, setMonth] = useState(params.get('month') || String(defMonth));
  const [year, setYear] = useState(params.get('year') || String(defYear));
  const [unmarkedAsAbsent, setUnmarkedAsAbsent] = useState(false);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});          // { [employeeId]: { field: value } }
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  const buildOverrides = (empId, e = edits[empId]) => {
    if (!e) return undefined;
    const row = rows.find(r => String(r.employeeId) === String(empId));
    const o = {};
    if (e.bonus !== undefined) o.bonus = e.bonus;
    if (e.arrears !== undefined) o.arrears = e.arrears;
    if (e.otherDeduction !== undefined) o.otherDeduction = e.otherDeduction;
    if (e.overtimeHours !== undefined) o.overtimeHours = e.overtimeHours;
    if (e.remarks !== undefined) o.remarks = e.remarks;
    if (e.loanTotal !== undefined && row) o.loanRecoveries = distribute(e.loanTotal, row.activeLoans || []);
    return o;
  };

  const load = async (editsNow = edits, keepSelection = false) => {
    setLoading(true);
    try {
      const overrides = {};
      for (const id of Object.keys(editsNow)) overrides[id] = buildOverrides(id, editsNow[id]);
      const res = await salaryAPI.preview({ month: Number(month), year: Number(year), unmarkedAsAbsent, overrides });
      const data = res.data || [];
      setRows(data);
      if (!keepSelection) setSelected(new Set(data.filter(r => r.existing?.status !== 'Paid').map(r => String(r.employeeId))));
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to calculate payroll', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setEdits({}); load({}); }, [month, year, unmarkedAsAbsent]);

  const edit = (empId, field, value) => {
    const next = { ...edits, [empId]: { ...(edits[empId] || {}), [field]: value === '' ? 0 : value } };
    setEdits(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(next, true), 600);
  };

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectable = rows.filter(r => r.existing?.status !== 'Paid');
  const allSelected = selectable.length > 0 && selectable.every(r => selected.has(String(r.employeeId)));

  const chosen = rows.filter(r => selected.has(String(r.employeeId)));
  const totals = useMemo(() => {
    const s = (f) => chosen.reduce((a, r) => a + (f(r) || 0), 0);
    return {
      gross: s(r => r.grossSalary), ded: s(r => r.totalDeductions), net: s(r => r.netSalary),
      loan: s(r => r.deductions.loanRecovery + r.deductions.advanceRecovery),
      statutory: s(r => r.deductions.pf + r.deductions.esi + r.deductions.professionalTax)
    };
  }, [chosen]);
  const reprocessCount = chosen.filter(r => r.existing).length;
  const unmarkedTotal = rows.reduce((s, r) => s + (r.attendance.unmarked || 0), 0);

  const handleGenerate = async () => {
    if (!chosen.length) return notifications.show({ title: 'Nothing selected', message: 'Select employees to process', color: 'orange' });
    setSaving(true);
    try {
      const res = await salaryAPI.bulkProcess({
        month: Number(month), year: Number(year), unmarkedAsAbsent,
        rows: chosen.map(r => ({ employeeId: r.employeeId, overrides: buildOverrides(String(r.employeeId)) }))
      });
      const errs = res.errors || [];
      notifications.show({
        title: `Payroll generated for ${res.count} employee(s)`,
        message: errs.length ? errs.map(e => `${e.name}: ${e.message}`).join('\n') : 'Review and approve in the Payroll register',
        color: errs.length ? 'orange' : 'green', autoClose: errs.length ? false : 4000
      });
      navigate(`/hrm/salary?month=${month}&year=${year}`);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to process salary', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const cellInput = (r, field, value, opts = {}) => (
    <NumberInput size="xs" hideControls min={0} w={opts.w || 78} value={value} decimalScale={opts.decimal ?? 0}
      disabled={r.existing?.status === 'Paid'} styles={{ input: { textAlign: 'right' } }}
      onChange={(v) => edit(String(r.employeeId), field, Number(v) || 0)} />
  );

  return (
    <Container size="100%" px="md" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Process Salary</Title>
          <Text c="dimmed" size="sm">Calculated from attendance, approved leave, salary structure, PF/ESI and loan EMIs — edit the yellow columns</Text>
        </div>
        <Button variant="light" onClick={() => navigate(`/hrm/salary?month=${month}&year=${year}`)}>Payroll Register</Button>
      </Group>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <Group align="flex-end" justify="space-between">
          <Group align="flex-end">
            <Select label="Month" data={MONTHS} value={month} onChange={(v) => v && setMonth(v)} w={150} />
            <Select label="Year" data={yearOptions()} value={year} onChange={(v) => v && setYear(v)} w={110} />
            <Switch label="Unmarked days = Absent (LOP)" checked={unmarkedAsAbsent} onChange={(e) => setUnmarkedAsAbsent(e.currentTarget.checked)} mb={6} />
          </Group>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => load(edits, true)}>Recalculate</Button>
        </Group>
      </Paper>

      {unmarkedTotal > 0 && (
        <Alert icon={<IconInfoCircle size={16} />} color={unmarkedAsAbsent ? 'orange' : 'blue'} variant="light" mb="md">
          {unmarkedTotal} employee-day(s) in {monthName(month)} have no attendance. They are counted as
          {unmarkedAsAbsent ? ' absent (salary cut).' : ' paid days.'} Mark attendance first for an exact payroll.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <StatCard icon={<IconUsers size={20} />} label="Selected" value={`${chosen.length} / ${rows.length}`} color="blue" sub={reprocessCount ? `${reprocessCount} will be recalculated` : ''} />
        <StatCard icon={<IconCurrencyRupee size={20} />} label="Gross" value={fmt(totals.gross)} color="indigo" />
        <StatCard icon={<IconReceipt size={20} />} label="Deductions" value={fmt(totals.ded)} color="orange" sub={`Statutory ${fmt(totals.statutory)} · Loans ${fmt(totals.loan)}`} />
        <StatCard icon={<IconCash size={20} />} label="Net Payable" value={fmt(totals.net)} color="teal" />
      </SimpleGrid>

      <Paper shadow="xs" radius="md" withBorder pos="relative" mb="md">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 1 }} />
        <Table.ScrollContainer minWidth={1350}>
          <Table striped highlightOnHover verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={36}>
                  <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map(r => String(r.employeeId))))} />
                </Table.Th>
                <Table.Th>Employee</Table.Th>
                <Table.Th ta="center">Paid / LOP</Table.Th>
                <Table.Th ta="right">Fixed Pay</Table.Th>
                <Table.Th ta="right">Earned</Table.Th>
                <Table.Th ta="right" bg="yellow.0">OT Hrs</Table.Th>
                <Table.Th ta="right">OT ₹</Table.Th>
                <Table.Th ta="right" bg="yellow.0">Bonus</Table.Th>
                <Table.Th ta="right" bg="yellow.0">Arrears</Table.Th>
                <Table.Th ta="right">Gross</Table.Th>
                <Table.Th ta="right">PF/ESI/PT</Table.Th>
                <Table.Th ta="right" bg="yellow.0">Loan / Adv</Table.Th>
                <Table.Th ta="right" bg="yellow.0">Other Ded</Table.Th>
                <Table.Th ta="right">Net Pay</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(r => {
                const id = String(r.employeeId);
                const a = r.attendance;
                const e = r.earnings;
                const d = r.deductions;
                const fixedEarned = e.basic + e.da + e.hra + e.ta + e.otherAllowance;
                const paid = r.existing?.status === 'Paid';
                const loanTotal = d.loanRecovery + d.advanceRecovery;
                const loanDue = (r.activeLoans || []).reduce((s, l) => s + l.remaining, 0);
                return (
                  <Table.Tr key={id} opacity={paid ? 0.55 : 1}>
                    <Table.Td><Checkbox checked={selected.has(id)} disabled={paid} onChange={() => toggle(id)} /></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>{r.employee.name}</Text>
                      <Text size="xs" c="dimmed">{[r.employee.employeeCode, r.employee.role, r.salaryType === 'Daily' ? 'Daily wage' : null].filter(Boolean).join(' · ')}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <HoverCard shadow="md" withArrow openDelay={200}>
                        <HoverCard.Target>
                          <Text size="sm" style={{ cursor: 'help' }}>
                            <b>{num(a.paidDays)}</b> / <Text span c={a.lopDays ? 'red' : 'dimmed'}>{num(a.lopDays)}</Text>
                          </Text>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Stack gap={2}>
                            <Text size="xs" fw={700}>{monthName(month)} — {a.daysInMonth} days</Text>
                            {[['Present', a.present], ['Half Day', a.halfDay], ['Absent', a.absent], ['Paid leave', a.paidLeave], ['Unpaid leave', a.unpaidLeave],
                              ['Holiday', a.holiday], ['Week off', a.weekOff], ['Not marked', a.unmarked], ['Before join / after exit', a.notEmployed]]
                              .filter(([, v]) => v).map(([k, v]) => <Text key={k} size="xs">{k}: {v}</Text>)}
                            <Text size="xs" c="dimmed">LOP = absent + ½ half days + unpaid leave{unmarkedAsAbsent ? ' + not marked' : ''}</Text>
                          </Stack>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    </Table.Td>
                    <Table.Td ta="right"><Text size="sm" c="dimmed">{fmt(r.fixedSalary)}{r.salaryType === 'Daily' ? '/d' : ''}</Text></Table.Td>
                    <Table.Td ta="right">{fmt(fixedEarned)}</Table.Td>
                    <Table.Td ta="right">
                      <Tooltip label={`Attendance: ${r.attendanceOvertimeHours || 0} h @ ${fmt(e.overtimeRate)}/h`}>
                        <div>{cellInput(r, 'overtimeHours', e.overtimeHours, { w: 64, decimal: 1 })}</div>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="right">{fmt(e.overtimeAmount)}</Table.Td>
                    <Table.Td ta="right">{cellInput(r, 'bonus', e.bonus)}</Table.Td>
                    <Table.Td ta="right">{cellInput(r, 'arrears', e.arrears)}</Table.Td>
                    <Table.Td ta="right" fw={600}>{fmt(r.grossSalary)}</Table.Td>
                    <Table.Td ta="right">
                      <Tooltip label={`PF ${fmt(d.pf)} · ESI ${fmt(d.esi)} · PT ${fmt(d.professionalTax)}`}>
                        <Text size="sm">{fmt(d.pf + d.esi + d.professionalTax)}</Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="right">
                      {r.activeLoans?.length ? (
                        <Tooltip multiline w={260} label={r.activeLoans.map(l => `${l.loanType} — due ${fmt(l.remaining)}${l.emiAmount ? `, EMI ${fmt(l.emiAmount)}` : ''}`).join('\n')}>
                          <div>
                            {cellInput(r, 'loanTotal', loanTotal)}
                            <Text size="xs" c="dimmed">due {fmt(loanDue)}</Text>
                          </div>
                        </Tooltip>
                      ) : <Text size="xs" c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td ta="right">{cellInput(r, 'otherDeduction', d.other)}</Table.Td>
                    <Table.Td ta="right"><Text fw={700} c={r.netSalary < 0 ? 'red' : 'teal'}>{fmt(r.netSalary)}</Text></Table.Td>
                    <Table.Td>
                      {r.existing
                        ? <Badge size="sm" variant="light" color={payrollStatusColor(r.existing.status)}>{r.existing.status}</Badge>
                        : <Badge size="sm" variant="outline" color="gray">New</Badge>}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
            {rows.length > 0 && (
              <Table.Tfoot>
                <Table.Tr fw={700}>
                  <Table.Td colSpan={9}>Total of selected ({chosen.length})</Table.Td>
                  <Table.Td ta="right">{fmt(totals.gross)}</Table.Td>
                  <Table.Td ta="right">{fmt(totals.statutory)}</Table.Td>
                  <Table.Td ta="right">{fmt(totals.loan)}</Table.Td>
                  <Table.Td />
                  <Table.Td ta="right">{fmt(totals.net)}</Table.Td>
                  <Table.Td />
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Table.ScrollContainer>
        {!rows.length && !loading && <Stack align="center" py={50}><Text c="dimmed">No employees on the rolls for this month</Text></Stack>}
      </Paper>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Already-generated payrolls that are not paid are recalculated (and go back to Pending). Paid salaries are locked — revert the payment in the register to change them.
        </Text>
        <Button size="md" leftSection={<IconCalculator size={18} />} onClick={handleGenerate} loading={saving} disabled={!chosen.length || loading}>
          Generate Payroll ({chosen.length})
        </Button>
      </Group>
    </Container>
  );
};

export default ProcessSalary;

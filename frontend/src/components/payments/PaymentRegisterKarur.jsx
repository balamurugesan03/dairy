/**
 * Producer Dues → Payment Bar Reports → Payment Register (Karur, Tamil Nadu)
 *
 * Pays a settled payment cycle in Cash or through a Bank ledger. The cycle and
 * every amount come from the saved Payment Register (settled); producers are
 * Centre Code + Farmer Number (C1-001), centre-wise. Save pays the cycle and
 * posts the voucher; saved runs are listed in the Payment Log (edit / cancel
 * with an audit trail). Print, PDF and Excel use the Cash or Bank layout.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Container, Paper, Group, Stack, Text, Title, Button, Select, SegmentedControl, TextInput, Textarea,
  Badge, ThemeIcon, ScrollArea, LoadingOverlay, Modal, Checkbox, Alert, Table, Tooltip, ActionIcon, Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconReportMoney, IconRefresh, IconDeviceFloppy, IconHistory, IconPrinter, IconFileTypePdf,
  IconFileSpreadsheet, IconMail, IconEdit, IconX, IconAlertTriangle, IconBan, IconListDetails, IconEye,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { karurPaymentRegisterAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useSocietyHeader from '../reports/shared/useSocietyHeader';
import {
  REPORT_TITLE, fmtAmt, r2, groupByCentre, grandTotal, headerFacts, reportFileName,
  printRegister, buildPdf, buildWorkbook, arrayBufferToBase64, PDF_TYPE, XLSX_TYPE,
} from '../../utils/karurPaymentRegisterReport';

const ymd = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const dmy = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '');
const cycleText = (f, t) => `${dmy(f)} to ${dmy(t)}`;
const errMsg = (e, fallback) => e?.message || fallback;
const norm = (s) => String(s || '').trim().toLowerCase();

const DEDUCTION_KEYS = ['welfare', 'loanRec', 'advance', 'cashAdvance', 'otherRec', 'totalDeductions'];
const SUM_KEYS = ['previousBalance', 'qty', 'milkValue', ...DEDUCTION_KEYS, 'netPayable'];
const sumRows = (rows) => Object.fromEntries(SUM_KEYS.map((k) => [k, r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0))]));

const EMPTY_HEADER = { bankLedgerId: null, chequeNumber: '', chequeDetails: '', remarks: '', paymentDate: new Date() };

export default function PaymentRegisterKarur() {
  const { canEdit, canDelete, canWrite } = useAuth();
  const society = useSocietyHeader();
  const mayWrite = canWrite('payments.register');
  const mayEdit = canEdit('payments.register');
  const mayCancel = canDelete('payments.register') || mayEdit;

  // ── options + filters ────────────────────────────────────────
  const [opts, setOpts] = useState(null);
  const [cycleKey, setCycleKey] = useState(null);
  const [paymentType, setPaymentType] = useState('Bank');
  const [centerId, setCenterId] = useState('all');
  const [bank, setBank] = useState('');
  const [cashScope, setCashScope] = useState('withoutBank');
  const [header, setHeader] = useState(EMPTY_HEADER);
  const setH = (k, v) => setHeader((h) => ({ ...h, [k]: v }));
  const [editing, setEditing] = useState(null);      // saved register being edited

  // ── generated grid ───────────────────────────────────────────
  const [result, setResult] = useState(null);        // { rows, alreadyPaid, skipped, source }
  const [excluded, setExcluded] = useState(new Set());
  const [savedReg, setSavedReg] = useState(null);    // last saved register (for print header)
  const [busy, setBusy] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const res = await karurPaymentRegisterAPI.getOptions();
      setOpts(res.data);
      return res.data;
    } catch (e) {
      notifications.show({ color: 'red', message: errMsg(e, 'Could not load payment settings') });
      return null;
    }
  }, []);

  useEffect(() => {
    loadOptions().then((d) => {
      if (!d) return;
      // Latest unsettled cycle that has ended (read from Milk Purchase), else the newest settled one
      const pend = d.pendingCycles || [];
      const ended = pend.findIndex((c) => dayjs(c.toDate).isBefore(dayjs(), 'day'));
      setCycleKey(pend.length ? `pending:${ended >= 0 ? ended : 0}`
        : d.cycles.length ? String(d.cycles[0].sourceRegisterId) : d.settingsCycle ? 'settings' : null);
    });
  }, [loadOptions]);

  const cycleOptions = useMemo(() => {
    if (!opts) return [];
    const pending = (opts.pendingCycles || []).map((c, i) => ({
      value: `pending:${i}`,
      label: `${cycleText(c.fromDate, c.toDate)}  · Not settled (from Milk Purchase)`,
    }));
    const list = opts.cycles.map((c, i) => ({
      value: String(c.sourceRegisterId),
      label: `${cycleText(c.fromDate, c.toDate)}${i === 0 ? '  · Active' : ''}  · Paid ${c.paidProducers}/${c.producers}`,
    }));
    if (pending.length) return [...pending, ...list];
    if (!list.length && opts.settingsCycle) {
      list.push({ value: 'settings', label: `${cycleText(opts.settingsCycle.fromDate, opts.settingsCycle.toDate)}  · Payment Settings (not settled)` });
    }
    return list;
  }, [opts]);

  const cycle = useMemo(() => {
    if (!opts || !cycleKey) return null;
    if (cycleKey === 'settings') return opts.settingsCycle;
    if (cycleKey.startsWith('pending:')) return (opts.pendingCycles || [])[Number(cycleKey.slice(8))] || null;
    return opts.cycles.find((c) => String(c.sourceRegisterId) === cycleKey)
      || (editing && String(editing.sourceRegisterId) === cycleKey ? { fromDate: editing.fromDate, toDate: editing.toDate } : null);
  }, [opts, cycleKey, editing]);

  const centreOptions = useMemo(() => [
    { value: 'all', label: 'All Centers' },
    ...(opts?.centres || []).map((c) => ({ value: String(c._id), label: [c.centerCode, c.centerName].filter(Boolean).join(' - ') })),
  ], [opts]);
  const bankOptions = useMemo(() => {
    const names = new Set([...(opts?.banks || []), ...(result?.banks || [])]);
    return [{ value: '', label: 'All Banks' }, ...[...names].sort().map((b) => ({ value: b, label: b }))];
  }, [opts, result]);
  const ledgerOptions = useMemo(() => (opts?.bankLedgers || []).map((l) => ({ value: String(l._id), label: l.ledgerName })), [opts]);

  const resetGrid = () => { setResult(null); setExcluded(new Set()); setSavedReg(null); };

  // ── Generate ─────────────────────────────────────────────────
  const generate = async (override = {}) => {
    const c = override.cycle || cycle;
    if (!c) return notifications.show({ color: 'orange', message: 'No payment cycle — set it in Settings → Payment Settings' });
    setBusy('generate');
    try {
      const res = await karurPaymentRegisterAPI.generate({
        fromDate: ymd(c.fromDate), toDate: ymd(c.toDate),
        paymentType: override.paymentType || paymentType,
        // All centres / banks are loaded once; Center + Bank then filter on screen.
        // Edit keeps the saved register's own centre / bank selection.
        centerId: override.serverCenterId ?? 'all',
        bank: (override.paymentType || paymentType) === 'Bank' ? (override.serverBank ?? '') : '',
        cashScope: override.cashScope || cashScope,
        editId: override.editId ?? editing?._id ?? null,
      });
      setResult(res.data);
      setExcluded(override.keepIds
        ? new Set(res.data.rows.filter((r) => !override.keepIds.has(r.farmerId)).map((r) => r.farmerId))
        : new Set());
      if (!override.keepIds) setSavedReg(null);
      if (!override.silent) {
        notifications.show({ color: 'teal', message: `${res.data.rows.length} producer(s) loaded for ${cycleText(c.fromDate, c.toDate)}` });
      }
      return res.data;
    } catch (e) {
      setResult(null);
      notifications.show({ color: 'red', autoClose: 9000, title: 'Generate', message: errMsg(e, 'Could not generate the register') });
      return null;
    } finally { setBusy(''); }
  };

  const allRows = result?.rows || [];
  // Center / Bank filter — applies to the grid, totals, Print, PDF, Excel and Email
  const rows = useMemo(() => allRows.filter((r) =>
    (centerId === 'all' || String(r.centerId || '') === centerId)
    && (paymentType !== 'Bank' || !bank || norm(r.bankName) === norm(bank))), [allRows, centerId, bank, paymentType]);
  const included = useMemo(() => rows.filter((r) => !excluded.has(r.farmerId)), [rows, excluded]);
  const allIncluded = useMemo(() => allRows.filter((r) => !excluded.has(r.farmerId)), [allRows, excluded]);
  const totals = useMemo(() => sumRows(included), [included]);
  const grouped = centerId === 'all';
  const sections = useMemo(() => (grouped ? groupByCentre(rows) : [{ key: 'one', title: '', rows }]), [rows, grouped]);

  const toggleRow = (fid) => setExcluded((s) => { const n = new Set(s); n.has(fid) ? n.delete(fid) : n.add(fid); return n; });
  const toggleAll = (on) => setExcluded((s) => {
    const n = new Set(s);
    rows.forEach((r) => (on ? n.delete(r.farmerId) : n.add(r.farmerId)));
    return n;
  });

  // ── Save / Update ────────────────────────────────────────────
  const validate = () => {
    if (!result) return 'Click Generate first';
    if (!(editing ? allIncluded : included).length) return 'No producers selected';
    if (!header.paymentDate) return 'Enter the Payment Date';
    if (paymentType === 'Bank') {
      if (!header.bankLedgerId) return 'Select the Bank Ledger';
      if (!header.chequeNumber.trim()) return 'Enter the Cheque Number';
    }
    return null;
  };

  const save = () => {
    const problem = validate();
    if (problem) return notifications.show({ color: 'orange', message: problem });
    const payRows = editing ? allIncluded : included;      // Edit keeps every producer of the register
    const payTotal = r2(payRows.reduce((t, r) => t + (r.netPayable || 0), 0));
    const payload = {
      fromDate: ymd(cycle.fromDate), toDate: ymd(cycle.toDate), paymentType, centerId,
      bank: paymentType === 'Bank' ? bank : '', cashScope,
      paymentDate: ymd(header.paymentDate),
      bankLedgerId: paymentType === 'Bank' ? header.bankLedgerId : null,
      chequeNumber: paymentType === 'Bank' ? header.chequeNumber.trim() : '',
      chequeDetails: paymentType === 'Bank' ? header.chequeDetails.trim() : '',
      remarks: header.remarks.trim(),
      farmerIds: payRows.map((r) => r.farmerId),
    };
    modals.openConfirmModal({
      title: editing ? `Update ${editing.registerNumber}` : 'Save Payment Register',
      centered: true,
      children: (
        <Text size="sm">
          {editing ? 'Re-post' : 'Pay'} <b>{payRows.length}</b> producer(s) — <b>₹ {fmtAmt(payTotal)}</b> by <b>{paymentType}</b>
          {paymentType === 'Bank' ? <> from <b>{ledgerOptions.find((l) => l.value === header.bankLedgerId)?.label}</b>, cheque <b>{payload.chequeNumber}</b></> : ' (Cash in Hand)'}
          {' '}for {cycleText(cycle.fromDate, cycle.toDate)}? A payment voucher is posted on {dmy(header.paymentDate)}.
        </Text>
      ),
      labels: { confirm: editing ? 'Update' : 'Save', cancel: 'Back' },
      onConfirm: async () => {
        setBusy('save');
        try {
          const res = editing
            ? await karurPaymentRegisterAPI.update(editing._id, payload)
            : await karurPaymentRegisterAPI.create(payload);
          notifications.show({ color: 'green', title: 'Saved', message: res.message || 'Payment register saved' });
          setSavedReg(res.data);
          setEditing(null);
          await loadOptions();
          // Grid now shows exactly what was saved (paid producers drop out of a fresh Generate)
          setResult((r) => (r ? { ...r, rows: payRows } : r));
          setExcluded(new Set());
        } catch (e) {
          notifications.show({ color: 'red', autoClose: 9000, title: 'Save', message: errMsg(e, 'Save failed') });
        } finally { setBusy(''); }
      },
    });
  };

  // ── Edit from Payment Log ────────────────────────────────────
  const openForEdit = async (reg) => {
    setLogOpen(false);
    try {
      const { data } = await karurPaymentRegisterAPI.getById(reg._id);
      const options = (await loadOptions()) || opts;
      const c = options?.cycles.find((x) => String(x.sourceRegisterId) === String(data.sourceRegisterId))
        || { fromDate: data.fromDate, toDate: data.toDate, sourceRegisterId: data.sourceRegisterId };
      setCycleKey(String(c.sourceRegisterId));
      setPaymentType(data.paymentType);
      const cid = data.centerId ? String(data.centerId) : 'all';
      setCenterId(cid);
      setBank(data.bankFilter || '');
      setCashScope(data.cashScope || 'withoutBank');
      setHeader({
        bankLedgerId: data.bankLedgerId ? String(data.bankLedgerId) : null,
        chequeNumber: data.chequeNumber || '', chequeDetails: data.chequeDetails || '',
        remarks: data.remarks || '', paymentDate: new Date(data.paymentDate),
      });
      setEditing(data);
      setSavedReg(data);
      const out = await generate({
        cycle: c, paymentType: data.paymentType, serverCenterId: cid, serverBank: data.bankFilter || '',
        cashScope: data.cashScope, editId: data._id, keepIds: new Set(data.entries.map((e) => String(e.farmerId))), silent: true,
      });
      if (out) notifications.show({ color: 'blue', message: `Editing ${data.registerNumber} — change the details and click Update` });
    } catch (e) {
      notifications.show({ color: 'red', message: errMsg(e, 'Could not open the register') });
    }
  };

  // ── View a saved register (split it centre-wise / bank-wise for reports) ──
  const openForView = async (reg) => {
    setLogOpen(false);
    try {
      const { data } = await karurPaymentRegisterAPI.getById(reg._id);
      await loadOptions();
      setEditing(null);
      setCycleKey(String(data.sourceRegisterId));
      setPaymentType(data.paymentType);
      setCashScope(data.cashScope || 'withoutBank');
      setCenterId(data.centerId ? String(data.centerId) : 'all');
      setBank(data.bankFilter || '');
      setHeader({
        bankLedgerId: data.bankLedgerId ? String(data.bankLedgerId) : null,
        chequeNumber: data.chequeNumber || '', chequeDetails: data.chequeDetails || '',
        remarks: data.remarks || '', paymentDate: new Date(data.paymentDate),
      });
      const entries = data.entries.map((e) => ({ ...e, farmerId: String(e.farmerId), centerId: e.centerId ? String(e.centerId) : null }));
      setResult({ rows: entries, alreadyPaid: [], skipped: {}, banks: [...new Set(entries.map((e) => e.bankName).filter(Boolean))] });
      setExcluded(new Set());
      setSavedReg(data);
      notifications.show({ color: 'blue', message: `${data.registerNumber} opened — choose Center / Bank to print or export separate reports` });
    } catch (e) {
      notifications.show({ color: 'red', message: errMsg(e, 'Could not open the register') });
    }
  };

  const cancelEdit = () => { setEditing(null); setHeader(EMPTY_HEADER); resetGrid(); };

  // ── Outputs ──────────────────────────────────────────────────
  const facts = () => {
    const reg = savedReg;
    const ledgerName = reg?.bankLedgerName || ledgerOptions.find((l) => l.value === header.bankLedgerId)?.label || '';
    return headerFacts({
      society, paymentType,
      cycle: cycle ? cycleText(cycle.fromDate, cycle.toDate) : '',
      centerLabel: centreOptions.find((c) => c.value === centerId)?.label,
      centerCode: centerId === 'all' ? '' : (opts?.centres || []).find((c) => String(c._id) === centerId)?.centerCode || '',
      bankLabel: bank || 'All Banks',
      paymentDate: dmy(reg?.paymentDate || header.paymentDate),
      registerNumber: reg?.registerNumber || '',
      bankLedgerName: ledgerName,
      chequeNumber: reg?.chequeNumber ?? header.chequeNumber,
      chequeDetails: reg?.chequeDetails ?? header.chequeDetails,
    });
  };
  const canExport = included.length > 0;
  const outArgs = () => ({ facts: facts(), rows: included, grouped });

  const doPrint = () => { if (!printRegister(outArgs())) notifications.show({ color: 'orange', message: 'Allow pop-ups to print' }); };
  const doPdf = async () => {
    setBusy('pdf');
    try { const a = outArgs(); (await buildPdf(a)).save(reportFileName(a.facts, '.pdf')); }
    catch (e) { notifications.show({ color: 'red', message: errMsg(e, 'PDF failed') }); }
    finally { setBusy(''); }
  };
  const doExcel = async () => {
    setBusy('excel');
    try { const a = outArgs(); const { XLSX, wb } = await buildWorkbook(a); XLSX.writeFile(wb, reportFileName(a.facts, '.xlsx')); }
    catch (e) { notifications.show({ color: 'red', message: errMsg(e, 'Excel failed') }); }
    finally { setBusy(''); }
  };
  const sendEmail = async ({ to, cc, subject, message, attachPdf, attachExcel }) => {
    setBusy('email');
    try {
      const a = outArgs();
      const attachments = [];
      if (attachPdf) {
        const doc = await buildPdf(a);
        attachments.push({ filename: reportFileName(a.facts, '.pdf'), contentType: PDF_TYPE, contentBase64: arrayBufferToBase64(doc.output('arraybuffer')) });
      }
      if (attachExcel) {
        const { XLSX, wb } = await buildWorkbook(a);
        attachments.push({ filename: reportFileName(a.facts, '.xlsx'), contentType: XLSX_TYPE, contentBase64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) });
      }
      const res = await karurPaymentRegisterAPI.email({ to, cc, subject, message, attachments });
      notifications.show({ color: 'green', message: res?.message || 'Email sent' });
      setEmailOpen(false);
    } catch (e) {
      notifications.show({ color: 'red', autoClose: 9000, message: errMsg(e, 'Email could not be sent') });
    } finally { setBusy(''); }
  };

  const filtersLocked = !!editing;
  const onFilterChange = (fn) => (v) => { fn(v); if (!editing) resetGrid(); };

  // ═════════════════════════════════════════════════════════════
  return (
    <Container fluid px="md" py="sm">
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Group gap="xs">
          <ThemeIcon variant="light" size="lg" radius="md" color="teal"><IconReportMoney size={18} /></ThemeIcon>
          <div>
            <Title order={3}>{REPORT_TITLE}</Title>
            <Text size="xs" c="dimmed">Pay a settled cycle in Cash or by Bank — amounts from Payment Register (settled)</Text>
          </div>
        </Group>
        <Group gap="xs">
          {editing && <Badge color="blue" size="lg" variant="light">Editing {editing.registerNumber}</Badge>}
          {!editing && savedReg && <Badge color="green" size="lg" variant="light">Saved {savedReg.registerNumber}</Badge>}
        </Group>
      </Group>

      {/* ── Filters ─────────────────────────────────────────── */}
      <Paper withBorder p="sm" radius="md" mb="sm">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select
            label="Payment Cycle" w={360} data={cycleOptions} value={cycleKey}
            onChange={onFilterChange(setCycleKey)} disabled={filtersLocked} allowDeselect={false}
            placeholder="No settled cycle" nothingFoundMessage="No cycle"
          />
          <TextInput label="From Date" w={110} readOnly value={cycle ? dmy(cycle.fromDate) : ''} />
          <TextInput label="To Date" w={110} readOnly value={cycle ? dmy(cycle.toDate) : ''} />
          <div>
            <Text size="sm" fw={500} mb={4}>Payment Type</Text>
            <SegmentedControl
              value={paymentType} onChange={onFilterChange(setPaymentType)} disabled={filtersLocked}
              data={[{ value: 'Cash', label: 'Cash' }, { value: 'Bank', label: 'Bank' }]}
            />
          </div>
          <Select label="Center" w={200} data={centreOptions} value={centerId} onChange={(v) => setCenterId(v || 'all')} allowDeselect={false} searchable />
          {paymentType === 'Bank' ? (
            <Select label="Bank" w={200} data={bankOptions} value={bank} onChange={(v) => setBank(v || '')} allowDeselect={false} searchable />
          ) : (
            <Select
              label="Producers" w={230} value={cashScope} onChange={onFilterChange((v) => setCashScope(v || 'withoutBank'))} disabled={filtersLocked} allowDeselect={false}
              data={[{ value: 'withoutBank', label: 'Without bank account' }, { value: 'all', label: 'All producers' }]}
            />
          )}
          <Button leftSection={<IconRefresh size={16} />} color="teal" loading={busy === 'generate'} onClick={() => generate()} disabled={!cycle}>
            Generate
          </Button>
        </Group>
        {opts && (
          <Text size="xs" c="dimmed" mt={6}>
            Payment Settings: {opts.paymentDays === 30 ? '1 month' : `${opts.paymentDays} days`} cycle
            {opts.settingsCycle ? `, from ${dmy(opts.settingsCycle.fromDate)}` : ''}. Settled cycles come from Payment Register (settled); cycles not settled yet are read straight from Milk Purchase (preview only). Generate loads every centre; Center and Bank then filter the preview, totals, Print, PDF, Excel and Email straight away.
          </Text>
        )}

        <Divider my="sm" />
        <Group align="flex-end" gap="sm" wrap="wrap">
          <DateInput label="Payment Date" w={150} valueFormat="DD/MM/YYYY" value={header.paymentDate} onChange={(v) => setH('paymentDate', v)} withAsterisk />
          {paymentType === 'Bank' && (
            <>
              <Select label="Bank Ledger" w={240} data={ledgerOptions} value={header.bankLedgerId} onChange={(v) => setH('bankLedgerId', v)} searchable withAsterisk
                placeholder={ledgerOptions.length ? 'Select bank ledger' : 'No bank ledger in Accounts → Ledgers'} />
              <TextInput label="Cheque Number" w={160} value={header.chequeNumber} onChange={(e) => setH('chequeNumber', e.target.value)} withAsterisk maxLength={30} />
              <TextInput label="Cheque Details" w={280} value={header.chequeDetails} onChange={(e) => setH('chequeDetails', e.target.value)} placeholder="Cheque date, drawn on, reference…" maxLength={500} />
            </>
          )}
          <TextInput label="Remarks" w={220} value={header.remarks} onChange={(e) => setH('remarks', e.target.value)} maxLength={500} />
        </Group>
      </Paper>

      {/* ── Actions ─────────────────────────────────────────── */}
      <Group gap="xs" mb="sm" wrap="wrap">
        <Button leftSection={<IconDeviceFloppy size={16} />} color="green" loading={busy === 'save'}
          disabled={!result || result.source?.provisional || !included.length || (editing ? !mayEdit : !mayWrite) || (!editing && !!savedReg)} onClick={save}>
          {editing ? 'Update' : 'Save'}
        </Button>
        {editing && <Button variant="default" leftSection={<IconX size={16} />} onClick={cancelEdit}>Cancel Edit</Button>}
        <Button variant="light" color="violet" leftSection={<IconEdit size={16} />} onClick={() => setLogOpen(true)}>Edit</Button>
        <Button variant="light" color="indigo" leftSection={<IconHistory size={16} />} onClick={() => setLogOpen(true)}>Payment Log</Button>
        <Button variant="light" color="red" leftSection={<IconFileTypePdf size={16} />} disabled={!canExport} loading={busy === 'pdf'} onClick={doPdf}>PDF Export</Button>
        <Button variant="light" color="teal" leftSection={<IconFileSpreadsheet size={16} />} disabled={!canExport} loading={busy === 'excel'} onClick={doExcel}>Excel Export</Button>
        <Button variant="light" color="blue" leftSection={<IconPrinter size={16} />} disabled={!canExport} onClick={doPrint}>Print</Button>
        <Button variant="light" color="grape" leftSection={<IconMail size={16} />} disabled={!canExport} onClick={() => setEmailOpen(true)}>Share by Email</Button>
      </Group>

      {result?.source?.provisional && (
        <Alert color="orange" variant="light" mb="sm" icon={<IconAlertTriangle size={16} />} p="xs">
          <Text size="xs">
            <b>This cycle is not settled yet.</b> The figures are calculated live from Milk Purchase — every milk entry dated{' '}
            {dmy(result.source.fromDate)} to {dmy(result.source.toDate)} (including late entries), previous balance from the last settled cycle,
            less cattle feed, deductions and payments in the cycle. Preview, Print, PDF and Excel work now; to pay, save the cycle in
            Producer Dues → Payments → Payment Register (settled) first.
          </Text>
        </Alert>
      )}
      {result && <GenerateNotes result={result} paymentType={paymentType} cashScope={cashScope} />}

      {/* ── Grid ────────────────────────────────────────────── */}
      <Paper withBorder radius="md" pos="relative">
        <LoadingOverlay visible={busy === 'generate'} />
        <ScrollArea h="calc(100vh - 430px)" mih={320} type="auto">
          <table style={TABLE}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={TH} rowSpan={2}>
                  <Checkbox size="xs" checked={rows.length > 0 && !excluded.size} indeterminate={excluded.size > 0 && excluded.size < rows.length}
                    onChange={(e) => toggleAll(e.currentTarget.checked)} disabled={!rows.length || (!!savedReg && !editing)} />
                </th>
                <th style={TH} rowSpan={2}>Sl No</th>
                <th style={TH} rowSpan={2}>Center Code</th>
                <th style={TH} rowSpan={2}>Producer ID</th>
                <th style={{ ...TH, textAlign: 'left' }} rowSpan={2}>Producer Name</th>
                <th style={TH} rowSpan={2}>Previous Balance</th>
                <th style={TH} colSpan={2}>Milk Details</th>
                <th style={TH} colSpan={6}>Deductions</th>
                <th style={TH} rowSpan={2}>Net Payable (₹)</th>
                <th style={TH} colSpan={4}>Bank Details</th>
              </tr>
              <tr>
                <th style={TH}>Milk Qty (L)</th><th style={TH}>Milk Amount (₹)</th>
                <th style={TH}>Welfare</th><th style={TH}>Loan Rec.</th><th style={TH}>Advance (C/F)</th>
                <th style={TH}>Cash Adv.</th><th style={TH}>Other Rec.</th><th style={TH}>Total Ded.</th>
                <th style={TH}>Bank Name</th><th style={TH}>Account No</th><th style={TH}>IFSC</th><th style={TH}>Branch</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr><td colSpan={19} style={{ ...TD, textAlign: 'center', padding: 28, color: '#888' }}>
                  {result ? 'No payable producers for this selection.' : 'Select the cycle and filters, then click Generate.'}
                </td></tr>
              )}
              {(() => {
                let sl = 0;
                return sections.map((s) => (
                  <Fragment key={s.key}>
                    {grouped && (
                      <tr><td colSpan={19} style={{ ...TD, background: '#eef4fb', fontWeight: 700 }}>Center: {s.title} ({s.rows.length})</td></tr>
                    )}
                    {s.rows.map((r) => {
                      const off = excluded.has(r.farmerId);
                      if (!off) sl += 1;
                      return (
                        <tr key={r.farmerId} style={{ opacity: off ? 0.45 : 1, background: off ? '#fafafa' : undefined }}>
                          <td style={TDC}><Checkbox size="xs" checked={!off} onChange={() => toggleRow(r.farmerId)} disabled={!!savedReg && !editing} /></td>
                          <td style={TDC}>{off ? '' : sl}</td>
                          <td style={TDC}>{r.centerCode || '-'}</td>
                          <td style={{ ...TDC, fontWeight: 600 }}>{r.producerId}</td>
                          <td style={TD}>{r.producerName}</td>
                          <td style={TDR}>{fmtAmt(r.previousBalance)}</td>
                          <td style={TDR}>{fmtAmt(r.qty)}</td>
                          <td style={TDR}>{fmtAmt(r.milkValue)}</td>
                          {DEDUCTION_KEYS.map((k) => <td key={k} style={{ ...TDR, color: '#8a3b12', fontWeight: k === 'totalDeductions' ? 600 : 400 }}>{fmtAmt(r[k])}</td>)}
                          <td style={{ ...TDR, fontWeight: 700, color: '#0b6b3a' }}>{fmtAmt(r.netPayable)}</td>
                          <td style={TD}>{r.bankName}</td>
                          <td style={TD}>{r.accountNumber}</td>
                          <td style={TD}>{r.ifsc}</td>
                          <td style={TD}>{r.branch}</td>
                        </tr>
                      );
                    })}
                    {grouped && (() => {
                      const t = sumRows(s.rows.filter((r) => !excluded.has(r.farmerId)));
                      return (
                        <tr style={{ background: '#f6f8fa', fontWeight: 600 }}>
                          <td style={TD} colSpan={5}>Center Total — {s.title}</td>
                          {SUM_KEYS.map((k) => <td key={k} style={TDR}>{fmtAmt(t[k])}</td>)}
                          <td style={TD} colSpan={4} />
                        </tr>
                      );
                    })()}
                  </Fragment>
                ));
              })()}
            </tbody>
            {rows.length > 0 && (
              <tfoot style={{ position: 'sticky', bottom: 0 }}>
                <tr style={{ background: '#0d3b6e', color: '#fff', fontWeight: 700 }}>
                  <td style={TF} colSpan={5}>GRAND TOTAL ({included.length} Producers)</td>
                  {SUM_KEYS.map((k) => <td key={k} style={{ ...TF, textAlign: 'right' }}>{fmtAmt(totals[k])}</td>)}
                  <td style={TF} colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </ScrollArea>
      </Paper>

      {logOpen && (
        <PaymentLogModal
          onClose={() => setLogOpen(false)} onEdit={openForEdit} onView={openForView} mayEdit={mayEdit} mayCancel={mayCancel}
          onChanged={() => { loadOptions(); if (editing) cancelEdit(); }}
        />
      )}
      {emailOpen && (
        <EmailModal
          onClose={() => setEmailOpen(false)} onSend={sendEmail} sending={busy === 'email'}
          defaultSubject={`${REPORT_TITLE} — ${paymentType} — ${cycle ? cycleText(cycle.fromDate, cycle.toDate) : ''}`}
        />
      )}
    </Container>
  );
}

// ── What Generate left out ───────────────────────────────────────
function GenerateNotes({ result, paymentType, cashScope }) {
  const { alreadyPaid, skipped } = result;
  const notes = [];
  if (paymentType === 'Bank' && skipped.noBankAccount) notes.push(`${skipped.noBankAccount} producer(s) have no bank account in Farmer Management — pay them in the Cash register`);
  if (paymentType === 'Cash' && cashScope !== 'all' && skipped.hasBankAccount) notes.push(`${skipped.hasBankAccount} producer(s) with a bank account are in the Bank register (choose "All producers" to pay them in cash)`);
  if (skipped.notPayable) notes.push(`${skipped.notPayable} producer(s) have no payable amount (net payable is zero or receivable)`);
  if (skipped.noFarmer) notes.push(`${skipped.noFarmer} register row(s) have no farmer in Farmer Management`);
  if (!notes.length && !alreadyPaid.length) return null;
  return (
    <Alert color="yellow" variant="light" mb="sm" icon={<IconAlertTriangle size={16} />} p="xs">
      <Stack gap={2}>
        {notes.map((n) => <Text key={n} size="xs">{n}.</Text>)}
        {alreadyPaid.length > 0 && (
          <Text size="xs">
            <b>{alreadyPaid.length} producer(s) already paid for this cycle</b> and left out:{' '}
            {alreadyPaid.slice(0, 12).map((p) => `${p.producerId} (${p.paidBy})`).join(', ')}{alreadyPaid.length > 12 ? ` … +${alreadyPaid.length - 12} more` : ''}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

// ── Payment Log ──────────────────────────────────────────────────
function PaymentLogModal({ onClose, onEdit, onView, onChanged, mayEdit, mayCancel }) {
  const [list, setList] = useState(null);
  const [type, setType] = useState('');
  const [audit, setAudit] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await karurPaymentRegisterAPI.getAll(type ? { paymentType: type } : {});
      setList(res.data || []);
    } catch (e) {
      setList([]);
      notifications.show({ color: 'red', message: errMsg(e, 'Could not load the Payment Log') });
    }
  }, [type]);
  useEffect(() => { load(); }, [load]);

  const cancelReg = (reg) => {
    let reason = '';
    modals.openConfirmModal({
      title: `Cancel ${reg.registerNumber}`,
      centered: true,
      children: (
        <Stack gap="xs">
          <Text size="sm">The payment voucher is removed and the {reg.producerCount} producer(s) become payable again for {cycleText(reg.fromDate, reg.toDate)}. The record stays in the log as Cancelled.</Text>
          <TextInput label="Reason" onChange={(e) => { reason = e.target.value; }} />
        </Stack>
      ),
      labels: { confirm: 'Cancel Payment', cancel: 'Back' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const res = await karurPaymentRegisterAPI.cancel(reg._id, { reason });
          notifications.show({ color: 'teal', message: res.message });
          load();
          onChanged();
        } catch (e) {
          notifications.show({ color: 'red', message: errMsg(e, 'Cancel failed') });
        }
      },
    });
  };

  return (
    <Modal opened onClose={onClose} title={`Payment Log — ${REPORT_TITLE}`} size="95%" centered>
      <Group mb="sm">
        <SegmentedControl size="xs" value={type} onChange={setType}
          data={[{ value: '', label: 'All' }, { value: 'Cash', label: 'Cash' }, { value: 'Bank', label: 'Bank' }]} />
        <Text size="xs" c="dimmed">Saved payment registers stay here; Edit re-posts the payment, Cancel reverses it. Every change is kept in the audit trail.</Text>
      </Group>
      <ScrollArea h={460}>
        <Table striped withTableBorder withColumnBorders fz="xs" stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Register No</Table.Th><Table.Th>Payment Cycle</Table.Th><Table.Th>Type</Table.Th>
              <Table.Th>Payment Date</Table.Th><Table.Th>Center</Table.Th><Table.Th>Bank</Table.Th>
              <Table.Th ta="right">Producers</Table.Th><Table.Th ta="right">Total (₹)</Table.Th>
              <Table.Th>Bank Ledger / Cheque</Table.Th><Table.Th>Voucher</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list === null && <Table.Tr><Table.Td colSpan={12} ta="center">Loading…</Table.Td></Table.Tr>}
            {list?.length === 0 && <Table.Tr><Table.Td colSpan={12} ta="center" c="dimmed">No saved payment registers</Table.Td></Table.Tr>}
            {list?.map((reg) => (
              <Table.Tr key={reg._id} style={{ opacity: reg.status === 'Cancelled' ? 0.55 : 1 }}>
                <Table.Td fw={600}>{reg.registerNumber}</Table.Td>
                <Table.Td>{cycleText(reg.fromDate, reg.toDate)}</Table.Td>
                <Table.Td><Badge size="xs" color={reg.paymentType === 'Bank' ? 'blue' : 'orange'}>{reg.paymentType}</Badge></Table.Td>
                <Table.Td>{dmy(reg.paymentDate)}</Table.Td>
                <Table.Td>{reg.centerLabel}</Table.Td>
                <Table.Td>{reg.paymentType === 'Bank' ? (reg.bankFilter || 'All Banks') : '-'}</Table.Td>
                <Table.Td ta="right">{reg.producerCount}</Table.Td>
                <Table.Td ta="right" fw={600}>{fmtAmt(reg.totalAmount)}</Table.Td>
                <Table.Td>
                  {reg.paymentType === 'Bank'
                    ? <>{reg.bankLedgerName}<br /><Text span size="xs" c="dimmed">Chq {reg.chequeNumber}{reg.chequeDetails ? ` · ${reg.chequeDetails}` : ''}</Text></>
                    : 'Cash in Hand'}
                </Table.Td>
                <Table.Td>{reg.voucherNumber || '-'}</Table.Td>
                <Table.Td><Badge size="xs" color={reg.status === 'Saved' ? 'green' : 'gray'}>{reg.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Producers & audit trail"><ActionIcon size="sm" variant="light" onClick={() => setAudit(reg)}><IconListDetails size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Open — print / export by Center or Bank"><ActionIcon size="sm" variant="light" color="teal" onClick={() => onView(reg)}><IconEye size={14} /></ActionIcon></Tooltip>
                    {reg.status === 'Saved' && mayEdit && (
                      <Tooltip label="Edit"><ActionIcon size="sm" variant="light" color="blue" onClick={() => onEdit(reg)}><IconEdit size={14} /></ActionIcon></Tooltip>
                    )}
                    {reg.status === 'Saved' && mayCancel && (
                      <Tooltip label="Cancel payment"><ActionIcon size="sm" variant="light" color="red" onClick={() => cancelReg(reg)}><IconBan size={14} /></ActionIcon></Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {audit && (
        <Modal opened onClose={() => setAudit(null)} title={`${audit.registerNumber} — producers & audit trail`} size="xl" centered>
          <Text fw={600} size="sm" mb={4}>Audit trail</Text>
          <Table withTableBorder fz="xs" mb="md">
            <Table.Tbody>
              {(audit.audit || []).map((a, i) => (
                <Table.Tr key={i}>
                  <Table.Td w={140}>{dayjs(a.at).format('DD/MM/YYYY HH:mm')}</Table.Td>
                  <Table.Td w={80}><Badge size="xs" variant="light">{a.action}</Badge></Table.Td>
                  <Table.Td w={120}>{a.byName || '-'}</Table.Td>
                  <Table.Td>{a.details}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text fw={600} size="sm" mb={4}>Producers ({audit.entries?.length || 0})</Text>
          <ScrollArea h={300}>
            <Table withTableBorder withColumnBorders fz="xs" striped>
              <Table.Thead><Table.Tr><Table.Th>Producer ID</Table.Th><Table.Th>Name</Table.Th><Table.Th>Bank / Account</Table.Th><Table.Th ta="right">Net Payable (₹)</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {[...(audit.entries || [])].sort((a, b) => String(a.producerId).localeCompare(String(b.producerId), undefined, { numeric: true })).map((e) => (
                  <Table.Tr key={e._id || e.farmerId}>
                    <Table.Td>{e.producerId}</Table.Td><Table.Td>{e.producerName}</Table.Td>
                    <Table.Td>{[e.bankName, e.accountNumber].filter(Boolean).join(' · ') || '-'}</Table.Td>
                    <Table.Td ta="right">{fmtAmt(e.netPayable)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Modal>
      )}
    </Modal>
  );
}

// ── Share by Email ───────────────────────────────────────────────
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function EmailModal({ onClose, onSend, sending, defaultSubject }) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('Please find the payment register attached.');
  const [attachPdf, setAttachPdf] = useState(true);
  const [attachExcel, setAttachExcel] = useState(true);
  const [error, setError] = useState('');
  const submit = () => {
    const list = splitEmails(to);
    const ccList = splitEmails(cc);
    if (!list.length) return setError('Enter the recipient email address');
    const bad = [...list, ...ccList].filter((e) => !EMAIL_RE.test(e));
    if (bad.length) return setError(`Invalid email address: ${bad.join(', ')}`);
    if (!attachPdf && !attachExcel) return setError('Attach the PDF and/or the Excel file');
    setError('');
    onSend({ to: list.join(','), cc: ccList.join(','), subject, message, attachPdf, attachExcel });
  };
  return (
    <Modal opened onClose={sending ? () => {} : onClose} title="Share Payment Register by Email" size="lg" centered>
      <Stack gap="xs">
        <TextInput label="To" placeholder="name@example.com, …" value={to} onChange={(e) => setTo(e.target.value)} withAsterisk />
        <TextInput label="Cc" value={cc} onChange={(e) => setCc(e.target.value)} />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea label="Message" autosize minRows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <Group>
          <Checkbox label="Attach PDF" checked={attachPdf} onChange={(e) => setAttachPdf(e.currentTarget.checked)} />
          <Checkbox label="Attach Excel" checked={attachExcel} onChange={(e) => setAttachExcel(e.currentTarget.checked)} />
        </Group>
        {error && <Text c="red" size="sm">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={sending}>Close</Button>
          <Button leftSection={<IconMail size={14} />} loading={sending} onClick={submit}>Send</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const TABLE = { width: '100%', minWidth: 1700, borderCollapse: 'collapse', fontSize: 12, fontFamily: '"Segoe UI", Arial, sans-serif' };
const TH = { background: '#e9eef5', border: '1px solid #c9d3df', padding: '6px 6px', fontWeight: 700, fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap' };
const TD = { border: '1px solid #dde3ea', padding: '4px 6px', whiteSpace: 'nowrap' };
const TDC = { ...TD, textAlign: 'center' };
const TDR = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const TF = { border: '1px solid #1a4070', padding: '6px', whiteSpace: 'nowrap' };

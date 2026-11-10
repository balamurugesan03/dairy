/**
 * Dairy Reports → LSGD Reports → LSGD Mithram Statement
 *
 * Panchayat (+ ward) producers with month-wise milk from Milk Purchase for the
 * selected From–To period (one column per month, generated from the dates),
 * Total Milk × subsidy ₹/litre = Total Amount, and an editable Subsidy Allotted.
 * Rows can be dropped from the statement (never from Farmer Management), columns
 * hidden; the preview, print, PDF, Excel and email all use the same rows/columns.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Group, Text, Title, Paper, SimpleGrid, NumberInput, Select, Autocomplete, TextInput,
  Checkbox, Table, ActionIcon, Tooltip, Badge, Popover, Stack, Divider, ScrollArea, Center, Loader,
  Modal, Textarea, Alert
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconFileSpreadsheet, IconFileTypePdf, IconPrinter, IconMail, IconTrash, IconColumns, IconRefresh,
  IconArrowBackUp, IconEye, IconPlayerPlay, IconAlertTriangle, IconPencil
} from '@tabler/icons-react';
import { farmerFormAPI, lsgdMithramAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import {
  DETAIL_COLUMNS, AMOUNT_COLUMNS, monthColumns, visibleColumns, computeRows, computeTotals, cellValue,
  totalValue, fmtQty, fmtAmt, headerFacts, buildStatementHtml, printStatement, buildStatementPdf,
  buildStatementWorkbook, collectDocuments, reportFileName, arrayBufferToBase64, PDF_TYPE, XLSX_TYPE, r2
} from '../../utils/lsgdMithramReport';

const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toYmd = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  return ymdOf(v);
};
const today = new Date();
const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
const DEFAULT_FROM = `${fyStartYear}-04-01`;
const DEFAULT_TO = ymdOf(today);

const HIDDEN_KEY = 'lsgdMithram:hiddenColumns';
const editsKey = (companyId, p) => `lsgdMithram:edits:${companyId || ''}:${[p.panchayat, p.ward, p.fromDate, p.toDate].map((s) => String(s || '').trim().toUpperCase()).join('|')}`;
const readJson = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };

export default function LsgdMithramStatement() {
  const { selectedCompany } = useCompany() || {};
  const companyId = selectedCompany?._id;

  // ── Filters ────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);
  const [rate, setRate] = useState(0);
  const [panchayat, setPanchayat] = useState('');
  const [panchayats, setPanchayats] = useState([]);
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState('');
  const [wardNumber, setWardNumber] = useState('');
  const [members, setMembers] = useState([]);
  const [wardMember, setWardMember] = useState('');
  const [onlySuppliers, setOnlySuppliers] = useState(true);

  // ── Report + user edits ────────────────────────────────────────
  const [report, setReport] = useState(null);       // { months, rows, meta }
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState({});   // farmerId → Subsidy Allotted
  const [removed, setRemoved] = useState([]);       // farmerIds dropped from this statement
  const [hidden, setHidden] = useState(() => new Set(readJson(HIDDEN_KEY, [])));
  const [withDocs, setWithDocs] = useState(false);
  const [busy, setBusy] = useState('');             // 'print' | 'pdf' | 'excel' | 'email'
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    farmerFormAPI.getPanchayats().then((r) => setPanchayats(r?.data || [])).catch(() => {});
  }, [companyId]);

  // Wards of the Panchayat
  useEffect(() => {
    const p = panchayat.trim();
    if (!p) { setWards([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      lsgdMithramAPI.getWards(p).then((r) => { if (alive) setWards(r?.data || []); }).catch(() => { if (alive) setWards([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [panchayat]);

  // Ward → ward number + saved ward members
  useEffect(() => {
    const p = panchayat.trim();
    if (!p || !ward) { setMembers([]); return undefined; }
    const w = wards.find((x) => x.ward === ward);
    setWardNumber(w?.wardNumber || '');
    let alive = true;
    lsgdMithramAPI.getWardMembers({ panchayat: p, ward }).then((r) => {
      if (!alive) return;
      const list = r?.data || [];
      setMembers(list);
      if (list[0]) {
        setWardMember((cur) => cur || list[0].memberName);
        if (list[0].wardNumber) setWardNumber((cur) => cur || list[0].wardNumber);
      }
    }).catch(() => { if (alive) setMembers([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ward, panchayat]);

  const wardOptions = useMemo(() => wards.map((w) => ({
    value: w.ward,
    label: `${w.ward}${w.wardNumber && w.wardNumber !== w.ward ? ` (No. ${w.wardNumber})` : ''}${w.farmers ? ` · ${w.farmers} farmers` : ''}`,
  })), [wards]);

  // ── Generate ───────────────────────────────────────────────────
  const generate = async () => {
    const f = toYmd(fromDate);
    const t = toYmd(toDate);
    if (!f || !t) return notifications.show({ color: 'orange', message: 'Select From Date and To Date' });
    if (f > t) return notifications.show({ color: 'orange', message: 'From Date must be on or before To Date' });
    if (!panchayat.trim()) return notifications.show({ color: 'orange', message: 'Select a Panchayat' });
    setLoading(true);
    try {
      const params = { fromDate: f, toDate: t, panchayat: panchayat.trim(), ward: ward || '', rate: Number(rate) || 0, onlySuppliers };
      const res = await lsgdMithramAPI.getStatement(params);
      const data = res?.data;
      setReport(data);
      // Manual amounts / removed rows of this same statement are kept (also across reloads)
      const saved = readJson(editsKey(companyId, params), null);
      const ids = new Set((data?.rows || []).map((r) => r.farmerId));
      setOverrides(Object.fromEntries(Object.entries(saved?.overrides || {}).filter(([id]) => ids.has(id))));
      setRemoved((saved?.removed || []).filter((id) => ids.has(id)));
      if (ward && wardMember.trim()) {
        lsgdMithramAPI.saveWardMember({ panchayat: panchayat.trim(), ward, wardNumber, memberName: wardMember.trim() })
          .then(() => lsgdMithramAPI.getWardMembers({ panchayat: panchayat.trim(), ward }))
          .then((r) => setMembers(r?.data || []))
          .catch(() => {});
      }
      if (!data?.rows?.length) {
        notifications.show({
          color: 'orange',
          message: data?.meta?.farmersInPanchayat
            ? `No producer of ${data.meta.panchayat}${ward ? ` / ${ward}` : ''} supplied milk in this period`
            : `No farmers found for ${panchayat}${ward ? ` / ${ward}` : ''} in Farmer Management`,
        });
      }
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not generate the statement' });
    } finally {
      setLoading(false);
    }
  };

  // Persist edits for this statement
  const editParams = report?.meta ? { panchayat: report.meta.panchayat, ward: report.meta.ward, fromDate: report.meta.fromDate, toDate: report.meta.toDate } : null;
  useEffect(() => {
    if (!editParams) return;
    const k = editsKey(companyId, editParams);
    if (!Object.keys(overrides).length && !removed.length) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ overrides, removed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, removed, companyId, editParams?.panchayat, editParams?.ward, editParams?.fromDate, editParams?.toDate]);

  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])); }, [hidden]);

  // ── Derived ────────────────────────────────────────────────────
  const months = useMemo(() => report?.months || [], [report]);
  const removedSet = useMemo(() => new Set(removed), [removed]);
  const rows = useMemo(() => computeRows(report?.rows || [], rate, overrides, removedSet), [report, rate, overrides, removedSet]);
  const totals = useMemo(() => computeTotals(rows, months), [rows, months]);
  const columns = useMemo(() => visibleColumns(months, hidden), [months, hidden]);
  const facts = useMemo(() => headerFacts({ meta: report?.meta, ward: report?.meta?.ward, wardNumber, wardMember: wardMember.trim(), rate }), [report, wardNumber, wardMember, rate]);
  const missingBank = rows.filter((r) => !r.accountNumber || !r.ifsc).length;
  const missingAadhaar = rows.filter((r) => !r.aadhaar).length;
  const withDocCount = rows.filter((r) => r.docs && (r.docs.bankPassbook || r.docs.aadhaar || r.docs.rationCard)).length;
  const manualCount = rows.filter((r) => r.manual).length;
  const canExport = !!report && columns.length > 0;

  // ── Row edits ──────────────────────────────────────────────────
  const setAllotted = (id, v) => {
    if (v === '' || v === null || v === undefined) {
      setOverrides((o) => { const n = { ...o }; delete n[id]; return n; });
      return;
    }
    const num = Number(v);
    if (!Number.isFinite(num) || num < 0) return;
    setOverrides((o) => ({ ...o, [id]: r2(num) }));
  };
  const resetAllotted = (id) => setOverrides((o) => { const n = { ...o }; delete n[id]; return n; });

  const confirmRemove = (r) => modals.openConfirmModal({
    title: 'Remove producer from statement',
    children: (
      <Text size="sm">
        Remove <b>{r.producerNo} – {r.name}</b> ({fmtQty(r.totalMilk)} L) from this statement? Totals are recalculated.
        The farmer record in Farmer Management is <b>not</b> deleted.
      </Text>
    ),
    labels: { confirm: 'Remove', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: () => setRemoved((list) => [...list, r.farmerId]),
  });

  const resetEdits = () => modals.openConfirmModal({
    title: 'Reset changes',
    children: <Text size="sm">Restore all removed producers and set every Subsidy Allotted back to the calculated Total Amount?</Text>,
    labels: { confirm: 'Reset', cancel: 'Cancel' },
    onConfirm: () => { setOverrides({}); setRemoved([]); },
  });

  // ── Column settings ────────────────────────────────────────────
  const toggleCol = (key, on) => setHidden((h) => { const n = new Set(h); if (on) n.delete(key); else n.add(key); return n; });
  const setAllCols = (on, keys) => setHidden((h) => { const n = new Set(h); keys.forEach((k) => (on ? n.delete(k) : n.add(k))); return n; });
  const monthCols = monthColumns(months);
  const allKeys = [...DETAIL_COLUMNS, ...monthCols, ...AMOUNT_COLUMNS].map((c) => c.key);

  // ── Outputs ────────────────────────────────────────────────────
  const output = { facts, columns, rows, totals };
  const docProgress = (done, total) => notifications.update({ id: 'lsgd-docs', loading: true, autoClose: false, message: `Loading documents ${done}/${total}…` });
  const loadDocs = async () => {
    if (!withDocs || !withDocCount) return [];
    notifications.show({ id: 'lsgd-docs', loading: true, autoClose: false, message: `Loading documents of ${withDocCount} producers…` });
    try {
      const res = await collectDocuments(rows, docProgress);
      notifications.update({ id: 'lsgd-docs', loading: false, autoClose: 3000, color: res.failed.length ? 'orange' : 'green',
        message: res.failed.length ? `Documents could not be loaded for: ${res.failed.join(', ')}` : `${res.groups.length} producers' documents added` });
      return res.groups;
    } catch {
      notifications.update({ id: 'lsgd-docs', loading: false, autoClose: 4000, color: 'orange', message: 'Documents could not be loaded — statement only' });
      return [];
    }
  };

  const doPrint = async () => {
    setBusy('print');
    try {
      if (withDocs && withDocCount) notifications.show({ id: 'lsgd-docs', loading: true, autoClose: false, message: 'Loading documents…' });
      const r = await printStatement({ ...output, withDocuments: withDocs && withDocCount > 0, onProgress: docProgress });
      if (withDocs && withDocCount) notifications.hide('lsgd-docs');
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed?.length) notifications.show({ color: 'orange', message: `Documents could not be loaded for: ${r.failed.join(', ')}` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setBusy('');
    }
  };

  const makePdf = async () => buildStatementPdf({ ...output, docGroups: await loadDocs() });
  const makeExcel = async () => {
    const { XLSX, wb } = await buildStatementWorkbook(output);
    return { XLSX, wb };
  };

  const doPdf = async () => {
    setBusy('pdf');
    try {
      const doc = await makePdf();
      doc.save(reportFileName(facts, '.pdf'));
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'PDF export failed' });
    } finally {
      setBusy('');
    }
  };

  const doExcel = async () => {
    setBusy('excel');
    try {
      const { XLSX, wb } = await makeExcel();
      XLSX.writeFile(wb, reportFileName(facts, '.xlsx'));
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Excel export failed' });
    } finally {
      setBusy('');
    }
  };

  const sendEmail = async ({ to, cc, subject, message, attachPdf, attachExcel }) => {
    setBusy('email');
    try {
      const attachments = [];
      if (attachPdf) {
        const doc = await makePdf();
        attachments.push({ filename: reportFileName(facts, '.pdf'), contentType: PDF_TYPE, contentBase64: arrayBufferToBase64(doc.output('arraybuffer')) });
      }
      if (attachExcel) {
        const { XLSX, wb } = await makeExcel();
        attachments.push({ filename: reportFileName(facts, '.xlsx'), contentType: XLSX_TYPE, contentBase64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) });
      }
      const res = await lsgdMithramAPI.email({ to, cc, subject, message, attachments });
      notifications.show({ color: 'green', message: res?.message || 'Email sent' });
      setEmailOpen(false);
    } catch (err) {
      notifications.show({ color: 'red', autoClose: 8000, message: err?.message || 'Email could not be sent' });
    } finally {
      setBusy('');
    }
  };

  const previewHtml = useMemo(() => (previewOpen ? buildStatementHtml(output) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewOpen, facts, columns, rows, totals]);

  // ── Render ─────────────────────────────────────────────────────
  const leadText = columns.findIndex((c) => c.type !== 'text');
  const textCount = leadText === -1 ? columns.length : leadText;

  return (
    <Box p="md">
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Dairy Reports · LSGD Reports</Text>
          <Title order={4}>LSGD Mithram Statement</Title>
        </div>
        <Group gap="xs" wrap="wrap">
          <Checkbox size="xs" label={`Include attached documents${report ? ` (${withDocCount})` : ''}`} checked={withDocs}
            onChange={(e) => setWithDocs(e.currentTarget.checked)} />
          <Button size="xs" variant="default" leftSection={<IconEye size={14} />} disabled={!canExport} onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} disabled={!canExport} loading={busy === 'print'} onClick={doPrint}>Print</Button>
          <Button size="xs" variant="light" color="red" leftSection={<IconFileTypePdf size={14} />} disabled={!canExport} loading={busy === 'pdf'} onClick={doPdf}>PDF</Button>
          <Button size="xs" variant="light" color="green" leftSection={<IconFileSpreadsheet size={14} />} disabled={!canExport} loading={busy === 'excel'} onClick={doExcel}>Excel</Button>
          <Button size="xs" variant="light" color="grape" leftSection={<IconMail size={14} />} disabled={!canExport} onClick={() => setEmailOpen(true)}>Share by Email</Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" mb="md">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
          <DateInput label="From Date" valueFormat="DD-MM-YYYY" value={fromDate} onChange={(v) => setFromDate(toYmd(v))} required />
          <DateInput label="To Date" valueFormat="DD-MM-YYYY" value={toDate} onChange={(v) => setToDate(toYmd(v))} minDate={fromDate || undefined} required />
          <NumberInput label="Subsidy Amount (₹ per litre)" value={rate} onChange={(v) => setRate(v === '' ? 0 : Number(v))}
            min={0} decimalScale={2} step={0.5} leftSection="₹" />
          <Autocomplete label="Panchayat" placeholder={panchayats.length ? 'Select Panchayat' : 'Type Panchayat'} data={panchayats}
            value={panchayat} onChange={(v) => { setPanchayat(v); setWard(''); setWardNumber(''); setWardMember(''); }} limit={50} required />
          <Select label="Ward" placeholder={wards.length ? 'All wards' : (panchayat ? 'No wards in Farmer Management' : 'Select Panchayat first')}
            data={wardOptions} value={ward || null} clearable searchable
            onChange={(v) => { setWard(v || ''); setWardMember(''); if (!v) setWardNumber(''); }} disabled={!panchayat.trim()} />
          <TextInput label="Ward Number" value={wardNumber} onChange={(e) => setWardNumber(e.currentTarget.value)}
            placeholder="Auto from ward" description={ward ? null : 'Select a ward'} disabled={!ward} />
          <Autocomplete label="Ward Member Name" placeholder={members.length ? 'Select or type' : 'Type the ward member name'}
            data={[...new Set(members.map((m) => m.memberName))]} value={wardMember} onChange={setWardMember}
            description={ward ? (members.length ? 'Saved for this ward' : 'Saved for the ward on Generate') : null} />
          <Stack gap={6} justify="flex-end">
            <Checkbox size="xs" label="Only producers who supplied milk in the period" checked={onlySuppliers}
              onChange={(e) => setOnlySuppliers(e.currentTarget.checked)} />
            <Button leftSection={<IconPlayerPlay size={14} />} onClick={generate} loading={loading}>Generate</Button>
          </Stack>
        </SimpleGrid>
      </Paper>

      {loading && <Center h={200}><Loader /></Center>}

      {!loading && !report && (
        <Center h={160}><Text c="dimmed" size="sm">Select the period and Panchayat, then click Generate</Text></Center>
      )}

      {!loading && report && (
        <Paper withBorder p="sm">
          <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light">{facts.panchayat}{report.meta.ward ? ` · ${report.meta.ward}` : ''}</Badge>
              <Badge variant="light" color="gray">{facts.period}</Badge>
              <Badge variant="light" color="gray">FY {facts.financialYear}</Badge>
              <Badge variant="light" color="teal">{rows.length} producers</Badge>
              {removed.length > 0 && <Badge variant="light" color="red">{removed.length} removed</Badge>}
              {manualCount > 0 && <Badge variant="light" color="orange">{manualCount} amounts edited</Badge>}
              {missingBank > 0 && <Badge variant="outline" color="orange">{missingBank} without bank details</Badge>}
              {missingAadhaar > 0 && <Badge variant="outline" color="orange">{missingAadhaar} without Aadhaar</Badge>}
            </Group>
            <Group gap="xs">
              {(removed.length > 0 || manualCount > 0) && (
                <Button size="xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={14} />} onClick={resetEdits}>Reset changes</Button>
              )}
              <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={generate}>Refresh</Button>
              <ColumnSettings monthCols={monthCols} hidden={hidden} toggleCol={toggleCol} setAllCols={setAllCols} allKeys={allKeys} />
            </Group>
          </Group>

          {columns.length === 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>Every column is hidden — select columns in Column Settings.</Alert>
          ) : (
            <ScrollArea type="auto" offsetScrollbars>
              <Table withTableBorder withColumnBorders striped highlightOnHover fz="xs" verticalSpacing={4} style={{ minWidth: 900 }}>
                <Table.Thead>
                  <HeadRows columns={columns} />
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 && (
                    <Table.Tr><Table.Td colSpan={columns.length + 1}><Text ta="center" c="dimmed" size="sm" py="md">No producers in this statement</Text></Table.Td></Table.Tr>
                  )}
                  {rows.map((r, i) => (
                    <Table.Tr key={r.farmerId}>
                      {columns.map((c) => {
                        if (c.key === 'subsidyAllotted') {
                          return (
                            <Table.Td key={c.key} style={{ minWidth: 130 }}>
                              <Group gap={2} wrap="nowrap">
                                <NumberInput size="xs" value={r.subsidyAllotted} min={0} decimalScale={2} hideControls
                                  thousandSeparator="," onChange={(v) => setAllotted(r.farmerId, v)}
                                  styles={{ input: { textAlign: 'right', fontWeight: r.manual ? 700 : 400, color: r.manual ? 'var(--mantine-color-orange-8)' : undefined } }}
                                  leftSection={r.manual ? <IconPencil size={11} /> : null} w={110} />
                                {r.manual && (
                                  <Tooltip label={`Back to calculated ₹${fmtAmt(r.totalAmount)}`}>
                                    <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => resetAllotted(r.farmerId)}><IconArrowBackUp size={13} /></ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                          );
                        }
                        const v = cellValue(r, c, i);
                        if (c.type === 'text') {
                          const missing = !v && ['accountNumber', 'ifsc', 'aadhaar'].includes(c.key);
                          return (
                            <Table.Td key={c.key} ta={c.align === 'center' ? 'center' : 'left'} style={{ whiteSpace: c.key === 'name' ? 'normal' : 'nowrap' }}>
                              {missing ? <Text span size="xs" c="orange">missing</Text> : v}
                            </Table.Td>
                          );
                        }
                        return (
                          <Table.Td key={c.key} ta="right" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {c.type === 'qty' ? fmtQty(v) : fmtAmt(v)}
                          </Table.Td>
                        );
                      })}
                      <Table.Td w={36} ta="center">
                        <Tooltip label="Remove from this statement">
                          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => confirmRemove(r)}><IconTrash size={14} /></ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ background: 'var(--mantine-color-gray-1)', fontWeight: 700 }}>
                    {textCount > 0 && <Table.Td colSpan={textCount} ta="center" fw={700}>GRAND TOTAL</Table.Td>}
                    {columns.slice(textCount).map((c) => {
                      const v = totalValue(totals, c);
                      return (
                        <Table.Td key={c.key} ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                          {v == null ? '' : (c.type === 'qty' ? fmtQty(v) : `₹ ${fmtAmt(v)}`)}
                        </Table.Td>
                      );
                    })}
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>
          )}

          <Divider my="xs" />
          <Group gap="lg" wrap="wrap">
            <Text size="sm">Total Milk: <b>{fmtQty(totals.totalMilk)} L</b></Text>
            <Text size="sm">Total Amount: <b>₹ {fmtAmt(totals.totalAmount)}</b></Text>
            <Text size="sm">Subsidy Allotted: <b>₹ {fmtAmt(totals.subsidyAllotted)}</b></Text>
            {removed.length > 0 && (
              <Button size="compact-xs" variant="subtle" color="red" onClick={() => setRemoved([])}>Restore {removed.length} removed</Button>
            )}
          </Group>
        </Paper>
      )}

      <Modal opened={previewOpen} onClose={() => setPreviewOpen(false)} title="Print Preview — LSGD Mithram Statement" size="95%" centered>
        <Text size="xs" c="dimmed" mb={6}>Same layout as Print / PDF{withDocs ? ' (attached documents are added when printing)' : ''}.</Text>
        <iframe title="LSGD Mithram Statement preview" srcDoc={previewHtml}
          style={{ width: '100%', height: '75vh', border: '1px solid var(--mantine-color-gray-4)', background: '#fff' }} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button leftSection={<IconPrinter size={14} />} loading={busy === 'print'} onClick={doPrint}>Print</Button>
        </Group>
      </Modal>

      {emailOpen && (
        <EmailModal
          onClose={() => setEmailOpen(false)}
          onSend={sendEmail}
          sending={busy === 'email'}
          withDocs={withDocs && withDocCount > 0}
          defaultSubject={`LSGD Mithram Statement - ${facts.panchayat}${facts.ward ? ` - ${facts.ward}` : ''} - ${facts.period}`}
          defaultMessage={`Please find attached the LSGD Mithram Statement of ${facts.society || 'the society'} for ${facts.panchayat}${facts.ward ? `, ${facts.ward}` : ''}, period ${facts.period}.\n\nProducers: ${rows.length}\nTotal Milk: ${fmtQty(totals.totalMilk)} litres\nSubsidy Allotted: Rs. ${fmtAmt(totals.subsidyAllotted)}`}
        />
      )}
    </Box>
  );
}

function HeadRows({ columns }) {
  const months = columns.filter((c) => c.group);
  const th = { textAlign: 'center', verticalAlign: 'middle', background: 'var(--mantine-color-gray-1)', whiteSpace: 'normal' };
  if (!months.length) {
    return (
      <Table.Tr>
        {columns.map((c) => <Table.Th key={c.key} style={th}>{c.label}</Table.Th>)}
        <Table.Th style={th} />
      </Table.Tr>
    );
  }
  const firstMonth = months[0].key;
  return (
    <>
      <Table.Tr>
        {columns.map((c) => {
          if (c.group) {
            if (c.key !== firstMonth) return null;
            return <Table.Th key="grp" colSpan={months.length} style={th}>{c.group}</Table.Th>;
          }
          return <Table.Th key={c.key} rowSpan={2} style={th}>{c.label}</Table.Th>;
        })}
        <Table.Th rowSpan={2} style={th} />
      </Table.Tr>
      <Table.Tr>
        {months.map((c) => <Table.Th key={c.key} style={th}>{c.label}</Table.Th>)}
      </Table.Tr>
    </>
  );
}

function ColumnSettings({ monthCols, hidden, toggleCol, setAllCols, allKeys }) {
  const groups = [
    { title: 'Producer details', cols: DETAIL_COLUMNS },
    { title: 'Monthly milk (Litre)', cols: monthCols },
    { title: 'Amounts', cols: AMOUNT_COLUMNS },
  ];
  const shown = allKeys.filter((k) => !hidden.has(k)).length;
  return (
    <Popover width={300} position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Button size="xs" variant="light" leftSection={<IconColumns size={14} />}>Column Settings ({shown}/{allKeys.length})</Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Group justify="space-between" mb="xs">
          <Button size="compact-xs" variant="subtle" onClick={() => setAllCols(true, allKeys)}>Select all</Button>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setAllCols(false, allKeys)}>Deselect all</Button>
        </Group>
        <ScrollArea.Autosize mah={380}>
          <Stack gap="xs">
            {groups.map((g) => g.cols.length > 0 && (
              <div key={g.title}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">{g.title}</Text>
                  <Checkbox size="xs" label="All"
                    checked={g.cols.every((c) => !hidden.has(c.key))}
                    indeterminate={g.cols.some((c) => !hidden.has(c.key)) && !g.cols.every((c) => !hidden.has(c.key))}
                    onChange={(e) => setAllCols(e.currentTarget.checked, g.cols.map((c) => c.key))} />
                </Group>
                <SimpleGrid cols={2} spacing={4} verticalSpacing={4}>
                  {g.cols.map((c) => (
                    <Checkbox key={c.key} size="xs" label={c.label} checked={!hidden.has(c.key)} onChange={(e) => toggleCol(c.key, e.currentTarget.checked)} />
                  ))}
                </SimpleGrid>
              </div>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Text size="xs" c="dimmed" mt="xs">Applies to the screen, Print, PDF, Excel and email. Totals do not change.</Text>
      </Popover.Dropdown>
    </Popover>
  );
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
const RECENT_KEY = 'lsgdMithram:recentEmails';

function EmailModal({ onClose, onSend, sending, withDocs, defaultSubject, defaultMessage }) {
  const recent = readJson(RECENT_KEY, []);
  const [to, setTo] = useState(recent[0] || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [attachPdf, setAttachPdf] = useState(true);
  const [attachExcel, setAttachExcel] = useState(true);
  const [error, setError] = useState('');

  const submit = useCallback(() => {
    const list = splitEmails(to);
    const ccList = splitEmails(cc);
    if (!list.length) return setError('Enter the recipient email address');
    const bad = [...list, ...ccList].filter((e) => !EMAIL_RE.test(e));
    if (bad.length) return setError(`Invalid email address: ${bad.join(', ')}`);
    if (!attachPdf && !attachExcel) return setError('Attach the PDF and/or the Excel file');
    setError('');
    localStorage.setItem(RECENT_KEY, JSON.stringify([...new Set([list.join(', '), ...recent])].slice(0, 8)));
    return onSend({ to: list.join(','), cc: ccList.join(','), subject, message, attachPdf, attachExcel });
  }, [to, cc, subject, message, attachPdf, attachExcel, onSend, recent]);

  return (
    <Modal opened onClose={sending ? () => {} : onClose} title="Share LSGD Mithram Statement by Email" size="lg" centered>
      <Stack gap="sm">
        <Autocomplete label="To" placeholder="name@example.com (several: separate with commas)" data={recent} value={to} onChange={setTo} required />
        <TextInput label="CC" placeholder="Optional" value={cc} onChange={(e) => setCc(e.currentTarget.value)} />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <Textarea label="Message" autosize minRows={4} maxRows={10} value={message} onChange={(e) => setMessage(e.currentTarget.value)} />
        <Group>
          <Checkbox label={`Attach PDF${withDocs ? ' (with attached documents)' : ''}`} checked={attachPdf} onChange={(e) => setAttachPdf(e.currentTarget.checked)} />
          <Checkbox label="Attach Excel" checked={attachExcel} onChange={(e) => setAttachExcel(e.currentTarget.checked)} />
        </Group>
        {error && <Alert color="red" py={6}>{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button leftSection={<IconMail size={14} />} loading={sending} onClick={submit}>Send</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

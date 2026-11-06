import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Modal, Stepper, Stack, Group, Button, Text, Table, Select, TextInput, Badge, Alert,
  Checkbox, SegmentedControl, ScrollArea, SimpleGrid, Paper, Loader, Center
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { DataTable } from 'mantine-datatable';
import { IconUpload, IconFileSpreadsheet, IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { farmerAPI } from '../../services/api';
import { message } from '../../utils/toast';

// ══════════════════════════════════════════════════════════════════════════════
//  DP system farmer import
//    1. Upload  — VillageCode, VillageName, MemberCode, MemberName, MobileNo,
//                 IsMember, IsActive, RateType, ImportType
//    2. Map     — each unique VillageCode → one Collection Centre (existing, or new C<number>)
//    3. Preview — server dry run: Create / Update / Duplicate / Error per row
//    4. Result  — totals, duplicates and failures with reasons
// ══════════════════════════════════════════════════════════════════════════════

const COLUMNS = {
  villageCode: ['villagecode', 'village code', 'village_code'],
  villageName: ['villagename', 'village name', 'village_name'],
  memberCode:  ['membercode', 'member code', 'member_code'],
  memberName:  ['membername', 'member name', 'member_name'],
  mobileNo:    ['mobileno', 'mobile no', 'mobile_no', 'mobile', 'mobilenumber'],
  isMember:    ['ismember', 'is member', 'is_member'],
  isActive:    ['isactive', 'is active', 'is_active'],
  rateType:    ['ratetype', 'rate type', 'rate_type'],
  importType:  ['importtype', 'import type', 'import_type'],
};
const REQUIRED = ['villageCode', 'villageName', 'memberCode', 'memberName'];
const LABEL = { villageCode: 'VillageCode', villageName: 'VillageName', memberCode: 'MemberCode', memberName: 'MemberName' };
const NEW = '__new__';

const codeStr = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return /^\d+(\.0+)?$/.test(s) ? String(parseInt(s, 10)) : s;
};

const ACTION_COLOR = { Create: 'green', Update: 'blue', Duplicate: 'orange', Error: 'red' };

const DpFarmerImportModal = ({ opened, onClose, onImported }) => {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [busy, setBusy] = useState(false);

  const [centres, setCentres] = useState([]);
  const [mapping, setMapping] = useState({});      // villageCode → { centreId | NEW, newCode, matchedBy }
  const [numberSeries, setNumberSeries] = useState('Existing');

  const [preview, setPreview] = useState(null);
  const [switchSeries, setSwitchSeries] = useState(true);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(0); setFileName(''); setRows([]); setParseError(''); setBusy(false);
    setCentres([]); setMapping({}); setPreview(null); setFilter('All'); setPage(1); setResult(null);
  };
  const close = () => { reset(); onClose(); };

  // ── Step 1: read the Excel ──────────────────────────────────────────────────
  const readFile = (file) => {
    setParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!json.length) { setParseError('The file has no rows'); return; }

        const headers = Object.keys(json[0]);
        const colOf = {};
        for (const [field, names] of Object.entries(COLUMNS)) {
          colOf[field] = headers.find(h => names.includes(h.toLowerCase().replace(/\s+/g, ' ').trim()));
        }
        const missing = REQUIRED.filter(f => !colOf[f]);
        if (missing.length) {
          setParseError(`Missing column(s): ${missing.map(f => LABEL[f]).join(', ')}. Found: ${headers.join(', ')}`);
          return;
        }
        const parsed = json.map((r, i) => {
          const o = { rowNumber: i + 2 };
          for (const f of Object.keys(COLUMNS)) o[f] = colOf[f] ? r[colOf[f]] : '';
          o.villageCode = codeStr(o.villageCode);
          o.memberCode = codeStr(o.memberCode);
          o.villageName = String(o.villageName ?? '').trim();
          o.memberName = String(o.memberName ?? '').trim();
          return o;
        }).filter(o => o.villageCode || o.memberCode || o.memberName);   // skip blank lines
        setRows(parsed);
        setFileName(file.name);
      } catch (err) {
        setParseError(`Could not read the file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const villages = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r.villageCode) continue;
      if (!map.has(r.villageCode)) map.set(r.villageCode, { villageCode: r.villageCode, villageName: r.villageName, farmers: 0 });
      const v = map.get(r.villageCode);
      v.farmers += 1;
      if (!v.villageName && r.villageName) v.villageName = r.villageName;
    }
    return [...map.values()].sort((a, b) => (parseInt(a.villageCode, 10) || 0) - (parseInt(b.villageCode, 10) || 0) || a.villageCode.localeCompare(b.villageCode));
  }, [rows]);

  const goToMapping = async () => {
    setBusy(true);
    try {
      const res = await farmerAPI.dpImportSuggest(villages.map(v => ({ villageCode: v.villageCode, villageName: v.villageName })));
      const d = res.data || {};
      setCentres(d.centres || []);
      setNumberSeries(d.numberSeries || 'Existing');
      const m = {};
      for (const s of d.mappings || []) {
        m[s.villageCode] = s.centreId
          ? { centreId: s.centreId, matchedBy: s.matchedBy, newCode: '' }
          : { centreId: NEW, matchedBy: null, newCode: String(s.newCode || '').replace(/^C/i, '') };
      }
      setMapping(m);
      setStep(1);
    } catch (err) {
      message.error(err.message || 'Failed to load centres');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: mapping checks (server re-checks everything) ────────────────────
  const centreOptions = useMemo(() => [
    { value: NEW, label: '+ Create new centre (VillageName)' },
    ...centres
      .slice()
      .sort((a, b) => (parseInt(String(a.centerCode).slice(1), 10) || 0) - (parseInt(String(b.centerCode).slice(1), 10) || 0))
      .map(c => ({
        value: String(c._id),
        label: `${c.centerCode || '—'} — ${c.centerName}${c.dpVillageCode ? ` (DP ${c.dpVillageCode})` : ''}${c.status === 'Inactive' ? ' [Inactive]' : ''}`
      }))
  ], [centres]);

  const mappingIssues = useMemo(() => {
    const issues = {};
    const usedCentre = new Map();
    const usedNew = new Map();
    const existingCodes = new Set(centres.map(c => c.centerCode));
    for (const v of villages) {
      const m = mapping[v.villageCode];
      if (!m || !m.centreId) { issues[v.villageCode] = 'Select a centre'; continue; }
      if (m.centreId === NEW) {
        const n = parseInt(m.newCode, 10);
        if (!/^\d{1,6}$/.test(m.newCode || '') || !(n > 0)) { issues[v.villageCode] = 'Enter the code number'; continue; }
        const code = `C${n}`;
        if (existingCodes.has(code)) { issues[v.villageCode] = `${code} already exists — select it above`; continue; }
        if (usedNew.has(code)) { issues[v.villageCode] = `${code} also used for Village ${usedNew.get(code)}`; continue; }
        if (!v.villageName) { issues[v.villageCode] = 'VillageName missing'; continue; }
        usedNew.set(code, v.villageCode);
      } else {
        if (usedCentre.has(m.centreId)) { issues[v.villageCode] = `Same centre as Village ${usedCentre.get(m.centreId)}`; continue; }
        usedCentre.set(m.centreId, v.villageCode);
      }
    }
    return issues;
  }, [mapping, villages, centres]);

  const setMap = (vc, patch) => setMapping(prev => ({ ...prev, [vc]: { ...prev[vc], ...patch } }));

  const payloadMappings = () => villages.map(v => {
    const m = mapping[v.villageCode] || {};
    return m.centreId === NEW
      ? { villageCode: v.villageCode, villageName: v.villageName, newCode: `C${parseInt(m.newCode, 10)}` }
      : { villageCode: v.villageCode, villageName: v.villageName, centreId: m.centreId };
  });

  const sendRows = () => rows.map(r => ({
    rowNumber: r.rowNumber, villageCode: r.villageCode, villageName: r.villageName,
    memberCode: r.memberCode, memberName: r.memberName, mobileNo: r.mobileNo,
    isMember: r.isMember, isActive: r.isActive, rateType: r.rateType, importType: r.importType,
  }));

  // ── Step 3: dry-run preview ─────────────────────────────────────────────────
  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await farmerAPI.dpImport({ rows: sendRows(), mappings: payloadMappings(), dryRun: true, switchToCentreSeries: switchSeries });
      setPreview(res.data);
      setFilter('All'); setPage(1);
      setStep(2);
    } catch (err) {
      message.error(err.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  // Re-run the preview when the centre-wise numbering choice changes (it changes row results)
  const toggleSwitchSeries = async (checked) => {
    setSwitchSeries(checked);
    setBusy(true);
    try {
      const res = await farmerAPI.dpImport({ rows: sendRows(), mappings: payloadMappings(), dryRun: true, switchToCentreSeries: checked });
      setPreview(res.data);
    } catch (err) {
      message.error(err.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    setBusy(true);
    try {
      const res = await farmerAPI.dpImport({ rows: sendRows(), mappings: payloadMappings(), dryRun: false, switchToCentreSeries: switchSeries });
      if (res.data?.dryRun) {
        setPreview(res.data);
        message.error('Fix the centre mapping errors first');
        return;
      }
      setResult(res.data);
      setStep(3);
      message.success(res.message || 'Import completed');
      onImported?.();
    } catch (err) {
      message.error(err.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const previewRows = useMemo(() => {
    const all = preview?.preview || [];
    if (filter === 'All') return all;
    if (filter === 'Warnings') return all.filter(r => r.warnings?.length);
    return all.filter(r => r.action === filter);
  }, [preview, filter]);
  const PAGE = 50;
  const pageRows = previewRows.slice((page - 1) * PAGE, page * PAGE);

  const s = preview?.summary;
  const canImport = preview && !preview.mappingErrors?.length && (s?.create + s?.update) > 0;
  const showSeriesOption = !!preview?.needsCentreSeries;

  return (
    <Modal opened={opened} onClose={close} title="Import Farmers (DP System)" size="80rem" centered closeOnClickOutside={false}>
      <Stepper active={step} size="sm" mb="md" allowNextStepsSelect={false}>
        <Stepper.Step label="Upload" description="DP Excel file" />
        <Stepper.Step label="Map Villages" description="VillageCode → Centre" />
        <Stepper.Step label="Preview" description="Validate" />
        <Stepper.Step label="Result" />
      </Stepper>

      {step === 0 && (
        <Stack>
          <Dropzone
            onDrop={(files) => files[0] && readFile(files[0])}
            accept={[MIME_TYPES.xlsx, MIME_TYPES.xls, MIME_TYPES.csv]}
            maxFiles={1}
            maxSize={15 * 1024 * 1024}
          >
            <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
              <IconUpload size={36} stroke={1.5} />
              <div>
                <Text size="md">Drop the DP system Excel here or click to select</Text>
                <Text size="xs" c="dimmed">
                  Columns: VillageCode, VillageName, MemberCode, MemberName, MobileNo, IsMember, IsActive, RateType, ImportType
                </Text>
              </div>
            </Group>
          </Dropzone>
          {parseError && <Alert color="red" icon={<IconAlertTriangle size={16} />}>{parseError}</Alert>}
          {rows.length > 0 && (
            <Paper withBorder p="sm">
              <Group gap="xs" mb="xs">
                <IconFileSpreadsheet size={18} />
                <Text fw={600}>{fileName}</Text>
                <Badge variant="light">{rows.length} farmers</Badge>
                <Badge variant="light" color="teal">{villages.length} villages</Badge>
              </Group>
              <ScrollArea.Autosize mah={220}>
                <Table striped withTableBorder fz="sm">
                  <Table.Thead><Table.Tr><Table.Th>VillageCode</Table.Th><Table.Th>VillageName</Table.Th><Table.Th ta="right">Farmers</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {villages.map(v => (
                      <Table.Tr key={v.villageCode}><Table.Td>{v.villageCode}</Table.Td><Table.Td>{v.villageName || <Text c="red" size="sm">missing</Text>}</Table.Td><Table.Td ta="right">{v.farmers}</Table.Td></Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Paper>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button onClick={goToMapping} disabled={!rows.length || !villages.length} loading={busy}>Next: Map Villages</Button>
          </Group>
        </Stack>
      )}

      {step === 1 && (
        <Stack>
          <Alert variant="light" icon={<IconInfoCircle size={16} />}>
            Every farmer with the same VillageCode goes to ONE Collection Centre. Pick the centre whose code matches the DP
            Center Number, or create a new centre (named after the VillageName). The mapping is remembered for the next import.
          </Alert>
          <ScrollArea.Autosize mah={420}>
            <Table withTableBorder striped verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={110}>VillageCode</Table.Th>
                  <Table.Th>VillageName</Table.Th>
                  <Table.Th w={80} ta="right">Farmers</Table.Th>
                  <Table.Th w={340}>Collection Centre</Table.Th>
                  <Table.Th w={150}>New Center Code</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {villages.map(v => {
                  const m = mapping[v.villageCode] || {};
                  const issue = mappingIssues[v.villageCode];
                  return (
                    <Table.Tr key={v.villageCode}>
                      <Table.Td fw={600}>{v.villageCode}</Table.Td>
                      <Table.Td>{v.villageName}</Table.Td>
                      <Table.Td ta="right">{v.farmers}</Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          data={centreOptions}
                          value={m.centreId || null}
                          searchable
                          onChange={(val) => setMap(v.villageCode, { centreId: val, matchedBy: null })}
                          error={issue && m.centreId !== NEW ? issue : null}
                          comboboxProps={{ withinPortal: true, zIndex: 10000 }}
                        />
                        {m.matchedBy && <Text size="xs" c="teal">Matched by {m.matchedBy === 'VillageCode' ? 'saved Village Code' : 'centre name'}</Text>}
                      </Table.Td>
                      <Table.Td>
                        {m.centreId === NEW ? (
                          <TextInput
                            size="xs"
                            leftSection={<Text fw={700} size="xs">C</Text>}
                            value={m.newCode || ''}
                            onChange={(e) => setMap(v.villageCode, { newCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            error={issue || null}
                          />
                        ) : <Text size="sm" c="dimmed">—</Text>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <Text size="xs" c="dimmed">
            Farmer Numbers: {numberSeries === 'Centre' ? 'centre-wise (each centre has its own 1, 2, 3 …)' : 'company-wide'} · MemberCode is kept as the Farmer Number.
          </Text>
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={runPreview} loading={busy} disabled={Object.keys(mappingIssues).length > 0}>Next: Preview</Button>
          </Group>
        </Stack>
      )}

      {step === 2 && preview && (
        <Stack>
          {preview.mappingErrors?.length > 0 && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Centre mapping problems">
              {preview.mappingErrors.map(e => <div key={e.villageCode}>{e.message}</div>)}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 2, sm: 5 }}>
            <Stat label="Total rows" value={s.total} />
            <Stat label="New farmers" value={s.create} color="green" />
            <Stat label="Update existing" value={s.update} color="blue" />
            <Stat label="Duplicates" value={s.duplicate} color="orange" />
            <Stat label="Errors" value={s.error} color="red" />
          </SimpleGrid>
          {showSeriesOption && (
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
              <Checkbox
                checked={switchSeries}
                disabled={busy}
                onChange={(e) => toggleSwitchSeries(e.currentTarget.checked)}
                label="Some MemberCodes repeat across villages/centres — switch Farmer Number Series to centre-wise (C100/1, C101/1 …)"
                description="Needed so each village keeps its DP member numbers. Without it, repeated numbers are reported as errors."
              />
            </Alert>
          )}
          <Group justify="space-between">
            <SegmentedControl
              size="xs"
              value={filter}
              onChange={(v) => { setFilter(v); setPage(1); }}
              data={['All', 'Create', 'Update', 'Duplicate', 'Error', 'Warnings']}
            />
            <Text size="xs" c="dimmed">{previewRows.length} rows</Text>
          </Group>
          {busy ? <Center h={200}><Loader /></Center> : (
            <DataTable
              withTableBorder
              striped
              minHeight={180}
              height={380}
              records={pageRows}
              idAccessor="rowNumber"
              totalRecords={previewRows.length}
              recordsPerPage={PAGE}
              page={page}
              onPageChange={setPage}
              columns={[
                { accessor: 'rowNumber', title: 'Row', width: 60 },
                { accessor: 'villageCode', title: 'Village', width: 75 },
                { accessor: 'centreCode', title: 'Centre', width: 80, render: r => r.centreCode ? <Text fw={600} size="sm">{r.centreCode}</Text> : '-' },
                { accessor: 'memberCode', title: 'Farmer No', width: 90 },
                { accessor: 'memberName', title: 'Name' },
                { accessor: 'mobileNo', title: 'Mobile', width: 115 },
                { accessor: 'isMember', title: 'Member', width: 75, render: r => r.isMember === undefined || r.isMember === null ? '-' : r.isMember ? 'Yes' : 'No' },
                { accessor: 'isActive', title: 'Active', width: 70, render: r => r.isActive === undefined || r.isActive === null ? '-' : r.isActive ? 'Yes' : 'No' },
                { accessor: 'rateType', title: 'Rate Type', width: 90 },
                { accessor: 'action', title: 'Status', width: 95, render: r => <Badge size="sm" color={ACTION_COLOR[r.action] || 'gray'}>{r.action}</Badge> },
                {
                  accessor: 'message', title: 'Details', width: 300,
                  render: r => (
                    <div>
                      <Text size="xs" c={r.action === 'Error' ? 'red' : r.action === 'Duplicate' ? 'orange' : undefined}>{r.message}</Text>
                      {r.warnings?.map((w, i) => <Text key={i} size="xs" c="yellow.8">{w}</Text>)}
                    </div>
                  )
                },
              ]}
            />
          )}
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(1)} disabled={busy}>Back</Button>
            <Group gap="xs">
              {s.error + s.duplicate > 0 && <Text size="xs" c="dimmed">Rows with errors/duplicates are skipped.</Text>}
              <Button color="green" leftSection={<IconCheck size={16} />} onClick={confirmImport} loading={busy} disabled={!canImport}>
                Confirm Import ({s.create + s.update})
              </Button>
            </Group>
          </Group>
        </Stack>
      )}

      {step === 3 && result && (
        <Stack>
          <SimpleGrid cols={{ base: 2, sm: 5 }}>
            <Stat label="Total records" value={result.total} />
            <Stat label="Imported (new)" value={result.created} color="green" />
            <Stat label="Updated existing" value={result.updated} color="blue" />
            <Stat label="Duplicates" value={result.duplicates?.length || 0} color="orange" />
            <Stat label="Failed" value={result.failed?.length || 0} color="red" />
          </SimpleGrid>
          {result.createdCentres?.length > 0 && (
            <Alert color="teal" variant="light" title="Collection Centres created">
              {result.createdCentres.map(c => <div key={c.centreCode}>Village {c.villageCode} → {c.centreCode} {c.centreName}</div>)}
            </Alert>
          )}
          {result.switchedToCentreSeries && (
            <Alert color="blue" variant="light">Farmer Number Series switched to centre-wise.</Alert>
          )}
          {(result.failed?.length > 0 || result.duplicates?.length > 0) && (
            <ScrollArea.Autosize mah={300}>
              <Table withTableBorder striped fz="sm">
                <Table.Thead>
                  <Table.Tr><Table.Th>Row</Table.Th><Table.Th>Village</Table.Th><Table.Th>MemberCode</Table.Th><Table.Th>Name</Table.Th><Table.Th>Type</Table.Th><Table.Th>Reason</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...(result.failed || []).map(r => ({ ...r, kind: 'Failed' })), ...(result.duplicates || []).map(r => ({ ...r, kind: 'Duplicate' }))]
                    .sort((a, b) => a.row - b.row)
                    .map((r, i) => (
                      <Table.Tr key={`${r.kind}-${r.row}-${i}`}>
                        <Table.Td>{r.row}</Table.Td><Table.Td>{r.villageCode}</Table.Td><Table.Td>{r.memberCode}</Table.Td><Table.Td>{r.name}</Table.Td>
                        <Table.Td><Badge size="sm" color={r.kind === 'Failed' ? 'red' : 'orange'}>{r.kind}</Badge></Table.Td>
                        <Table.Td>{r.message}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}
          <Group justify="flex-end">
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};

const Stat = ({ label, value, color }) => (
  <Paper withBorder p="xs" ta="center">
    <Text size="xs" c="dimmed">{label}</Text>
    <Text fw={700} size="xl" c={color}>{value ?? 0}</Text>
  </Paper>
);

export default DpFarmerImportModal;

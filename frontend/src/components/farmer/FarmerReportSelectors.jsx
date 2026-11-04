/**
 * Shared pieces of the farmer report forms (Crop Damage Statement, Monthly Agri
 * Statistics): Year + Panchayat selection at the top (Panchayats come from
 * Farmer Management; a name not in the list can be typed), the farmer list
 * with the details a form fills in, and which documents will be printed.
 */
import { useEffect, useState } from 'react';
import { Autocomplete, Select, Group, Badge, Text, TextInput, Paper, SimpleGrid, Button } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { farmerFormAPI } from '../../services/api';
import { FARMER_DOCUMENTS } from '../../utils/farmerDocumentsPrint';

const thisYear = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(thisYear + 1 - i));

const norm = (s) => String(s || '').trim().toUpperCase();

/** Panchayats in Farmer Management + every farmer with the auto-fill fields. */
export const useFarmerFormData = () => {
  const [panchayats, setPanchayats] = useState([]);
  const [farmers, setFarmers] = useState([]);
  useEffect(() => {
    farmerFormAPI.getPanchayats().then(r => setPanchayats(r?.data || [])).catch(() => {});
    farmerFormAPI.getFarmers().then(r => setFarmers(r?.data || [])).catch(() => {});
  }, []);
  return { panchayats, farmers };
};

/** Farmer options, limited to the Panchayat when it is one of the known ones (the chosen farmer always stays). */
export const farmerOptions = (farmers, panchayat, panchayats, selectedId) => {
  const known = panchayat && panchayats.some(p => norm(p) === norm(panchayat));
  return farmers
    .filter(f => !known || f._id === selectedId || norm(f.panchayat) === norm(panchayat))
    .map(f => ({ value: f._id, label: `${f.name || ''} (${f.farmerNumber || ''})` }));
};

export function YearSelect({ value, onChange, ...rest }) {
  const v = value ? String(value) : null;
  const data = v && !YEAR_OPTIONS.includes(v) ? [v, ...YEAR_OPTIONS] : YEAR_OPTIONS;
  return <Select label="Year" data={data} value={v} onChange={x => onChange(x ? +x : null)} allowDeselect={false} {...rest} />;
}

export function PanchayatInput({ value, onChange, panchayats, onPick, ...rest }) {
  return (
    <Autocomplete
      label="Panchayat"
      placeholder={panchayats.length ? 'Select or type Panchayat' : 'Type Panchayat'}
      description="From Farmer Management — or type a new name"
      data={panchayats}
      value={value || ''}
      onChange={onChange}
      onOptionSubmit={onPick}
      limit={50}
      {...rest}
    />
  );
}

/** Which uploaded documents will follow the report in print. */
export function FarmerDocumentsStatus({ farmer }) {
  if (!farmer) return null;
  return (
    <Group gap={6} mt={6} wrap="wrap">
      <Text size="xs" c="dimmed">Printed after the report:</Text>
      {FARMER_DOCUMENTS.map(d => (
        <Badge key={d.key} size="sm" variant="light" color={farmer.docs?.[d.key] ? 'green' : 'gray'}>
          {d.label}{farmer.docs?.[d.key] ? '' : ' — not uploaded'}
        </Badge>
      ))}
    </Group>
  );
}

/**
 * Farmer Number entry: the report is made for a Farmer Number, not a name.
 * Numbers repeat per centre, so "15" may match several farmers (pick the
 * centre) and "C2/15" picks one directly. The farmer's details show below.
 */
export function FarmerNumberLookup({ farmers, farmer, onPick, label = 'Farmer Number', notFoundHint, hideDetails = false, ...rest }) {
  // "C2/15" when the number is in more than one centre, else just "15"
  const display = (f) => (f
    ? (f.centreCode && matchesFor(farmers, f.farmerNumber).length > 1 ? `${f.centreCode}/${f.farmerNumber}` : f.farmerNumber || '')
    : '');
  const [text, setText] = useState(display(farmer));
  const [matches, setMatches] = useState(null);   // null = not searched yet
  // Show the number of the farmer chosen (or loaded with a saved report)
  const [shownFor, setShownFor] = useState(farmer?._id);
  if ((farmer?._id || null) !== (shownFor || null)) {
    setShownFor(farmer?._id);
    setText(display(farmer));
  }

  const find = () => {
    const found = matchesFor(farmers, text);
    setMatches(found);
    if (found.length === 1) onPick(found[0]);
  };

  return (
    <div>
      <TextInput
        label={label}
        placeholder="e.g. 15 or C2/15 — press Enter"
        value={text}
        onChange={e => { setText(e.currentTarget.value); setMatches(null); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(); } }}
        onBlur={() => { if (text.trim() && text.trim() !== farmer?.farmerNumber) find(); }}
        rightSection={<IconSearch size={14} style={{ cursor: 'pointer' }} onClick={find} />}
        {...rest}
      />
      {matches && matches.length === 0 && (
        <Text size="xs" c="red" mt={4}>No farmer with number {text}{notFoundHint ? ` — ${notFoundHint}` : ''}</Text>
      )}
      {matches && matches.length > 1 && (
        <Group gap={6} mt={6}>
          <Text size="xs" c="dimmed">Number {text} is in {matches.length} centres:</Text>
          {matches.map(f => (
            <Button key={f._id} size="compact-xs" variant={farmer?._id === f._id ? 'filled' : 'light'}
              onClick={() => { onPick(f); setMatches([f]); }}>
              {f.centreCode ? `${f.centreCode}/` : ''}{f.farmerNumber} · {f.name}
            </Button>
          ))}
        </Group>
      )}
      {!hideDetails && <FarmerDetailsCard farmer={farmer} />}
    </div>
  );
}

/**
 * Other way to find the farmer when the number isn't known: type part of the
 * name, mobile, Aadhaar, account number or farmer number.
 */
export function FarmerSearchSelect({ farmers, farmer, onPick, label = 'Or search farmer by name / mobile / Aadhaar', ...rest }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toUpperCase();
  const digits = q.replace(/\D/g, '');
  const found = !q ? [] : farmers.filter((f) => {
    if (String(f.name || '').toUpperCase().includes(q)) return true;
    if (String(f.farmerNumber || '').toUpperCase() === q) return true;
    if (digits.length >= 4 && [f.phone, f.aadhaar, f.accountNumber].some((v) => String(v || '').includes(digits))) return true;
    return false;
  }).slice(0, 50);
  // Keep the chosen farmer in the list so its label shows
  const list = farmer && !found.some((f) => f._id === farmer._id) ? [farmer, ...found] : found;
  const data = list.map((f) => ({
    value: f._id,
    label: [`${f.centreCode ? `${f.centreCode}/` : ''}${f.farmerNumber || ''}`, f.name, f.phone, f.panchayat].filter(Boolean).join(' · '),
  }));
  return (
    <Select
      label={label}
      placeholder="Type at least 2 letters of the name, or 4+ digits"
      data={data}
      value={farmer?._id || null}
      searchable
      searchValue={query}
      onSearchChange={setQuery}
      filter={({ options }) => options}
      nothingFoundMessage={q.length >= 2 ? 'No farmer found in Farmer Management' : 'Keep typing…'}
      onChange={(id) => { const f = farmers.find((x) => x._id === id); if (f) onPick(f); }}
      leftSection={<IconSearch size={14} />}
      clearable={false}
      {...rest}
    />
  );
}

// "15" → every farmer numbered 15; "C2/15" → farmer 15 of centre C2
const matchesFor = (farmers, input) => {
  const t = String(input || '').trim().toUpperCase();
  if (!t) return [];
  const m = t.match(/^(C\d+)\s*[/-]\s*(.+)$/);
  const num = (m ? m[2] : t).replace(/^0+(?=\d)/, '');
  const same = (n) => String(n || '').trim().toUpperCase().replace(/^0+(?=\d)/, '') === num;
  return farmers.filter(f => same(f.farmerNumber) && (!m || String(f.centreCode).toUpperCase() === m[1]));
};

/** Details already in Farmer Management, shown under the Farmer Number. */
export function FarmerDetailsCard({ farmer }) {
  if (!farmer) return null;
  const rows = [
    ['Name', farmer.name],
    ['Centre', farmer.centreName ? `${farmer.centreCode ? `${farmer.centreCode} - ` : ''}${farmer.centreName}` : ''],
    ['Mobile', farmer.phone],
    ['Aadhaar', farmer.aadhaar],
    ['Ward', farmer.ward],
    ['Panchayat', farmer.panchayat],
    ['Bank', [farmer.bankName, farmer.branch].filter(Boolean).join(', ')],
    ['A/c No · IFSC', [farmer.accountNumber, farmer.ifsc].filter(Boolean).join(' · ')],
  ];
  return (
    <Paper withBorder p={8} mt={6} bg="#f0f9ff">
      <SimpleGrid cols={2} spacing={4} verticalSpacing={2}>
        {rows.map(([k, v]) => (
          <Text key={k} size="xs"><Text span c="dimmed">{k}: </Text><Text span fw={600} c={v ? undefined : 'orange.7'}>{v || 'not in Farmer Management'}</Text></Text>
        ))}
      </SimpleGrid>
      <FarmerDocumentsStatus farmer={farmer} />
    </Paper>
  );
}

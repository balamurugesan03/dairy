/**
 * Shared pieces of the farmer report forms (Crop Damage Statement, Monthly Agri
 * Statistics): Year + Panchayat selection at the top (Panchayats come from
 * Farmer Management; a name not in the list can be typed), the farmer list
 * with the details a form fills in, and which documents will be printed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Select, Group, Badge, Text, TextInput, Paper, SimpleGrid, Button } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { farmerFormAPI } from '../../services/api';
import { FARMER_DOCUMENTS } from '../../utils/farmerDocumentsPrint';
import {
  placeKey, findKeralaPanchayat, panchayatAliases, panchayatOptions, wardOptions, wardNumberFor
} from '../../utils/keralaPanchayat';

const thisYear = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(thisYear + 1 - i));


/** Panchayats in Farmer Management + every farmer with the auto-fill fields. */
export const useFarmerFormData = () => {
  const [panchayats, setPanchayats] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    farmerFormAPI.getPanchayats().then(r => setPanchayats(r?.data || [])).catch(() => {});
    farmerFormAPI.getFarmers().then(r => setFarmers(r?.data || [])).catch(() => {});
  }, [tick]);
  // reload: after details were saved back to Farmers Management;
  // patchFarmer: update one farmer in place (e.g. its document flags after an upload)
  const reload = () => setTick(t => t + 1);
  const patchFarmer = (id, patch) => setFarmers(list => list.map(f => (f._id === id ? { ...f, ...patch } : f)));
  return { panchayats, farmers, reload, patchFarmer };
};

/** Farmer options, limited to the Panchayat when farmers have it (loose match; the chosen farmer always stays). */
export const farmerOptions = (farmers, panchayat, panchayats, selectedId) => {
  const keys = new Set([panchayat, ...panchayatAliases(panchayat)].map(placeKey).filter(Boolean));
  const known = keys.size > 0 && panchayats.some(p => keys.has(placeKey(p)));
  return farmers
    .filter(f => !known || f._id === selectedId || keys.has(placeKey(f.panchayat)))
    .map(f => ({ value: f._id, label: `${f.name || ''} (${f.farmerNumber || ''})` }));
};

export function YearSelect({ value, onChange, ...rest }) {
  const v = value ? String(value) : null;
  const data = v && !YEAR_OPTIONS.includes(v) ? [v, ...YEAR_OPTIONS] : YEAR_OPTIONS;
  return <Select label="Year" data={data} value={v} onChange={x => onChange(x ? +x : null)} allowDeselect={false} {...rest} />;
}

/**
 * Panchayat: names used in Farmer Management first, then every Kerala Grama Panchayat
 * by district; any other name can be typed (reports match it loosely).
 */
export function PanchayatInput({ value, onChange, panchayats, onPick, description, ...rest }) {
  const data = useMemo(() => panchayatOptions(panchayats), [panchayats]);
  const known = findKeralaPanchayat(value);
  return (
    <Autocomplete
      label="Panchayat"
      placeholder="Select or type the Panchayat"
      description={description !== undefined ? description : (String(value || '').trim()
        ? (known ? `${known.district} district · ${known.ml}` : 'Typed name — matched loosely')
        : 'Kerala Panchayats / Farmer Management — or type a name')}
      data={data}
      value={value || ''}
      onChange={onChange}
      onOptionSubmit={onPick}
      limit={60}
      maxDropdownHeight={300}
      {...rest}
    />
  );
}

/** Wards recorded for the Panchayat's farmers (+ Ward 1…24); returns [{ ward, wardNumber, farmers }] */
export const usePanchayatWards = (panchayat) => {
  const [wards, setWards] = useState([]);
  useEffect(() => {
    const p = String(panchayat || '').trim();
    if (!p) { setWards([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      farmerFormAPI.getWards(p, panchayatAliases(p))
        .then(r => { if (alive) setWards(r?.data || []); })
        .catch(() => { if (alive) setWards([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [panchayat]);
  return wards;
};

/** Ward (select or type) + Ward Number (auto from the ward) for a Panchayat */
/** wrap(node, key) puts each input in its own layout cell, e.g. a Grid.Col */
export function WardInputs({ panchayat, ward, wardNumber, onWard, onWardNumber, wardProps = {}, numberProps = {}, wrap = (n) => n }) {
  const wards = usePanchayatWards(panchayat);
  const data = useMemo(() => wardOptions(wards), [wards]);
  return (
    <>
      {wrap(
        <Autocomplete
          label="Ward"
          placeholder={String(panchayat || '').trim() ? 'Select or type the ward' : 'Select Panchayat first'}
          data={data} limit={60} maxDropdownHeight={280}
          value={ward || ''}
          onChange={v => { onWard(v); const n = wardNumberFor(v, wards); if (n) onWardNumber(n); }}
          {...wardProps}
        />, 'ward'
      )}
      {wrap(
        <TextInput label="Ward Number" placeholder="Auto from ward" value={wardNumber || ''}
          onChange={e => onWardNumber(e.currentTarget.value)} {...numberProps} />, 'wardNumber'
      )}
    </>
  );
}

/** Which uploaded documents will follow the report in print. */
export function FarmerDocumentsStatus({ farmer }) {
  if (!farmer) return null;
  const other = farmer.docs?.otherCount || 0;
  return (
    <Group gap={6} mt={6} wrap="wrap">
      <Text size="xs" c="dimmed">Printed after the report:</Text>
      {FARMER_DOCUMENTS.map(d => (
        <Badge key={d.key} size="sm" variant="light" color={farmer.docs?.[d.key] ? 'green' : 'gray'}>
          {d.label}{farmer.docs?.[d.key] ? '' : ' — not uploaded'}
        </Badge>
      ))}
      {other > 0 && <Badge size="sm" variant="light" color="green">{other} other document{other > 1 ? 's' : ''}</Badge>}
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

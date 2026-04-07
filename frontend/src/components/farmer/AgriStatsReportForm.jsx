import { useState, useEffect } from 'react';
import {
  Box, Button, Group, Grid, TextInput, NumberInput, Select,
  Text, Paper, ScrollArea, Divider, Stack
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { agriStatsAPI } from '../../services/api';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => String(currentYear - i));

// ── Default form data matching model defaults ─────────────────────────────────
const defaultForm = () => ({
  district: '',
  month: MONTHS[new Date().getMonth()],
  year: currentYear,
  status: 'Draft',
  generalInfo: [
    { slNo: 1, details: 'Name of Local Body',  value1: '', value2: '', value3: '' },
    { slNo: 2, details: 'Name of Village',     value1: '', value2: '', value3: '' },
    { slNo: 3, details: 'Ward Number',         value1: '', value2: '', value3: '' },
    { slNo: 4, details: 'Name of Officer',     value1: '', value2: '', value3: '' }
  ],
  populationDetails: [
    { category: 'Population', sc: '', st: '', female: '', male: '', total: '' },
    { category: 'Farmers',    sc: '', st: '', female: '', male: '', total: '' }
  ],
  livestockProduction: [
    { slNo: 1, category: 'Milk Production',  unit: 'Litres',  value: '', avgPerDay: '' },
    { slNo: 2, category: 'Egg Production',   unit: 'Numbers', value: '', avgPerDay: '' },
    { slNo: 3, category: 'Meat Production',  unit: 'Kg',      value: '', avgPerDay: '' },
    { slNo: 4, category: 'Other Products',   unit: '',        value: '', avgPerDay: '' },
    { slNo: 5, category: 'Total Production', unit: '',        value: '', avgPerDay: '' }
  ],
  priceDetails: [
    { slNo: 1, product: 'Milk',           fat: '', snf: '', avgPriceLtr: '' },
    { slNo: 2, product: 'Other Products', fat: '', snf: '', avgPriceLtr: '' }
  ],
  additionalDetails: [
    { slNo: 1, description: '', remarks1: '', remarks2: '', remarks3: '' },
    { slNo: 2, description: '', remarks1: '', remarks2: '', remarks3: '' },
    { slNo: 3, description: '', remarks1: '', remarks2: '', remarks3: '' },
    { slNo: 4, description: '', remarks1: '', remarks2: '', remarks3: '' }
  ]
});

export default function AgriStatsReportForm({ reportId, onClose }) {
  const [form, setForm]     = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!reportId);

  useEffect(() => {
    if (!reportId) { setLoading(false); return; }
    agriStatsAPI.getById(reportId).then(res => {
      if (res?.success) {
        const d = res.data;
        setForm({
          district: d.district || '',
          month:    d.month    || MONTHS[0],
          year:     d.year     || currentYear,
          status:   d.status   || 'Draft',
          generalInfo:         d.generalInfo         || defaultForm().generalInfo,
          populationDetails:   d.populationDetails   || defaultForm().populationDetails,
          livestockProduction: d.livestockProduction || defaultForm().livestockProduction,
          priceDetails:        d.priceDetails        || defaultForm().priceDetails,
          additionalDetails:   d.additionalDetails   || defaultForm().additionalDetails
        });
      }
      setLoading(false);
    });
  }, [reportId]);

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  // Generic array-row updater
  const setRow = (section, idx, field, value) => {
    setForm(p => {
      const arr = [...p[section]];
      arr[idx] = { ...arr[idx], [field]: value };
      // Auto-sum population total
      if (section === 'populationDetails' && ['sc','st','female','male'].includes(field)) {
        const row = arr[idx];
        const sc     = +(field === 'sc'     ? value : row.sc     || 0);
        const st     = +(field === 'st'     ? value : row.st     || 0);
        const female = +(field === 'female' ? value : row.female || 0);
        const male   = +(field === 'male'   ? value : row.male   || 0);
        arr[idx].total = sc + st + female + male || '';
      }
      return { ...p, [section]: arr };
    });
  };

  const handleSubmit = async () => {
    if (!form.district.trim()) {
      notifications.show({ message: 'District is required', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const res = reportId
        ? await agriStatsAPI.update(reportId, form)
        : await agriStatsAPI.create(form);
      if (res?.success) {
        notifications.show({ message: reportId ? 'Report updated' : 'Report created', color: 'green' });
        onClose();
      } else {
        notifications.show({ message: res?.message || 'Save failed', color: 'red' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box p="xl" ta="center"><Text c="dimmed">Loading...</Text></Box>;

  // Shared cell style
  const td = { border: '1px solid #dee2e6', padding: '3px 6px', verticalAlign: 'middle' };
  const th = { ...td, background: '#f1f3f5', fontWeight: 700, fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap' };
  const inp = { variant: 'unstyled', size: 'xs', styles: { input: { textAlign: 'center', fontSize: 11, minWidth: 60 } } };

  return (
    <ScrollArea h="82vh" px="md" pb="md">

      {/* ── Top fields ── */}
      <Paper withBorder p="sm" mt="md" mb="md">
        <Grid gutter="sm">
          <Grid.Col span={4}>
            <TextInput label="District" placeholder="Enter district" value={form.district}
              onChange={e => set('district', e.target.value)} required size="sm" />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select label="Month" data={MONTHS} value={form.month}
              onChange={v => set('month', v)} size="sm" />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select label="Year" data={YEARS} value={String(form.year)}
              onChange={v => set('year', +v)} size="sm" />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select label="Status" data={['Draft','Submitted','Approved']} value={form.status}
              onChange={v => set('status', v)} size="sm" />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Section 1: General Info ── */}
      <SectionBlock label="Section 1 — General Information">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Sl. No', 'Details', 'Value 1', 'Value 2', 'Value 3'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.generalInfo.map((row, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'center', width: 50 }}>{row.slNo}</td>
                <td style={{ ...td, fontWeight: 600, fontSize: 11 }}>{row.details}</td>
                {['value1','value2','value3'].map(f => (
                  <td key={f} style={td}>
                    <TextInput {...inp} value={row[f]} onChange={e => setRow('generalInfo', i, f, e.target.value)}
                      styles={{ input: { fontSize: 11, minWidth: 80 } }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBlock>

      {/* ── Section 2: Population Details ── */}
      <SectionBlock label="Section 2 — Population Details">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Category', 'SC', 'ST', 'Female', 'Male', 'Total'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.populationDetails.map((row, i) => (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 600, fontSize: 11 }}>{row.category}</td>
                {['sc','st','female','male'].map(f => (
                  <td key={f} style={td}>
                    <NumberInput {...inp} value={row[f]} hideControls
                      onChange={v => setRow('populationDetails', i, f, v)} />
                  </td>
                ))}
                <td style={{ ...td, background: '#f8f9fa', textAlign: 'center', fontWeight: 700 }}>
                  {row.total || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBlock>

      {/* ── Section 3: Livestock ── */}
      <SectionBlock label="Section 3 — Livestock / Production">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Sl. No', 'Category', 'Unit', 'Value', 'Avg / Day'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.livestockProduction.map((row, i) => (
              <tr key={i} style={row.category === 'Total Production' ? { background: '#fff9e6' } : {}}>
                <td style={{ ...td, textAlign: 'center', width: 50 }}>{row.slNo}</td>
                <td style={{ ...td, fontWeight: row.category === 'Total Production' ? 700 : 400, fontSize: 11 }}>
                  {row.category}
                </td>
                <td style={td}>
                  <TextInput {...inp} value={row.unit} onChange={e => setRow('livestockProduction', i, 'unit', e.target.value)} />
                </td>
                <td style={td}>
                  <NumberInput {...inp} value={row.value} hideControls onChange={v => setRow('livestockProduction', i, 'value', v)} />
                </td>
                <td style={td}>
                  <NumberInput {...inp} value={row.avgPerDay} hideControls onChange={v => setRow('livestockProduction', i, 'avgPerDay', v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBlock>

      {/* ── Section 4: Price Details ── */}
      <SectionBlock label="Section 4 — Price Details">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Sl. No', 'Product', 'FAT (%)', 'SNF (%)', 'Avg Price / Ltr (₹)'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.priceDetails.map((row, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'center', width: 50 }}>{row.slNo}</td>
                <td style={{ ...td, fontWeight: 600, fontSize: 11 }}>{row.product}</td>
                <td style={td}><NumberInput {...inp} value={row.fat}  hideControls onChange={v => setRow('priceDetails', i, 'fat', v)} /></td>
                <td style={td}><NumberInput {...inp} value={row.snf}  hideControls onChange={v => setRow('priceDetails', i, 'snf', v)} /></td>
                <td style={td}><NumberInput {...inp} value={row.avgPriceLtr} hideControls onChange={v => setRow('priceDetails', i, 'avgPriceLtr', v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBlock>

      {/* ── Section 5: Additional Details ── */}
      <SectionBlock label="Section 5 — Additional Details">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Sl. No', 'Description', 'Remarks 1', 'Remarks 2', 'Remarks 3'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.additionalDetails.map((row, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'center', width: 50 }}>{row.slNo}</td>
                {['description','remarks1','remarks2','remarks3'].map(f => (
                  <td key={f} style={td}>
                    <TextInput {...inp} value={row[f]} onChange={e => setRow('additionalDetails', i, f, e.target.value)}
                      styles={{ input: { fontSize: 11, minWidth: f === 'description' ? 140 : 90 } }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBlock>

      <Group justify="flex-end" pb="md">
        <Button variant="default" onClick={onClose} size="sm">Cancel</Button>
        <Button onClick={handleSubmit} loading={saving} size="sm">
          {reportId ? 'Update Report' : 'Save Report'}
        </Button>
      </Group>
    </ScrollArea>
  );
}

function SectionBlock({ label, children }) {
  return (
    <Paper withBorder p="sm" mb="md">
      <Text fw={700} size="xs" tt="uppercase" c="blue" mb="xs" style={{ letterSpacing: 1 }}>
        {label}
      </Text>
      {children}
    </Paper>
  );
}

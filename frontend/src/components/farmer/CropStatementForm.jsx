import { useState, useEffect } from 'react';
import {
  Box, Button, Group, Grid, TextInput, Select, NumberInput,
  Textarea, Divider, Text, ActionIcon, Tooltip, Stack, Paper,
  ScrollArea, Title
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { cropStatementAPI, farmerAPI } from '../../services/api';

const EMPTY_ROW = () => ({
  cropCultivated: '',
  areaOwned: '',
  areaLeased: '',
  totalCultivatedArea: '',
  areaAffected: '',
  percentageLoss: '',
  descriptionOfDamage: '',
  typeOfDamage: ''
});

const DEFAULT_FORM = {
  farmerName: '',
  farmerId: null,
  surveyNumber: '',
  bankName: '',
  loanAccountNumber: '',
  aadhaarNumber: '',
  mobileNumber: '',
  statementDate: new Date(),
  status: 'Draft',
  cropRows: [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()],
  descriptionOfDamagesOccurred: '',
  farmerDeclaration: '',
  officerDeclaration: ''
};

export default function CropStatementForm({ statementId, onClose }) {
  const [form, setForm]           = useState(DEFAULT_FORM);
  const [farmers, setFarmers]     = useState([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(!!statementId);

  // Load farmers for autocomplete
  useEffect(() => {
    farmerAPI.getAll({ limit: 500 }).then(res => {
      if (res?.success) {
        setFarmers(
          (res.data.farmers || res.data || []).map(f => ({
            value: f._id,
            label: `${f.personalDetails?.name || ''} (${f.farmerNumber || ''})`
          }))
        );
      }
    });
  }, []);

  // Load existing statement for edit
  useEffect(() => {
    if (!statementId) { setLoading(false); return; }
    cropStatementAPI.getById(statementId).then(res => {
      if (res?.success) {
        const d = res.data;
        setForm({
          farmerName:   d.farmerName || '',
          farmerId:     d.farmerId?._id || d.farmerId || null,
          surveyNumber: d.surveyNumber || '',
          bankName:     d.bankName || '',
          loanAccountNumber: d.loanAccountNumber || '',
          aadhaarNumber:     d.aadhaarNumber || '',
          mobileNumber:      d.mobileNumber || '',
          statementDate:     d.statementDate ? new Date(d.statementDate) : new Date(),
          status:       d.status || 'Draft',
          cropRows:     d.cropRows?.length ? d.cropRows : [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()],
          descriptionOfDamagesOccurred: d.descriptionOfDamagesOccurred || '',
          farmerDeclaration:            d.farmerDeclaration || '',
          officerDeclaration:           d.officerDeclaration || ''
        });
      }
      setLoading(false);
    });
  }, [statementId]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const setRow = (idx, field, value) => {
    setForm(prev => {
      const rows = [...prev.cropRows];
      rows[idx] = { ...rows[idx], [field]: value };
      // Auto-calc total
      if (field === 'areaOwned' || field === 'areaLeased') {
        const owned  = field === 'areaOwned'  ? +value : +(rows[idx].areaOwned || 0);
        const leased = field === 'areaLeased' ? +value : +(rows[idx].areaLeased || 0);
        rows[idx].totalCultivatedArea = (owned + leased) || '';
      }
      return { ...prev, cropRows: rows };
    });
  };

  const addRow = () => setForm(prev => ({ ...prev, cropRows: [...prev.cropRows, EMPTY_ROW()] }));
  const removeRow = (idx) => setForm(prev => ({
    ...prev,
    cropRows: prev.cropRows.filter((_, i) => i !== idx)
  }));

  const handleFarmerSelect = (val) => {
    set('farmerId', val);
    // Auto-fill farmerName from the select label
    const found = farmers.find(f => f.value === val);
    if (found) {
      const name = found.label.replace(/\s*\(.*\)\s*$/, '').trim();
      set('farmerName', name);
    }
  };

  const handleSubmit = async () => {
    if (!form.farmerName.trim()) {
      notifications.show({ message: 'Farmer name is required', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        cropRows: form.cropRows.map((r, i) => ({ ...r, slNo: i + 1 }))
      };
      const res = statementId
        ? await cropStatementAPI.update(statementId, payload)
        : await cropStatementAPI.create(payload);

      if (res?.success) {
        notifications.show({ message: statementId ? 'Statement updated' : 'Statement created', color: 'green' });
        onClose();
      } else {
        notifications.show({ message: res?.message || 'Save failed', color: 'red' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box p="xl" ta="center"><Text c="dimmed">Loading...</Text></Box>;

  const colHeader = (label, sub) => (
    <Box ta="center">
      <Text size="xs" fw={700} style={{ whiteSpace: 'nowrap' }}>{label}</Text>
      {sub && <Text size={10} c="dimmed">{sub}</Text>}
    </Box>
  );

  return (
    <ScrollArea h="80vh" px="md" pb="md">
      {/* ── Header info ──────────────────────────────────────────────── */}
      <Paper withBorder p="md" mt="md" mb="md">
        <Text fw={700} mb="xs" size="sm" tt="uppercase" c="dimmed">Farmer & Bank Details</Text>
        <Grid gutter="sm">
          <Grid.Col span={6}>
            <Select
              label="Select Farmer"
              placeholder="Search farmer..."
              data={farmers}
              searchable
              clearable
              value={form.farmerId}
              onChange={handleFarmerSelect}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Name of the Farmer"
              placeholder="Full name"
              value={form.farmerName}
              onChange={e => set('farmerName', e.target.value)}
              required
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Survey Number of Land"
              placeholder="Survey / Patta number"
              value={form.surveyNumber}
              onChange={e => set('surveyNumber', e.target.value)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <DatePickerInput
              label="Statement Date"
              value={form.statementDate}
              onChange={v => set('statementDate', v)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Name of the Bank"
              placeholder="Bank name"
              value={form.bankName}
              onChange={e => set('bankName', e.target.value)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Loan Account Number"
              placeholder="Account number"
              value={form.loanAccountNumber}
              onChange={e => set('loanAccountNumber', e.target.value)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Farmer Aadhaar Number"
              placeholder="12-digit Aadhaar"
              value={form.aadhaarNumber}
              onChange={e => set('aadhaarNumber', e.target.value)}
              size="sm"
              maxLength={12}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Farmer Mobile Number"
              placeholder="10-digit mobile"
              value={form.mobileNumber}
              onChange={e => set('mobileNumber', e.target.value)}
              size="sm"
              maxLength={10}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Status"
              data={['Draft', 'Submitted', 'Approved']}
              value={form.status}
              onChange={v => set('status', v)}
              size="sm"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Crop Table ───────────────────────────────────────────────── */}
      <Paper withBorder p="md" mb="md">
        <Group justify="space-between" mb="xs">
          <Text fw={700} size="sm" tt="uppercase" c="dimmed">Crop Details</Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={addRow}>
            Add Row
          </Button>
        </Group>

        <ScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1f3f5' }}>
                {[
                  ['Sl.No', '(A)'],
                  ['Crop Cultivated', '(B)'],
                  ['Area Owned (Acres)', '(C)'],
                  ['Area Leased (Acres)', '(D)'],
                  ['Total Cultivated Area', '(C+D)'],
                  ['Area Affected (Acres)', '(F)'],
                  ['% of Loss', '(G)'],
                  ['Description of Damage', '(H)'],
                  ['Type of Damage', '(I)'],
                  ['', '']
                ].map(([label, sub], i) => (
                  <th key={i} style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '10px', color: '#868e96' }}>{sub}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700 }}>{label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.cropRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={tdStyle}><Text size="xs" ta="center">{idx + 1}</Text></td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.cropCultivated} onChange={e => setRow(idx, 'cropCultivated', e.target.value)} styles={{ input: { textAlign: 'center', minWidth: 100 } }} />
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.areaOwned} onChange={e => setRow(idx, 'areaOwned', e.target.value)} styles={{ input: { textAlign: 'center', minWidth: 70 } }} />
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.areaLeased} onChange={e => setRow(idx, 'areaLeased', e.target.value)} styles={{ input: { textAlign: 'center', minWidth: 70 } }} />
                  </td>
                  <td style={{ ...tdStyle, background: '#f8f9fa' }}>
                    <Text size="xs" ta="center" c="dimmed">
                      {(+(row.areaOwned || 0) + +(row.areaLeased || 0)) || ''}
                    </Text>
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.areaAffected} onChange={e => setRow(idx, 'areaAffected', e.target.value)} styles={{ input: { textAlign: 'center', minWidth: 70 } }} />
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.percentageLoss} onChange={e => setRow(idx, 'percentageLoss', e.target.value)} styles={{ input: { textAlign: 'center', minWidth: 60 } }} />
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.descriptionOfDamage} onChange={e => setRow(idx, 'descriptionOfDamage', e.target.value)} styles={{ input: { minWidth: 130 } }} />
                  </td>
                  <td style={tdStyle}>
                    <TextInput size="xs" variant="unstyled" value={row.typeOfDamage} onChange={e => setRow(idx, 'typeOfDamage', e.target.value)} styles={{ input: { minWidth: 100 } }} />
                  </td>
                  <td style={{ ...tdStyle, width: 32, textAlign: 'center' }}>
                    {form.cropRows.length > 1 && (
                      <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeRow(idx)}>
                        <IconTrash size={12} />
                      </ActionIcon>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Paper>

      {/* ── Footer Declarations ───────────────────────────────────────── */}
      <Paper withBorder p="md" mb="md">
        <Text fw={700} size="sm" tt="uppercase" c="dimmed" mb="xs">Declarations</Text>
        <Stack gap="sm">
          <Textarea
            label="Description of Damages Occurred"
            placeholder="Describe in detail the damages that occurred..."
            minRows={3}
            value={form.descriptionOfDamagesOccurred}
            onChange={e => set('descriptionOfDamagesOccurred', e.target.value)}
            size="sm"
          />
          <Textarea
            label="Farmer's Declaration"
            placeholder="I hereby declare that the above information is true and correct to the best of my knowledge..."
            minRows={3}
            value={form.farmerDeclaration}
            onChange={e => set('farmerDeclaration', e.target.value)}
            size="sm"
          />
          <Textarea
            label="Officer's Declaration"
            placeholder="I hereby certify that I have personally verified the above details and they are correct..."
            minRows={3}
            value={form.officerDeclaration}
            onChange={e => set('officerDeclaration', e.target.value)}
            size="sm"
          />
        </Stack>
      </Paper>

      <Group justify="flex-end" pb="md">
        <Button variant="default" onClick={onClose} size="sm">Cancel</Button>
        <Button onClick={handleSubmit} loading={saving} size="sm">
          {statementId ? 'Update Statement' : 'Save Statement'}
        </Button>
      </Group>
    </ScrollArea>
  );
}

const tdStyle = {
  border: '1px solid #dee2e6',
  padding: '2px 4px',
  verticalAlign: 'middle'
};

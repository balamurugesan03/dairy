import { useState, useEffect } from 'react';
import {
  Box, Button, Group, Grid, TextInput, Select, NumberInput,
  Textarea, Divider, Text, ActionIcon, Tooltip, Stack, Paper,
  ScrollArea, Title
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { cropStatementAPI, bankMasterAPI } from '../../services/api';
import {
  useFarmerFormData, YearSelect, PanchayatInput, FarmerNumberLookup
} from './FarmerReportSelectors';

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
  farmerNumber: '',
  surveyNumber: '',
  ward: '',
  bankName: '',
  branch: '',
  ifsc: '',
  accountNumber: '',
  bankLedgerId: null,      // from Farmer Bank Details; saved to the farmer with the bank
  loanAccountNumber: '',
  aadhaarNumber: '',
  mobileNumber: '',
  statementDate: new Date(),
  year: new Date().getFullYear(),
  panchayat: '',
  status: 'Draft',
  cropRows: [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()],
  descriptionOfDamagesOccurred: '',
  farmerDeclaration: '',
  officerDeclaration: ''
};

export default function CropStatementForm({ statementId, onClose }) {
  const [form, setForm]           = useState(DEFAULT_FORM);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(!!statementId);

  // Panchayats + farmers (with the details this form fills in) from Farmer Management
  const { panchayats, farmers } = useFarmerFormData();

  // Load existing statement for edit
  useEffect(() => {
    if (!statementId) { setLoading(false); return; }
    cropStatementAPI.getById(statementId).then(res => {
      if (res?.success) {
        const d = res.data;
        setForm({
          farmerName:   d.farmerName || '',
          farmerId:     d.farmerId?._id || d.farmerId || null,
          farmerNumber: d.farmerNumber || d.farmerId?.farmerNumber || '',
          surveyNumber: d.surveyNumber || '',
          ward:         d.ward || '',
          bankName:     d.bankName || '',
          branch:       d.branch || '',
          ifsc:         d.ifsc || '',
          accountNumber: d.accountNumber || '',
          bankLedgerId: null,
          loanAccountNumber: d.loanAccountNumber || '',
          aadhaarNumber:     d.aadhaarNumber || '',
          mobileNumber:      d.mobileNumber || '',
          statementDate:     d.statementDate ? new Date(d.statementDate) : new Date(),
          year:              d.year || (d.statementDate ? new Date(d.statementDate).getFullYear() : new Date().getFullYear()),
          panchayat:         d.panchayat || '',
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

  // Farmer Number → what Farmer Management already has; the rest stays editable.
  // Missing details typed here are saved back to the farmer on Save.
  const handleFarmerPick = (f) => {
    setForm(prev => ({
      ...prev,
      farmerId:      f._id,
      farmerNumber:  f.farmerNumber || '',
      farmerName:    f.name || prev.farmerName,
      aadhaarNumber: f.aadhaar || '',
      mobileNumber:  f.phone || '',
      bankName:      f.bankName || '',
      branch:        f.branch || '',
      ifsc:          f.ifsc || '',
      accountNumber: f.accountNumber || '',
      bankLedgerId:  null,
      ward:          f.ward || '',
      panchayat:     f.panchayat || prev.panchayat,
    }));
  };
  const selectedFarmer = farmers.find(x => x._id === form.farmerId);

  // Farmers Management → Farmer Bank Details: pick a bank to fill its name, branch and IFSC
  const [banks, setBanks] = useState([]);
  useEffect(() => { bankMasterAPI.getAll().then(r => setBanks(r?.data || [])).catch(() => {}); }, []);
  const pickBank = (id) => {
    const b = banks.find(x => x._id === id);
    if (!b) return;
    setForm(prev => ({ ...prev, bankName: b.bankName || '', branch: b.branch || '', ifsc: b.ifsc || '', bankLedgerId: b.bankLedgerId || null }));
  };
  const bankPicked = banks.find(b => (b.bankName || '').trim().toUpperCase() === form.bankName.trim().toUpperCase()
    && (!form.ifsc || (b.ifsc || '').toUpperCase() === form.ifsc.toUpperCase()));

  const handleSubmit = async () => {
    // New statements are made for a Farmer Number (older ones may have only a name)
    if (!form.farmerId && !statementId) {
      notifications.show({ message: 'Enter the Farmer Number and press Enter', color: 'red' });
      return;
    }
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
        if (res.synced?.length) {
          notifications.show({ message: `Saved to Farmers Management: ${res.synced.join(', ')}`, color: 'teal', autoClose: 6000 });
        }
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
      {/* ── Year + Panchayat ─────────────────────────────────────────── */}
      <Paper withBorder p="md" mt="md" mb="md" bg="#f8fafc">
        <Grid gutter="sm">
          <Grid.Col span={3}>
            <YearSelect value={form.year} onChange={v => set('year', v)} size="sm" />
          </Grid.Col>
          <Grid.Col span={9}>
            <PanchayatInput value={form.panchayat} onChange={v => set('panchayat', v)} panchayats={panchayats} size="sm" />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Header info ──────────────────────────────────────────────── */}
      <Paper withBorder p="md" mb="md">
        <Text fw={700} mb="xs" size="sm" tt="uppercase" c="dimmed">Farmer & Bank Details</Text>
        <Grid gutter="sm">
          <Grid.Col span={6}>
            <FarmerNumberLookup farmers={farmers} farmer={selectedFarmer} onPick={handleFarmerPick} size="sm" required />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Name of the Farmer"
              placeholder="Filled from the Farmer Number"
              value={form.farmerName}
              onChange={e => set('farmerName', e.target.value)}
              required
              size="sm"
            />
            <TextInput
              mt="sm"
              label="Ward"
              placeholder="Ward number / name"
              value={form.ward}
              onChange={e => set('ward', e.target.value)}
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
          <Grid.Col span={12}>
            <Text fw={700} size="xs" tt="uppercase" c="dimmed" mt={4}>Bank Details</Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Bank (Farmer Bank Details)"
              placeholder={banks.length ? 'Select bank to fill name, branch, IFSC' : 'No banks in Farmer Bank Details'}
              data={banks.map(b => ({ value: b._id, label: [b.bankName, b.branch, b.ifsc].filter(Boolean).join(' · ') }))}
              value={bankPicked?._id || null}
              onChange={pickBank}
              searchable
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Name of the Bank"
              placeholder="Bank name"
              value={form.bankName}
              onChange={e => setForm(prev => ({ ...prev, bankName: e.target.value, bankLedgerId: null }))}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Branch"
              value={form.branch}
              onChange={e => set('branch', e.target.value)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="IFSC Code"
              value={form.ifsc}
              onChange={e => set('ifsc', e.target.value.toUpperCase())}
              size="sm"
              maxLength={11}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Account Number"
              placeholder="Bank account number"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
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

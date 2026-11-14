/**
 * LSGD Milk Statement → one producer's details and documents, edited on the
 * statement and saved to that farmer in Farmers Management (found by the row's
 * farmer, i.e. its Farmer Number — never a new farmer). Changed fields replace
 * the farmer's values; documents are saved as soon as they are uploaded.
 */
import { useState } from 'react';
import { Modal, Grid, TextInput, Group, Button, Text, Stack, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react';
import { farmerFormAPI } from '../../services/api';
import { PanchayatInput, WardInputs } from './FarmerReportSelectors';
import FarmerDocumentsUpload from './FarmerDocumentsUpload';

const FIELDS = ['panchayat', 'ward', 'wardNumber', 'bankName', 'accountNumber', 'ifsc', 'aadhaarNumber'];
const d = (s) => String(s ?? '').replace(/\s+/g, '');

const validate = (v) => {
  const e = {};
  if (v.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc)) e.ifsc = 'IFSC must be 11 characters, e.g. CNRB0001700';
  if (v.accountNumber && !/^\d{6,18}$/.test(d(v.accountNumber))) e.accountNumber = 'Account number must be 6–18 digits';
  if (v.aadhaarNumber && !/^\d{12}$/.test(d(v.aadhaarNumber))) e.aadhaarNumber = 'Aadhaar must be 12 digits';
  return e;
};

/**
 * @param row         statement row ({ farmerId, farmerNumber, producerNo, name, bankName, accountNumber, ifsc, aadhaar, panchayat, ward, wardNumber })
 * @param panchayats  Panchayat names from Farmer Management
 * @param onSaved     (patch) => void — new values for the row (details and/or docs)
 */
export default function FarmerDetailsSyncModal({ row, panchayats = [], onClose, onSaved }) {
  const initial = {
    panchayat: row.panchayat || '', ward: row.ward || '', wardNumber: row.wardNumber || '',
    bankName: row.bankName || '', accountNumber: row.accountNumber || '', ifsc: row.ifsc || '', aadhaarNumber: row.aadhaar || '',
  };
  const [v, setV] = useState(initial);
  const [changed, setChanged] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, val) => {
    setV((p) => ({ ...p, [k]: val }));
    setChanged((s) => new Set([...s, k]));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const dirty = FIELDS.some((k) => changed.has(k) && String(v[k] ?? '').trim() !== String(initial[k] ?? '').trim());

  const save = async () => {
    const e = validate(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const res = await farmerFormAPI.updateDetails(row.farmerId, { ...v, changed: [...changed] });
      const f = res?.data || {};
      onSaved({
        panchayat: f.panchayat ?? v.panchayat, ward: f.ward ?? v.ward, wardNumber: f.wardNumber ?? v.wardNumber,
        bankName: f.bankName ?? v.bankName, accountNumber: f.accountNumber ?? v.accountNumber,
        ifsc: f.ifsc ?? v.ifsc, aadhaar: f.aadhaar ?? v.aadhaarNumber,
      });
      notifications.show({ color: res?.synced?.length ? 'teal' : 'gray', title: `Farmer ${row.farmerNumber || row.producerNo}`, message: res?.message || 'Saved' });
      onClose();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not save to Farmers Management' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={saving ? () => {} : onClose} centered size="lg"
      title={<Text fw={700}>{row.producerNo} – {row.name}</Text>}>
      <Stack gap="sm">
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} py={6}>
          Saved to this farmer in Farmers Management → Producer Management and used by every report.
        </Alert>
        <Grid gutter="sm">
          <Grid.Col span={12}>
            <PanchayatInput value={v.panchayat} onChange={(x) => set('panchayat', x)} panchayats={panchayats} />
          </Grid.Col>
          <WardInputs
            panchayat={v.panchayat} ward={v.ward} wardNumber={v.wardNumber}
            onWard={(x) => set('ward', x)} onWardNumber={(x) => set('wardNumber', x)}
            wrap={(node, key) => <Grid.Col key={key} span={key === 'ward' ? 8 : 4}>{node}</Grid.Col>}
          />
          <Grid.Col span={6}>
            <TextInput label="Bank name" value={v.bankName} onChange={(e) => set('bankName', e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Account number" value={v.accountNumber} maxLength={18} error={errors.accountNumber}
              onChange={(e) => set('accountNumber', e.currentTarget.value.replace(/\D/g, ''))} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="IFSC code" value={v.ifsc} maxLength={11} error={errors.ifsc}
              onChange={(e) => set('ifsc', e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Aadhaar number" value={v.aadhaarNumber} maxLength={12} error={errors.aadhaarNumber}
              onChange={(e) => set('aadhaarNumber', e.currentTarget.value.replace(/\D/g, ''))} />
          </Grid.Col>
        </Grid>

        <FarmerDocumentsUpload farmerId={row.farmerId} farmerNumber={row.farmerNumber} farmerName={row.name} compact
          onChange={(summary) => onSaved({
            docs: {
              bankPassbook: !!summary.bankPassbook, aadhaar: !!summary.aadhaar, rationCard: !!summary.rationCard,
              incomeProof: !!summary.incomeProof, otherCount: summary.otherCount || 0,
            },
          })} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>Close</Button>
          <Button leftSection={<IconDeviceFloppy size={14} />} onClick={save} loading={saving} disabled={!dirty}>
            Save to Farmers Management
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

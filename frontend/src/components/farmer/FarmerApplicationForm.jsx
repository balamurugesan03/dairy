/**
 * Farmer Application form (Panchayat milk subsidy / incentive).
 * Year + Panchayat + Farmer Number at the top; the farmer's details come from
 * Farmer Management and stay editable. On Save, details the farmer record is
 * missing are written back to that same farmer (never a new farmer).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Group, Grid, TextInput, Select, NumberInput, Textarea, Text, Paper,
  ScrollArea, SegmentedControl, Radio, Badge, Alert
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconEye, IconPrinter, IconRefresh, IconInfoCircle } from '@tabler/icons-react';
import { farmerApplicationAPI, bankMasterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { useFarmerFormData, PanchayatInput, FarmerNumberLookup, FarmerSearchSelect, FarmerDetailsCard } from './FarmerReportSelectors';
import {
  FORM_TYPES, CATEGORIES, DEFAULT_SCHEME, fyLabel, printApplications, currentSchemeYear, SCHEME_YEAR_OPTIONS
} from '../../utils/farmerApplicationPrint';
import FarmerApplicationPreview from './FarmerApplicationPreview';

const thisFy = currentSchemeYear();

const EMPTY = {
  applicationNo: '',
  formType: 'SUBSIDY',
  year: thisFy,
  panchayat: '',
  panchayatLabel: '',
  schemeName: '',
  applicationDate: new Date(),
  farmerId: null,
  farmerNumber: '',
  applicantName: '',
  address: '',
  pincode: '',
  mobileNumber: '',
  category: '',
  gender: '',
  ward: '',
  houseNumber: '',
  rationCardNo: '',
  electionId: '',
  aadhaarNumber: '',
  bankName: '',
  branch: '',
  accountNumber: '',
  ifsc: '',
  bankLedgerId: null,
  isMember: true,
  membershipNo: '',
  societyName: '',
  isSmallFarmer: null,
  landArea: '',
  surveyNumber: '',
  beneficiaryNo: '',
  cowCount: '',
  avgMilkPerDay: '',
  place: '',
  status: 'Draft',
};

const casteToCategory = (c) => {
  const v = String(c || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (v === 'SC') return 'SC';
  if (v === 'ST') return 'ST';
  if (['OBC', 'OEC', 'BC', 'SEBC'].includes(v)) return 'OBC';
  if (['GENERAL', 'GEN', 'OC', 'FC'].includes(v)) return 'General';
  return '';
};

const composeAddress = (f) => [f.houseName, f.place, f.post].map(x => String(x || '').trim()).filter(Boolean).join(', ');

// Same rules as the server
const validateApplication = (f) => {
  const e = {};
  const d = (s) => String(s ?? '').replace(/\s+/g, '');
  if (!f.farmerId) e.farmerId = 'Enter a valid Farmer Number and press Enter';
  if (!f.year) e.year = 'Select the year';
  if (!String(f.panchayat || '').trim()) e.panchayat = 'Select or type the Panchayat';
  if (!String(f.applicantName || '').trim()) e.applicantName = 'Applicant name is required';
  if (f.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(f.ifsc).trim().toUpperCase())) e.ifsc = 'IFSC must be 11 characters, e.g. CNRB0001700';
  if (f.accountNumber && !/^\d{6,18}$/.test(d(f.accountNumber))) e.accountNumber = 'Account number must be 6–18 digits';
  if (f.aadhaarNumber && !/^\d{12}$/.test(d(f.aadhaarNumber))) e.aadhaarNumber = 'Aadhaar must be 12 digits';
  if (f.mobileNumber && !/^\d{10}$/.test(d(f.mobileNumber))) e.mobileNumber = 'Mobile must be 10 digits';
  if (f.pincode && !/^\d{6}$/.test(d(f.pincode))) e.pincode = 'PIN code must be 6 digits';
  if (f.isMember && !String(f.membershipNo || '').trim()) e.membershipNo = 'Membership number is required for a member';
  return e;
};

/** lockedType: 'SUBSIDY' | 'INCENTIVE' — the LSGD report this form belongs to (own form + template). */
export default function FarmerApplicationForm({ applicationId, onClose, onOpenExisting, lockedType }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, formType: lockedType || EMPTY.formType }));
  const [savedId, setSavedId] = useState(applicationId || null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!!applicationId);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [milkInfo, setMilkInfo] = useState(null);
  const { selectedCompany } = useCompany() || {};

  const { panchayats, farmers } = useFarmerFormData();
  const selectedFarmer = farmers.find(x => x._id === form.farmerId);

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // Society name / place for a new form
  useEffect(() => {
    if (applicationId) return;
    farmerApplicationAPI.prefill({}).then(r => {
      const d = r?.data || {};
      setForm(prev => ({
        ...prev,
        societyName: prev.societyName || d.societyName || selectedCompany?.companyName || '',
        place: prev.place || d.place || '',
      }));
    }).catch(() => {});
  }, [applicationId, selectedCompany?.companyName]);

  // Saved application
  useEffect(() => {
    if (!applicationId) return;
    farmerApplicationAPI.getById(applicationId).then(res => {
      const d = res?.data;
      if (d) {
        setForm({
          ...EMPTY,
          ...Object.fromEntries(Object.entries(d).filter(([k]) => k in EMPTY && d[k] !== null && d[k] !== undefined)),
          isSmallFarmer: d.isSmallFarmer ?? null,
          applicationDate: d.applicationDate ? new Date(d.applicationDate) : new Date(),
          cowCount: d.cowCount ?? '',
          avgMilkPerDay: d.avgMilkPerDay ?? '',
          farmerId: d.farmerId?._id || d.farmerId || null,
        });
      }
    }).catch(err => notifications.show({ color: 'red', message: err?.message || 'Could not load the application' }))
      .finally(() => setLoading(false));
  }, [applicationId]);

  // Average milk per day for the secretary's certificate
  const fetchMilk = async (farmerId, year, date, overwrite) => {
    if (!farmerId) return;
    try {
      const r = await farmerApplicationAPI.prefill({ farmerId, year, date: date ? new Date(date).toISOString() : undefined });
      const m = r?.data?.milk || null;
      setMilkInfo(m);
      if (m && overwrite) setForm(prev => ({ ...prev, avgMilkPerDay: m.avgPerDay }));
    } catch { /* leave it for manual entry */ }
  };

  // Farmer Number → everything Farmer Management has; the rest stays editable
  const handleFarmerPick = (f) => {
    setErrors(prev => ({ ...prev, farmerId: undefined, applicantName: undefined }));
    setForm(prev => ({
      ...prev,
      farmerId: f._id,
      farmerNumber: f.farmerNumber || '',
      applicantName: f.name || '',
      address: composeAddress(f),
      pincode: f.pin || '',
      mobileNumber: f.phone || '',
      category: casteToCategory(f.caste),
      gender: f.gender || '',
      ward: f.ward || '',
      houseNumber: f.houseNumber || '',
      rationCardNo: f.rationCardNo || '',
      electionId: f.voterId || '',
      aadhaarNumber: f.aadhaar || '',
      bankName: f.bankName || '',
      branch: f.branch || '',
      accountNumber: f.accountNumber || '',
      ifsc: f.ifsc || '',
      bankLedgerId: null,
      isMember: !!(f.isMembership || f.memberId),
      membershipNo: f.memberId || '',
      panchayat: f.panchayat || prev.panchayat,
    }));
    fetchMilk(f._id, form.year, form.applicationDate, true);
  };

  // Which fields Farmer Management doesn't have (typed ones are saved back to the farmer)
  const missing = useMemo(() => {
    if (!selectedFarmer) return {};
    const f = selectedFarmer;
    return {
      address: !composeAddress(f), pincode: !f.pin, mobileNumber: !f.phone, category: !casteToCategory(f.caste),
      gender: !f.gender, ward: !f.ward, houseNumber: !f.houseNumber, rationCardNo: !f.rationCardNo,
      electionId: !f.voterId, aadhaarNumber: !f.aadhaar, bankName: !f.bankName, branch: !f.branch,
      accountNumber: !f.accountNumber, ifsc: !f.ifsc, membershipNo: !f.memberId, panchayat: !f.panchayat,
    };
  }, [selectedFarmer]);
  const hint = (field) => (missing[field] ? 'Not in Farmer Management — saved to the farmer on Save' : undefined);
  const hintStyles = { description: { color: 'var(--mantine-color-orange-7)' } };

  // Farmers Management → Farmer Bank Details: pick a bank to fill name, branch and IFSC
  const [banks, setBanks] = useState([]);
  useEffect(() => { bankMasterAPI.getAll().then(r => setBanks(r?.data || [])).catch(() => {}); }, []);
  const pickBank = (id) => {
    const b = banks.find(x => x._id === id);
    if (!b) return;
    setForm(prev => ({ ...prev, bankName: b.bankName || '', branch: b.branch || '', ifsc: (b.ifsc || '').toUpperCase(), bankLedgerId: b.bankLedgerId || null }));
    setErrors(prev => ({ ...prev, ifsc: undefined }));
  };
  const bankPicked = banks.find(b => (b.bankName || '').trim().toUpperCase() === form.bankName.trim().toUpperCase()
    && (!form.ifsc || (b.ifsc || '').toUpperCase() === form.ifsc.toUpperCase()));

  const check = () => {
    const e = validateApplication(form);
    setErrors(e);
    const list = Object.values(e).filter(Boolean);
    if (list.length) notifications.show({ color: 'red', title: 'Please correct the form', message: list.join(' · ') });
    return !list.length;
  };

  const handleSave = async () => {
    if (!check()) return null;
    setSaving(true);
    try {
      const res = savedId
        ? await farmerApplicationAPI.update(savedId, form)
        : await farmerApplicationAPI.create(form);
      if (res?.success) {
        setSavedId(res.data._id);
        setForm(prev => ({ ...prev, applicationNo: res.data.applicationNo }));
        notifications.show({ color: 'green', message: `Application ${res.data.applicationNo} saved` });
        if (res.synced?.length) {
          notifications.show({ color: 'teal', autoClose: 7000, title: 'Saved to Farmers Management', message: res.synced.join(', ') });
        }
        return res.data;
      }
      notifications.show({ color: 'red', message: res?.message || 'Save failed' });
    } catch (err) {
      if (err?.existingId && onOpenExisting) {
        notifications.show({ color: 'orange', message: err.message });
        onOpenExisting(err.existingId);
      } else {
        notifications.show({ color: 'red', title: 'Save failed', message: err?.message || 'Could not save the application' });
      }
    } finally {
      setSaving(false);
    }
    return null;
  };

  const handlePreview = () => { if (check()) setPreviewOpen(true); };

  const handlePrint = async () => {
    if (!check()) return;
    setPrinting(true);
    try {
      const r = await printApplications([{ ...form }]);
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed.length) notifications.show({ color: 'orange', message: `Could not load: ${r.failed.join(', ')} — printed without it` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) return <Box p="xl" ta="center"><Text c="dimmed">Loading...</Text></Box>;

  const isSubsidy = form.formType === 'SUBSIDY';

  return (
    <>
      <ScrollArea h="80vh" px="md" pb="md">
        {/* ── Form + Year + Panchayat + Farmer ─────────────────────────── */}
        <Paper withBorder p="md" mt="md" mb="md" bg="#f8fafc">
          <Group justify="space-between" mb="sm">
            {lockedType ? (
              <Text fw={700} size="sm">{FORM_TYPES.find(t => t.value === lockedType)?.label}</Text>
            ) : (
              <SegmentedControl
                value={form.formType}
                onChange={v => set('formType', v)}
                data={FORM_TYPES.map(t => ({ value: t.value, label: t.label }))}
                size="xs"
              />
            )}
            {form.applicationNo && <Badge variant="light" size="lg">{form.applicationNo}</Badge>}
          </Group>
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select
                label="Year" required
                data={SCHEME_YEAR_OPTIONS}
                value={form.year ? String(form.year) : null}
                onChange={v => { set('year', v ? +v : null); fetchMilk(form.farmerId, v ? +v : null, form.applicationDate, false); }}
                allowDeselect={false}
                error={errors.year}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <PanchayatInput
                value={form.panchayat} onChange={v => set('panchayat', v)} panchayats={panchayats}
                required error={errors.panchayat}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="Panchayat name in heading"
                description="As printed, e.g. കാഞ്ഞിരംകുളം — blank uses Panchayat"
                value={form.panchayatLabel}
                onChange={e => set('panchayatLabel', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FarmerNumberLookup
                farmers={farmers} farmer={selectedFarmer} onPick={handleFarmerPick} required error={errors.farmerId}
                notFoundHint="search by name, mobile or Aadhaar below" hideDetails
              />
              <FarmerSearchSelect mt="sm" farmers={farmers} farmer={selectedFarmer} onPick={handleFarmerPick} />
              <FarmerDetailsCard farmer={selectedFarmer} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Scheme name (പദ്ധതി)"
                placeholder={DEFAULT_SCHEME[form.formType]}
                value={form.schemeName}
                onChange={e => set('schemeName', e.target.value)}
              />
              <DatePickerInput
                mt="sm" label="Application date" valueFormat="DD-MM-YYYY"
                value={form.applicationDate}
                onChange={v => set('applicationDate', v)}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* ── 1–11 Applicant ───────────────────────────────────────────── */}
        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="xs" size="sm" tt="uppercase" c="dimmed">Applicant details</Text>
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="1. അപേക്ഷകന്റെ പേര് (Applicant name)" required value={form.applicantName}
                onChange={e => set('applicantName', e.target.value)} error={errors.applicantName} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <TextInput label="Mobile / Phone" value={form.mobileNumber} maxLength={10}
                onChange={e => set('mobileNumber', e.target.value.replace(/\D/g, ''))}
                error={errors.mobileNumber} description={hint('mobileNumber')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select label="Gender (സ്ത്രീ/പുരുഷൻ)" data={['Female', 'Male', 'Other']} value={form.gender || null}
                onChange={v => set('gender', v || '')} clearable description={hint('gender')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 9 }}>
              <Textarea label="Address (മേൽവിലാസം)" autosize minRows={2} value={form.address}
                onChange={e => set('address', e.target.value)} description={hint('address')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <TextInput label="PIN code" value={form.pincode} maxLength={6}
                onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))}
                error={errors.pincode} description={hint('pincode')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select label="Category (വിഭാഗം)" value={form.category || null} onChange={v => set('category', v || '')} clearable
                data={CATEGORIES.map(c => ({ value: c.value, label: `${c.en} — ${c.label}` }))}
                description={hint('category')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <TextInput label="Ward number" value={form.ward} onChange={e => set('ward', e.target.value)}
                description={hint('ward')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <TextInput label="House number" value={form.houseNumber} onChange={e => set('houseNumber', e.target.value)}
                description={hint('houseNumber')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Ration card number" value={form.rationCardNo} onChange={e => set('rationCardNo', e.target.value)}
                description={hint('rationCardNo')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Election ID number" value={form.electionId} onChange={e => set('electionId', e.target.value.toUpperCase())}
                description={hint('electionId')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Aadhaar number" value={form.aadhaarNumber} maxLength={12}
                onChange={e => set('aadhaarNumber', e.target.value.replace(/\D/g, ''))}
                error={errors.aadhaarNumber} description={hint('aadhaarNumber')} styles={hintStyles} />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* ── Bank ─────────────────────────────────────────────────────── */}
        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="xs" size="sm" tt="uppercase" c="dimmed">Bank details</Text>
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Bank (Farmer Bank Details)"
                placeholder={banks.length ? 'Select bank to fill name, branch, IFSC' : 'No banks in Farmer Bank Details'}
                data={banks.map(b => ({ value: b._id, label: [b.bankName, b.branch, b.ifsc].filter(Boolean).join(' · ') }))}
                value={bankPicked?._id || null}
                onChange={pickBank}
                searchable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Bank name" value={form.bankName}
                onChange={e => setForm(prev => ({ ...prev, bankName: e.target.value, bankLedgerId: null }))}
                description={hint('bankName')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Branch" value={form.branch} onChange={e => set('branch', e.target.value)}
                description={hint('branch')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Account number" value={form.accountNumber} maxLength={18}
                onChange={e => set('accountNumber', e.target.value.replace(/\D/g, ''))}
                error={errors.accountNumber} description={hint('accountNumber')} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="IFSC code" value={form.ifsc} maxLength={11}
                onChange={e => set('ifsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                error={errors.ifsc} description={hint('ifsc')} styles={hintStyles} />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* ── 12–14 Society, land, beneficiary ─────────────────────────── */}
        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="xs" size="sm" tt="uppercase" c="dimmed">Dairy society, land &amp; scheme</Text>
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Radio.Group label="Member of dairy society? (അംഗമാണോ)" value={form.isMember ? 'yes' : 'no'}
                onChange={v => set('isMember', v === 'yes')}>
                <Group mt={6}><Radio value="yes" label="Yes (അതെ)" /><Radio value="no" label="No (അല്ല)" /></Group>
              </Radio.Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <TextInput label="Membership number" value={form.membershipNo} disabled={!form.isMember}
                onChange={e => set('membershipNo', e.target.value)} error={errors.membershipNo}
                description={form.isMember ? hint('membershipNo') : undefined} styles={hintStyles} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Dairy society name (ക്ഷീര സംഘം)" value={form.societyName}
                onChange={e => set('societyName', e.target.value)} />
            </Grid.Col>

            {isSubsidy && (
              <>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <Radio.Group label="Small / marginal farmer? (ചെറുകിട/നാമമാത്ര)"
                    value={form.isSmallFarmer === true ? 'yes' : form.isSmallFarmer === false ? 'no' : ''}
                    onChange={v => set('isSmallFarmer', v === 'yes' ? true : v === 'no' ? false : null)}>
                    <Group mt={6}><Radio value="yes" label="Yes" /><Radio value="no" label="No" /></Group>
                  </Radio.Group>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput label="Total land area (വിസ്തീർണം)" placeholder="e.g. 25 cent" value={form.landArea}
                    onChange={e => set('landArea', e.target.value)} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput label="Survey number" value={form.surveyNumber} onChange={e => set('surveyNumber', e.target.value)} />
                </Grid.Col>
              </>
            )}
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <TextInput label="Beneficiary list number" value={form.beneficiaryNo} onChange={e => set('beneficiaryNo', e.target.value)} />
            </Grid.Col>
            {!isSubsidy && (
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <NumberInput label="Milch cows reared (കറവപ്പശുക്കൾ)" min={0} allowDecimal={false} value={form.cowCount}
                  onChange={v => set('cowCount', v)} />
              </Grid.Col>
            )}
            {isSubsidy && (
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <NumberInput
                  label="Average milk / day (litres)" min={0} decimalScale={2} value={form.avgMilkPerDay}
                  onChange={v => set('avgMilkPerDay', v)}
                  description={milkInfo ? `${milkInfo.qty} L over ${milkInfo.days} days poured` : 'From milk purchase records'}
                  rightSection={<IconRefresh size={14} style={{ cursor: 'pointer' }} title="Recalculate"
                    onClick={() => fetchMilk(form.farmerId, form.year, form.applicationDate, true)} />}
                />
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <TextInput label="Place (സ്ഥലം)" value={form.place} onChange={e => set('place', e.target.value)} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select label="Status" data={['Draft', 'Submitted', 'Approved']} value={form.status}
                onChange={v => set('status', v || 'Draft')} allowDeselect={false} />
            </Grid.Col>
          </Grid>
        </Paper>

        <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} mb="md">
          Print adds the farmer&apos;s uploaded Bank Statement, Aadhaar and Ration Card after the form (only those uploaded).
          Year shown on the form: <b>{fyLabel(form.year)}</b>.
        </Alert>

        <Group justify="flex-end" pb="md">
          <Button variant="default" onClick={onClose}>Close</Button>
          <Button variant="light" leftSection={<IconEye size={16} />} onClick={handlePreview}>Generate / Preview</Button>
          <Button variant="light" color="teal" leftSection={<IconPrinter size={16} />} onClick={handlePrint} loading={printing}>Print</Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={saving}>
            {savedId ? 'Update' : 'Save'}
          </Button>
        </Group>
      </ScrollArea>

      <FarmerApplicationPreview opened={previewOpen} onClose={() => setPreviewOpen(false)} application={form} />
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Grid, Paper, Title, Text, TextInput, Select, NumberInput,
  Button, Group, Badge, Table, ActionIcon, Stack, Divider, Tooltip,
  Radio, FileButton, Loader, Center, ScrollArea, Box, Anchor,
  ThemeIcon, Flex, SimpleGrid, Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Dropzone } from '@mantine/dropzone';
import {
  IconBuilding, IconUser, IconCalendar, IconUpload, IconEye,
  IconDownload, IconTrash, IconSearch, IconCheck, IconAlertCircle,
  IconClock, IconDeviceFloppy, IconEdit, IconFileDescription,
  IconBuildingBank, IconId, IconLicense, IconCertificate,
  IconX, IconRefresh, IconInfoCircle, IconFilter,
} from '@tabler/icons-react';
import { societyInfoAPI } from '../../services/api';

// ─── Document Type Registry ──────────────────────────────────────────────────
const DOCUMENT_TYPES = [
  { key: 'registration',   label: 'Society Registration Certificate', icon: IconCertificate, hasExpiry: false },
  { key: 'bylaw',          label: 'Society Bylaw / Sub Rules / Division', icon: IconFileDescription, hasExpiry: false },
  { key: 'land',           label: 'Land Document',                    icon: IconBuilding,     hasExpiry: false },
  { key: 'landTax',        label: 'Land Tax',                         icon: IconBuildingBank, hasExpiry: true  },
  { key: 'pan',            label: 'PAN Card Number',                  icon: IconId,           hasExpiry: false },
  { key: 'gst',            label: 'GST Number',                       icon: IconId,           hasExpiry: false },
  { key: 'fssai',          label: 'FSSAI License',                    icon: IconLicense,      hasExpiry: true  },
  { key: 'legalMetrology', label: 'Legal Metrology License',          icon: IconLicense,      hasExpiry: true  },
  { key: 'buildingTax',    label: 'Building Tax',                     icon: IconBuilding,     hasExpiry: true  },
  { key: 'panchayat',      label: 'Panchayat License',                icon: IconLicense,      hasExpiry: true  },
  { key: 'institutional',  label: 'Institutional Fee',                icon: IconBuildingBank, hasExpiry: false },
  { key: 'vehicleTax',     label: 'Vehicle Tax',                      icon: IconCalendar,     hasExpiry: true  },
  { key: 'vehicleInsurance', label: 'Vehicle Insurance',              icon: IconLicense,      hasExpiry: true  },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
  'West Bengal','Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli',
  'Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const AUDIT_CLASSES = ['A', 'B', 'C', 'D', 'AA', 'AB'];

const DRAFT_KEY = 'society_info_draft';

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ doc }) {
  if (!doc?.fileData) return <Badge color="gray" variant="light" size="sm">Pending</Badge>;
  if (doc?.expiryDate && new Date(doc.expiryDate) < new Date()) {
    return <Badge color="red" variant="filled" size="sm">Expired</Badge>;
  }
  if (doc?.expiryDate) {
    const daysLeft = Math.ceil((new Date(doc.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      return <Badge color="orange" variant="light" size="sm">Expiring Soon</Badge>;
    }
  }
  return <Badge color="green" variant="filled" size="sm">Valid</Badge>;
}

// ─── Document Row ─────────────────────────────────────────────────────────────
function DocumentRow({ docType, data, onChange, onSave, onDelete, saving }) {
  const fileRef = useRef(null);
  const Icon = docType.icon;

  const isExpired = data?.expiryDate && new Date(data.expiryDate) < new Date();

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notifications.show({ color: 'red', message: 'File too large. Maximum 10 MB allowed.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(docType.key, {
        ...data,
        fileData: e.target.result,
        fileName: file.name,
        fileType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleView = () => {
    if (!data?.fileData) return;
    const win = window.open();
    if (data.fileType?.includes('pdf')) {
      win.document.write(`<iframe src="${data.fileData}" width="100%" height="100%" style="border:none"></iframe>`);
    } else {
      win.document.write(`<img src="${data.fileData}" style="max-width:100%;margin:auto;display:block"/>`);
    }
  };

  const handleDownload = () => {
    if (!data?.fileData) return;
    const a = document.createElement('a');
    a.href = data.fileData;
    a.download = data.fileName || docType.label;
    a.click();
  };

  return (
    <Table.Tr style={{ background: isExpired ? '#fff5f5' : undefined }}>
      {/* Document Name */}
      <Table.Td style={{ minWidth: 220 }}>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size="sm" radius="sm" color={isExpired ? 'red' : 'blue'} variant="light">
            <Icon size={12} />
          </ThemeIcon>
          <Text size="sm" fw={500} lineClamp={1}>{docType.label}</Text>
        </Group>
      </Table.Td>

      {/* Upload */}
      <Table.Td style={{ minWidth: 160 }}>
        <FileButton onChange={handleFile} accept="application/pdf,image/*">
          {(props) => (
            <Button
              {...props}
              size="xs"
              variant={data?.fileData ? 'light' : 'filled'}
              color={data?.fileData ? 'teal' : 'blue'}
              leftSection={<IconUpload size={12} />}
              style={{ whiteSpace: 'nowrap' }}
            >
              {data?.fileName ? data.fileName.substring(0, 18) + (data.fileName.length > 18 ? '…' : '') : 'Upload File'}
            </Button>
          )}
        </FileButton>
      </Table.Td>

      {/* Document Number */}
      <Table.Td style={{ minWidth: 160 }}>
        <TextInput
          size="xs"
          placeholder="Doc number / ref"
          value={data?.documentNumber || ''}
          onChange={(e) => onChange(docType.key, { ...data, documentNumber: e.target.value })}
          styles={{ input: { height: 30 } }}
        />
      </Table.Td>

      {/* Expiry Date */}
      <Table.Td style={{ minWidth: 150 }}>
        {docType.hasExpiry ? (
          <DatePickerInput
            size="xs"
            placeholder="Expiry date"
            value={data?.expiryDate ? new Date(data.expiryDate) : null}
            onChange={(val) => onChange(docType.key, { ...data, expiryDate: val })}
            clearable
            styles={{ input: { height: 30, borderColor: isExpired ? '#fa5252' : undefined } }}
          />
        ) : (
          <Text size="xs" c="dimmed" ta="center">—</Text>
        )}
      </Table.Td>

      {/* Status */}
      <Table.Td style={{ minWidth: 110 }}>
        <StatusBadge doc={data} />
      </Table.Td>

      {/* Actions */}
      <Table.Td style={{ minWidth: 120 }}>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Save" withArrow>
            <ActionIcon
              size="sm"
              variant="light"
              color="blue"
              onClick={() => onSave(docType.key)}
              loading={saving === docType.key}
            >
              <IconDeviceFloppy size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="View" withArrow>
            <ActionIcon
              size="sm"
              variant="light"
              color="teal"
              disabled={!data?.fileData}
              onClick={handleView}
            >
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download" withArrow>
            <ActionIcon
              size="sm"
              variant="light"
              color="grape"
              disabled={!data?.fileData}
              onClick={handleDownload}
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Clear" withArrow>
            <ActionIcon
              size="sm"
              variant="light"
              color="red"
              disabled={!data?.fileData}
              onClick={() => onDelete(docType.key)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SocietyInfoPage() {
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [docSaving,    setDocSaving]    = useState(null);   // key of doc being saved
  const [documents,    setDocuments]    = useState({});     // { [key]: docRecord }
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expiredCount, setExpiredCount] = useState(0);

  const form = useForm({
    initialValues: {
      societyCode: '', societyName: '', doorNo: '', city: '', state: '',
      pinCode: '', phone: '', fax: '', email: '',
      financialYearFrom: null, financialYearTo: null,
      welfareCode: '', noOfStaff: 0,
      auditedYear: '', auditedClassification: '', presidentName: '',
      presidentGender: '', boardMaleCount: 0, boardFemaleCount: 0,
      milkMaleCount: 0, milkFemaleCount: 0,
      boardMeetingDate: null, nextElectionDate: null,
    },
    validate: {
      email: (v) => v && !/\S+@\S+\.\S+/.test(v) ? 'Invalid email address' : null,
      pinCode: (v) => v && !/^\d{6}$/.test(v) ? 'PIN code must be 6 digits' : null,
      phone: (v) => v && !/^\d{7,15}$/.test(v) ? 'Invalid phone number' : null,
    },
  });

  // ── Load data ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await societyInfoAPI.get();
      if (res?.success) {
        const { info, documents: docs } = res.data;

        // Populate form
        const vals = { ...form.getValues() };
        Object.keys(vals).forEach((k) => {
          if (info[k] !== undefined) {
            if (k.includes('Date') || k.includes('Year') && info[k]) {
              vals[k] = info[k] ? new Date(info[k]) : null;
            } else {
              vals[k] = info[k];
            }
          }
        });
        // Fix date fields explicitly
        ['financialYearFrom', 'financialYearTo', 'boardMeetingDate', 'nextElectionDate'].forEach(k => {
          vals[k] = info[k] ? new Date(info[k]) : null;
        });
        form.setValues(vals);

        // Build documents map
        const docMap = {};
        docs.forEach((d) => { docMap[d.documentKey] = d; });
        setDocuments(docMap);

        // Count expired
        const now = new Date();
        const expired = docs.filter(d => d.fileData && d.expiryDate && new Date(d.expiryDate) < now).length;
        setExpiredCount(expired);
      }
    } catch (err) {
      notifications.show({ color: 'red', message: 'Failed to load society info' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Auto-save draft to localStorage ───────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form.getValues()));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [form.values]);

  // ── Save Society Info ──────────────────────────────────────────
  const handleSaveInfo = async () => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    setSaving(true);
    try {
      await societyInfoAPI.upsert(form.getValues());
      localStorage.removeItem(DRAFT_KEY);
      notifications.show({ color: 'green', message: 'Society information saved successfully', icon: <IconCheck size={16} /> });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // ── Document state updater ─────────────────────────────────────
  const handleDocChange = (key, data) => {
    setDocuments(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...data } }));
  };

  // ── Save single document ───────────────────────────────────────
  const handleDocSave = async (key) => {
    const docType = DOCUMENT_TYPES.find(d => d.key === key);
    const data = documents[key] || {};
    setDocSaving(key);
    try {
      await societyInfoAPI.upsertDocument(key, {
        documentKey:    key,
        documentName:   docType.label,
        documentNumber: data.documentNumber || '',
        expiryDate:     data.expiryDate || null,
        fileData:       data.fileData || null,
        fileName:       data.fileName || null,
        fileType:       data.fileType || null,
      });
      // Recompute expired count
      const now = new Date();
      const allDocs = Object.values({ ...documents, [key]: data });
      const expired = allDocs.filter(d => d?.fileData && d?.expiryDate && new Date(d.expiryDate) < now).length;
      setExpiredCount(expired);
      notifications.show({ color: 'green', message: `${docType.label} saved`, icon: <IconCheck size={16} /> });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to save document' });
    } finally {
      setDocSaving(null);
    }
  };

  // ── Delete/clear a document ────────────────────────────────────
  const handleDocDelete = async (key) => {
    setDocSaving(key);
    try {
      await societyInfoAPI.deleteDocument(key);
      setDocuments(prev => ({ ...prev, [key]: { ...prev[key], fileData: null, fileName: null, fileType: null, documentNumber: '', expiryDate: null, status: 'Pending' } }));
      notifications.show({ color: 'teal', message: 'Document cleared' });
    } catch (err) {
      notifications.show({ color: 'red', message: 'Failed to clear document' });
    } finally {
      setDocSaving(null);
    }
  };

  // ── Filtered document list ─────────────────────────────────────
  const filteredDocs = DOCUMENT_TYPES.filter(dt => {
    const matchSearch = dt.label.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (!filterStatus) return true;
    const doc = documents[dt.key];
    if (filterStatus === 'Pending') return !doc?.fileData;
    if (filterStatus === 'Expired') return doc?.fileData && doc?.expiryDate && new Date(doc.expiryDate) < new Date();
    if (filterStatus === 'Valid')   return doc?.fileData && (!doc?.expiryDate || new Date(doc.expiryDate) >= new Date());
    return true;
  });

  if (loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="sm">
          <Loader size="md" type="dots" />
          <Text size="sm" c="dimmed">Loading society information…</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
        minHeight: '100vh',
        padding: '0 0 40px',
      }}
    >
      {/* ── Page Header ─────────────────────────────────────── */}
      <Box
        style={{
          background: 'linear-gradient(135deg, #1c7ed6 0%, #228be6 50%, #339af0 100%)',
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(28,126,214,0.25)',
        }}
      >
        <Flex align="center" justify="space-between" wrap="wrap" gap="sm">
          <Group gap="md">
            <ThemeIcon size={44} radius="md" color="white" variant="light" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <IconBuilding size={24} color="white" />
            </ThemeIcon>
            <Box>
              <Title order={3} style={{ color: '#fff', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Society Info & Document Management
              </Title>
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Dairy Cooperative Society — Master Profile
              </Text>
            </Box>
          </Group>
          <Group gap="sm">
            {expiredCount > 0 && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                variant="filled"
                p="xs"
                style={{ background: 'rgba(255,212,59,0.9)', border: 'none', borderRadius: 8 }}
              >
                <Text size="xs" c="dark" fw={600}>{expiredCount} document{expiredCount > 1 ? 's' : ''} expired!</Text>
              </Alert>
            )}
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="white"
              color="blue"
              size="sm"
              onClick={load}
            >
              Refresh
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              color="white"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
              size="sm"
              onClick={handleSaveInfo}
              loading={saving}
            >
              Save Society Info
            </Button>
          </Group>
        </Flex>
      </Box>

      <Container size="xl" px="md">

        {/* ── Section 1 & 2: Two-Column Info Grid ──────────────── */}
        <Grid gutter="md" mb="md">

          {/* ── Left: Society Basic Information ───────────────── */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              shadow="xs"
              radius="lg"
              p="xl"
              style={{
                border: '1px solid #e8eef8',
                background: '#fff',
                height: '100%',
              }}
            >
              {/* Section header */}
              <Group gap="sm" mb="lg">
                <ThemeIcon size={36} radius="md" color="blue" variant="light">
                  <IconBuilding size={18} />
                </ThemeIcon>
                <Box>
                  <Title order={5} style={{ fontWeight: 700, color: '#1c3354' }}>Society Information</Title>
                  <Text size="xs" c="dimmed">Basic registration & contact details</Text>
                </Box>
              </Group>

              <Divider mb="md" color="#f0f4ff" />

              <Stack gap="sm">
                <SimpleGrid cols={2} spacing="sm">
                  <Tooltip label="Unique society registration code" withArrow position="top">
                    <TextInput
                      label="Society Code"
                      placeholder="e.g. MPCS-001"
                      {...form.getInputProps('societyCode')}
                    />
                  </Tooltip>
                  <Tooltip label="Number of permanent staff members" withArrow position="top">
                    <NumberInput
                      label="No. of Staff"
                      placeholder="0"
                      min={0}
                      {...form.getInputProps('noOfStaff')}
                    />
                  </Tooltip>
                </SimpleGrid>

                <TextInput
                  label="Society Name"
                  placeholder="Full name of the society"
                  {...form.getInputProps('societyName')}
                />

                <SimpleGrid cols={2} spacing="sm">
                  <TextInput
                    label="Door No."
                    placeholder="House / Building No."
                    {...form.getInputProps('doorNo')}
                  />
                  <TextInput
                    label="City / Village"
                    placeholder="City or village name"
                    {...form.getInputProps('city')}
                  />
                </SimpleGrid>

                <SimpleGrid cols={2} spacing="sm">
                  <Select
                    label="State"
                    placeholder="Select state"
                    data={INDIAN_STATES}
                    searchable
                    {...form.getInputProps('state')}
                  />
                  <Tooltip label="6-digit postal code" withArrow>
                    <TextInput
                      label="PIN Code"
                      placeholder="600001"
                      maxLength={6}
                      {...form.getInputProps('pinCode')}
                    />
                  </Tooltip>
                </SimpleGrid>

                <SimpleGrid cols={2} spacing="sm">
                  <TextInput
                    label="Phone"
                    placeholder="Phone number"
                    {...form.getInputProps('phone')}
                  />
                  <TextInput
                    label="Fax"
                    placeholder="Fax number"
                    {...form.getInputProps('fax')}
                  />
                </SimpleGrid>

                <TextInput
                  label="Email"
                  placeholder="society@example.com"
                  {...form.getInputProps('email')}
                />

                <Divider label="Financial Year" labelPosition="left" color="#f0f4ff" />

                <SimpleGrid cols={2} spacing="sm">
                  <DatePickerInput
                    label="From"
                    placeholder="Pick start date"
                    valueFormat="DD MMM YYYY"
                    {...form.getInputProps('financialYearFrom')}
                    clearable
                  />
                  <DatePickerInput
                    label="To"
                    placeholder="Pick end date"
                    valueFormat="DD MMM YYYY"
                    {...form.getInputProps('financialYearTo')}
                    clearable
                  />
                </SimpleGrid>

                <TextInput
                  label="Welfare Code"
                  placeholder="Welfare scheme code"
                  {...form.getInputProps('welfareCode')}
                />
              </Stack>
            </Paper>
          </Grid.Col>

          {/* ── Right: Audit & Board Details ──────────────────── */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              shadow="xs"
              radius="lg"
              p="xl"
              style={{
                border: '1px solid #e8eef8',
                background: '#fff',
                height: '100%',
              }}
            >
              <Group gap="sm" mb="lg">
                <ThemeIcon size={36} radius="md" color="violet" variant="light">
                  <IconUser size={18} />
                </ThemeIcon>
                <Box>
                  <Title order={5} style={{ fontWeight: 700, color: '#1c3354' }}>Audit & Board Details</Title>
                  <Text size="xs" c="dimmed">Governance, election & membership statistics</Text>
                </Box>
              </Group>

              <Divider mb="md" color="#f0f4ff" />

              <Stack gap="sm">
                {/* Audit Info */}
                <SimpleGrid cols={2} spacing="sm">
                  <TextInput
                    label="Audited Year"
                    placeholder="e.g. 2024-25"
                    {...form.getInputProps('auditedYear')}
                  />
                  <Select
                    label="Audit Classification"
                    placeholder="Select class"
                    data={AUDIT_CLASSES}
                    {...form.getInputProps('auditedClassification')}
                  />
                </SimpleGrid>

                <Divider label="President Details" labelPosition="left" color="#f0f4ff" mt="xs" />

                <TextInput
                  label="President Name"
                  placeholder="Full name"
                  {...form.getInputProps('presidentName')}
                />

                <Box>
                  <Text size="sm" fw={500} mb={6}>President Gender</Text>
                  <Radio.Group {...form.getInputProps('presidentGender')}>
                    <Group gap="xl">
                      <Radio value="Male"   label="Male"   color="blue" />
                      <Radio value="Female" label="Female" color="pink" />
                    </Group>
                  </Radio.Group>
                </Box>

                <Divider label="Board Members" labelPosition="left" color="#f0f4ff" mt="xs" />

                <SimpleGrid cols={2} spacing="sm">
                  <NumberInput
                    label="Male Members"
                    placeholder="0"
                    min={0}
                    leftSection={<Text size="xs" c="blue">M</Text>}
                    {...form.getInputProps('boardMaleCount')}
                  />
                  <NumberInput
                    label="Female Members"
                    placeholder="0"
                    min={0}
                    leftSection={<Text size="xs" c="pink">F</Text>}
                    {...form.getInputProps('boardFemaleCount')}
                  />
                </SimpleGrid>

                <Divider label="Milk Producing Members" labelPosition="left" color="#f0f4ff" mt="xs" />

                <SimpleGrid cols={2} spacing="sm">
                  <NumberInput
                    label="Male Producers"
                    placeholder="0"
                    min={0}
                    leftSection={<Text size="xs" c="blue">M</Text>}
                    {...form.getInputProps('milkMaleCount')}
                  />
                  <NumberInput
                    label="Female Producers"
                    placeholder="0"
                    min={0}
                    leftSection={<Text size="xs" c="pink">F</Text>}
                    {...form.getInputProps('milkFemaleCount')}
                  />
                </SimpleGrid>

                <Divider label="Meeting & Election" labelPosition="left" color="#f0f4ff" mt="xs" />

                <SimpleGrid cols={2} spacing="sm">
                  <DatePickerInput
                    label="Last Board Meeting"
                    placeholder="Pick date"
                    valueFormat="DD MMM YYYY"
                    leftSection={<IconCalendar size={14} />}
                    {...form.getInputProps('boardMeetingDate')}
                    clearable
                  />
                  <DatePickerInput
                    label="Next Election Date"
                    placeholder="Pick date"
                    valueFormat="DD MMM YYYY"
                    leftSection={<IconCalendar size={14} />}
                    {...form.getInputProps('nextElectionDate')}
                    clearable
                  />
                </SimpleGrid>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* ── Section 3: Document Management ───────────────────── */}
        <Paper
          shadow="xs"
          radius="lg"
          p="xl"
          style={{ border: '1px solid #e8eef8', background: '#fff' }}
        >
          {/* Document section header */}
          <Flex align="center" justify="space-between" mb="md" wrap="wrap" gap="sm">
            <Group gap="sm">
              <ThemeIcon size={36} radius="md" color="teal" variant="light">
                <IconFileDescription size={18} />
              </ThemeIcon>
              <Box>
                <Title order={5} style={{ fontWeight: 700, color: '#1c3354' }}>Document Management</Title>
                <Text size="xs" c="dimmed">Upload, track & manage all statutory documents</Text>
              </Box>
            </Group>

            {/* Summary badges */}
            <Group gap="xs">
              {(() => {
                const now = new Date();
                const valid   = DOCUMENT_TYPES.filter(dt => { const d = documents[dt.key]; return d?.fileData && (!d?.expiryDate || new Date(d.expiryDate) >= now); }).length;
                const expired = DOCUMENT_TYPES.filter(dt => { const d = documents[dt.key]; return d?.fileData && d?.expiryDate && new Date(d.expiryDate) < now; }).length;
                const pending = DOCUMENT_TYPES.filter(dt => !documents[dt.key]?.fileData).length;
                return (
                  <>
                    <Badge color="green" variant="light" size="sm">{valid} Valid</Badge>
                    <Badge color="red"   variant="light" size="sm">{expired} Expired</Badge>
                    <Badge color="gray"  variant="light" size="sm">{pending} Pending</Badge>
                  </>
                );
              })()}
            </Group>
          </Flex>

          <Divider mb="md" color="#f0f4ff" />

          {/* Search & Filter bar */}
          <Group mb="md" gap="sm" wrap="wrap">
            <TextInput
              placeholder="Search documents…"
              leftSection={<IconSearch size={14} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
              rightSection={searchQuery ? (
                <ActionIcon size="xs" variant="transparent" onClick={() => setSearchQuery('')}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null}
            />
            <Select
              placeholder="Filter by status"
              leftSection={<IconFilter size={14} />}
              data={['Valid', 'Expired', 'Pending']}
              value={filterStatus}
              onChange={(v) => setFilterStatus(v || '')}
              clearable
              style={{ width: 160 }}
            />
            <Text size="xs" c="dimmed" style={{ alignSelf: 'center' }}>
              Showing {filteredDocs.length} of {DOCUMENT_TYPES.length} documents
            </Text>
          </Group>

          {/* Drag & Drop info banner */}
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            mb="md"
            p="xs"
            radius="md"
          >
            <Text size="xs">
              Click the <strong>Upload File</strong> button on each row to attach a PDF or image (max 10 MB).
              After uploading, click <strong>Save</strong> (disk icon) to store the document.
              Expired documents are highlighted in red.
            </Text>
          </Alert>

          {/* Document Table */}
          <ScrollArea>
            <Table
              striped="odd"
              highlightOnHover
              withTableBorder
              withColumnBorders
              verticalSpacing="sm"
              style={{ minWidth: 900 }}
              styles={{
                table: { borderRadius: 10, overflow: 'hidden' },
                thead: { background: 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)' },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 220, color: '#1c3354', fontWeight: 700 }}>Document Name</Table.Th>
                  <Table.Th style={{ width: 160, color: '#1c3354', fontWeight: 700 }}>Attached File</Table.Th>
                  <Table.Th style={{ width: 160, color: '#1c3354', fontWeight: 700 }}>Document Number</Table.Th>
                  <Table.Th style={{ width: 150, color: '#1c3354', fontWeight: 700 }}>Expiry Date</Table.Th>
                  <Table.Th style={{ width: 110, color: '#1c3354', fontWeight: 700 }}>Status</Table.Th>
                  <Table.Th style={{ width: 120, color: '#1c3354', fontWeight: 700 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredDocs.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Center py="xl">
                        <Stack align="center" gap="xs">
                          <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                            <IconFileDescription size={24} />
                          </ThemeIcon>
                          <Text c="dimmed" size="sm">No documents match your filter</Text>
                        </Stack>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredDocs.map((docType) => (
                    <DocumentRow
                      key={docType.key}
                      docType={docType}
                      data={documents[docType.key]}
                      onChange={handleDocChange}
                      onSave={handleDocSave}
                      onDelete={handleDocDelete}
                      saving={docSaving}
                    />
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        {/* ── Bottom Save Bar ───────────────────────────────────── */}
        <Paper
          shadow="xs"
          radius="lg"
          p="md"
          mt="md"
          style={{
            border: '1px solid #e8eef8',
            background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)',
          }}
        >
          <Flex align="center" justify="space-between" wrap="wrap" gap="sm">
            <Group gap="xs">
              <IconInfoCircle size={14} color="#aaa" />
              <Text size="xs" c="dimmed">
                Changes to Society Info are auto-saved as a draft. Click <strong>Save Society Info</strong> to persist.
              </Text>
            </Group>
            <Group gap="sm">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY);
                  load();
                }}
              >
                Reset Changes
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                color="blue"
                size="sm"
                onClick={handleSaveInfo}
                loading={saving}
              >
                Save Society Info
              </Button>
            </Group>
          </Flex>
        </Paper>

      </Container>
    </Box>
  );
}

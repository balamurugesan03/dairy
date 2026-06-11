import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FarmerModal from './FarmerModal';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Badge,
  Tabs,
  Grid,
  Box,
  LoadingOverlay,
  Image,
  Modal,
  Avatar,
  ActionIcon,
  Tooltip,
  Center,
  ThemeIcon,
  Progress
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconPrinter,
  IconFileDownload,
  IconPhone,
  IconBrandWhatsapp,
  IconUpload,
  IconEye,
  IconFileText,
  IconPhoto,
  IconTrash,
  IconReplace,
  IconCheck,
  IconFile
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { farmerAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';
import { message } from '../../utils/toast';
import { notifications } from '@mantine/notifications';
import AnalyticCard from '../common/AnalyticCard';

// Document types definition
const DOC_TYPES = [
  { key: 'aadhaar',      label: 'Aadhaar Card' },
  { key: 'bankPassbook', label: 'Bank Passbook' },
  { key: 'rationCard',   label: 'Ration Card' },
  { key: 'incomeProof',  label: 'Income Proof' },
];

const FarmerView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const printRef = useRef(null);
  const fileInputRef = useRef(null);

  const [farmer,        setFarmer]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [activeTab,     setActiveTab]     = useState('details');
  const [documentModal, setDocumentModal] = useState({ open: false, doc: null, title: '', isPdf: false });
  const [uploadingKey,  setUploadingKey]  = useState(null);
  const [pendingKey,    setPendingKey]    = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => { fetchFarmer(); }, [id]);

  const fetchFarmer = async () => {
    setLoading(true);
    try {
      const response = await farmerAPI.getById(id);
      setFarmer(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmer details');
      navigate('/farmers');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    printReport(printRef, { title: 'Farmer Profile', orientation: 'landscape' });
  };

  const handleExportPDF = () => {
    message.info('PDF export feature coming soon');
  };

  const handleCallFarmer = () => {
    if (farmer?.personalDetails?.phone) {
      window.location.href = `tel:${farmer.personalDetails.phone}`;
    }
  };

  const handleWhatsApp = () => {
    if (farmer?.personalDetails?.phone) {
      const cleanPhone = farmer.personalDetails.phone.replace(/\D/g, '');
      window.open(`https://wa.me/91${cleanPhone}`, '_blank');
    }
  };

  // ── Document helpers ──────────────────────────────────────────────────────
  const openDocumentModal = (doc, title) => {
    const isPdf = doc.startsWith('data:application/pdf') || doc.toLowerCase().includes('.pdf');
    setDocumentModal({ open: true, doc, title, isPdf });
  };

  const closeDocumentModal = () => setDocumentModal({ open: false, doc: null, title: '', isPdf: false });

  // Trigger hidden file input for the given doc key
  const triggerUpload = (key) => {
    setPendingKey(key);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  // Convert selected file to base64 and save via API
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingKey) return;

    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024) {
      notifications.show({ title: 'File too large', message: `Maximum allowed size is ${maxMB} MB`, color: 'red' });
      return;
    }

    setUploadingKey(pendingKey);
    const key = pendingKey;
    setPendingKey(null);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Merge into existing documents and save
      const updatedDocs = { ...(farmer.documents || {}), [key]: base64 };
      await farmerAPI.update(id, { documents: updatedDocs });

      // Optimistic update
      setFarmer(prev => ({ ...prev, documents: updatedDocs }));
      notifications.show({ title: 'Uploaded', message: `${DOC_TYPES.find(d => d.key === key)?.label} saved successfully`, color: 'green', icon: <IconCheck size={16} /> });
    } catch (err) {
      notifications.show({ title: 'Upload failed', message: err?.message || 'Could not save document', color: 'red' });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDeleteDoc = async (key, label) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      const updatedDocs = { ...(farmer.documents || {}), [key]: null };
      await farmerAPI.update(id, { documents: updatedDocs });
      setFarmer(prev => ({ ...prev, documents: { ...prev.documents, [key]: null } }));
      notifications.show({ title: 'Deleted', message: `${label} removed`, color: 'teal' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Could not delete document', color: 'red' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading || !farmer) {
    return (
      <Container fluid>
        <Paper p="xl" withBorder pos="relative" style={{ minHeight: 400 }}>
          <LoadingOverlay visible={loading} />
        </Paper>
      </Container>
    );
  }

  const InfoRow = ({ label, value }) => (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">{label}:</Text>
      <Text size="sm" fw={500}>{value || '-'}</Text>
    </Group>
  );

  return (
    <Container fluid ref={printRef}>
      {/* Hidden file input — shared for all doc types */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Farmer Details</Title>
            <Text c="dimmed" size="sm">
              View details for {farmer.personalDetails?.name || 'Farmer'}
            </Text>
          </Box>
          <Group>
            <Button
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/farmers')}
            >
              Back
            </Button>
            <Button
              variant="default"
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
            >
              Print
            </Button>
            <Button
              variant="default"
              leftSection={<IconFileDownload size={16} />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={() => setShowEditModal(true)}
            >
              Edit
            </Button>
          </Group>
        </Group>

        <Group>
          <Button
            variant="light"
            leftSection={<IconPhone size={16} />}
            onClick={handleCallFarmer}
            disabled={!farmer.personalDetails?.phone}
          >
            Call
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconBrandWhatsapp size={16} />}
            onClick={handleWhatsApp}
            disabled={!farmer.personalDetails?.phone}
          >
            WhatsApp
          </Button>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <AnalyticCard title="Total Shares" value={farmer.financialDetails?.totalShares || 0} color="blue" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <AnalyticCard
              title="Share Value"
              value={`₹${((farmer.financialDetails?.totalShares || 0) * (farmer.financialDetails?.shareValue || 10)).toFixed(2)}`}
              color="green"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <AnalyticCard
              title="Membership"
              value={farmer.isMembership ? 'Member' : 'Non-Member'}
              color={farmer.isMembership ? 'teal' : 'gray'}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <AnalyticCard
              title="Status"
              value={farmer.status}
              color={farmer.status === 'Active' ? 'green' : 'red'}
            />
          </Grid.Col>
        </Grid>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="documents">
              Documents
              {DOC_TYPES.some(d => farmer.documents?.[d.key]) && (
                <Badge size="xs" ml={6} variant="light" color="blue">
                  {DOC_TYPES.filter(d => farmer.documents?.[d.key]).length}
                </Badge>
              )}
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Details Tab ── */}
          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Title order={4} mb="md">Basic Information</Title>
                <Stack gap="xs">
                  <InfoRow label="Farmer Number" value={farmer.farmerNumber} />
                  <InfoRow label="Member ID"     value={farmer.memberId} />
                  <InfoRow label="Farmer Type"   value={farmer.farmerType} />
                  <InfoRow label="Cow Type"      value={farmer.cowType} />
                  <InfoRow
                    label="Admission Date"
                    value={farmer.admissionDate ? dayjs(farmer.admissionDate).format('DD-MM-YYYY') : null}
                  />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Personal Details</Title>
                {farmer.personalDetails?.photo && (
                  <Group mb="md">
                    <Avatar src={farmer.personalDetails.photo} size={80} radius={80} />
                  </Group>
                )}
                <Stack gap="xs">
                  <InfoRow label="Name"         value={farmer.personalDetails?.name} />
                  <InfoRow label="Father's Name" value={farmer.personalDetails?.fatherName} />
                  <InfoRow label="Age"           value={farmer.personalDetails?.age} />
                  <InfoRow
                    label="Date of Birth"
                    value={farmer.personalDetails?.dob ? dayjs(farmer.personalDetails.dob).format('DD-MM-YYYY') : null}
                  />
                  <InfoRow label="Gender"       value={farmer.personalDetails?.gender} />
                  <InfoRow label="Caste"        value={farmer.personalDetails?.caste} />
                  <InfoRow label="Phone"        value={farmer.personalDetails?.phone} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Address</Title>
                <Stack gap="xs">
                  <InfoRow label="Ward"      value={farmer.address?.ward} />
                  <InfoRow label="Place"     value={farmer.address?.place} />
                  <InfoRow label="Post"      value={farmer.address?.post} />
                  <InfoRow label="Village"   value={farmer.address?.village} />
                  <InfoRow label="Panchayat" value={farmer.address?.panchayat} />
                  <InfoRow label="PIN Code"  value={farmer.address?.pin} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Identity Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Aadhaar Number"  value={farmer.identityDetails?.aadhaar} />
                  <InfoRow label="PAN Number"      value={farmer.identityDetails?.pan} />
                  <InfoRow label="Welfare Number"  value={farmer.identityDetails?.welfareNo} />
                  <InfoRow label="Ksheerasree ID"  value={farmer.identityDetails?.ksheerasreeId} />
                  <InfoRow label="ID Card Number"  value={farmer.identityDetails?.idCardNumber} />
                  <InfoRow
                    label="Issue Date"
                    value={farmer.identityDetails?.issueDate ? dayjs(farmer.identityDetails.issueDate).format('DD-MM-YYYY') : null}
                  />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Bank Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Account Number" value={farmer.bankDetails?.accountNumber} />
                  <InfoRow label="Bank Name"      value={farmer.bankDetails?.bankName} />
                  <InfoRow label="Branch"         value={farmer.bankDetails?.branch} />
                  <InfoRow label="IFSC Code"      value={farmer.bankDetails?.ifsc} />
                  <InfoRow label="MICR Code"      value={farmer.bankDetails?.micr} />
                  <InfoRow label="Bank Ledger"    value={farmer.bankDetails?.bankLedgerId?.ledgerName || farmer.bankDetails?.bankLedgerId} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Financial Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Old Shares"        value={farmer.financialDetails?.oldShares || 0} />
                  <InfoRow label="New Shares"        value={farmer.financialDetails?.newShares || 0} />
                  <InfoRow label="Total Shares"      value={farmer.financialDetails?.totalShares || 0} />
                  <InfoRow label="Share Value"       value={`₹${farmer.financialDetails?.shareValue || 0}`} />
                  <InfoRow label="Admission Fee"     value={`₹${farmer.financialDetails?.admissionFee || 0}`} />
                  <InfoRow label="Resolution Number" value={farmer.financialDetails?.resolutionNo} />
                  <InfoRow
                    label="Resolution Date"
                    value={farmer.financialDetails?.resolutionDate ? dayjs(farmer.financialDetails.resolutionDate).format('DD-MM-YYYY') : null}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* ── Documents Tab ── */}
          <Tabs.Panel value="documents" pt="md">
            <Paper p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={4}>Documents</Title>
                <Text size="xs" c="dimmed">Supported: JPG, PNG, PDF · Max 5 MB</Text>
              </Group>

              <Grid gutter="md">
                {DOC_TYPES.map(({ key, label }) => {
                  const docValue = farmer.documents?.[key];
                  const hasDoc   = !!docValue;
                  const isImage  = hasDoc && (docValue.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(docValue));
                  const isPdf    = hasDoc && (docValue.startsWith('data:application/pdf') || /\.pdf$/i.test(docValue));
                  const isUploading = uploadingKey === key;

                  return (
                    <Grid.Col key={key} span={{ base: 12, sm: 6, md: 3 }}>
                      <Paper withBorder p="sm" radius="md" style={{ height: '100%' }}>
                        <Stack gap="xs" h="100%">
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" fw={600}>{label}</Text>
                            {hasDoc && (
                              <Badge size="xs" color="green" variant="light">Uploaded</Badge>
                            )}
                          </Group>

                          {/* Preview area */}
                          <Box
                            style={{
                              flex: 1,
                              minHeight: 120,
                              border: '1px dashed var(--mantine-color-gray-4)',
                              borderRadius: 8,
                              overflow: 'hidden',
                              cursor: hasDoc ? 'pointer' : 'default',
                              background: hasDoc ? 'transparent' : 'var(--mantine-color-gray-0)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onClick={() => hasDoc && openDocumentModal(docValue, label)}
                          >
                            {isUploading ? (
                              <Stack align="center" gap={4}>
                                <Progress size="xs" value={100} animated w={80} />
                                <Text size="xs" c="dimmed">Uploading…</Text>
                              </Stack>
                            ) : isImage ? (
                              <Image
                                src={docValue}
                                alt={label}
                                fit="cover"
                                style={{ maxHeight: 140, width: '100%', objectFit: 'cover' }}
                              />
                            ) : isPdf ? (
                              <Stack align="center" gap={4} p="sm">
                                <ThemeIcon size={48} variant="light" color="red" radius="md">
                                  <IconFileText size={28} />
                                </ThemeIcon>
                                <Text size="xs" c="dimmed" ta="center">PDF Document</Text>
                                <Text size="xs" c="blue" fw={500}>Click to view</Text>
                              </Stack>
                            ) : (
                              <Stack align="center" gap={4} p="sm">
                                <ThemeIcon size={48} variant="light" color="gray" radius="md">
                                  <IconFile size={28} />
                                </ThemeIcon>
                                <Text size="xs" c="dimmed" ta="center">No document</Text>
                                <Text size="xs" c="dimmed">Click Upload to add</Text>
                              </Stack>
                            )}
                          </Box>

                          {/* Action buttons */}
                          <Group gap="xs" grow>
                            {hasDoc ? (
                              <>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="blue"
                                  leftSection={<IconEye size={13} />}
                                  onClick={() => openDocumentModal(docValue, label)}
                                >
                                  View
                                </Button>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="orange"
                                  leftSection={<IconReplace size={13} />}
                                  loading={isUploading}
                                  onClick={() => triggerUpload(key)}
                                >
                                  Replace
                                </Button>
                                <Tooltip label={`Delete ${label}`} withArrow>
                                  <ActionIcon
                                    size="sm"
                                    variant="light"
                                    color="red"
                                    onClick={() => handleDeleteDoc(key, label)}
                                  >
                                    <IconTrash size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              </>
                            ) : (
                              <Button
                                size="xs"
                                variant="light"
                                color="blue"
                                leftSection={<IconUpload size={13} />}
                                loading={isUploading}
                                onClick={() => triggerUpload(key)}
                                fullWidth
                              >
                                Upload
                              </Button>
                            )}
                          </Group>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  );
                })}
              </Grid>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* ── Edit Modal ── */}
      <FarmerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => { setShowEditModal(false); fetchFarmer(); }}
        farmerId={id}
      />

      {/* ── Document View Modal ── */}
      <Modal
        opened={documentModal.open}
        onClose={closeDocumentModal}
        title={documentModal.title}
        size="xl"
        centered
      >
        {documentModal.doc && (
          documentModal.isPdf ? (
            <Stack gap="sm">
              <iframe
                src={documentModal.doc}
                title={documentModal.title}
                style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }}
              />
              <Button
                variant="light"
                leftSection={<IconFileDownload size={16} />}
                component="a"
                href={documentModal.doc}
                download={`${documentModal.title.replace(/\s+/g, '_')}.pdf`}
              >
                Download PDF
              </Button>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Image src={documentModal.doc} alt={documentModal.title} />
              <Button
                variant="light"
                leftSection={<IconFileDownload size={16} />}
                component="a"
                href={documentModal.doc}
                download={`${documentModal.title.replace(/\s+/g, '_')}.jpg`}
              >
                Download Image
              </Button>
            </Stack>
          )
        )}
      </Modal>
    </Container>
  );
};

export default FarmerView;

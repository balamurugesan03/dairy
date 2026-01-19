import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Modal
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconPrinter,
  IconFileDownload,
  IconPhone,
  IconBrandWhatsapp
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { farmerAPI } from '../../services/api';
import { message } from '../../utils/toast';
import AnalyticCard from '../common/AnalyticCard';

const FarmerView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [documentModal, setDocumentModal] = useState({ open: false, doc: null, title: '' });

  useEffect(() => {
    fetchFarmer();
  }, [id]);

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
    window.print();
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

  const openDocumentModal = (doc, title) => {
    setDocumentModal({ open: true, doc, title });
  };

  const closeDocumentModal = () => {
    setDocumentModal({ open: false, doc: null, title: '' });
  };

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
    <Container fluid>
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
              onClick={() => navigate(`/farmers/edit/${id}`)}
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
            <AnalyticCard
              title="Total Shares"
              value={farmer.financialDetails?.totalShares || 0}
              color="blue"
            />
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
            <Tabs.Tab value="documents">Documents</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Title order={4} mb="md">Basic Information</Title>
                <Stack gap="xs">
                  <InfoRow label="Farmer Number" value={farmer.farmerNumber} />
                  <InfoRow label="Member ID" value={farmer.memberId} />
                  <InfoRow label="Farmer Type" value={farmer.farmerType} />
                  <InfoRow label="Cow Type" value={farmer.cowType} />
                  <InfoRow
                    label="Admission Date"
                    value={farmer.admissionDate ? dayjs(farmer.admissionDate).format('DD-MM-YYYY') : null}
                  />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Personal Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Name" value={farmer.personalDetails?.name} />
                  <InfoRow label="Father's Name" value={farmer.personalDetails?.fatherName} />
                  <InfoRow label="Age" value={farmer.personalDetails?.age} />
                  <InfoRow
                    label="Date of Birth"
                    value={farmer.personalDetails?.dob ? dayjs(farmer.personalDetails.dob).format('DD-MM-YYYY') : null}
                  />
                  <InfoRow label="Gender" value={farmer.personalDetails?.gender} />
                  <InfoRow label="Phone" value={farmer.personalDetails?.phone} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Address</Title>
                <Stack gap="xs">
                  <InfoRow label="Ward" value={farmer.address?.ward} />
                  <InfoRow label="Village" value={farmer.address?.village} />
                  <InfoRow label="Panchayat" value={farmer.address?.panchayat} />
                  <InfoRow label="PIN Code" value={farmer.address?.pin} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Identity Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Aadhaar Number" value={farmer.identityDetails?.aadhaar} />
                  <InfoRow label="PAN Number" value={farmer.identityDetails?.pan} />
                  <InfoRow label="Welfare Number" value={farmer.identityDetails?.welfareNo} />
                  <InfoRow label="Ksheerasree ID" value={farmer.identityDetails?.ksheerasreeId} />
                  <InfoRow label="ID Card Number" value={farmer.identityDetails?.idCardNumber} />
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
                  <InfoRow label="Bank Name" value={farmer.bankDetails?.bankName} />
                  <InfoRow label="Branch" value={farmer.bankDetails?.branch} />
                  <InfoRow label="IFSC Code" value={farmer.bankDetails?.ifsc} />
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">Financial Details</Title>
                <Stack gap="xs">
                  <InfoRow label="Old Shares" value={farmer.financialDetails?.oldShares || 0} />
                  <InfoRow label="New Shares" value={farmer.financialDetails?.newShares || 0} />
                  <InfoRow label="Total Shares" value={farmer.financialDetails?.totalShares || 0} />
                  <InfoRow label="Share Value" value={`₹${farmer.financialDetails?.shareValue || 0}`} />
                  <InfoRow label="Admission Fee" value={`₹${farmer.financialDetails?.admissionFee || 0}`} />
                  <InfoRow label="Resolution Number" value={farmer.financialDetails?.resolutionNo} />
                  <InfoRow
                    label="Resolution Date"
                    value={farmer.financialDetails?.resolutionDate ? dayjs(farmer.financialDetails.resolutionDate).format('DD-MM-YYYY') : null}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="documents" pt="md">
            <Paper p="md" withBorder>
              <Title order={4} mb="md">Documents</Title>
              {farmer.documents?.aadhaar || farmer.documents?.bankPassbook || farmer.documents?.rationCard || farmer.documents?.incomeProof ? (
                <Grid>
                  {farmer.documents?.aadhaar && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">Aadhaar Card</Text>
                        {farmer.documents.aadhaar.startsWith('data:image') ? (
                          <Image
                            src={farmer.documents.aadhaar}
                            alt="Aadhaar"
                            style={{ cursor: 'pointer' }}
                            onClick={() => openDocumentModal(farmer.documents.aadhaar, 'Aadhaar Card')}
                          />
                        ) : (
                          <Button
                            variant="light"
                            component="a"
                            href={farmer.documents.aadhaar}
                            download="aadhaar.pdf"
                          >
                            Download PDF
                          </Button>
                        )}
                      </Box>
                    </Grid.Col>
                  )}

                  {farmer.documents?.bankPassbook && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">Bank Passbook</Text>
                        {farmer.documents.bankPassbook.startsWith('data:image') ? (
                          <Image
                            src={farmer.documents.bankPassbook}
                            alt="Bank Passbook"
                            style={{ cursor: 'pointer' }}
                            onClick={() => openDocumentModal(farmer.documents.bankPassbook, 'Bank Passbook')}
                          />
                        ) : (
                          <Button
                            variant="light"
                            component="a"
                            href={farmer.documents.bankPassbook}
                            download="bank-passbook.pdf"
                          >
                            Download PDF
                          </Button>
                        )}
                      </Box>
                    </Grid.Col>
                  )}

                  {farmer.documents?.rationCard && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">Ration Card</Text>
                        {farmer.documents.rationCard.startsWith('data:image') ? (
                          <Image
                            src={farmer.documents.rationCard}
                            alt="Ration Card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => openDocumentModal(farmer.documents.rationCard, 'Ration Card')}
                          />
                        ) : (
                          <Button
                            variant="light"
                            component="a"
                            href={farmer.documents.rationCard}
                            download="ration-card.pdf"
                          >
                            Download PDF
                          </Button>
                        )}
                      </Box>
                    </Grid.Col>
                  )}

                  {farmer.documents?.incomeProof && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">Income Proof</Text>
                        {farmer.documents.incomeProof.startsWith('data:image') ? (
                          <Image
                            src={farmer.documents.incomeProof}
                            alt="Income Proof"
                            style={{ cursor: 'pointer' }}
                            onClick={() => openDocumentModal(farmer.documents.incomeProof, 'Income Proof')}
                          />
                        ) : (
                          <Button
                            variant="light"
                            component="a"
                            href={farmer.documents.incomeProof}
                            download="income-proof.pdf"
                          >
                            Download PDF
                          </Button>
                        )}
                      </Box>
                    </Grid.Col>
                  )}
                </Grid>
              ) : (
                <Text c="dimmed">No documents uploaded</Text>
              )}
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={documentModal.open}
        onClose={closeDocumentModal}
        title={documentModal.title}
        size="xl"
      >
        {documentModal.doc && documentModal.doc.startsWith('data:image') && (
          <Image src={documentModal.doc} alt={documentModal.title} />
        )}
      </Modal>
    </Container>
  );
};

export default FarmerView;

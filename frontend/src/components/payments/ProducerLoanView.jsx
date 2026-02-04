import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import { producerLoanAPI } from '../../services/api';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  Grid,
  Divider,
  ActionIcon,
  Timeline,
  Progress,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconPrinter,
  IconCurrencyRupee,
  IconCalendar,
  IconUser,
  IconCheck,
  IconClock,
  IconAlertTriangle,
} from '@tabler/icons-react';

const ProducerLoanView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loan, setLoan] = useState(null);

  useEffect(() => {
    if (id) {
      fetchLoan();
    }
  }, [id]);

  const fetchLoan = async () => {
    try {
      setLoading(true);
      const response = await producerLoanAPI.getById(id);
      setLoan(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch loan details');
      navigate('/payments/loans');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'blue';
      case 'Closed': return 'green';
      case 'Defaulted': return 'red';
      case 'Cancelled': return 'gray';
      default: return 'gray';
    }
  };

  const getEMIStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Partial': return 'yellow';
      case 'Pending': return 'gray';
      case 'Overdue': return 'red';
      default: return 'gray';
    }
  };

  const getEMIStatusIcon = (status) => {
    switch (status) {
      case 'Paid': return <IconCheck size={14} />;
      case 'Partial': return <IconClock size={14} />;
      case 'Pending': return <IconClock size={14} />;
      case 'Overdue': return <IconAlertTriangle size={14} />;
      default: return null;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Loader size="lg" />
        </Box>
      </Container>
    );
  }

  if (!loan) {
    return (
      <Container size="xl" py="xl">
        <Text ta="center" c="dimmed">Loan not found</Text>
      </Container>
    );
  }

  const recoveryProgress = loan.totalLoanAmount > 0
    ? (loan.recoveredAmount / loan.totalLoanAmount) * 100
    : 0;

  const paidEMIs = loan.emiSchedule?.filter(e => e.status === 'Paid').length || 0;

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/payments/loans')}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Box>
              <Title order={2}>Loan Details</Title>
              <Text c="dimmed" size="sm">{loan.loanNumber}</Text>
            </Box>
          </Group>
          <Group>
            <Badge color={getStatusColor(loan.status)} size="lg" variant="filled">
              {loan.status}
            </Badge>
            <Button leftSection={<IconPrinter size={16} />} variant="light" onClick={handlePrint}>
              Print
            </Button>
          </Group>
        </Group>

        {/* Loan Summary Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder p="lg" radius="md">
              <Grid>
                {/* Farmer Details */}
                <Grid.Col span={12}>
                  <Group gap="lg" align="flex-start">
                    <Box style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Farmer</Text>
                      <Group gap="xs">
                        <IconUser size={16} />
                        <Text size="lg" fw={600}>{loan.farmerId?.personalDetails?.name}</Text>
                      </Group>
                      <Text size="sm" c="dimmed">{loan.farmerId?.farmerNumber}</Text>
                      <Text size="sm">{loan.farmerId?.address?.village}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Loan Date</Text>
                      <Group gap="xs">
                        <IconCalendar size={16} />
                        <Text size="lg" fw={600}>{formatDate(loan.loanDate)}</Text>
                      </Group>
                    </Box>
                  </Group>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Divider my="sm" />
                </Grid.Col>

                {/* Loan Details */}
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Loan Type</Text>
                  <Badge color="blue" variant="light" size="lg" mt={4}>
                    {loan.loanType}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>EMI Scheme</Text>
                  <Text size="lg" fw={500}>{loan.loanScheme}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payment Mode</Text>
                  <Text size="lg" fw={500}>{loan.paymentMode}</Text>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Divider my="sm" />
                </Grid.Col>

                {/* Amount Details */}
                <Grid.Col span={3}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Principal</Text>
                  <Text size="lg" fw={600}>{formatCurrency(loan.principalAmount)}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Interest</Text>
                  <Text size="lg" fw={600}>
                    {formatCurrency(loan.interestAmount)}
                    {loan.interestType === 'Percentage' && (
                      <Text span size="sm" c="dimmed"> ({loan.interestRate}%)</Text>
                    )}
                  </Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Amount</Text>
                  <Text size="lg" fw={700} c="blue">{formatCurrency(loan.totalLoanAmount)}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>EMI Amount</Text>
                  <Text size="lg" fw={600}>{formatCurrency(loan.emiAmount)}</Text>
                </Grid.Col>

                {loan.purpose && (
                  <>
                    <Grid.Col span={12}>
                      <Divider my="sm" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Purpose</Text>
                      <Text>{loan.purpose}</Text>
                    </Grid.Col>
                  </>
                )}

                {(loan.guarantorName || loan.guarantorPhone) && (
                  <>
                    <Grid.Col span={12}>
                      <Divider my="sm" />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Guarantor Name</Text>
                      <Text>{loan.guarantorName || '-'}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Guarantor Phone</Text>
                      <Text>{loan.guarantorPhone || '-'}</Text>
                    </Grid.Col>
                  </>
                )}
              </Grid>
            </Card>
          </Grid.Col>

          {/* Recovery Progress */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <Card withBorder p="lg" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">Recovery Progress</Text>
                <Progress
                  value={recoveryProgress}
                  size="xl"
                  radius="xl"
                  color={recoveryProgress === 100 ? 'green' : 'blue'}
                  mb="sm"
                />
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Recovered</Text>
                  <Text size="sm" fw={600} c="green">{formatCurrency(loan.recoveredAmount)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Outstanding</Text>
                  <Text size="sm" fw={600} c="orange">{formatCurrency(loan.outstandingAmount)}</Text>
                </Group>
                <Divider my="sm" />
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Total</Text>
                  <Text size="sm" fw={700}>{formatCurrency(loan.totalLoanAmount)}</Text>
                </Group>
              </Card>

              <Card withBorder p="lg" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">EMI Status</Text>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Paid EMIs</Text>
                  <Text size="sm" fw={600} c="green">{paidEMIs} / {loan.totalEMI}</Text>
                </Group>
                <Progress
                  value={(paidEMIs / loan.totalEMI) * 100}
                  size="md"
                  radius="xl"
                  color="green"
                />
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>

        {/* EMI Schedule */}
        <Card withBorder p="lg" radius="md">
          <Title order={4} mb="md">EMI Schedule</Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>EMI #</Table.Th>
                <Table.Th>Due Date</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Paid Amount</Table.Th>
                <Table.Th>Paid Date</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loan.emiSchedule?.map((emi) => (
                <Table.Tr key={emi.emiNumber}>
                  <Table.Td>
                    <Text fw={500}>EMI {emi.emiNumber}</Text>
                  </Table.Td>
                  <Table.Td>{formatDate(emi.dueDate)}</Table.Td>
                  <Table.Td>{formatCurrency(emi.amount)}</Table.Td>
                  <Table.Td>
                    <Text c={emi.paidAmount > 0 ? 'green' : 'dimmed'}>
                      {formatCurrency(emi.paidAmount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{emi.paidDate ? formatDate(emi.paidDate) : '-'}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={getEMIStatusColor(emi.status)}
                      variant="light"
                      leftSection={getEMIStatusIcon(emi.status)}
                    >
                      {emi.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        {/* Remarks */}
        {loan.remarks && (
          <Card withBorder p="lg" radius="md">
            <Title order={4} mb="md">Remarks</Title>
            <Text>{loan.remarks}</Text>
          </Card>
        )}
      </Stack>
    </Container>
  );
};

export default ProducerLoanView;

import { useState, useEffect, useRef } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, producerReceiptAPI, producerLoanAPI, advanceAPI, farmerLedgerAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  NumberInput,
  TextInput,
  Textarea,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  ActionIcon,
  Grid,
  Modal,
  ScrollArea,
  Pagination,
  Menu,
  Divider,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPlus,
  IconSearch,
  IconPrinter,
  IconEye,
  IconX,
  IconDotsVertical,
  IconCurrencyRupee,
  IconCalendar,
  IconFilter,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react';

const ProducerReceiptManagement = () => {
  const { canWrite } = useAuth();
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  // Filters
  const [filters, setFilters] = useState({
    receiptType: '',
    fromDate: null,
    toDate: null
  });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Form state
  const [formLoading, setFormLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [references, setReferences] = useState([]);
  const [referencesLoading, setReferencesLoading] = useState(false);

  const [formData, setFormData] = useState({
    farmerId: '',
    receiptDate: new Date(),
    receiptType: 'Cash Advance',
    referenceType: 'Advance',
    referenceId: '',
    paymentMode: 'Cash',
    amount: '',
    remarks: ''
  });

  const [currentBalance, setCurrentBalance] = useState(0);

  useEffect(() => {
    fetchReceipts();
  }, [pagination.page, filters]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'receiptDate',
        sortOrder: 'desc'
      };

      if (filters.receiptType) params.receiptType = filters.receiptType;
      if (filters.fromDate) params.fromDate = filters.fromDate.toISOString();
      if (filters.toDate) params.toDate = filters.toDate.toISOString();

      const response = await producerReceiptAPI.getAll(params);
      setReceipts(response.data || []);
      setSummary(response.summary || []);
      setPagination(prev => ({
        ...prev,
        ...response.pagination
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  };

  const searchFarmers = async (query) => {
    try {
      setSearchLoading(true);
      let response;
      if (query && query.trim().length > 0) {
        response = await farmerAPI.search(query.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active', limit: 50 });
      }
      setFarmers(response.data || []);
    } catch (error) {
      console.error('Failed to search farmers:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFarmerSelect = async (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    setSelectedFarmer(farmer);
    setFormData(prev => ({ ...prev, farmerId, referenceId: '' }));

    if (farmer) {
      // Fetch farmer's outstanding advances/loans
      await fetchReferences(farmerId, formData.receiptType);
    }
  };

  const fetchReferences = async (farmerId, receiptType) => {
    if (!farmerId) return;

    setReferencesLoading(true);
    try {
      let refs = [];

      // Map receipt type to advance category
      const advanceCategory = receiptType;

      // Fetch advances with matching category
      const advancesResponse = await advanceAPI.getFarmerAdvances(farmerId);
      const matchingAdvances = (advancesResponse.data || []).filter(
        adv => adv.advanceCategory === advanceCategory ||
               (!adv.advanceCategory && advanceCategory === 'Cash Advance')
      );

      refs.push(...matchingAdvances.map(adv => ({
        value: `advance_${adv._id}`,
        label: `${adv.advanceNumber} - Balance: ₹${adv.balanceAmount?.toFixed(2)}`,
        type: 'Advance',
        id: adv._id,
        balance: adv.balanceAmount,
        number: adv.advanceNumber
      })));

      // Fetch loans with matching type
      const loansResponse = await producerLoanAPI.getFarmerLoans(farmerId);
      const matchingLoans = (loansResponse.data || []).filter(
        loan => loan.loanType === receiptType
      );

      refs.push(...matchingLoans.map(loan => ({
        value: `loan_${loan._id}`,
        label: `${loan.loanNumber} - Outstanding: ₹${loan.outstandingAmount?.toFixed(2)}`,
        type: 'Loan',
        id: loan._id,
        balance: loan.outstandingAmount,
        number: loan.loanNumber
      })));

      setReferences(refs);
    } catch (error) {
      console.error('Failed to fetch references:', error);
      setReferences([]);
    } finally {
      setReferencesLoading(false);
    }
  };

  const handleReceiptTypeChange = async (value) => {
    setFormData(prev => ({ ...prev, receiptType: value, referenceId: '' }));
    setCurrentBalance(0);

    if (selectedFarmer) {
      await fetchReferences(selectedFarmer._id, value);
    }
  };

  const handleReferenceSelect = (value) => {
    const ref = references.find(r => r.value === value);
    if (ref) {
      setFormData(prev => ({
        ...prev,
        referenceId: value,
        referenceType: ref.type
      }));
      setCurrentBalance(ref.balance || 0);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      farmerId: '',
      receiptDate: new Date(),
      receiptType: 'Cash Advance',
      referenceType: 'Advance',
      referenceId: '',
      paymentMode: 'Cash',
      amount: '',
      remarks: ''
    });
    setSelectedFarmer(null);
    setReferences([]);
    setCurrentBalance(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.farmerId) {
      message.error('Please select a farmer');
      return;
    }

    if (!formData.referenceId) {
      message.error('Please select an advance/loan reference');
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      message.error('Please enter a valid amount');
      return;
    }

    if (formData.amount > currentBalance) {
      message.error(`Amount cannot exceed outstanding balance of ₹${currentBalance.toFixed(2)}`);
      return;
    }

    setFormLoading(true);
    try {
      const ref = references.find(r => r.value === formData.referenceId);

      const payload = {
        farmerId: formData.farmerId,
        receiptDate: formData.receiptDate,
        receiptType: formData.receiptType,
        referenceType: ref.type,
        referenceId: ref.id,
        paymentMode: formData.paymentMode,
        amount: parseFloat(formData.amount),
        remarks: formData.remarks
      };

      await producerReceiptAPI.create(payload);
      message.success('Receipt created successfully');
      setModalOpen(false);
      resetForm();
      fetchReceipts();
    } catch (error) {
      message.error(error.message || 'Failed to create receipt');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelReceipt = async () => {
    if (!selectedReceipt || !cancelReason.trim()) {
      message.error('Please provide a cancellation reason');
      return;
    }

    try {
      await producerReceiptAPI.cancel(selectedReceipt._id, cancelReason);
      message.success('Receipt cancelled successfully');
      setCancelModalOpen(false);
      setSelectedReceipt(null);
      setCancelReason('');
      fetchReceipts();
    } catch (error) {
      message.error(error.message || 'Failed to cancel receipt');
    }
  };

  const handlePrint = async (receipt) => {
    try {
      const response = await producerReceiptAPI.getPrintData(receipt._id);
      const printData = response.data;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${printData.receiptNumber}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 400px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
                margin-bottom: 15px;
              }
              .title { font-size: 18px; font-weight: bold; margin: 0; }
              .subtitle { font-size: 14px; color: #666; margin: 5px 0 0 0; }
              .row {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px dotted #ccc;
              }
              .label { color: #666; font-size: 12px; }
              .value { font-weight: 500; }
              .amount-box {
                background: #f5f5f5;
                padding: 15px;
                text-align: center;
                margin: 15px 0;
                border-radius: 5px;
              }
              .amount { font-size: 24px; font-weight: bold; color: #2196f3; }
              @media print { body { padding: 10px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <p class="title">Dairy Society</p>
              <p class="subtitle">${printData.receiptType} Receipt</p>
              <p style="font-size: 12px;">No: ${printData.receiptNumber}</p>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${new Date(printData.receiptDate).toLocaleDateString('en-IN')}</span>
            </div>
            <div class="row">
              <span class="label">Farmer:</span>
              <span class="value">${printData.farmer.number} - ${printData.farmer.name}</span>
            </div>
            <div class="row">
              <span class="label">Reference:</span>
              <span class="value">${printData.referenceNumber}</span>
            </div>
            <div class="row">
              <span class="label">Payment Mode:</span>
              <span class="value">${printData.paymentMode}</span>
            </div>
            <div class="amount-box">
              <p style="margin: 0; color: #666;">Amount Received</p>
              <p class="amount">₹${printData.amount.toFixed(2)}</p>
            </div>
            <div class="row">
              <span class="label">Previous Balance:</span>
              <span class="value">₹${printData.previousBalance.toFixed(2)}</span>
            </div>
            <div class="row">
              <span class="label">New Balance:</span>
              <span class="value" style="color: ${printData.newBalance > 0 ? 'orange' : 'green'};">₹${printData.newBalance.toFixed(2)}</span>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      message.error('Failed to get print data');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
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

  const receiptTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Cash Advance', label: 'Cash Advance' },
    { value: 'CF Advance', label: 'CF Advance' },
    { value: 'Loan Advance', label: 'Loan Advance' }
  ];

  const receiptTypeColors = {
    'Cash Advance': 'cyan',
    'CF Advance': 'orange',
    'Loan Advance': 'violet'
  };

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name}`
  }));

  const paymentModeOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' }
  ];

  // Calculate totals from summary
  const totalReceived = summary.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title order={2}>Producer Receipt Management</Title>
            <Text c="dimmed" size="sm">Record advance/loan repayments from farmers</Text>
          </Box>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => {
              resetForm();
              searchFarmers('');
              setModalOpen(true);
            }}
            disabled={!canWrite('payments')}
          >
            New Receipt
          </Button>
        </Group>

        {/* Summary Cards */}
        <Grid>
          {summary.map((s, index) => (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{s._id}</Text>
                    <Text size="xl" fw={700} c={receiptTypeColors[s._id]}>
                      {formatCurrency(s.totalAmount)}
                    </Text>
                    <Text size="xs" c="dimmed">{s.count} receipts</Text>
                  </Box>
                  <IconCurrencyRupee size={32} stroke={1.5} color={`var(--mantine-color-${receiptTypeColors[s._id]}-6)`} />
                </Group>
              </Card>
            </Grid.Col>
          ))}
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md" bg="green.0">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Received</Text>
                  <Text size="xl" fw={700} c="green">{formatCurrency(totalReceived)}</Text>
                </Box>
                <IconCurrencyRupee size={32} stroke={1.5} color="var(--mantine-color-green-6)" />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconFilter size={18} />
              <Text fw={600}>Filters</Text>
            </Group>
            <ActionIcon variant="subtle" onClick={fetchReceipts}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                placeholder="Receipt Type"
                value={filters.receiptType}
                onChange={(value) => setFilters(prev => ({ ...prev, receiptType: value }))}
                data={receiptTypeOptions}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                placeholder="From Date"
                value={filters.fromDate}
                onChange={(value) => setFilters(prev => ({ ...prev, fromDate: value }))}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                placeholder="To Date"
                value={filters.toDate}
                onChange={(value) => setFilters(prev => ({ ...prev, toDate: value }))}
                clearable
                size="sm"
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Receipts Table */}
        <Card withBorder shadow="sm" radius="md">
          {loading ? (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Loader size="md" />
            </Box>
          ) : receipts.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No receipts found</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Receipt No</Table.Th>
                      <Table.Th>Farmer</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {receipts.map((receipt) => (
                      <Table.Tr key={receipt._id}>
                        <Table.Td>{formatDate(receipt.receiptDate)}</Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{receipt.receiptNumber}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {receipt.farmerId?.farmerNumber || '-'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {receipt.farmerId?.personalDetails?.name || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={receiptTypeColors[receipt.receiptType]} variant="light" size="sm">
                            {receipt.receiptType}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{receipt.referenceNumber || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600} c="green">{formatCurrency(receipt.amount)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">{receipt.paymentMode}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconPrinter size={14} />}
                                onClick={() => handlePrint(receipt)}
                              >
                                Print
                              </Menu.Item>
                              {receipt.status === 'Active' && canWrite('payments') && (
                                <Menu.Item
                                  leftSection={<IconX size={14} />}
                                  color="red"
                                  onClick={() => {
                                    setSelectedReceipt(receipt);
                                    setCancelModalOpen(true);
                                  }}
                                >
                                  Cancel
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {pagination.pages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={pagination.pages}
                    value={pagination.page}
                    onChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* New Receipt Modal */}
        <Modal
          opened={modalOpen}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
          title={<Text fw={600} size="lg">Create Receipt</Text>}
          size="lg"
          centered
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Grid>
                <Grid.Col span={6}>
                  <DatePickerInput
                    label="Receipt Date"
                    value={formData.receiptDate}
                    onChange={(value) => handleInputChange('receiptDate', value)}
                    leftSection={<IconCalendar size={16} />}
                    required
                    clearable={false}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Receipt Type"
                    value={formData.receiptType}
                    onChange={handleReceiptTypeChange}
                    data={[
                      { value: 'Cash Advance', label: 'Cash Advance' },
                      { value: 'CF Advance', label: 'CF Advance' },
                      { value: 'Loan Advance', label: 'Loan Advance' }
                    ]}
                    required
                  />
                </Grid.Col>
              </Grid>

              <Select
                label="Select Farmer"
                placeholder="Search farmer"
                value={formData.farmerId}
                onChange={handleFarmerSelect}
                data={farmerOptions}
                searchable
                clearable
                onSearchChange={searchFarmers}
                nothingFoundMessage={searchLoading ? "Searching..." : "No farmers found"}
                required
                leftSection={<IconSearch size={16} />}
                rightSection={searchLoading ? <Loader size="xs" /> : null}
              />

              {selectedFarmer && (
                <Paper withBorder p="sm" radius="md" bg="gray.0">
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Farmer</Text>
                      <Text size="sm" fw={500}>{selectedFarmer.personalDetails?.name}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Village</Text>
                      <Text size="sm">{selectedFarmer.address?.village || '-'}</Text>
                    </Grid.Col>
                  </Grid>
                </Paper>
              )}

              <Select
                label="Select Advance/Loan Reference"
                placeholder={referencesLoading ? "Loading..." : "Select reference"}
                value={formData.referenceId}
                onChange={handleReferenceSelect}
                data={references}
                disabled={!selectedFarmer || referencesLoading}
                required
                rightSection={referencesLoading ? <Loader size="xs" /> : null}
              />

              {currentBalance > 0 && (
                <Alert color="blue" icon={<IconAlertCircle />}>
                  <Text size="sm">Outstanding Balance: <Text span fw={700}>{formatCurrency(currentBalance)}</Text></Text>
                </Alert>
              )}

              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Amount"
                    value={formData.amount}
                    onChange={(value) => handleInputChange('amount', value)}
                    placeholder="Enter amount"
                    min={1}
                    max={currentBalance}
                    required
                    leftSection={<IconCurrencyRupee size={16} />}
                    thousandSeparator=","
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Payment Mode"
                    value={formData.paymentMode}
                    onChange={(value) => handleInputChange('paymentMode', value)}
                    data={paymentModeOptions}
                    required
                  />
                </Grid.Col>
              </Grid>

              <Textarea
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={formLoading}
                  disabled={!formData.farmerId || !formData.referenceId || !formData.amount}
                >
                  Create Receipt
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>

        {/* Cancel Confirmation Modal */}
        <Modal
          opened={cancelModalOpen}
          onClose={() => {
            setCancelModalOpen(false);
            setSelectedReceipt(null);
            setCancelReason('');
          }}
          title="Cancel Receipt"
          centered
        >
          <Stack>
            <Text size="sm">
              Are you sure you want to cancel receipt <strong>{selectedReceipt?.receiptNumber}</strong>?
              This will reverse the balance update.
            </Text>
            <TextInput
              label="Cancellation Reason"
              placeholder="Enter reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setCancelModalOpen(false)}>
                No, Keep It
              </Button>
              <Button color="red" onClick={handleCancelReceipt}>
                Yes, Cancel Receipt
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

export default ProducerReceiptManagement;

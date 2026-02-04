import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, producerLoanAPI } from '../../services/api';
import {
  Modal,
  Stack,
  Grid,
  Select,
  NumberInput,
  TextInput,
  Textarea,
  Button,
  Text,
  Group,
  Paper,
  SegmentedControl,
  Loader,
  Divider,
  Box,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch,
  IconCalendar,
  IconCurrencyRupee,
  IconInfoCircle,
} from '@tabler/icons-react';

const ProducerLoanModal = ({ opened, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  const [formData, setFormData] = useState({
    farmerId: '',
    loanDate: new Date(),
    loanType: 'Cash Advance',
    loanScheme: 'Monthly',
    principalAmount: '',
    interestType: 'Percentage',
    interestRate: 0,
    interestAmount: 0,
    totalEMI: '',
    paymentMode: 'Cash',
    chequeNumber: '',
    purpose: '',
    remarks: '',
    guarantorName: '',
    guarantorPhone: ''
  });

  const [calculations, setCalculations] = useState({
    totalLoanAmount: 0,
    emiAmount: 0
  });

  useEffect(() => {
    if (opened) {
      searchFarmers('');
    }
  }, [opened]);

  useEffect(() => {
    // Calculate totals when amount or interest changes
    const principal = parseFloat(formData.principalAmount) || 0;
    let interest = 0;

    if (formData.interestType === 'Percentage' && formData.interestRate > 0) {
      interest = (principal * formData.interestRate) / 100;
    } else if (formData.interestType === 'Flat') {
      interest = parseFloat(formData.interestAmount) || 0;
    }

    const total = principal + interest;
    const emiCount = parseInt(formData.totalEMI) || 1;
    const emi = emiCount > 0 ? Math.ceil(total / emiCount) : 0;

    setCalculations({
      totalLoanAmount: total,
      emiAmount: emi
    });
  }, [formData.principalAmount, formData.interestType, formData.interestRate, formData.interestAmount, formData.totalEMI]);

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

  const handleFarmerSelect = (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    setSelectedFarmer(farmer);
    setFormData(prev => ({ ...prev, farmerId }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      farmerId: '',
      loanDate: new Date(),
      loanType: 'Cash Advance',
      loanScheme: 'Monthly',
      principalAmount: '',
      interestType: 'Percentage',
      interestRate: 0,
      interestAmount: 0,
      totalEMI: '',
      paymentMode: 'Cash',
      chequeNumber: '',
      purpose: '',
      remarks: '',
      guarantorName: '',
      guarantorPhone: ''
    });
    setSelectedFarmer(null);
    setCalculations({ totalLoanAmount: 0, emiAmount: 0 });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.farmerId) {
      message.error('Please select a farmer');
      return;
    }

    if (!formData.principalAmount || formData.principalAmount <= 0) {
      message.error('Please enter a valid principal amount');
      return;
    }

    if (!formData.totalEMI || formData.totalEMI <= 0) {
      message.error('Please enter total EMI count');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        principalAmount: parseFloat(formData.principalAmount),
        interestRate: parseFloat(formData.interestRate) || 0,
        interestAmount: formData.interestType === 'Flat' ? parseFloat(formData.interestAmount) || 0 : 0,
        totalEMI: parseInt(formData.totalEMI)
      };

      await producerLoanAPI.create(payload);
      message.success('Loan created successfully');
      resetForm();
      onSuccess();
    } catch (error) {
      message.error(error.message || 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name} (${farmer.personalDetails?.phone || 'No phone'})`
  }));

  const loanTypeOptions = [
    { value: 'Cash Advance', label: 'Cash Advance' },
    { value: 'CF Advance', label: 'CF Advance (Cattle Feed)' },
    { value: 'Loan Advance', label: 'Loan Advance' }
  ];

  const loanSchemeOptions = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Custom', label: 'Custom' }
  ];

  const paymentModeOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Cheque', label: 'Cheque' }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text fw={600} size="lg">Create New Loan</Text>}
      size="xl"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Farmer Selection */}
          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Loan Date"
                placeholder="Select date"
                value={formData.loanDate}
                onChange={(value) => handleInputChange('loanDate', value)}
                leftSection={<IconCalendar size={16} />}
                required
                clearable={false}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Select Farmer"
                placeholder="Search by farmer number, name, or phone"
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
            </Grid.Col>
          </Grid>

          {/* Farmer Details */}
          {selectedFarmer && (
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Grid>
                <Grid.Col span={3}>
                  <Text size="xs" fw={500} c="dimmed">Farmer Name</Text>
                  <Text size="sm" fw={600}>{selectedFarmer.personalDetails?.name}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" fw={500} c="dimmed">Farmer Number</Text>
                  <Text size="sm" fw={600}>{selectedFarmer.farmerNumber}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" fw={500} c="dimmed">Phone</Text>
                  <Text size="sm">{selectedFarmer.personalDetails?.phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="xs" fw={500} c="dimmed">Village</Text>
                  <Text size="sm">{selectedFarmer.address?.village || '-'}</Text>
                </Grid.Col>
              </Grid>
            </Paper>
          )}

          <Divider label="Loan Details" labelPosition="center" />

          {/* Loan Type and Scheme */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Loan Type"
                value={formData.loanType}
                onChange={(value) => handleInputChange('loanType', value)}
                data={loanTypeOptions}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="EMI Scheme"
                value={formData.loanScheme}
                onChange={(value) => handleInputChange('loanScheme', value)}
                data={loanSchemeOptions}
                required
              />
            </Grid.Col>
          </Grid>

          {/* Amount and Interest */}
          <Grid>
            <Grid.Col span={4}>
              <NumberInput
                label="Principal Amount"
                value={formData.principalAmount}
                onChange={(value) => handleInputChange('principalAmount', value)}
                placeholder="Enter amount"
                min={1}
                required
                leftSection={<IconCurrencyRupee size={16} />}
                thousandSeparator=","
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>Interest Type</Text>
                <SegmentedControl
                  value={formData.interestType}
                  onChange={(value) => handleInputChange('interestType', value)}
                  data={[
                    { label: 'Percentage (%)', value: 'Percentage' },
                    { label: 'Flat Amount', value: 'Flat' }
                  ]}
                  size="xs"
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={4}>
              {formData.interestType === 'Percentage' ? (
                <NumberInput
                  label="Interest Rate (%)"
                  value={formData.interestRate}
                  onChange={(value) => handleInputChange('interestRate', value)}
                  placeholder="0"
                  min={0}
                  max={100}
                  decimalScale={2}
                  suffix="%"
                />
              ) : (
                <NumberInput
                  label="Interest Amount"
                  value={formData.interestAmount}
                  onChange={(value) => handleInputChange('interestAmount', value)}
                  placeholder="Enter interest"
                  min={0}
                  leftSection={<IconCurrencyRupee size={16} />}
                  thousandSeparator=","
                />
              )}
            </Grid.Col>
          </Grid>

          {/* EMI Details */}
          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Total EMI Count"
                value={formData.totalEMI}
                onChange={(value) => handleInputChange('totalEMI', value)}
                placeholder="Number of installments"
                min={1}
                required
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

          {formData.paymentMode === 'Cheque' && (
            <TextInput
              label="Cheque Number"
              value={formData.chequeNumber}
              onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
              placeholder="Enter cheque number"
            />
          )}

          {/* Calculation Summary */}
          <Paper withBorder p="md" radius="md" bg="blue.0">
            <Grid>
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">Principal Amount</Text>
                <Text size="lg" fw={600}>{formatCurrency(formData.principalAmount || 0)}</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">Total Loan Amount</Text>
                <Text size="lg" fw={700} c="blue">{formatCurrency(calculations.totalLoanAmount)}</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">EMI Amount</Text>
                <Text size="lg" fw={700} c="green">{formatCurrency(calculations.emiAmount)}</Text>
              </Grid.Col>
            </Grid>
          </Paper>

          <Divider label="Additional Details" labelPosition="center" />

          {/* Optional Fields */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Guarantor Name"
                value={formData.guarantorName}
                onChange={(e) => handleInputChange('guarantorName', e.target.value)}
                placeholder="Optional"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Guarantor Phone"
                value={formData.guarantorPhone}
                onChange={(e) => handleInputChange('guarantorPhone', e.target.value)}
                placeholder="Optional"
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Purpose"
            value={formData.purpose}
            onChange={(e) => handleInputChange('purpose', e.target.value)}
            placeholder="Purpose of the loan"
            rows={2}
          />

          <Textarea
            label="Remarks"
            value={formData.remarks}
            onChange={(e) => handleInputChange('remarks', e.target.value)}
            placeholder="Additional notes"
            rows={2}
          />

          {/* Form Actions */}
          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!formData.farmerId || !formData.principalAmount || !formData.totalEMI}
            >
              Create Loan
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ProducerLoanModal;

import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { farmerAPI, paymentAPI, advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
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
  TextInput,
  NumberInput,
  Button,
  Table,
  Badge,
  Divider,
  Loader,
  Box,
  ActionIcon,
  Grid,
  Alert,
} from '@mantine/core';
import { IconTrash, IconPlus, IconSearch, IconCurrencyRupee } from '@tabler/icons-react';

const MilkPaymentForm = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deductions, setDeductions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    farmerId: '',
    milkAmount: '',
    advanceAmount: '',
    paymentMode: 'Cash',
    paidAmount: ''
  });

  // Deduction form fields
  const [deductionForm, setDeductionForm] = useState({
    type: '',
    amount: '',
    description: ''
  });

  const [calculations, setCalculations] = useState({
    milkAmount: 0,
    advanceAmount: 0,
    totalDeduction: 0,
    netPayable: 0
  });

  useEffect(() => {
    searchFarmer('');
  }, []);

  const searchFarmer = async (value) => {
    try {
      setSearchLoading(true);
      let response;
      if (value && value.trim().length > 0) {
        response = await farmerAPI.search(value.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active' });
      }
      setFarmers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to search farmers');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFarmerSelect = async (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedFarmer(farmer);
      setFormData(prev => ({ ...prev, farmerId }));
      // Fetch farmer's advance balance
      try {
        const response = await advanceAPI.getFarmerAdvances(farmerId);
        const activeAdvances = response.data.filter(adv => adv.status === 'Active');
        const totalAdvance = activeAdvances.reduce((sum, adv) => sum + adv.balanceAmount, 0);
        setFormData(prev => ({ ...prev, advanceAmount: totalAdvance }));
      } catch (error) {
        console.error('Failed to fetch advances:', error);
      }
    }
  };

  const handleAddDeduction = () => {
    const { type, amount, description } = deductionForm;

    if (!type || !amount) {
      message.error('Please enter deduction type and amount');
      return;
    }

    const newDeduction = { type, amount: parseFloat(amount), description: description || '' };
    setDeductions([...deductions, newDeduction]);

    setDeductionForm({
      type: '',
      amount: '',
      description: ''
    });
  };

  const handleRemoveDeduction = (index) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeductionInputChange = (name, value) => {
    setDeductionForm(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const milkAmount = parseFloat(formData.milkAmount) || 0;
    const advanceAmount = parseFloat(formData.advanceAmount) || 0;
    const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPayable = milkAmount - advanceAmount - totalDeduction;

    setCalculations({
      milkAmount,
      advanceAmount,
      totalDeduction,
      netPayable
    });
  }, [formData.milkAmount, formData.advanceAmount, deductions]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFarmer) {
      message.error('Please select a farmer');
      return;
    }

    if (!formData.milkAmount) {
      message.error('Please enter milk amount');
      return;
    }

    if (!formData.paymentMode) {
      message.error('Please select payment mode');
      return;
    }

    setLoading(true);
    try {
      const paidAmount = parseFloat(formData.paidAmount) || calculations.netPayable;

      const payload = {
        farmerId: selectedFarmer._id,
        milkAmount: parseFloat(formData.milkAmount),
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        deductions: deductions,
        totalDeduction: calculations.totalDeduction,
        netPayable: calculations.netPayable,
        paymentMode: formData.paymentMode,
        paidAmount: paidAmount,
        balanceAmount: calculations.netPayable - paidAmount
      };

      await paymentAPI.create(payload);
      message.success('Payment created successfully');
      navigate('/payments/history');
    } catch (error) {
      message.error(error.message || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = farmers.filter(farmer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      farmer.farmerNumber?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.name?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.phone?.toLowerCase().includes(searchLower)
    );
  });

  const farmerOptions = filteredFarmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name} (${farmer.personalDetails?.phone})`
  }));

  const deductionTypes = [
    { value: 'Feed', label: 'Feed' },
    { value: 'Medicine', label: 'Medicine' },
    { value: 'Loan', label: 'Loan' },
    { value: 'Other', label: 'Other' },
  ];

  const paymentModes = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank' },
  ];

  return (
    <Container size="lg" py="xl">
      <Stack spacing="xl">
        <Box>
          <Title order={2}>Milk Payment</Title>
          <Text color="dimmed" size="sm">Process farmer milk payment</Text>
        </Box>

        <Card withBorder shadow="sm" radius="md" p="lg">
          <form onSubmit={handleSubmit}>
            <Stack spacing="lg">
              {/* Farmer Selection */}
              <Grid>
                <Grid.Col span={12}>
                  <Select
                    label="Select Farmer"
                    placeholder="Search by farmer number, name, or phone"
                    value={formData.farmerId}
                    onChange={handleFarmerSelect}
                    data={farmerOptions}
                    searchable
                    clearable
                    onSearchChange={(value) => {
                      setSearchTerm(value);
                      searchFarmer(value);
                    }}
                    nothingFound={searchLoading ? "Searching..." : "No farmers found"}
                    required
                    icon={<IconSearch size={16} />}
                    rightSection={searchLoading ? <Loader size="xs" /> : null}
                  />
                </Grid.Col>
              </Grid>

              {selectedFarmer && (
                <Paper withBorder p="md" radius="md">
                  <Grid>
                    <Grid.Col span={4}>
                      <Text size="sm" fw={500}>Farmer Name</Text>
                      <Text>{selectedFarmer.personalDetails?.name}</Text>
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <Text size="sm" fw={500}>Phone</Text>
                      <Text>{selectedFarmer.personalDetails?.phone}</Text>
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <Text size="sm" fw={500}>Village</Text>
                      <Text>{selectedFarmer.address?.village}</Text>
                    </Grid.Col>
                  </Grid>
                </Paper>
              )}

              {/* Amount Inputs */}
              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Milk Amount (₹)"
                    value={formData.milkAmount}
                    onChange={(value) => handleInputChange('milkAmount', value)}
                    placeholder="Enter milk amount"
                    min={0}
                    step={0.01}
                    required
                    icon={<IconCurrencyRupee size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Advance Amount to Deduct (₹)"
                    value={formData.advanceAmount}
                    onChange={(value) => handleInputChange('advanceAmount', value)}
                    placeholder="Enter advance amount"
                    min={0}
                    step={0.01}
                    icon={<IconCurrencyRupee size={16} />}
                  />
                </Grid.Col>
              </Grid>

              {/* Deductions Section */}
              <Paper withBorder p="md" radius="md">
                <Title order={4} mb="md">Deductions</Title>
                <Grid gutter="sm" align="flex-end">
                  <Grid.Col span={3}>
                    <Select
                      label="Type"
                      placeholder="Select type"
                      value={deductionForm.type}
                      onChange={(value) => handleDeductionInputChange('type', value)}
                      data={deductionTypes}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <NumberInput
                      label="Amount (₹)"
                      value={deductionForm.amount}
                      onChange={(value) => handleDeductionInputChange('amount', value)}
                      placeholder="Amount"
                      min={0}
                      step={0.01}
                      icon={<IconCurrencyRupee size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <TextInput
                      label="Description"
                      value={deductionForm.description}
                      onChange={(e) => handleDeductionInputChange('description', e.target.value)}
                      placeholder="Description"
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <Button
                      onClick={handleAddDeduction}
                      leftIcon={<IconPlus size={16} />}
                      variant="light"
                      fullWidth
                    >
                      Add
                    </Button>
                  </Grid.Col>
                </Grid>

                {deductions.length > 0 && (
                  <Box mt="md">
                    <Table striped highlightOnHover>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Description</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deductions.map((deduction, index) => (
                          <tr key={index}>
                            <td>
                              <Badge color="blue" variant="light">
                                {deduction.type}
                              </Badge>
                            </td>
                            <td>₹{deduction.amount.toFixed(2)}</td>
                            <td>{deduction.description}</td>
                            <td>
                              <ActionIcon
                                color="red"
                                onClick={() => handleRemoveDeduction(index)}
                                variant="light"
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Box>
                )}
              </Paper>

              {/* Calculations */}
              <Paper withBorder p="md" radius="md">
                <Title order={4} mb="md">Payment Summary</Title>
                <Stack spacing="xs">
                  <Group position="apart">
                    <Text size="sm">Milk Amount:</Text>
                    <Text fw={500}>₹{calculations.milkAmount.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm">Advance Deduction:</Text>
                    <Text fw={500} color="red">- ₹{calculations.advanceAmount.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm">Total Deductions:</Text>
                    <Text fw={500} color="red">- ₹{calculations.totalDeduction.toFixed(2)}</Text>
                  </Group>
                  <Divider />
                  <Group position="apart">
                    <Text size="lg" fw={700}>Net Payable:</Text>
                    <Text size="lg" fw={700} color="green">₹{calculations.netPayable.toFixed(2)}</Text>
                  </Group>
                </Stack>
              </Paper>

              {/* Payment Details */}
              <Grid>
                <Grid.Col span={6}>
                  <Select
                    label="Payment Mode"
                    value={formData.paymentMode}
                    onChange={(value) => handleInputChange('paymentMode', value)}
                    data={paymentModes}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Paid Amount (₹)"
                    value={formData.paidAmount}
                    onChange={(value) => handleInputChange('paidAmount', value)}
                    placeholder="Enter paid amount"
                    min={0}
                    max={calculations.netPayable}
                    step={0.01}
                    icon={<IconCurrencyRupee size={16} />}
                  />
                  {formData.paidAmount && (
                    <Text size="xs" color="dimmed" mt={4}>
                      Balance: ₹{(calculations.netPayable - parseFloat(formData.paidAmount || 0)).toFixed(2)}
                    </Text>
                  )}
                </Grid.Col>
              </Grid>

              {/* Form Actions */}
              <Group position="right" mt="xl">
                <Button
                  variant="light"
                  color="gray"
                  onClick={() => navigate('/payments/history')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!selectedFarmer || !formData.milkAmount || !canWrite('payments')}
                >
                  Save Payment
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
};

export default MilkPaymentForm;
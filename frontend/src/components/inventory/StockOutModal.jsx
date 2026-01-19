import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Title,
  Text,
  Badge,
  Divider,
  Alert
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPackageExport,
  IconCheck,
  IconX,
  IconCalendar,
  IconCurrencyRupee,
  IconAlertTriangle,
  IconPackage
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { stockAPI, itemAPI } from '../../services/api';

const StockOutModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: 0,
    rate: 0,
    date: new Date(),
    referenceType: 'Adjustment',
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      itemId: '',
      quantity: 0,
      rate: 0,
      date: new Date(),
      referenceType: 'Adjustment',
      notes: ''
    });
    setSelectedItem(null);
    setErrors({});
  };

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll({ status: 'Active', limit: 1000 });
      const itemsData = response.data || [];
      setItems(itemsData.map(item => ({
        value: item._id,
        label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`,
        ...item
      })));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch items',
        color: 'red'
      });
    }
  };

  const handleItemChange = (value) => {
    setFormData(prev => ({ ...prev, itemId: value }));

    // Find and set selected item details
    const item = items.find(i => i.value === value);
    if (item) {
      setSelectedItem(item);
      // Auto-fill rate with sales rate if available
      if (!formData.rate || formData.rate === 0) {
        setFormData(prev => ({ ...prev, rate: item.salesRate || 0 }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.itemId) {
      newErrors.itemId = 'Item is required';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (selectedItem && formData.quantity > selectedItem.currentBalance) {
      newErrors.quantity = `Quantity cannot exceed available stock (${selectedItem.currentBalance} ${selectedItem.unit})`;
    }

    if (!formData.rate || formData.rate <= 0) {
      newErrors.rate = 'Rate must be greater than 0';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the errors in the form',
        color: 'red'
      });
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        itemId: formData.itemId,
        quantity: parseFloat(formData.quantity),
        rate: parseFloat(formData.rate),
        notes: formData.notes
      };

      await stockAPI.stockOut(submitData);

      notifications.show({
        title: 'Success',
        message: 'Stock reduced successfully',
        color: 'green'
      });

      onSuccess();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to reduce stock',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = parseFloat(formData.quantity || 0) * parseFloat(formData.rate || 0);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <IconPackageExport size={24} />
          <div>
            <Title order={4}>Stock Out</Title>
            <Text size="sm" c="dimmed">
              Remove stock from inventory
            </Text>
          </div>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Item Selection */}
        <div>
          <Title order={5} mb="sm">Item Details</Title>
          <Grid>
            <Grid.Col span={12}>
              <Select
                label="Select Item"
                placeholder="Choose an item"
                leftSection={<IconPackage size={16} />}
                data={items}
                value={formData.itemId}
                onChange={handleItemChange}
                searchable
                error={errors.itemId}
                required
              />
            </Grid.Col>

            {selectedItem && (
              <Grid.Col span={12}>
                <Alert
                  variant="light"
                  color="blue"
                  title="Current Stock Information"
                  icon={<IconPackage size={16} />}
                >
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Item Code</Text>
                      <Text size="sm" fw={600}>{selectedItem.itemCode}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Category</Text>
                      <Text size="sm" fw={600}>{selectedItem.category}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Current Balance</Text>
                      <Badge color="green" variant="filled" size="lg">
                        {selectedItem.currentBalance} {selectedItem.unit}
                      </Badge>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Sales Rate</Text>
                      <Text size="sm" fw={600}>₹{selectedItem.salesRate?.toFixed(2)}</Text>
                    </Grid.Col>
                  </Grid>
                </Alert>
              </Grid.Col>
            )}

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label="Quantity"
                placeholder="Enter quantity to remove"
                value={formData.quantity}
                onChange={(value) => setFormData(prev => ({ ...prev, quantity: value }))}
                min={0}
                decimalScale={2}
                error={errors.quantity}
                required
                rightSection={
                  selectedItem && (
                    <Text size="xs" c="dimmed" pr="md">
                      {selectedItem.unit}
                    </Text>
                  )
                }
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label="Rate (₹)"
                placeholder="Enter rate"
                leftSection={<IconCurrencyRupee size={16} />}
                value={formData.rate}
                onChange={(value) => setFormData(prev => ({ ...prev, rate: value }))}
                min={0}
                decimalScale={2}
                error={errors.rate}
                required
              />
            </Grid.Col>

            {formData.quantity > 0 && formData.rate > 0 && (
              <Grid.Col span={12}>
                <Alert variant="light" color="violet">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Total Amount:</Text>
                    <Badge color="violet" size="xl" variant="filled">
                      ₹{totalAmount.toFixed(2)}
                    </Badge>
                  </Group>
                </Alert>
              </Grid.Col>
            )}

            {selectedItem && formData.quantity > selectedItem.currentBalance && (
              <Grid.Col span={12}>
                <Alert
                  variant="light"
                  color="red"
                  title="Insufficient Stock"
                  icon={<IconAlertTriangle size={16} />}
                >
                  The requested quantity ({formData.quantity}) exceeds available stock ({selectedItem.currentBalance} {selectedItem.unit}).
                  Please adjust the quantity.
                </Alert>
              </Grid.Col>
            )}
          </Grid>
        </div>

        <Divider />

        {/* Additional Details */}
        <div>
          <Title order={5} mb="sm">Transaction Details</Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <DateInput
                label="Date"
                placeholder="Select date"
                leftSection={<IconCalendar size={16} />}
                value={formData.date}
                onChange={(value) => setFormData(prev => ({ ...prev, date: value }))}
                error={errors.date}
                required
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Reference Type"
                data={[
                  { value: 'Adjustment', label: 'Adjustment' },
                  { value: 'Sale', label: 'Sale' },
                  { value: 'Return', label: 'Return' }
                ]}
                value={formData.referenceType}
                onChange={(value) => setFormData(prev => ({ ...prev, referenceType: value }))}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Textarea
                label="Notes"
                placeholder="Enter reason or additional notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </Grid.Col>
          </Grid>
        </div>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            leftSection={<IconX size={16} />}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={handleSubmit}
            loading={loading}
            color="red"
          >
            Remove Stock
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default StockOutModal;

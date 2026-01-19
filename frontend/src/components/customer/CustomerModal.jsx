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
  FileInput,
  Title,
  Text
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconFileText,
  IconCurrencyRupee,
  IconCheck,
  IconX,
  IconUpload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { customerAPI } from '../../services/api';

const CustomerModal = ({ isOpen, onClose, onSuccess, customerId = null }) => {
  const isEditMode = Boolean(customerId);

  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: '',
    openingBalance: 0,
    state: '',
    district: '',
    pincode: '',
    panNumber: '',
    active: true,
    documents: {
      aadhaar: '',
      passbook: '',
      rationCard: '',
      incomeProof: ''
    }
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomer();
    } else if (isOpen && !customerId) {
      resetForm();
    }
  }, [isOpen, customerId]);

  const resetForm = () => {
    setFormData({
      customerId: '',
      name: '',
      phone: '',
      email: '',
      gstNumber: '',
      address: '',
      openingBalance: 0,
      state: '',
      district: '',
      pincode: '',
      panNumber: '',
      active: true,
      documents: {
        aadhaar: '',
        passbook: '',
        rationCard: '',
        incomeProof: ''
      }
    });
    setErrors({});
  };

  const fetchCustomer = async () => {
    try {
      const response = await customerAPI.getById(customerId);
      setFormData(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch customer',
        color: 'red'
      });
      onClose();
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDocumentChange = (docType, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documents: {
            ...prev.documents,
            [docType]: reader.result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.pincode && !/^[0-9]{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      newErrors.panNumber = 'Invalid PAN number format (e.g., ABCDE1234F)';
    }

    if (formData.gstNumber && formData.gstNumber.length !== 15) {
      newErrors.gstNumber = 'GST number must be 15 characters';
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
      if (isEditMode) {
        await customerAPI.update(customerId, formData);
        notifications.show({
          title: 'Success',
          message: 'Customer updated successfully',
          color: 'green'
        });
      } else {
        // Don't send customerId for new customers (will be auto-generated)
        const { customerId: _, ...dataToSend } = formData;
        await customerAPI.create(dataToSend);
        notifications.show({
          title: 'Success',
          message: 'Customer created successfully with ledger accounts',
          color: 'green'
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'create'} customer`,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <IconUser size={24} />
          <div>
            <Title order={4}>{isEditMode ? 'Edit Customer' : 'Add New Customer'}</Title>
            <Text size="sm" c="dimmed">
              {isEditMode ? 'Update the details of the customer' : 'Customer ID will be auto-generated'}
            </Text>
          </div>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        <Title order={5}>Basic Information</Title>
        <Grid>
          {isEditMode && (
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Customer ID"
                leftSection={<IconFileText size={16} />}
                value={formData.customerId}
                disabled
              />
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, sm: isEditMode ? 6 : 12 }}>
            <TextInput
              label="Customer Name"
              placeholder="Enter full name"
              leftSection={<IconUser size={16} />}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Phone Number"
              placeholder="10-digit phone number"
              leftSection={<IconPhone size={16} />}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={errors.phone}
              maxLength={10}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Email Address"
              placeholder="Enter email address"
              leftSection={<IconMail size={16} />}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Opening Balance"
              placeholder="Enter opening balance (₹)"
              leftSection={<IconCurrencyRupee size={16} />}
              value={formData.openingBalance}
              onChange={(value) => handleChange('openingBalance', value)}
              decimalScale={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Status"
              leftSection={<IconCheck size={16} />}
              value={String(formData.active)}
              onChange={(value) => handleChange('active', value === 'true')}
              data={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' }
              ]}
            />
          </Grid.Col>
        </Grid>

        <Title order={5} mt="md">Address Details</Title>
        <Grid>
          <Grid.Col span={12}>
            <Textarea
              label="Full Address"
              placeholder="Street, locality, landmark"
              leftSection={<IconMapPin size={16} />}
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={3}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="State"
              placeholder="Enter state"
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="District"
              placeholder="Enter district"
              value={formData.district}
              onChange={(e) => handleChange('district', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="PIN Code"
              placeholder="6-digit PIN code"
              value={formData.pincode}
              onChange={(e) => handleChange('pincode', e.target.value)}
              error={errors.pincode}
              maxLength={6}
            />
          </Grid.Col>
        </Grid>

        <Title order={5} mt="md">Tax Information</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="GST Number"
              placeholder="15-character GST number"
              leftSection={<IconFileText size={16} />}
              value={formData.gstNumber}
              onChange={(e) => handleChange('gstNumber', e.target.value)}
              error={errors.gstNumber}
              maxLength={15}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="PAN Number"
              placeholder="Format: ABCDE1234F"
              leftSection={<IconFileText size={16} />}
              value={formData.panNumber}
              onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
              error={errors.panNumber}
              maxLength={10}
            />
          </Grid.Col>
        </Grid>

        <Title order={5} mt="md">Documents (Optional)</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <FileInput
              label="Aadhaar Card"
              placeholder="Upload Aadhaar"
              leftSection={<IconUpload size={16} />}
              accept="image/*,.pdf"
              onChange={(file) => handleDocumentChange('aadhaar', file)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <FileInput
              label="Bank Passbook"
              placeholder="Upload Passbook"
              leftSection={<IconUpload size={16} />}
              accept="image/*,.pdf"
              onChange={(file) => handleDocumentChange('passbook', file)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <FileInput
              label="Ration Card"
              placeholder="Upload Ration Card"
              leftSection={<IconUpload size={16} />}
              accept="image/*,.pdf"
              onChange={(file) => handleDocumentChange('rationCard', file)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <FileInput
              label="Income Proof"
              placeholder="Upload Income Proof"
              leftSection={<IconUpload size={16} />}
              accept="image/*,.pdf"
              onChange={(file) => handleDocumentChange('incomeProof', file)}
            />
          </Grid.Col>
        </Grid>

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
          >
            {isEditMode ? 'Update Customer' : 'Create Customer'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CustomerModal;

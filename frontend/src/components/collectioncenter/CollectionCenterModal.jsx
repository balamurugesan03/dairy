import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Title,
  Text
} from '@mantine/core';
import {
  IconBuilding,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCalendar,
  IconUser,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { collectionCenterAPI } from '../../services/api';

const CollectionCenterModal = ({ isOpen, onClose, onSuccess, centerId = null }) => {
  const isEditMode = Boolean(centerId);

  const [formData, setFormData] = useState({
    centerName: '',
    startDate: new Date(),
    centerType: 'Sub Centre',
    status: 'Active',
    address: {
      street: '',
      village: '',
      district: '',
      state: '',
      pincode: ''
    },
    contactDetails: {
      phone: '',
      email: '',
      incharge: ''
    },
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && centerId) {
      fetchCenter();
    } else if (isOpen && !centerId) {
      resetForm();
    }
  }, [isOpen, centerId]);

  const resetForm = () => {
    setFormData({
      centerName: '',
      startDate: new Date(),
      centerType: 'Sub Centre',
      status: 'Active',
      address: {
        street: '',
        village: '',
        district: '',
        state: '',
        pincode: ''
      },
      contactDetails: {
        phone: '',
        email: '',
        incharge: ''
      },
      description: ''
    });
    setErrors({});
  };

  const fetchCenter = async () => {
    try {
      const response = await collectionCenterAPI.getById(centerId);
      const center = response.data;
      setFormData({
        ...center,
        startDate: center.startDate ? new Date(center.startDate) : new Date(),
        address: center.address || {
          street: '',
          village: '',
          district: '',
          state: '',
          pincode: ''
        },
        contactDetails: center.contactDetails || {
          phone: '',
          email: '',
          incharge: ''
        }
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch collection center',
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

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
    if (errors[`address.${field}`]) {
      setErrors(prev => ({ ...prev, [`address.${field}`]: '' }));
    }
  };

  const handleContactChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contactDetails: { ...prev.contactDetails, [field]: value }
    }));
    if (errors[`contactDetails.${field}`]) {
      setErrors(prev => ({ ...prev, [`contactDetails.${field}`]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.centerName.trim()) {
      newErrors.centerName = 'Center name is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.centerType) {
      newErrors.centerType = 'Center type is required';
    }

    if (formData.contactDetails.phone && !/^[0-9]{10}$/.test(formData.contactDetails.phone)) {
      newErrors['contactDetails.phone'] = 'Phone number must be 10 digits';
    }

    if (formData.contactDetails.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactDetails.email)) {
      newErrors['contactDetails.email'] = 'Invalid email format';
    }

    if (formData.address.pincode && !/^[0-9]{6}$/.test(formData.address.pincode)) {
      newErrors['address.pincode'] = 'Pincode must be 6 digits';
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
        await collectionCenterAPI.update(centerId, formData);
        notifications.show({
          title: 'Success',
          message: 'Collection center updated successfully',
          color: 'green'
        });
      } else {
        await collectionCenterAPI.create(formData);
        notifications.show({
          title: 'Success',
          message: 'Collection center created successfully',
          color: 'green'
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'create'} collection center`,
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
          <IconBuilding size={24} />
          <div>
            <Title order={4}>{isEditMode ? 'Edit Collection Center' : 'Add New Collection Center'}</Title>
            <Text size="sm" c="dimmed">
              {isEditMode ? 'Update the details of the collection center' : 'Enter collection center information'}
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
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Center Name"
              placeholder="Enter center name"
              leftSection={<IconBuilding size={16} />}
              value={formData.centerName}
              onChange={(e) => handleChange('centerName', e.target.value)}
              error={errors.centerName}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Center Type"
              placeholder="Select type"
              leftSection={<IconBuilding size={16} />}
              value={formData.centerType}
              onChange={(value) => handleChange('centerType', value)}
              data={[
                { value: 'Head Office', label: 'Head Office' },
                { value: 'Sub Centre', label: 'Sub Centre' }
              ]}
              error={errors.centerType}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label="Start Date"
              placeholder="Select start date"
              leftSection={<IconCalendar size={16} />}
              value={formData.startDate}
              onChange={(value) => handleChange('startDate', value)}
              error={errors.startDate}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Status"
              leftSection={<IconCheck size={16} />}
              value={formData.status}
              onChange={(value) => handleChange('status', value)}
              data={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Description"
              placeholder="Enter description (optional)"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </Grid.Col>
        </Grid>

        <Title order={5} mt="md">Address Details</Title>
        <Grid>
          <Grid.Col span={12}>
            <TextInput
              label="Street"
              placeholder="Enter street address"
              leftSection={<IconMapPin size={16} />}
              value={formData.address.street}
              onChange={(e) => handleAddressChange('street', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Village"
              placeholder="Enter village"
              value={formData.address.village}
              onChange={(e) => handleAddressChange('village', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="District"
              placeholder="Enter district"
              value={formData.address.district}
              onChange={(e) => handleAddressChange('district', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="State"
              placeholder="Enter state"
              value={formData.address.state}
              onChange={(e) => handleAddressChange('state', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="PIN Code"
              placeholder="6-digit PIN code"
              value={formData.address.pincode}
              onChange={(e) => handleAddressChange('pincode', e.target.value)}
              error={errors['address.pincode']}
              maxLength={6}
            />
          </Grid.Col>
        </Grid>

        <Title order={5} mt="md">Contact Details</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Incharge Name"
              placeholder="Enter incharge name"
              leftSection={<IconUser size={16} />}
              value={formData.contactDetails.incharge}
              onChange={(e) => handleContactChange('incharge', e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Phone Number"
              placeholder="10-digit phone number"
              leftSection={<IconPhone size={16} />}
              value={formData.contactDetails.phone}
              onChange={(e) => handleContactChange('phone', e.target.value)}
              error={errors['contactDetails.phone']}
              maxLength={10}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput
              label="Email Address"
              placeholder="Enter email address"
              leftSection={<IconMail size={16} />}
              value={formData.contactDetails.email}
              onChange={(e) => handleContactChange('email', e.target.value)}
              error={errors['contactDetails.email']}
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
            {isEditMode ? 'Update Center' : 'Create Center'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CollectionCenterModal;

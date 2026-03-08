import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Title,
  Text,
  Textarea
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBuilding,
  IconId,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { agentAPI, collectionCenterAPI } from '../../services/api';

const AgentModal = ({ isOpen, onClose, onSuccess, agentId = null }) => {
  const isEditMode = Boolean(agentId);

  const [formData, setFormData] = useState({
    agentCode: '',
    agentName: '',
    collectionCenterId: '',
    phone: '',
    email: '',
    address: '',
    status: 'Active'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    fetchCenters();
  }, []);

  useEffect(() => {
    if (isOpen && agentId) {
      fetchAgent();
    } else if (isOpen && !agentId) {
      resetForm();
    }
  }, [isOpen, agentId]);

  const fetchCenters = async () => {
    try {
      const res = await collectionCenterAPI.getAll({ status: 'Active', limit: 200 });
      const data = res.data || [];
      setCenters(data.map(c => ({ value: c._id, label: `${c.centerName} (${c.centerType})` })));
    } catch {
      // silent
    }
  };

  const resetForm = () => {
    setFormData({
      agentCode: '',
      agentName: '',
      collectionCenterId: '',
      phone: '',
      email: '',
      address: '',
      status: 'Active'
    });
    setErrors({});
  };

  const fetchAgent = async () => {
    try {
      const res = await agentAPI.getById(agentId);
      const a = res.data;
      setFormData({
        agentCode: a.agentCode || '',
        agentName: a.agentName || '',
        collectionCenterId: a.collectionCenterId?._id || a.collectionCenterId || '',
        phone: a.phone || '',
        email: a.email || '',
        address: a.address || '',
        status: a.status || 'Active'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch agent',
        color: 'red'
      });
      onClose();
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.agentCode.trim()) newErrors.agentCode = 'Agent code is required';
    if (!formData.agentName.trim()) newErrors.agentName = 'Agent name is required';
    if (!formData.collectionCenterId) newErrors.collectionCenterId = 'Collection center is required';
    if (formData.phone && !/^[0-9]{10}$/.test(formData.phone))
      newErrors.phone = 'Phone must be 10 digits';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Invalid email format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      notifications.show({ title: 'Validation Error', message: 'Please fix the errors', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      if (isEditMode) {
        await agentAPI.update(agentId, formData);
        notifications.show({ title: 'Success', message: 'Agent updated successfully', color: 'green' });
      } else {
        await agentAPI.create(formData);
        notifications.show({ title: 'Success', message: 'Agent created successfully', color: 'green' });
      }
      onSuccess();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'create'} agent`,
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
            <Title order={4}>{isEditMode ? 'Edit Agent' : 'Add New Agent'}</Title>
            <Text size="sm" c="dimmed">
              {isEditMode ? 'Update agent details' : 'Enter agent information'}
            </Text>
          </div>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Title order={5}>Basic Information</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Agent Code"
              placeholder="e.g. AG001"
              leftSection={<IconId size={16} />}
              value={formData.agentCode}
              onChange={e => handleChange('agentCode', e.target.value.toUpperCase())}
              error={errors.agentCode}
              required
              disabled={isEditMode}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Agent Name"
              placeholder="Enter full name"
              leftSection={<IconUser size={16} />}
              value={formData.agentName}
              onChange={e => handleChange('agentName', e.target.value)}
              error={errors.agentName}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Collection Center"
              placeholder="Select collection center"
              leftSection={<IconBuilding size={16} />}
              value={formData.collectionCenterId}
              onChange={v => handleChange('collectionCenterId', v)}
              data={centers}
              error={errors.collectionCenterId}
              required
              searchable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Status"
              leftSection={<IconCheck size={16} />}
              value={formData.status}
              onChange={v => handleChange('status', v)}
              data={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Phone Number"
              placeholder="10-digit phone"
              leftSection={<IconPhone size={16} />}
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              error={errors.phone}
              maxLength={10}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Email Address"
              placeholder="Enter email"
              leftSection={<IconMail size={16} />}
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              error={errors.email}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Address"
              placeholder="Enter address"
              leftSection={<IconMapPin size={16} />}
              value={formData.address}
              onChange={e => handleChange('address', e.target.value)}
              rows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" leftSection={<IconX size={16} />} onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button leftSection={<IconCheck size={16} />} onClick={handleSubmit} loading={loading}>
            {isEditMode ? 'Update Agent' : 'Create Agent'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default AgentModal;

import { useState, useEffect } from 'react';
import {
  Stack,
  Select,
  MultiSelect,
  TextInput,
  Text
} from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { customerAPI } from '../../services/api';

const CustomerTargeting = ({ targetType, targetCustomers, targetGroup, onChange }) => {
  const [customerOptions, setCustomerOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (targetType === 'Specific') {
      fetchCustomers();
    }
  }, [targetType]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll();
      const data = response?.data || response || [];
      const options = (Array.isArray(data) ? data : [])
        .filter(c => c.active !== false)
        .map(c => ({
          value: c._id,
          label: `${c.name}${c.phone ? ` (${c.phone})` : ''}`
        }));
      setCustomerOptions(options);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600} c="dimmed">Customer Targeting</Text>
      <Select
        label="Target Type"
        value={targetType || 'All'}
        onChange={(value) => onChange({ targetType: value, targetCustomers: [], targetGroup: '' })}
        data={[
          { value: 'All', label: 'All Customers' },
          { value: 'Specific', label: 'Specific Customers' },
          { value: 'Group', label: 'Customer Group' }
        ]}
        leftSection={<IconUsers size={16} />}
      />

      {targetType === 'Specific' && (
        <MultiSelect
          label="Select Customers"
          placeholder="Search customers..."
          value={targetCustomers || []}
          onChange={(value) => onChange({ targetType, targetCustomers: value, targetGroup })}
          data={customerOptions}
          searchable
          clearable
          disabled={loading}
        />
      )}

      {targetType === 'Group' && (
        <TextInput
          label="Customer Group"
          placeholder="e.g., VIP, Regular, Wholesale"
          value={targetGroup || ''}
          onChange={(e) => onChange({ targetType, targetCustomers, targetGroup: e.target.value })}
        />
      )}
    </Stack>
  );
};

export default CustomerTargeting;

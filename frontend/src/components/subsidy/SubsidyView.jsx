import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Container,
  Card,
  Group,
  Stack,
  Title,
  Text,
  Badge,
  Divider,
  Grid,
  Paper,
  Button,
  LoadingOverlay,
  Box
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { message } from '../../utils/toast';

const SubsidyView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [subsidy, setSubsidy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubsidy();
  }, [id]);

  const fetchSubsidy = async () => {
    setLoading(true);
    try {
      const response = await subsidyAPI.getById(id);
      setSubsidy(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidy details');
    } finally {
      setLoading(false);
    }
  };

  const getSubsidyTypeColor = (type) => {
    return type === 'Subsidy' ? 'green' : 'blue';
  };

  const getLedgerGroupColor = (group) => {
    const colorMap = {
      'Advance due to Society': 'blue',
      'Advance due by Society': 'cyan',
      'Contingencies': 'yellow',
      'Trade Expenses': 'red',
      'Trade Income': 'green',
      'Miscellaneous Income': 'violet'
    };
    return colorMap[group] || 'gray';
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (!subsidy) {
    return (
      <Container size="xl" py="xl">
        <Card>
          <Text align="center" color="dimmed">
            Subsidy not found
          </Text>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack spacing="md">
        <Group position="apart">
          <div>
            <Title order={2}>Subsidy Details</Title>
            <Text color="dimmed" size="sm">
              View details for {subsidy.subsidyName || 'Subsidy'}
            </Text>
          </div>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="default"
            onClick={() => navigate('/subsidies')}
            radius="md"
          >
            Back to List
          </Button>
        </Group>

        <Card shadow="sm" padding="lg" radius="md">
          <Stack spacing="xl">
            {/* Basic Information Section */}
            <div>
              <Title order={3} mb="md" size="h4">
                Basic Information
              </Title>
              <Grid gutter="lg">
                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Subsidy Name
                    </Text>
                    <Text weight={500} size="lg">
                      {subsidy.subsidyName}
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Subsidy Type
                    </Text>
                    <Badge
                      size="lg"
                      color={getSubsidyTypeColor(subsidy.subsidyType)}
                      variant="light"
                    >
                      {subsidy.subsidyType}
                    </Badge>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Ledger Group
                    </Text>
                    <Badge
                      size="lg"
                      color={getLedgerGroupColor(subsidy.ledgerGroup)}
                      variant="light"
                    >
                      {subsidy.ledgerGroup}
                    </Badge>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Status
                    </Text>
                    <Badge
                      size="lg"
                      color={subsidy.status === 'Active' ? 'green' : 'red'}
                      variant="light"
                    >
                      {subsidy.status}
                    </Badge>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Description
                    </Text>
                    <Text>
                      {subsidy.description || '-'}
                    </Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Timestamps Section */}
            <div>
              <Title order={3} mb="md" size="h4">
                Timestamps
              </Title>
              <Grid gutter="lg">
                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Created At
                    </Text>
                    <Text weight={500}>
                      {dayjs(subsidy.createdAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder radius="md">
                    <Text size="sm" color="dimmed" mb="xs">
                      Last Updated
                    </Text>
                    <Text weight={500}>
                      {dayjs(subsidy.updatedAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </div>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};

export default SubsidyView;
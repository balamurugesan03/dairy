import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { machineAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const MachineView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMachine();
  }, [id]);

  const fetchMachine = async () => {
    setLoading(true);
    try {
      const response = await machineAPI.getById(id);
      setMachine(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch machine details');
      navigate('/machines');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!machine) {
    return null;
  }

  const getStatusColor = (status) => {
    const colors = {
      'Active': '#52c41a',
      'Inactive': '#ff4d4f',
      'Under Maintenance': '#faad14',
      'Retired': '#8c8c8c'
    };
    return colors[status] || '#1890ff';
  };

  const renderStatusTag = (status) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getStatusColor(status)}20`,
      color: getStatusColor(status),
      border: `1px solid ${getStatusColor(status)}`
    }}>
      {status}
    </span>
  );

  const DescriptionRow = ({ label, value, span = 1 }) => (
    <div style={{
      gridColumn: span === 2 ? 'span 2' : 'span 1',
      padding: '12px',
      borderBottom: '1px solid var(--border-color)',
      display: 'grid',
      gridTemplateColumns: '150px 1fr',
      gap: '12px'
    }}>
      <div style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>{label}:</div>
      <div style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Machine Details"
        subtitle={`View details for ${machine.machineName}`}
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/machines')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/machines/edit/${id}`)}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            Edit
          </button>
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Basic Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Machine Code" value={machine.machineCode} />
            <DescriptionRow label="Machine Name" value={machine.machineName} />
            <DescriptionRow label="Category" value={machine.category} />
            <DescriptionRow label="Status" value={renderStatusTag(machine.status)} />
            <DescriptionRow label="Manufacturer" value={machine.manufacturer || '-'} />
            <DescriptionRow label="Model" value={machine.model || '-'} />
            <DescriptionRow label="Serial Number" value={machine.serialNumber || '-'} />
            <DescriptionRow label="Location" value={machine.location || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Purchase Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Purchase Date" value={machine.purchaseDate ? dayjs(machine.purchaseDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Purchase Cost" value={machine.purchaseCost ? `₹${parseFloat(machine.purchaseCost).toFixed(2)}` : '-'} />
            <DescriptionRow label="Installation Date" value={machine.installationDate ? dayjs(machine.installationDate).format('DD-MM-YYYY') : '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Technical Specifications
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Capacity" value={machine.capacity || '-'} />
            <DescriptionRow label="Power Rating" value={machine.powerRating || '-'} />
            {machine.specifications && <DescriptionRow label="Specifications" value={machine.specifications} span={2} />}
            {machine.description && <DescriptionRow label="Description" value={machine.description} span={2} />}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Maintenance Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Last Maintenance" value={machine.lastMaintenanceDate ? dayjs(machine.lastMaintenanceDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Next Maintenance" value={machine.nextMaintenanceDate ? dayjs(machine.nextMaintenanceDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Maintenance Interval" value={machine.maintenanceInterval ? `${machine.maintenanceInterval} days` : '-'} />
            {machine.maintenanceNotes && <DescriptionRow label="Maintenance Notes" value={machine.maintenanceNotes} span={2} />}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={machine.createdAt ? dayjs(machine.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={machine.updatedAt ? dayjs(machine.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineView;

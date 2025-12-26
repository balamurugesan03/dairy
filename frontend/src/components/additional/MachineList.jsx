import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { machineAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './MachineList.css';

const MachineList = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const response = await machineAPI.getAll({ search: searchText });
      setMachines(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch machines');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Machine',
      content: 'Are you sure you want to delete this machine?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await machineAPI.delete(id);
          message.success('Machine deleted successfully');
          fetchMachines();
        } catch (error) {
          message.error(error.message || 'Failed to delete machine');
        }
      }
    });
  };

  const handleSearch = () => {
    fetchMachines();
  };

  const getStatusClass = (status) => {
    const statusClasses = {
      'Active': 'tag-success',
      'Under Maintenance': 'tag-warning',
      'Out of Service': 'tag-danger',
      'Inactive': 'tag-default'
    };
    return statusClasses[status] || 'tag-default';
  };

  const exportData = machines.map(machine => ({
    'Machine Code': machine.machineCode,
    'Machine Name': machine.machineName,
    'Category': machine.category,
    'Manufacturer': machine.manufacturer,
    'Model': machine.model,
    'Serial Number': machine.serialNumber,
    'Purchase Date': machine.purchaseDate ? dayjs(machine.purchaseDate).format('DD/MM/YYYY') : '-',
    'Purchase Cost': (machine.purchaseCost || 0).toFixed(2),
    'Location': machine.location,
    'Status': machine.status,
    'Description': machine.description || ''
  }));

  return (
    <div>
      <PageHeader
        title="Machine Management"
        subtitle="Manage dairy processing machines and equipment"
      />

      <div className="actions-bar">
        <button
          className="btn btn-primary"
          onClick={() => navigate('/machines/add')}
        >
          + Add Machine
        </button>
      </div>

      <div className="filters-container">
        <div className="search-box">
          <input
            type="text"
            className="form-input"
            placeholder="Search by machine code, name, or serial number"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-default" onClick={handleSearch}>
            Search
          </button>
        </div>
        <ExportButton
          data={exportData}
          filename="machines"
          buttonText="Export to Excel"
        />
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : machines.length === 0 ? (
          <div className="no-data">No machines found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine Code</th>
                <th>Machine Name</th>
                <th>Category</th>
                <th>Manufacturer</th>
                <th>Model</th>
                <th>Serial Number</th>
                <th>Purchase Date</th>
                <th style={{ textAlign: 'right' }}>Purchase Cost</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr key={machine._id}>
                  <td>{machine.machineCode}</td>
                  <td>{machine.machineName}</td>
                  <td>{machine.category}</td>
                  <td>{machine.manufacturer}</td>
                  <td>{machine.model}</td>
                  <td>{machine.serialNumber}</td>
                  <td>{machine.purchaseDate ? dayjs(machine.purchaseDate).format('DD/MM/YYYY') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>₹{(machine.purchaseCost || 0).toFixed(2)}</td>
                  <td>{machine.location}</td>
                  <td>
                    <span className={`tag ${getStatusClass(machine.status)}`}>
                      {machine.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-link btn-view"
                        onClick={() => navigate(`/machines/view/${machine._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn-link btn-edit"
                        onClick={() => navigate(`/machines/edit/${machine._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-delete"
                        onClick={() => handleDelete(machine._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {machines.length > 0 && (
        <div className="pagination-info">
          Total {machines.length} machines
        </div>
      )}
    </div>
  );
};

export default MachineList;

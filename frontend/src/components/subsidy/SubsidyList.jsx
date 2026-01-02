import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './SubsidyList.css';

const SubsidyList = () => {
  const navigate = useNavigate();
  const [subsidies, setSubsidies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSubsidy, setEditingSubsidy] = useState(null);
  const [formData, setFormData] = useState({
    subsidyName: '',
    subsidyType: 'Subsidy',
    ledgerGroup: '',
    status: 'Active',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    subsidyType: '',
    ledgerGroup: ''
  });

  useEffect(() => {
    fetchSubsidies();
  }, []);

  const fetchSubsidies = async () => {
    setLoading(true);
    try {
      const response = await subsidyAPI.getAll();
      setSubsidies(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidies');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSubsidy(null);
    setFormData({
      subsidyName: '',
      subsidyType: 'Subsidy',
      ledgerGroup: '',
      status: 'Active',
      description: ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleEdit = (subsidy) => {
    setEditingSubsidy(subsidy);
    setFormData({
      subsidyName: subsidy.subsidyName || '',
      subsidyType: subsidy.subsidyType || 'Subsidy',
      ledgerGroup: subsidy.ledgerGroup || '',
      status: subsidy.status || 'Active',
      description: subsidy.description || ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked ? 'Active' : 'Inactive' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.subsidyName) newErrors.subsidyName = 'Subsidy name is required';
    if (!formData.subsidyType) newErrors.subsidyType = 'Subsidy type is required';
    if (!formData.ledgerGroup) newErrors.ledgerGroup = 'Ledger group is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (editingSubsidy) {
        await subsidyAPI.update(editingSubsidy._id, formData);
        message.success('Subsidy updated successfully');
      } else {
        await subsidyAPI.create(formData);
        message.success('Subsidy created successfully');
      }
      setModalVisible(false);
      fetchSubsidies();
    } catch (error) {
      message.error(error.message || 'Failed to save subsidy');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this subsidy?')) {
      try {
        await subsidyAPI.delete(id);
        message.success('Subsidy deactivated successfully');
        fetchSubsidies();
      } catch (error) {
        message.error(error.message || 'Failed to delete subsidy');
      }
    }
  };

  const getSubsidyTypeColor = (type) => {
    return type === 'Subsidy' ? 'tag-success' : 'tag-info';
  };

  const getLedgerGroupColor = (group) => {
    const colorMap = {
      'Advance due to Society': 'tag-blue',
      'Advance due by Society': 'tag-cyan',
      'Contingencies': 'tag-warning',
      'Trade Expenses': 'tag-danger',
      'Trade Income': 'tag-success',
      'Miscellaneous Income': 'tag-purple'
    };
    return colorMap[group] || 'tag-default';
  };

  const filteredSubsidies = subsidies.filter(subsidy => {
    if (filters.search && !subsidy.subsidyName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.subsidyType && subsidy.subsidyType !== filters.subsidyType) {
      return false;
    }
    if (filters.ledgerGroup && subsidy.ledgerGroup !== filters.ledgerGroup) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Subsidy Management"
        subtitle="View and manage subsidies and discounts"
      />

      <div className="subsidy-actions">
        <button
          className="btn btn-primary"
          onClick={handleAdd}
        >
          + Add Subsidy
        </button>
      </div>

      <div className="filters-container">
        <div className="search-container">
          <input
            type="text"
            className="form-input"
            placeholder="Search by subsidy name"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <select
          className="form-select"
          value={filters.subsidyType}
          onChange={(e) => setFilters(prev => ({ ...prev, subsidyType: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="Subsidy">Subsidy</option>
          <option value="Discount">Discount</option>
        </select>
        <select
          className="form-select"
          value={filters.ledgerGroup}
          onChange={(e) => setFilters(prev => ({ ...prev, ledgerGroup: e.target.value }))}
        >
          <option value="">All Ledger Groups</option>
          <option value="Advance due to Society">Advance due to Society</option>
          <option value="Advance due by Society">Advance due by Society</option>
          <option value="Contingencies">Contingencies</option>
          <option value="Trade Expenses">Trade Expenses</option>
          <option value="Trade Income">Trade Income</option>
          <option value="Miscellaneous Income">Miscellaneous Income</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : filteredSubsidies.length === 0 ? (
          <div className="no-data">No subsidies found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Subsidy Name</th>
                <th>Type</th>
                <th>Ledger Group</th>
                <th>Status</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubsidies.map((subsidy) => (
                <tr key={subsidy._id}>
                  <td>{subsidy.subsidyName}</td>
                  <td>
                    <span className={`tag ${getSubsidyTypeColor(subsidy.subsidyType)}`}>
                      {subsidy.subsidyType}
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${getLedgerGroupColor(subsidy.ledgerGroup)}`}>
                      {subsidy.ledgerGroup}
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${subsidy.status === 'Active' ? 'tag-success' : 'tag-danger'}`}>
                      {subsidy.status}
                    </span>
                  </td>
                  <td>{subsidy.description || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-link btn-view"
                        onClick={() => navigate(`/subsidies/view/${subsidy._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn-link btn-edit"
                        onClick={() => handleEdit(subsidy)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-delete"
                        onClick={() => handleDelete(subsidy._id)}
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

      {modalVisible && (
        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSubsidy ? 'Edit Subsidy' : 'Add Subsidy'}</h2>
              <button className="modal-close" onClick={() => setModalVisible(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Subsidy Name</label>
                  <input
                    type="text"
                    name="subsidyName"
                    className={`form-input ${errors.subsidyName ? 'error' : ''}`}
                    placeholder="Enter subsidy name"
                    value={formData.subsidyName}
                    onChange={handleChange}
                  />
                  {errors.subsidyName && <div className="form-error">{errors.subsidyName}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Subsidy Type</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="subsidyType"
                        value="Subsidy"
                        checked={formData.subsidyType === 'Subsidy'}
                        onChange={handleChange}
                      />
                      <span>Subsidy</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="subsidyType"
                        value="Discount"
                        checked={formData.subsidyType === 'Discount'}
                        onChange={handleChange}
                      />
                      <span>Discount</span>
                    </label>
                  </div>
                  {errors.subsidyType && <div className="form-error">{errors.subsidyType}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Ledger Group</label>
                  <select
                    name="ledgerGroup"
                    className={`form-select ${errors.ledgerGroup ? 'error' : ''}`}
                    value={formData.ledgerGroup}
                    onChange={handleChange}
                  >
                    <option value="">Select Ledger Group</option>
                    <option value="Advance due to Society">Advance due to Society</option>
                    <option value="Advance due by Society">Advance due by Society</option>
                    <option value="Contingencies">Contingencies</option>
                    <option value="Trade Expenses">Trade Expenses</option>
                    <option value="Trade Income">Trade Income</option>
                    <option value="Miscellaneous Income">Miscellaneous Income</option>
                  </select>
                  {errors.ledgerGroup && <div className="form-error">{errors.ledgerGroup}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      name="status"
                      checked={formData.status === 'Active'}
                      onChange={handleChange}
                    />
                    <span style={{ marginLeft: '8px' }}>Active</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    className="form-textarea"
                    placeholder="Enter description (optional)"
                    value={formData.description}
                    onChange={handleChange}
                    rows="4"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {editingSubsidy ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setModalVisible(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubsidyList;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';
import AddShareModal from './AddShareModal';

const FarmerList = () => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 6,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'Active',
    farmerType: '',
    cowType: '',
    village: '',
    panchayat: '',
    ward: '',
    isMembership: '',
    collectionCenter: '',
    admissionDateFrom: '',
    admissionDateTo: '',
    minShares: '',
    maxShares: ''
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [villages, setVillages] = useState([]);
  const [panchayats, setPanchayats] = useState([]);

  useEffect(() => {
    fetchFarmers();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchCollectionCenters();
    fetchFilterOptions();
  }, []);

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ status: 'Active', limit: 100 });
      setCollectionCenters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch collection centers:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await farmerAPI.getAll({ limit: 1000 });
      const allFarmers = response.data || [];

      const uniqueVillages = [...new Set(allFarmers.map(f => f.address?.village).filter(Boolean))];
      const uniquePanchayats = [...new Set(allFarmers.map(f => f.address?.panchayat).filter(Boolean))];

      setVillages(uniqueVillages.sort());
      setPanchayats(uniquePanchayats.sort());
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        farmerType: filters.farmerType,
        cowType: filters.cowType,
        village: filters.village,
        panchayat: filters.panchayat,
        ward: filters.ward,
        isMembership: filters.isMembership,
        collectionCenter: filters.collectionCenter,
        admissionDateFrom: filters.admissionDateFrom,
        admissionDateTo: filters.admissionDateTo,
        minShares: filters.minShares,
        maxShares: filters.maxShares,
        search: filters.search
      };

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await farmerAPI.getAll(params);
      setFarmers(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || response.data?.length || 0
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Farmer',
      content: 'Are you sure you want to deactivate this farmer?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await farmerAPI.delete(id);
          message.success('Farmer deactivated successfully');
          fetchFarmers();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate farmer');
        }
      }
    });
  };

  const handleMembershipToggle = async (id, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    showConfirmDialog({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Membership`,
      content: `Are you sure you want to ${action} membership for this farmer?`,
      type: currentStatus ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await farmerAPI.toggleMembership(id);
          message.success(`Membership ${action}d successfully`);
          fetchFarmers();
        } catch (error) {
          message.error(error.message || `Failed to ${action} membership`);
        }
      }
    });
  };

  const handleAddShare = (farmer) => {
    setSelectedFarmer(farmer);
    setShowShareModal(true);
  };

  const handleShareSuccess = () => {
    fetchFarmers();
    setShowShareModal(false);
    setSelectedFarmer(null);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: e.target.search.value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      farmerType: '',
      cowType: '',
      village: '',
      panchayat: '',
      ward: '',
      isMembership: '',
      collectionCenter: '',
      admissionDateFrom: '',
      admissionDateTo: '',
      minShares: '',
      maxShares: ''
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    message.success('Filters cleared');
  };

  const getActiveFilterCount = () => {
    return Object.entries(filters).filter(([key, value]) => value !== '' && key !== 'status').length;
  };

  const handleExportToCSV = () => {
    if (farmers.length === 0) {
      message.warning('No data to export');
      return;
    }

    const headers = [
      'Farmer No', 'Member ID', 'Name', 'Father Name', 'Phone', 'Age', 'Gender',
      'Village', 'Panchayat', 'Ward', 'PIN', 'Farmer Type', 'Cow Type',
      'Membership', 'Status', 'Total Shares', 'Share Value', 'Admission Fee',
      'Bank Name', 'Account Number', 'IFSC', 'Aadhaar', 'PAN'
    ];

    const csvData = farmers.map(farmer => [
      farmer.farmerNumber || '',
      farmer.memberId || '',
      farmer.personalDetails?.name || '',
      farmer.personalDetails?.fatherName || '',
      farmer.personalDetails?.phone || '',
      farmer.personalDetails?.age || '',
      farmer.personalDetails?.gender || '',
      farmer.address?.village || '',
      farmer.address?.panchayat || '',
      farmer.address?.ward || '',
      farmer.address?.pin || '',
      farmer.farmerType || '',
      farmer.cowType || '',
      farmer.isMembership ? 'Member' : 'Non-Member',
      farmer.status || '',
      farmer.financialDetails?.totalShares || 0,
      farmer.financialDetails?.shareValue || 0,
      farmer.financialDetails?.admissionFee || 0,
      farmer.bankDetails?.bankName || '',
      farmer.bankDetails?.accountNumber || '',
      farmer.bankDetails?.ifsc || '',
      farmer.identityDetails?.aadhaar || '',
      farmer.identityDetails?.pan || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `farmers_report_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Report exported successfully');
  };

  const getTagColor = (type, value) => {
    if (type === 'farmerType') {
      return value === 'A' ? '#1890ff' : value === 'B' ? '#52c41a' : '#faad14';
    }
    return value === 'Active' ? '#52c41a' : '#ff4d4f';
  };

  return (
    <div>
      <PageHeader
        title="Farmer Management"
        subtitle="Manage dairy cooperative farmers"
        extra={[
          <button
            key="members"
            className="btn btn-default"
            onClick={() => navigate('/farmers/members')}
            style={{ marginRight: '8px' }}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
              <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
            </svg>
            View Members
          </button>,
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/farmers/add')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Farmer
          </button>
        ]}
      />

      <div style={{ marginBottom: '16px' }}>
        {/* Quick Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              name="search"
              className="form-input"
              placeholder="Search by farmer number, name, or phone"
              style={{ width: '350px' }}
            />
            <button type="submit" className="btn btn-default">
              <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
              Search
            </button>
          </form>

          <select
            className="form-select"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            style={{ width: '130px' }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            className="form-select"
            value={filters.farmerType}
            onChange={(e) => setFilters(prev => ({ ...prev, farmerType: e.target.value }))}
            style={{ width: '130px' }}
          >
            <option value="">All Types</option>
            <option value="A">Type A</option>
            <option value="B">Type B</option>
            <option value="C">Type C</option>
          </select>

          <button
            className="btn btn-default"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{ marginLeft: 'auto' }}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
            </svg>
            Advanced Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
          </button>

          <button
            className="btn btn-default"
            onClick={handleExportToCSV}
            title="Export to CSV"
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
            Export
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Advanced Filters</h3>
              <button
                className="btn btn-link"
                onClick={handleClearFilters}
                style={{ padding: '4px 8px', fontSize: '13px' }}
              >
                Clear All Filters
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {/* Membership Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Membership</label>
                <select
                  className="form-select"
                  value={filters.isMembership}
                  onChange={(e) => setFilters(prev => ({ ...prev, isMembership: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="true">Members</option>
                  <option value="false">Non-Members</option>
                </select>
              </div>

              {/* Cow Type Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Cow Type</label>
                <select
                  className="form-select"
                  value={filters.cowType}
                  onChange={(e) => setFilters(prev => ({ ...prev, cowType: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="Desi">Desi</option>
                  <option value="Crossbreed">Crossbreed</option>
                  <option value="Jersey">Jersey</option>
                  <option value="HF">HF (Holstein Friesian)</option>
                </select>
              </div>

              {/* Village Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Village</label>
                <select
                  className="form-select"
                  value={filters.village}
                  onChange={(e) => setFilters(prev => ({ ...prev, village: e.target.value }))}
                >
                  <option value="">All Villages</option>
                  {villages.map(village => (
                    <option key={village} value={village}>{village}</option>
                  ))}
                </select>
              </div>

              {/* Panchayat Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Panchayat</label>
                <select
                  className="form-select"
                  value={filters.panchayat}
                  onChange={(e) => setFilters(prev => ({ ...prev, panchayat: e.target.value }))}
                >
                  <option value="">All Panchayats</option>
                  {panchayats.map(panchayat => (
                    <option key={panchayat} value={panchayat}>{panchayat}</option>
                  ))}
                </select>
              </div>

              {/* Ward Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Ward</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter ward"
                  value={filters.ward}
                  onChange={(e) => setFilters(prev => ({ ...prev, ward: e.target.value }))}
                />
              </div>

              {/* Collection Center Filter */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Collection Center</label>
                <select
                  className="form-select"
                  value={filters.collectionCenter}
                  onChange={(e) => setFilters(prev => ({ ...prev, collectionCenter: e.target.value }))}
                >
                  <option value="">All Centers</option>
                  {collectionCenters.map(center => (
                    <option key={center._id} value={center._id}>
                      {center.centerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admission Date From */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Admission From</label>
                <input
                  type="date"
                  className="form-input"
                  value={filters.admissionDateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, admissionDateFrom: e.target.value }))}
                />
              </div>

              {/* Admission Date To */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Admission To</label>
                <input
                  type="date"
                  className="form-input"
                  value={filters.admissionDateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, admissionDateTo: e.target.value }))}
                />
              </div>

              {/* Min Shares */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Min Shares</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Min shares"
                  value={filters.minShares}
                  onChange={(e) => setFilters(prev => ({ ...prev, minShares: e.target.value }))}
                  min="0"
                />
              </div>

              {/* Max Shares */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Max Shares</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Max shares"
                  value={filters.maxShares}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxShares: e.target.value }))}
                  min="0"
                />
              </div>
            </div>

            {/* Active Filters Summary */}
            {getActiveFilterCount() > 0 && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '13px' }}>
                <strong>{getActiveFilterCount()}</strong> filter{getActiveFilterCount() > 1 ? 's' : ''} active
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="billing-table" style={{ minWidth: '1300px' }}>
          <thead>
            <tr>
              <th>Farmer No.</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Village</th>
              <th>Farmer Type</th>
              <th>Membership</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                  Loading...
                </td>
              </tr>
            ) : farmers.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-empty">
                  No farmers found
                </td>
              </tr>
            ) : (
              farmers.map((farmer) => (
                <tr key={farmer._id}>
                  <td>{farmer.farmerNumber}</td>
                  <td>{farmer.memberId || '-'}</td>
                  <td>{farmer.personalDetails?.name || '-'}</td>
                  <td>{farmer.personalDetails?.phone || '-'}</td>
                  <td>{farmer.address?.village || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getTagColor('farmerType', farmer.farmerType)}20`,
                      color: getTagColor('farmerType', farmer.farmerType),
                      border: `1px solid ${getTagColor('farmerType', farmer.farmerType)}`
                    }}>
                      {farmer.farmerType}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: farmer.isMembership ? '#52c41a20' : '#d9d9d920',
                      color: farmer.isMembership ? '#52c41a' : '#8c8c8c',
                      border: `1px solid ${farmer.isMembership ? '#52c41a' : '#d9d9d9'}`
                    }}>
                      {farmer.isMembership ? 'Member' : 'Non-Member'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getTagColor('status', farmer.status)}20`,
                      color: getTagColor('status', farmer.status),
                      border: `1px solid ${getTagColor('status', farmer.status)}`
                    }}>
                      {farmer.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/farmers/view/${farmer._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/farmers/edit/${farmer._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#1890ff' }}
                        onClick={() => handleAddShare(farmer)}
                      >
                        Add Share
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: farmer.isMembership ? '#faad14' : '#1890ff' }}
                        onClick={() => handleMembershipToggle(farmer._id, farmer.isMembership)}
                      >
                        {farmer.isMembership ? 'Remove Member' : 'Add Member'}
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleDelete(farmer._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > pagination.pageSize && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Showing {(pagination.current - 1) * pagination.pageSize + 1} to {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} entries
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-default"
              disabled={pagination.current === 1}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
            >
              Previous
            </button>
            <button
              className="btn btn-default"
              disabled={pagination.current * pagination.pageSize >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showShareModal && selectedFarmer && (
        <AddShareModal
          farmer={selectedFarmer}
          onClose={() => {
            setShowShareModal(false);
            setSelectedFarmer(null);
          }}
          onSuccess={handleShareSuccess}
        />
      )}
    </div>
  );
};

export default FarmerList;

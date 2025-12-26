import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { warrantyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './WarrantyList.css';

const WarrantyList = () => {
  const navigate = useNavigate();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    fetchWarranties();
  }, []);

  const fetchWarranties = async () => {
    setLoading(true);
    try {
      const response = await warrantyAPI.getAll({ search: searchText });
      setWarranties(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch warranties');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Warranty',
      content: 'Are you sure you want to delete this warranty?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await warrantyAPI.delete(id);
          message.success('Warranty deleted successfully');
          fetchWarranties();
        } catch (error) {
          message.error(error.message || 'Failed to delete warranty');
        }
      }
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchWarranties();
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  useEffect(() => {
    if (searchText === '') {
      fetchWarranties();
    }
  }, [searchText]);

  const getWarrantyStatus = (endDate) => {
    const daysRemaining = dayjs(endDate).diff(dayjs(), 'day');
    if (daysRemaining < 0) return { text: 'Expired', color: 'red' };
    if (daysRemaining <= 30) return { text: 'Expiring Soon', color: 'orange' };
    return { text: 'Active', color: 'green' };
  };

  const exportData = warranties.map(warranty => ({
    'Warranty No': warranty.warrantyNumber,
    'Customer Name': warranty.customerName,
    'Product': warranty.product,
    'Serial Number': warranty.serialNumber,
    'Purchase Date': dayjs(warranty.purchaseDate).format('DD/MM/YYYY'),
    'Warranty Start': dayjs(warranty.warrantyStartDate).format('DD/MM/YYYY'),
    'Warranty End': dayjs(warranty.warrantyEndDate).format('DD/MM/YYYY'),
    'Duration': `${warranty.warrantyPeriod || 0} ${warranty.warrantyPeriodUnit || 'months'}`,
    'Status': getWarrantyStatus(warranty.warrantyEndDate).text,
    'Terms': warranty.terms || ''
  }));

  // Pagination
  const totalPages = Math.ceil(warranties.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentWarranties = warranties.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="warranty-list-container">
      <PageHeader
        title="Warranty Management"
        subtitle="Manage product warranties and service agreements"
        extra={
          <button
            className="btn btn-primary"
            onClick={() => navigate('/warranty/add')}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Warranty
          </button>
        }
      />

      <div className="warranty-list-controls">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by warranty number, customer, or product"
            value={searchText}
            onChange={handleSearchChange}
          />
          <button type="submit" className="btn btn-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Search
          </button>
        </form>

        <ExportButton
          data={exportData}
          filename="warranties"
          buttonText="Export to Excel"
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading warranties...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="warranty-table">
              <thead>
                <tr>
                  <th>Warranty No</th>
                  <th>Customer Name</th>
                  <th>Product</th>
                  <th>Serial Number</th>
                  <th>Purchase Date</th>
                  <th>Warranty Start</th>
                  <th>Warranty End</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentWarranties.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="no-data">
                      No warranties found
                    </td>
                  </tr>
                ) : (
                  currentWarranties.map((warranty) => {
                    const status = getWarrantyStatus(warranty.warrantyEndDate);
                    return (
                      <tr key={warranty._id}>
                        <td>{warranty.warrantyNumber}</td>
                        <td>{warranty.customerName}</td>
                        <td>{warranty.product}</td>
                        <td>{warranty.serialNumber}</td>
                        <td>{dayjs(warranty.purchaseDate).format('DD/MM/YYYY')}</td>
                        <td>{dayjs(warranty.warrantyStartDate).format('DD/MM/YYYY')}</td>
                        <td>{dayjs(warranty.warrantyEndDate).format('DD/MM/YYYY')}</td>
                        <td>{warranty.warrantyPeriod || 0} {warranty.warrantyPeriodUnit || 'months'}</td>
                        <td>
                          <span className={`status-badge status-${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn btn-link"
                            onClick={() => navigate(`/warranty/edit/${warranty._id}`)}
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Edit
                          </button>
                          <button
                            className="btn btn-link btn-danger"
                            onClick={() => handleDelete(warranty._id)}
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="3 6 5 6 21 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {warranties.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, warranties.length)} of {warranties.length} warranties
              </div>

              <div className="pagination-controls">
                <label>
                  Show
                  <select value={pageSize} onChange={handlePageSizeChange}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  entries
                </label>
              </div>

              <div className="pagination-buttons">
                <button
                  className="btn btn-pagination"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  First
                </button>
                <button
                  className="btn btn-pagination"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 ||
                           page === totalPages ||
                           Math.abs(page - currentPage) <= 2;
                  })
                  .map((page, index, array) => {
                    if (index > 0 && page - array[index - 1] > 1) {
                      return (
                        <span key={`ellipsis-${page}`}>
                          <span className="pagination-ellipsis">...</span>
                          <button
                            className={`btn btn-pagination ${currentPage === page ? 'active' : ''}`}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        className={`btn btn-pagination ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    );
                  })}

                <button
                  className="btn btn-pagination"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
                <button
                  className="btn btn-pagination"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WarrantyList;

import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { quotationAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './QuotationList.css';

const QuotationList = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const response = await quotationAPI.getAll({ search: searchText });
      setQuotations(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Quotation',
      content: 'Are you sure you want to delete this quotation?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await quotationAPI.delete(id);
          message.success('Quotation deleted successfully');
          fetchQuotations();
        } catch (error) {
          message.error(error.message || 'Failed to delete quotation');
        }
      }
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchQuotations();
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  useEffect(() => {
    if (searchText === '') {
      fetchQuotations();
    }
  }, [searchText]);

  const getStatusColor = (status) => {
    const statusColors = {
      'Draft': 'default',
      'Sent': 'blue',
      'Accepted': 'green',
      'Rejected': 'red',
      'Expired': 'orange'
    };
    return statusColors[status] || 'default';
  };

  const exportData = quotations.map(quotation => ({
    'Quotation No': quotation.quotationNumber,
    'Date': dayjs(quotation.quotationDate).format('DD/MM/YYYY'),
    'Customer Name': quotation.customerName,
    'Customer Phone': quotation.customerPhone,
    'Valid Until': dayjs(quotation.validUntil).format('DD/MM/YYYY'),
    'Items': quotation.items?.length || 0,
    'Subtotal': (quotation.subtotal || 0).toFixed(2),
    'Tax Amount': (quotation.taxAmount || 0).toFixed(2),
    'Discount': (quotation.discount || 0).toFixed(2),
    'Total Amount': (quotation.totalAmount || 0).toFixed(2),
    'Status': quotation.status,
    'Notes': quotation.notes || ''
  }));

  // Filter quotations by status
  const filteredQuotations = statusFilter === 'all'
    ? quotations
    : quotations.filter(q => q.status === statusFilter);

  // Pagination
  const totalPages = Math.ceil(filteredQuotations.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentQuotations = filteredQuotations.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="quotation-list-container">
      <PageHeader
        title="Quotation Management"
        subtitle="Manage customer quotations and estimates"
        extra={
          <button
            className="btn btn-primary"
            onClick={() => navigate('/quotations/add')}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Quotation
          </button>
        }
      />

      <div className="quotation-list-controls">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by quotation number or customer name"
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

        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <ExportButton
          data={exportData}
          filename="quotations"
          buttonText="Export to Excel"
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading quotations...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="quotation-table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Customer Phone</th>
                  <th>Valid Until</th>
                  <th>Items</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentQuotations.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="no-data">
                      No quotations found
                    </td>
                  </tr>
                ) : (
                  currentQuotations.map((quotation) => (
                    <tr key={quotation._id}>
                      <td>{quotation.quotationNumber}</td>
                      <td>{dayjs(quotation.quotationDate).format('DD/MM/YYYY')}</td>
                      <td>{quotation.customerName}</td>
                      <td>{quotation.customerPhone}</td>
                      <td>{dayjs(quotation.validUntil).format('DD/MM/YYYY')}</td>
                      <td>{quotation.items?.length || 0}</td>
                      <td className="text-right">₹{(quotation.subtotal || 0).toFixed(2)}</td>
                      <td className="text-right">₹{(quotation.taxAmount || 0).toFixed(2)}</td>
                      <td className="text-right">₹{(quotation.totalAmount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`status-badge status-${getStatusColor(quotation.status)}`}>
                          {quotation.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-link"
                          onClick={() => navigate(`/quotations/view/${quotation._id}`)}
                          title="View"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          View
                        </button>
                        <button
                          className="btn btn-link"
                          onClick={() => navigate(`/quotations/edit/${quotation._id}`)}
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
                          onClick={() => handleDelete(quotation._id)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredQuotations.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredQuotations.length)} of {filteredQuotations.length} quotations
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

export default QuotationList;

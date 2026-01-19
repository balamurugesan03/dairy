import { useState } from 'react';
import ExportButton from '../../common/ExportButton';
import './ReportTable.css';

/**
 * Reusable table component for Vyapar reports
 * @param {Array} data - Table data
 * @param {Array} columns - Column definitions
 * @param {String} exportFilename - Filename for export
 * @param {Function} onRowClick - Callback for row click
 */
const ReportTable = ({
  data = [],
  columns = [],
  exportFilename = 'report',
  onRowClick,
  pagination = false,
  itemsPerPage = 50
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sorting logic
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = () => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = () => {
    if (!pagination) return sortedData();

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData().slice(startIndex, endIndex);
  };

  // Export data preparation
  const exportData = data.map(row => {
    const exportRow = {};
    columns.forEach(col => {
      if (col.render && typeof col.render === 'function') {
        exportRow[col.label] = col.render(row);
      } else {
        exportRow[col.label] = row[col.key];
      }
    });
    return exportRow;
  });

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="report-table-wrapper">
      {/* Export Button */}
      <div className="table-header">
        <div className="table-info">
          Showing {paginatedData().length} of {data.length} records
        </div>
        <ExportButton data={exportData} filename={exportFilename} />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="report-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={col.sortable !== false ? 'sortable' : ''}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span className="sort-indicator">
                      {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData().length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="no-data">
                  No data available
                </td>
              </tr>
            ) : (
              paginatedData().map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'clickable' : ''}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={col.className || ''}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="page-numbers">
            {[...Array(totalPages)].map((_, idx) => {
              const page = idx + 1;
              // Show first, last, current, and adjacent pages
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    className={`page-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="page-ellipsis">...</span>;
              }
              return null;
            })}
          </div>

          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportTable;

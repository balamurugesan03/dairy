import { useState, useEffect } from 'react';
import DateFilterToolbar from '../../common/DateFilterToolbar';
import './ReportFilters.css';

/**
 * Reusable filter component for Vyapar reports
 * @param {Object} config - Configuration for which filters to show
 * @param {Function} onApply - Callback when filters are applied
 */
const ReportFilters = ({ config = {}, onApply }) => {
  const [filters, setFilters] = useState({
    filterType: 'thisMonth',
    customStart: null,
    customEnd: null,
    partyId: '',
    itemId: '',
    statusFilter: '',
    minAmount: '',
    maxAmount: '',
    groupBy: 'Date'
  });

  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-apply on mount
  useEffect(() => {
    handleApply();
  }, []);

  const handleDateFilterChange = (dateFilterData) => {
    setFilters(prev => ({
      ...prev,
      filterType: dateFilterData.filterType,
      customStart: dateFilterData.customStart,
      customEnd: dateFilterData.customEnd
    }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApply = () => {
    onApply(filters);
  };

  const handleReset = () => {
    const defaultFilters = {
      filterType: 'thisMonth',
      customStart: null,
      customEnd: null,
      partyId: '',
      itemId: '',
      statusFilter: '',
      minAmount: '',
      maxAmount: '',
      groupBy: 'Date'
    };
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  return (
    <div className="report-filters">
      {/* Date Range Filter */}
      {config.dateRange !== false && (
        <div className="filter-section">
          <DateFilterToolbar onFilterChange={handleDateFilterChange} />
        </div>
      )}

      {/* Advanced Filters Toggle */}
      {(config.partySelector || config.itemSelector || config.statusFilter || config.amountRange || config.groupBy) && (
        <div className="advanced-toggle">
          <button
            className="toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="advanced-filters">
          {/* Party Selector */}
          {config.partySelector && (
            <div className="filter-group">
              <label>Party</label>
              <select
                value={filters.partyId}
                onChange={(e) => handleFilterChange('partyId', e.target.value)}
                className="filter-input"
              >
                <option value="">All Parties</option>
                {parties.map(party => (
                  <option key={party._id} value={party._id}>
                    {party.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Item Selector */}
          {config.itemSelector && (
            <div className="filter-group">
              <label>Item</label>
              <select
                value={filters.itemId}
                onChange={(e) => handleFilterChange('itemId', e.target.value)}
                className="filter-input"
              >
                <option value="">All Items</option>
                {items.map(item => (
                  <option key={item._id} value={item._id}>
                    {item.itemName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          {config.statusFilter && (
            <div className="filter-group">
              <label>Payment Status</label>
              <select
                value={filters.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                className="filter-input"
              >
                <option value="">All Status</option>
                {config.statusFilter.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Range */}
          {config.amountRange && (
            <div className="filter-group">
              <label>Amount Range</label>
              <div className="amount-range">
                <input
                  type="number"
                  placeholder="Min Amount"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                  className="filter-input"
                />
                <span className="range-separator">to</span>
                <input
                  type="number"
                  placeholder="Max Amount"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>
          )}

          {/* Group By Selector */}
          {config.groupBy && (
            <div className="filter-group">
              <label>Group By</label>
              <select
                value={filters.groupBy}
                onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                className="filter-input"
              >
                {config.groupBy.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="filter-actions">
        <button className="btn-apply" onClick={handleApply}>
          Apply Filters
        </button>
        <button className="btn-reset" onClick={handleReset}>
          Reset
        </button>
      </div>
    </div>
  );
};

export default ReportFilters;

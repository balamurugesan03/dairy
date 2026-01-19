import './SummaryCards.css';

/**
 * Reusable summary cards component for Vyapar reports
 * @param {Object} data - Summary data object
 * @param {Array} fields - Field definitions for cards
 */
const SummaryCards = ({ data = {}, fields = [] }) => {
  const formatValue = (value, field) => {
    // If field has custom formatter, use it
    if (field.format && typeof field.format === 'function') {
      return field.format(value);
    }

    // Default formatters
    if (field.type === 'currency') {
      return `₹${parseFloat(value || 0).toFixed(2)}`;
    } else if (field.type === 'percentage') {
      return `${parseFloat(value || 0).toFixed(2)}%`;
    } else if (field.type === 'number') {
      return parseFloat(value || 0).toLocaleString();
    }

    return value;
  };

  const getCardClass = (field) => {
    const baseClass = 'summary-card';
    const typeClass = field.type ? `type-${field.type}` : '';
    const colorClass = field.color ? `color-${field.color}` : '';
    return `${baseClass} ${typeClass} ${colorClass}`.trim();
  };

  return (
    <div className="summary-cards-container">
      {fields.map((field, idx) => {
        const value = data[field.key];
        return (
          <div key={idx} className={getCardClass(field)}>
            <div className="card-content">
              {field.icon && (
                <div className="card-icon">
                  <i className={`icon-${field.icon}`}></i>
                </div>
              )}
              <div className="card-details">
                <div className="card-label">{field.label}</div>
                <div className="card-value">{formatValue(value, field)}</div>
                {field.subtext && (
                  <div className="card-subtext">{field.subtext}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryCards;

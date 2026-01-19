import './GroupBySelector.css';

/**
 * Dropdown selector for grouping report data
 * @param {Array} options - Grouping options
 * @param {String} value - Current selected value
 * @param {Function} onChange - Change callback
 */
const GroupBySelector = ({ options = [], value, onChange }) => {
  return (
    <div className="group-by-selector">
      <label htmlFor="groupBy">Group By:</label>
      <select
        id="groupBy"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="group-select"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default GroupBySelector;

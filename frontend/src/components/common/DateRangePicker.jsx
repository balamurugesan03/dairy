import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import './DateRangePicker.css';

const DateRangePickerComponent = ({
  value,
  onChange,
  format = 'YYYY-MM-DD',
  placeholder = ['Start Date', 'End Date'],
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(value?.[0] || null);
  const [endDate, setEndDate] = useState(value?.[1] || null);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) {
      setStartDate(value[0]);
      setEndDate(value[1]);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDisplayValue = () => {
    if (startDate && endDate) {
      return `${dayjs(startDate).format(format)} ~ ${dayjs(endDate).format(format)}`;
    }
    return '';
  };

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      const start = dayjs(tempStartDate);
      const end = dayjs(tempEndDate);

      if (start.isValid() && end.isValid() && start.isBefore(end)) {
        setStartDate(start);
        setEndDate(end);
        onChange?.([start, end]);
        setIsOpen(false);
      }
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setTempStartDate('');
    setTempEndDate('');
    onChange?.(null);
    setIsOpen(false);
  };

  return (
    <div className="date-range-picker" ref={containerRef} {...rest}>
      <div className="date-range-input" onClick={() => setIsOpen(!isOpen)}>
        <svg className="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
        </svg>
        <span className={formatDisplayValue() ? '' : 'placeholder'}>
          {formatDisplayValue() || `${placeholder[0]} ~ ${placeholder[1]}`}
        </span>
        {(startDate || endDate) && (
          <button
            className="clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="date-range-dropdown">
          <div className="date-inputs">
            <div className="form-group">
              <label className="form-label">{placeholder[0]}</label>
              <input
                type="date"
                className="form-input"
                value={tempStartDate || (startDate ? dayjs(startDate).format('YYYY-MM-DD') : '')}
                onChange={(e) => setTempStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{placeholder[1]}</label>
              <input
                type="date"
                className="form-input"
                value={tempEndDate || (endDate ? dayjs(endDate).format('YYYY-MM-DD') : '')}
                onChange={(e) => setTempEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="date-range-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleClear}>
              Clear
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePickerComponent;

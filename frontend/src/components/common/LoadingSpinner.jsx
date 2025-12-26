import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({
  tip = 'Loading...',
  size = 'large',
  fullScreen = false
}) => {
  const spinnerClass = size === 'small' ? 'spinner-sm' : size === 'large' ? 'spinner-lg' : '';

  if (fullScreen) {
    return (
      <div className="loading-container loading-fullscreen">
        <div className={`spinner ${spinnerClass}`}></div>
        {tip && <p className="loading-text">{tip}</p>}
      </div>
    );
  }

  return (
    <div className="loading-container">
      <div className={`spinner ${spinnerClass}`}></div>
      {tip && <p className="loading-text">{tip}</p>}
    </div>
  );
};

export default LoadingSpinner;

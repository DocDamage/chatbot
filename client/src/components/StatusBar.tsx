import React, { useState, useEffect } from 'react';
import './StatusBar.css';

interface StatusBarProps {
  isConnected?: boolean;
  messageCount?: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ isConnected = true, messageCount = 0 }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="status-bar" role="status" aria-live="polite">
      <div className="status-item">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {messageCount > 0 && (
        <div className="status-item">
          <span>{messageCount} message{messageCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className="status-item">
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default StatusBar;


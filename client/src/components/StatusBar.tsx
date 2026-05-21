import React, { useState, useEffect } from 'react';
import './StatusBar.css';

interface StatusBarProps {
  connectionState?: 'connected' | 'degraded' | 'connecting' | 'disconnected';
  messageCount?: number;
}

const statusLabels = {
  connected: 'Connected',
  degraded: 'Degraded',
  connecting: 'Connecting',
  disconnected: 'Disconnected'
};

const StatusBar: React.FC<StatusBarProps> = ({ connectionState = 'connecting', messageCount = 0 }) => {
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
        <span className={`status-indicator ${connectionState}`}></span>
        <span>{statusLabels[connectionState]}</span>
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


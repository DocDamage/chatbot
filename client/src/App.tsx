import React, { useState, useRef, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Chatbot Hub</h1>
        <p className="subtitle">Ask me anything</p>
      </header>
      <ChatInterface />
    </div>
  );
}

export default App;


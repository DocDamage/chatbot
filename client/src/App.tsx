import { useState } from 'react';
import AssistantChat from './components/AssistantChat';
import LocalToolsWorkspace from './components/LocalToolsWorkspace';
import SettingsMenu from './components/SettingsMenu';
import StaticDemo from './components/StaticDemo';
import CampaignPanel from './components/CampaignPanel';
import { isStaticPagesBuild } from './api/runtime';
import './App.css';

function InteractiveApp() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <div>
            <h1>Chatbot</h1>
            <p className="subtitle">A simple space to think, write, and build.</p>
          </div>
        </div>
        <SettingsMenu
          advancedOpen={advancedOpen}
          onAdvancedToggle={() => setAdvancedOpen(previous => !previous)}
        />
        <nav className="app-mode-nav" aria-label="Chat spaces"><button type="button" aria-pressed={!campaignsOpen} onClick={() => setCampaignsOpen(false)}>Chat</button><button type="button" aria-pressed={campaignsOpen} onClick={() => setCampaignsOpen(true)}>D&amp;D campaigns</button></nav>
      </header>
      <main className={advancedOpen && !campaignsOpen ? 'app-main advanced-open' : 'app-main'}>
        <div className="chat-space" hidden={campaignsOpen}><AssistantChat advancedOpen={advancedOpen} /></div>
        {campaignsOpen && <CampaignPanel />}
        {advancedOpen && !campaignsOpen && <LocalToolsWorkspace />}
      </main>
    </div>
  );
}

function App() {
  return isStaticPagesBuild ? <StaticDemo /> : <InteractiveApp />;
}

export default App;

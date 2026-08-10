import { useState } from 'react';
import AssistantChat from './components/AssistantChat';
import LocalToolsWorkspace from './components/LocalToolsWorkspace';
import SettingsMenu from './components/SettingsMenu';
import StaticDemo from './components/StaticDemo';
import { isStaticPagesBuild } from './api/runtime';
import './App.css';

function InteractiveApp() {
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
      </header>
      <main className={advancedOpen ? 'app-main advanced-open' : 'app-main'}>
        <AssistantChat advancedOpen={advancedOpen} />
        {advancedOpen && <LocalToolsWorkspace />}
      </main>
    </div>
  );
}

function App() {
  return isStaticPagesBuild ? <StaticDemo /> : <InteractiveApp />;
}

export default App;

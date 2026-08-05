import AssistantChat from './components/AssistantChat';
import LocalToolsWorkspace from './components/LocalToolsWorkspace';
import SettingsMenu from './components/SettingsMenu';
import StaticDemo from './components/StaticDemo';
import { isStaticPagesBuild } from './api/runtime';
import './App.css';

function InteractiveApp() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Chatbot Hub</h1>
        <p className="subtitle">Ask me anything</p>
        <SettingsMenu />
      </header>
      <AssistantChat />
      <LocalToolsWorkspace />
    </div>
  );
}

function App() {
  return isStaticPagesBuild ? <StaticDemo /> : <InteractiveApp />;
}

export default App;

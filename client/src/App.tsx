import AssistantChat from './components/AssistantChat';
import LocalToolsWorkspace from './components/LocalToolsWorkspace';
import SettingsMenu from './components/SettingsMenu';
import './App.css';

function App() {
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

export default App;

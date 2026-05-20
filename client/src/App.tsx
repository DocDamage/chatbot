import AssistantChat from './components/AssistantChat';
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
    </div>
  );
}

export default App;


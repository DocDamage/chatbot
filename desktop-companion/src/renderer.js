const input = document.getElementById('input');
const messages = document.getElementById('messages');
const status = document.getElementById('status');
const talkButton = document.getElementById('talk');
const apiBase = localStorage.getItem('chatbotApiBase') || 'http://localhost:3001';
const sessionKey = 'chatbotCompanionSessionId';
const sessionId = localStorage.getItem(sessionKey) || `desktop-${crypto.randomUUID()}`;
localStorage.setItem(sessionKey, sessionId);

function addMessage(role, text) {
  const element = document.createElement('div');
  element.className = `message ${role}`;
  element.textContent = text;
  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addMessage('user', message);
  status.textContent = 'Thinking…';
  try {
    const response = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, mode: 'general' }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || payload?.error || 'Chat request failed');
    const answer = payload.response || 'The chatbot returned no response.';
    addMessage('assistant', answer);
    speak(answer);
    status.textContent = 'Ready.';
  } catch (error) {
    addMessage('assistant', `Companion error: ${error.message}`);
    status.textContent = 'Check that the chatbot server is running.';
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (Recognition) {
  recognition = new Recognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { talkButton.classList.add('listening'); talkButton.textContent = 'Listening…'; status.textContent = 'Listening…'; };
  recognition.onend = () => { talkButton.classList.remove('listening'); talkButton.textContent = 'Talk'; if (status.textContent === 'Listening…') status.textContent = 'Ready.'; };
  recognition.onerror = event => { status.textContent = `Voice input unavailable: ${event.error}`; };
  recognition.onresult = event => {
    const transcript = Array.from(event.results).map(result => result[0].transcript).join('');
    input.value = transcript;
    if (event.results[event.results.length - 1].isFinal) void sendMessage();
  };
} else {
  talkButton.disabled = true;
  talkButton.title = 'SpeechRecognition is not available in this Electron build.';
}

document.getElementById('send').addEventListener('click', () => void sendMessage());
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } });
talkButton.addEventListener('click', () => recognition?.start());
document.getElementById('stop').addEventListener('click', () => { recognition?.stop(); window.speechSynthesis?.cancel(); });

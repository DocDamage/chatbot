const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let window;

function createWindow() {
  window = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 360,
    minHeight: 520,
    title: 'Chatbot Companion',
    backgroundColor: '#10131a',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.loadFile(path.join(__dirname, 'renderer.html'));
  window.on('closed', () => { window = undefined; });
}

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!window) createWindow();
    if (window.isVisible()) window.hide(); else window.show();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', event => event.preventDefault());

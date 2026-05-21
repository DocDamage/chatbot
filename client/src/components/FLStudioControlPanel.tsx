import { useEffect, useMemo, useState } from 'react';
import './FLStudioControlPanel.css';

type ControlMode = 'dry_run' | 'confirm_required' | 'live_control';

interface FLStudioState {
  connected: boolean;
  serverId?: string;
  mode?: ControlMode;
  lastConnectionMessage?: string;
  limitations?: string[];
  log?: Array<{
    tool: string;
    dryRun: boolean;
    ok: boolean;
    timestamp: string;
  }>;
}

interface FLStudioStatus {
  connected: boolean;
  serverId?: string;
  initialized?: boolean;
  transport?: string;
  state?: FLStudioState;
}

interface FLStudioTools {
  toolNames: string[];
}

const quickCommands = [
  'Make a four-bar dark trap progression in F minor',
  'Add 808 root notes under the chords',
  'Make a kick step sequence for trap',
  'Turn down track 3 by -3 dB and pan it left'
];

const chordPresets = [
  { label: 'Fm', notes: 'F3 Ab3 C4' },
  { label: 'Db', notes: 'Db3 F3 Ab3' },
  { label: 'Cm', notes: 'C3 Eb3 G3' },
  { label: 'Ab', notes: 'Ab2 C3 Eb3' },
  { label: 'Dark i-VI-III-VII', notes: 'F3 Ab3 C4' }
];

const drumPresets = [
  { label: 'Trap kick', channel: 'kick', steps: [0, 6, 10, 14] },
  { label: 'Snare 2/4', channel: 'snare', steps: [4, 12] },
  { label: 'Hat 1/8', channel: 'hi-hat', steps: [0, 2, 4, 6, 8, 10, 12, 14] },
  { label: 'Four on floor', channel: 'kick', steps: [0, 4, 8, 12] }
];

interface FLStudioControlPanelProps {
  onSendCommand?: (command: string) => void;
}

const defaultSteps = [0, 4, 8, 12];

export default function FLStudioControlPanel({ onSendCommand }: FLStudioControlPanelProps) {
  const [status, setStatus] = useState<FLStudioStatus | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [mode, setMode] = useState<ControlMode>('dry_run');
  const [confirmed, setConfirmed] = useState(false);
  const [command, setCommand] = useState(quickCommands[0]);
  const [chordNotes, setChordNotes] = useState('F3 Ab3 C4');
  const [noteList, setNoteList] = useState('F2');
  const [chordTime, setChordTime] = useState(0);
  const [chordDuration, setChordDuration] = useState(2);
  const [channel, setChannel] = useState('kick');
  const [steps, setSteps] = useState<number[]>(defaultSteps);
  const [mixerTrack, setMixerTrack] = useState(1);
  const [dbChange, setDbChange] = useState(-3);
  const [pan, setPan] = useState(0);
  const [mute, setMute] = useState(false);
  const [solo, setSolo] = useState(false);
  const [selectedTool, setSelectedTool] = useState('fl_get_transport_status');
  const [toolArgs, setToolArgs] = useState('{}');
  const [mixBrief, setMixBrief] = useState('Make this beat mix cleaner and louder but keep the 808 huge.');
  const [mixGenre, setMixGenre] = useState('trap');
  const [mixDelivery, setMixDelivery] = useState('professional first-pass mix');
  const [mixLowEnd, setMixLowEnd] = useState('huge but controlled');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [inspector, setInspector] = useState('');

  const visibleTools = useMemo(() => tools.slice(0, 8), [tools]);

  useEffect(() => {
    refreshStatus();
  }, []);

  const refreshStatus = async () => {
    try {
      const [statusResponse, toolsResponse] = await Promise.all([
        fetch('/api/flstudio/status'),
        fetch('/api/flstudio/tools')
      ]);

      if (statusResponse.ok) {
        setStatus(await statusResponse.json());
      }

      if (toolsResponse.ok) {
        const data: FLStudioTools = await toolsResponse.json();
        setTools(data.toolNames || []);
        if (data.toolNames?.length && !data.toolNames.includes(selectedTool)) {
          setSelectedTool(data.toolNames[0]);
        }
      }
    } catch (error: any) {
      setMessage(`Status check failed: ${error.message}`);
    }
  };

  const postJson = async (url: string, body: Record<string, any>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  const runAction = async (label: string, url: string, body: Record<string, any>) => {
    setBusy(true);
    setMessage('');
    try {
      const data = await postJson(url, { mode, confirmed, ...body });
      setMessage(data.response || data.message || `${label} complete.`);
      await refreshStatus();
      return data;
    } catch (error: any) {
      setMessage(`${label} failed: ${error.message}`);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await postJson('/api/flstudio/connect', { mode });
      setStatus(data);
      setMessage(data.message || 'Connection attempt complete.');
      await refreshStatus();
    } catch (error: any) {
      setMessage(`Connect failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/flstudio/disconnect', { method: 'POST' });
      setTools([]);
      await refreshStatus();
      setMessage('Disconnected from the FL Studio MCP bridge.');
    } catch (error: any) {
      setMessage(`Disconnect failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const dryRunCommand = async () => {
    await runAction('Command', '/api/flstudio/command', { query: command });
  };

  const sendTransport = (action: 'play' | 'stop' | 'record') => {
    runAction(`Transport ${action}`, '/api/flstudio/transport', { action });
  };

  const sendChord = () => {
    const notes = chordNotes.split(/[,\s]+/).map(note => note.trim()).filter(Boolean);
    runAction('Piano Roll chord', '/api/flstudio/piano-roll/chord', {
      notes,
      time: chordTime,
      duration: chordDuration,
      velocity: 92
    });
  };

  const sendNotes = () => {
    const notes = noteList
      .split(/[,\s]+/)
      .map((note, index) => ({
        note: note.trim(),
        time: chordTime + index * 0.5,
        duration: chordDuration,
        velocity: 96
      }))
      .filter(item => item.note);
    runAction('Piano Roll notes', '/api/flstudio/piano-roll/notes', {
      notes,
      channel: 'selected'
    });
  };

  const sendStepSequence = () => {
    runAction('Step sequence', '/api/flstudio/channel/step-sequence', {
      channel,
      steps,
      length: 16
    });
  };

  const sendMixer = () => {
    runAction('Mixer update', '/api/flstudio/mixer/set', {
      track: mixerTrack,
      dbChange,
      pan,
      mute,
      solo
    });
  };

  const runDirectTool = () => {
    let args: Record<string, any>;
    try {
      args = toolArgs.trim() ? JSON.parse(toolArgs) : {};
    } catch {
      setMessage('Tool args must be valid JSON.');
      return;
    }

    runAction('Direct tool call', '/api/flstudio/tool-call', {
      toolName: selectedTool,
      args
    });
  };

  const runMixPass = async (action: 'plan' | 'apply' | 'master') => {
    await runAction(`Mix ${action}`, `/api/music/mix/${action}`, {
      query: mixBrief,
      genre: mixGenre,
      delivery: mixDelivery,
      lowEndTarget: mixLowEnd,
      permissionMode: mode
    });
  };

  const inspectTool = async (toolName: string, label: string, args: Record<string, any> = {}) => {
    setBusy(true);
    setInspector('');
    try {
      const data = await postJson('/api/flstudio/tool-call', {
        toolName,
        args,
        mode: connected ? 'live_control' : 'dry_run',
        confirmed: true
      });
      setInspector(JSON.stringify(data.toolResults?.[0]?.result || data.toolResults?.[0] || data, null, 2));
      setMessage(`${label} read complete.`);
      await refreshStatus();
    } catch (error: any) {
      setInspector(`${label} failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleStep = (step: number) => {
    setSteps(current => current.includes(step)
      ? current.filter(item => item !== step)
      : [...current, step].sort((a, b) => a - b)
    );
  };

  const toolGroups = useMemo(() => {
    const match = (pattern: RegExp) => tools.filter(tool => pattern.test(tool));
    return {
      transport: match(/play|stop|record|transport|loop|song/i).length,
      mixer: match(/mixer|track|volume|pan|mute|solo|arm/i).length,
      piano: match(/piano|note|chord/i).length,
      channelRack: match(/channel|step|grid/i).length,
      plugins: match(/plugin|param|preset/i).length
    };
  }, [tools]);

  const lastLogs = status?.state?.log?.slice(0, 5) || [];
  const connected = !!status?.connected;
  const liveWarning = mode !== 'dry_run';
  const modeTruth = mode === 'dry_run'
    ? 'Dry-run: actions are planned without touching FL Studio.'
    : connected
      ? 'Bridge connected: live-capable actions still pass the confirmation safety gate.'
      : 'Bridge offline: live modes fall back to blocked or dry-run safety behavior.';

  const renderStepButtons = () => {
    return Array.from({ length: 16 }, (_, index) => {
      const active = steps.includes(index);
      const beat = index % 4 === 0;
      return (
        <button
          key={index}
          type="button"
          className={`fl-step ${active ? 'active' : ''} ${beat ? 'beat' : ''}`}
          onClick={() => toggleStep(index)}
          aria-pressed={active}
        >
          {index + 1}
        </button>
      );
    });
  };

  const formatMessage = (value: string) => {
    if (value.length < 900) return value;
    return `${value.slice(0, 900)}\n...`;
  };

  const renderOutput = () => {
    if (!message) return null;
    return <pre className="fl-control-message">{formatMessage(message)}</pre>;
  };

  if (!status) {
    return (
      <aside className="fl-control-panel" aria-label="FL Studio control panel">
        <div className="fl-control-status">
          <div>
            <span className="fl-control-dot" />
            <strong>Checking FL Studio bridge</strong>
            <span>fl-studio-mcp</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fl-control-panel" aria-label="FL Studio control panel">
      <div className="fl-cockpit-top">
        <div className="fl-control-status">
          <div>
            <span className={`fl-control-dot ${connected ? 'connected' : ''}`} />
            <strong>{connected ? 'Bridge connected' : 'Bridge offline'}</strong>
            <span>{status.state?.serverId || status.serverId || 'fl-studio-mcp'}</span>
          </div>
          <div className="fl-control-actions">
            <button type="button" onClick={connect} disabled={busy}>Connect</button>
            <button type="button" onClick={disconnect} disabled={busy}>Disconnect</button>
            <button type="button" onClick={refreshStatus} disabled={busy}>Refresh</button>
          </div>
        </div>

        <div className="fl-mode-strip">
          <label>
            Mode
            <select value={mode} onChange={event => setMode(event.target.value as ControlMode)}>
              <option value="dry_run">Dry run</option>
              <option value="confirm_required">Confirm required</option>
              <option value="live_control">Live control</option>
            </select>
          </label>
          <label className="fl-confirm-toggle">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)}
            />
            Confirm risky actions
          </label>
          {liveWarning && (
            <span className="fl-warning">Live modes can change the active FL Studio project after bridge and confirmation checks.</span>
          )}
          <span className="fl-mode-note">{modeTruth}</span>
        </div>
      </div>

      <div className="fl-control-board">
        <section className="fl-module transport">
          <div className="fl-module-header">
            <h3>Transport</h3>
            <span>{connected ? 'ready' : 'dry-run available'}</span>
          </div>
          <div className="fl-transport-buttons">
            <button type="button" onClick={() => sendTransport('play')} disabled={busy}>Play</button>
            <button type="button" onClick={() => sendTransport('stop')} disabled={busy}>Stop</button>
            <button type="button" onClick={() => sendTransport('record')} disabled={busy && !confirmed}>Record</button>
          </div>
        </section>

        <section className="fl-module piano">
          <div className="fl-module-header">
            <h3>Piano Roll</h3>
            <span>chords and notes</span>
          </div>
          <label>
            Chord notes
            <input value={chordNotes} onChange={event => setChordNotes(event.target.value)} />
          </label>
          <div className="fl-preset-row">
            {chordPresets.map(preset => (
              <button key={preset.label} type="button" onClick={() => setChordNotes(preset.notes)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="fl-inline-controls">
            <label>
              Time
              <input type="number" min="0" step="0.25" value={chordTime} onChange={event => setChordTime(Number(event.target.value))} />
            </label>
            <label>
              Beats
              <input type="number" min="0.25" step="0.25" value={chordDuration} onChange={event => setChordDuration(Number(event.target.value))} />
            </label>
            <button type="button" onClick={sendChord} disabled={busy || !chordNotes.trim()}>Send chord</button>
          </div>
          <label>
            Raw notes
            <input value={noteList} onChange={event => setNoteList(event.target.value)} />
          </label>
          <button type="button" onClick={sendNotes} disabled={busy || !noteList.trim()}>Send notes</button>
        </section>

        <section className="fl-module sequencer">
          <div className="fl-module-header">
            <h3>Step Sequencer</h3>
            <span>16-step grid</span>
          </div>
          <label>
            Channel
            <input value={channel} onChange={event => setChannel(event.target.value)} />
          </label>
          <div className="fl-preset-row">
            {drumPresets.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setChannel(preset.channel);
                  setSteps(preset.steps);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="fl-step-grid">{renderStepButtons()}</div>
          <button type="button" onClick={sendStepSequence} disabled={busy}>Set sequence</button>
        </section>

        <section className="fl-module mixer">
          <div className="fl-module-header">
            <h3>Mixer</h3>
            <span>track control</span>
          </div>
          <div className="fl-inline-controls">
            <label>
              Track
              <input type="number" min="1" value={mixerTrack} onChange={event => setMixerTrack(Number(event.target.value))} />
            </label>
            <label>
              dB
              <input type="number" step="0.5" value={dbChange} onChange={event => setDbChange(Number(event.target.value))} />
            </label>
          </div>
          <label>
            Pan {pan.toFixed(2)}
            <input type="range" min="-1" max="1" step="0.05" value={pan} onChange={event => setPan(Number(event.target.value))} />
          </label>
          <div className="fl-toggle-row">
            <label><input type="checkbox" checked={mute} onChange={event => setMute(event.target.checked)} /> Mute</label>
            <label><input type="checkbox" checked={solo} onChange={event => setSolo(event.target.checked)} /> Solo</label>
          </div>
          <button type="button" onClick={sendMixer} disabled={busy}>Apply mixer</button>
        </section>

        <section className="fl-module command">
          <div className="fl-module-header">
            <h3>Command Plan</h3>
            <span>natural language</span>
          </div>
          <label>
            Command
            <input value={command} onChange={event => setCommand(event.target.value)} />
          </label>
          <div className="fl-command-actions">
            <button className="fl-control-primary" type="button" onClick={dryRunCommand} disabled={busy || !command.trim()}>
              Plan
            </button>
            {onSendCommand && (
              <button className="fl-control-chat" type="button" onClick={() => onSendCommand(command)} disabled={busy || !command.trim()}>
                Send to chat
              </button>
            )}
          </div>
          <div className="fl-control-chips">
            {quickCommands.map(item => (
              <button key={item} type="button" onClick={() => setCommand(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="fl-module tools">
          <div className="fl-module-header">
            <h3>Bridge Tools</h3>
            <span>{tools.length} total</span>
          </div>
          <div className="fl-meter-grid">
            <span>Transport <strong>{toolGroups.transport}</strong></span>
            <span>Mixer <strong>{toolGroups.mixer}</strong></span>
            <span>Piano <strong>{toolGroups.piano}</strong></span>
            <span>Channel <strong>{toolGroups.channelRack}</strong></span>
            <span>Plugins <strong>{toolGroups.plugins}</strong></span>
          </div>
          <div className="fl-control-tools">
            {visibleTools.map(tool => <code key={tool}>{tool}</code>)}
          </div>
          {lastLogs.length > 0 && (
            <div className="fl-log-list">
              {lastLogs.map((log, index) => (
                <span key={`${log.timestamp}-${index}`}>
                  {log.ok ? 'ok' : 'blocked'} · {log.dryRun ? 'dry' : 'live'} · {log.tool}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="fl-module inspector">
          <div className="fl-module-header">
            <h3>FL Inspector</h3>
            <span>read from bridge</span>
          </div>
          <div className="fl-inspector-buttons">
            <button type="button" onClick={() => inspectTool('fl_connection_status', 'Connection status')} disabled={busy}>
              Connection
            </button>
            <button type="button" onClick={() => inspectTool('fl_get_transport_status', 'Transport status')} disabled={busy}>
              Transport
            </button>
            <button type="button" onClick={() => inspectTool('fl_get_all_channels', 'Channel list')} disabled={busy}>
              Channels
            </button>
            <button type="button" onClick={() => inspectTool('fl_get_all_mixer_tracks', 'Mixer tracks')} disabled={busy}>
              Mixer
            </button>
            <button type="button" onClick={() => inspectTool('fl_get_piano_roll_state', 'Piano Roll state')} disabled={busy}>
              Piano Roll
            </button>
          </div>
          <pre className="fl-inspector-output">
            {inspector || 'Connect the bridge, then read current FL Studio state here.'}
          </pre>
        </section>

        <section className="fl-module mix-pass">
          <div className="fl-module-header">
            <h3>Mix Pass</h3>
            <span>plan, apply, revise</span>
          </div>
          <label>
            Brief
            <textarea value={mixBrief} onChange={event => setMixBrief(event.target.value)} rows={3} />
          </label>
          <div className="fl-inline-controls">
            <label>
              Genre
              <input value={mixGenre} onChange={event => setMixGenre(event.target.value)} />
            </label>
            <label>
              Low end
              <input value={mixLowEnd} onChange={event => setMixLowEnd(event.target.value)} />
            </label>
            <label>
              Delivery
              <input value={mixDelivery} onChange={event => setMixDelivery(event.target.value)} />
            </label>
          </div>
          <div className="fl-command-actions">
            <button type="button" onClick={() => runMixPass('plan')} disabled={busy || !mixBrief.trim()}>
              Plan mix
            </button>
            <button type="button" onClick={() => runMixPass('apply')} disabled={busy || !mixBrief.trim()}>
              Apply dry-run
            </button>
            <button type="button" onClick={() => runMixPass('master')} disabled={busy || !mixBrief.trim()}>
              Master target
            </button>
          </div>
        </section>

        <section className="fl-module tool-console">
          <div className="fl-module-header">
            <h3>MCP Tool Console</h3>
            <span>guarded direct call</span>
          </div>
          <label>
            Tool
            <select value={selectedTool} onChange={event => setSelectedTool(event.target.value)}>
              {[selectedTool, ...tools.filter(tool => tool !== selectedTool)].filter(Boolean).map(tool => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>
          </label>
          <label>
            Args JSON
            <textarea value={toolArgs} onChange={event => setToolArgs(event.target.value)} rows={4} />
          </label>
          <button type="button" onClick={runDirectTool} disabled={busy || !selectedTool}>
            Call tool
          </button>
        </section>
      </div>

      {renderOutput()}
    </aside>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import './ModeSelector.css';

export type ChatMode =
    | 'ask'
    | 'plan'
    | 'implement'
    | 'debug'
    | 'explain'
    | 'pop_culture'
    | 'history'
    | 'science'
    | 'music'
    | 'suno'
    | 'fl_studio'
    | 'fl_studio_control'
    | 'pro_tools'
    | 'logic'
    | 'mix_master';

interface ModeSelectorProps {
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
}

const modeConfig: Record<ChatMode, { icon: string; label: string; description: string; color: string }> = {
    ask: {
        icon: '💬',
        label: 'Ask',
        description: 'Ask questions, get explanations',
        color: '#00d4ff'
    },
    plan: {
        icon: '📋',
        label: 'Plan',
        description: 'Plan a feature or project',
        color: '#00ff88'
    },
    implement: {
        icon: '⚡',
        label: 'Implement',
        description: 'Write code and create files',
        color: '#ff9500'
    },
    debug: {
        icon: '🔧',
        label: 'Debug',
        description: 'Find and fix problems',
        color: '#ff4444'
    },
    explain: {
        icon: '📖',
        label: 'Explain',
        description: 'Explain code in simple terms',
        color: '#9966ff'
    },
    pop_culture: {
        icon: '🎬',
        label: 'Pop Culture',
        description: 'Culture timelines and influence',
        color: '#f45b69'
    },
    history: {
        icon: '🏛️',
        label: 'History',
        description: 'Time-aware historical analysis',
        color: '#8b6f47'
    },
    science: {
        icon: '🔬',
        label: 'Science',
        description: 'Inventions, papers, and patents',
        color: '#2aa7a5'
    },
    music: {
        icon: '🎛️',
        label: 'Music',
        description: 'Production, beats, mix, and DAWs',
        color: '#22c55e'
    },
    suno: {
        icon: '🎤',
        label: 'Suno',
        description: 'Prompts, hooks, revisions, rights',
        color: '#f97316'
    },
    fl_studio: {
        icon: '🎹',
        label: 'FL Studio',
        description: 'Patterns, 808s, mixer, export',
        color: '#f59e0b'
    },
    fl_studio_control: {
        icon: '🎛️',
        label: 'FL Control',
        description: 'Dry-run DAW control plans',
        color: '#fb923c'
    },
    pro_tools: {
        icon: '🎚️',
        label: 'Pro Tools',
        description: 'Recording, comping, stems, post',
        color: '#38bdf8'
    },
    logic: {
        icon: '🎼',
        label: 'Logic Pro',
        description: 'MIDI, vocals, stock plugins',
        color: '#a78bfa'
    },
    mix_master: {
        icon: '📊',
        label: 'Mix/Master',
        description: 'Diagnostics, loudness, chains',
        color: '#14b8a6'
    }
};

const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onModeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentMode = modeConfig[mode];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                const modeMap: Record<string, ChatMode> = {
                    '1': 'ask',
                    '2': 'plan',
                    '3': 'implement',
                    '4': 'debug',
                    '5': 'explain',
                    '6': 'pop_culture',
                    '7': 'history',
                    '8': 'science',
                    '9': 'music'
                };

                if (modeMap[e.key]) {
                    e.preventDefault();
                    onModeChange(modeMap[e.key]);
                    setIsOpen(false);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onModeChange]);

    return (
        <div className="mode-selector" ref={dropdownRef}>
            <button
                className="mode-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                style={{ '--mode-color': currentMode.color } as React.CSSProperties}
            >
                <span className="mode-icon">{currentMode.icon}</span>
                <span className="mode-label">{currentMode.label}</span>
                <span className="mode-chevron">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="mode-dropdown">
                    {(Object.keys(modeConfig) as ChatMode[]).map((modeKey, index) => {
                        const config = modeConfig[modeKey];
                        return (
                            <button
                                key={modeKey}
                                className={`mode-option ${mode === modeKey ? 'active' : ''}`}
                                onClick={() => {
                                    onModeChange(modeKey);
                                    setIsOpen(false);
                                }}
                                style={{ '--mode-color': config.color } as React.CSSProperties}
                            >
                                <span className="mode-option-icon">{config.icon}</span>
                                <div className="mode-option-content">
                                    <span className="mode-option-label">{config.label}</span>
                                    <span className="mode-option-description">{config.description}</span>
                                </div>
                                {index < 9 && <span className="mode-shortcut">⌘{index + 1}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ModeSelector;

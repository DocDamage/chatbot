import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
    | 'gaming'
    | 'math'
    | 'market'
    | 'gamedev'
    | 'music'
    | 'suno'
    | 'fl_studio'
    | 'fl_studio_control'
    | 'pro_tools'
    | 'logic'
    | 'mix_master'
    | 'story'
    | 'legal'
    | 'health'
    | 'security'
    | 'business'
    | 'philosophy'
    | 'language'
    | 'geography'
    | 'engineering'
    | 'knowledge_os';

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
    gaming: {
        icon: '🎮',
        label: 'Gaming',
        description: 'Games, game dev, engines, lore, modding, strategy',
        color: '#60a5fa'
    },
    math: {
        icon: '∑',
        label: 'Math',
        description: 'Symbolic math, formulas, proofs, calculations',
        color: '#06b6d4'
    },
    market: {
        icon: '$',
        label: 'Market',
        description: 'Risk, filings, macro, scenarios, guardrails',
        color: '#10b981'
    },
    gamedev: {
        icon: '🕹️',
        label: 'Game Dev',
        description: 'Mechanics, balance, engines, playtests',
        color: '#818cf8'
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
    },
    story: {
        icon: '✍',
        label: 'Story',
        description: 'Worldbuilding, scenes, arcs, continuity',
        color: '#ec4899'
    },
    legal: {
        icon: '§',
        label: 'Legal/Civic',
        description: 'Jurisdiction-aware legal and civic framing',
        color: '#64748b'
    },
    health: {
        icon: '+',
        label: 'Health',
        description: 'Fitness, nutrition, anatomy, safety boundaries',
        color: '#ef4444'
    },
    security: {
        icon: '🛡️',
        label: 'Security',
        description: 'Threat modeling, auth, privacy, reviews',
        color: '#0f766e'
    },
    business: {
        icon: '↗',
        label: 'Business',
        description: 'Strategy, pricing, KPIs, unit economics',
        color: '#2563eb'
    },
    philosophy: {
        icon: 'Φ',
        label: 'Philosophy',
        description: 'Arguments, ethics, debate, timelines',
        color: '#7c3aed'
    },
    language: {
        icon: 'Aa',
        label: 'Language',
        description: 'Translation, tone, grammar, speeches',
        color: '#0891b2'
    },
    geography: {
        icon: '◎',
        label: 'Geography',
        description: 'Countries, culture, maps, demographics',
        color: '#16a34a'
    },
    engineering: {
        icon: '⚙',
        label: 'Engineering',
        description: 'Circuits, robotics, mechanics, prototypes',
        color: '#f97316'
    },
    knowledge_os: {
        icon: '🧠',
        label: 'Knowledge OS',
        description: 'Database, graph, wiki, memory',
        color: '#ffffff'
    }
};

const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onModeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const currentMode = modeConfig[mode];
    const modeKeys = useMemo(() => Object.keys(modeConfig) as ChatMode[], []);
    const listboxId = 'mode-selector-listbox';
    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
    const shortcutPrefix = isMac ? '⌘' : 'Ctrl+';

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

    useLayoutEffect(() => {
        if (isOpen) {
            const selectedIndex = Math.max(0, modeKeys.indexOf(mode));
            setActiveIndex(selectedIndex);
            optionRefs.current[selectedIndex]?.focus();
        }
    }, [isOpen, mode, modeKeys]);

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

    const selectMode = (nextMode: ChatMode) => {
        onModeChange(nextMode);
        setIsOpen(false);
    };

    const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                return;
            }

            const nextIndex = (activeIndex + 1) % modeKeys.length;
            setActiveIndex(nextIndex);
            optionRefs.current[nextIndex]?.focus();
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(true);
        }
    };

    const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, modeKey: ChatMode) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectMode(modeKey);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (index + direction + modeKeys.length) % modeKeys.length;
            setActiveIndex(nextIndex);
            optionRefs.current[nextIndex]?.focus();
        }
    };

    return (
        <div className="mode-selector" ref={dropdownRef}>
            <button
                className="mode-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleButtonKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                style={{ '--mode-color': currentMode.color } as React.CSSProperties}
            >
                <span className="mode-icon">{currentMode.icon}</span>
                <span className="mode-label">{currentMode.label}</span>
                <span className="mode-chevron">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="mode-dropdown" id={listboxId} role="listbox" aria-label="Chat mode">
                    {modeKeys.map((modeKey, index) => {
                        const config = modeConfig[modeKey];
                        return (
                            <button
                                key={modeKey}
                                ref={element => { optionRefs.current[index] = element; }}
                                role="option"
                                aria-selected={mode === modeKey}
                                tabIndex={activeIndex === index ? 0 : -1}
                                className={`mode-option ${mode === modeKey ? 'active' : ''}`}
                                onClick={() => selectMode(modeKey)}
                                onKeyDown={event => handleOptionKeyDown(event, index, modeKey)}
                                style={{ '--mode-color': config.color } as React.CSSProperties}
                            >
                                <span className="mode-option-icon">{config.icon}</span>
                                <div className="mode-option-content">
                                    <span className="mode-option-label">{config.label}</span>
                                    <span className="mode-option-description">{config.description}</span>
                                </div>
                                {index < 9 && <span className="mode-shortcut">{shortcutPrefix}{index + 1}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ModeSelector;

import { FormEvent, useEffect, useState } from 'react';
import { campaignApi, CampaignCharacter, CampaignState, importCampaign } from '../api/campaigns';
import { initializeLocalSession } from '../api/http';
import './CampaignPanel.css';

type SavedCampaign = Pick<CampaignState, 'id' | 'name' | 'edition'>;
const errorText = (e: unknown) => e instanceof Error ? e.message : 'The campaign request failed.';
const blankSheet = (): CampaignCharacter => ({ id: crypto.randomUUID(), name: '', kind: 'player', level: 1, ac: 12, hp: 10, maxHp: 10, tempHp: 0, attackBonus: 3, damage: '1d6+1', initiativeMod: 1, hitDie: 8, constitutionMod: 1, hitDiceUsed: 0, pactMagic: false, hidden: false, conditions: [], inventory: [], spellSlots: {} });

export default function CampaignPanel() {
  const [saved, setSaved] = useState<SavedCampaign[]>([]), [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [newName, setNewName] = useState(''), [edition, setEdition] = useState('5e-2024'), [premise, setPremise] = useState('');
  const [message, setMessage] = useState(''), [dice, setDice] = useState('1d20+3'), [actor, setActor] = useState(''), [target, setTarget] = useState('');
  const [dm, setDm] = useState(false), [sheet, setSheet] = useState<CampaignCharacter | null>(null), [inventory, setInventory] = useState('');
  const [scene, setScene] = useState(''), [recap, setRecap] = useState(''), [dmNotes, setDmNotes] = useState('');
  const [recordName, setRecordName] = useState(''), [recordKind, setRecordKind] = useState('npc'), [recordBody, setRecordBody] = useState(''), [recordSecret, setRecordSecret] = useState('');
  const [importFormat, setImportFormat] = useState('dmt');
  const loadSaved = async () => setSaved(await campaignApi<SavedCampaign[]>());
  function accept(value: CampaignState) {
    setCampaign(value); setScene(value.scene); setRecap(value.recap); setDmNotes(value.dmNotes || '');
    localStorage.setItem('chatbot-active-campaign', value.id);
  }
  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  useEffect(() => { let active = true; void (async () => {
    await initializeLocalSession();
    try {
      const rows = await campaignApi<SavedCampaign[]>(); if (!active) return; setSaved(rows);
      const last = localStorage.getItem('chatbot-active-campaign');
      if (last && rows.some(r => r.id === last)) { const value = await campaignApi<CampaignState>(`/${last}`); if (active) accept(value); }
    } catch (e) { if (active) setError(errorText(e)); }
  })(); return () => { active = false; }; }, []);
  const act = async (action: unknown) => {
    if (!campaign) return;
    const result = await campaignApi<{ campaign: CampaignState; outcome: string }>(`/${campaign.id}/actions`, { action, version: campaign.version, view: dm ? 'dm' : 'player' });
    accept(result.campaign); setNotice(result.outcome);
  };
  const editSheet = (value: CampaignCharacter) => { setSheet({ ...value }); setInventory((value.inventory || []).map(i => `${i.name} | ${i.quantity}`).join('\n')); };
  const open = async (id: string, privateView = false) => { accept(await campaignApi<CampaignState>(`/${id}${privateView ? '?view=dm' : ''}`)); setDm(privateView); setSheet(null); setNotice(''); };
  const submitTurn = (e: FormEvent) => { e.preventDefault(); if (!campaign || !message.trim()) return; void run(async () => {
    const result = await campaignApi<{ campaign: CampaignState; response: string; model?: string }>(`/${campaign.id}/turn`, { message, version: campaign.version });
    accept(result.campaign); setDm(false); setMessage(''); setNotice(result.model === 'server-dice' ? result.response : 'Campaign saved.');
  }); };
  const hero = campaign?.characters.find(c => c.id === actor) || campaign?.characters.find(c => c.kind === 'player');
  return <section className="campaign-workspace" aria-label="Dungeons and Dragons campaigns">
    <div className="campaign-heading"><div><span className="campaign-eyebrow">Your table</span><h2>D&amp;D campaigns</h2><p>Keep your story, sheets, and session history together.</p></div>
      <label>Saved campaign<select aria-label="Saved campaign" value={campaign?.id || ''} disabled={busy} onChange={e => { if (e.target.value) void run(() => open(e.target.value)); else { setCampaign(null); setSheet(null); setDm(false); localStorage.removeItem('chatbot-active-campaign'); } }}><option value="">New campaign</option>{saved.map(c => <option key={c.id} value={c.id}>{c.name} · {c.edition}</option>)}</select></label></div>
    {error && <p role="alert" className="campaign-error">{error} {campaign && <button onClick={() => void run(() => open(campaign.id, dm))}>Reload campaign</button>}</p>}
    {!campaign ? <div className="campaign-setup">
      <form onSubmit={e => { e.preventDefault(); void run(async () => { const value = await campaignApi<CampaignState>('', { name: newName, edition, premise: premise || undefined }); accept(value); setDm(false); await loadSaved(); }); }}>
        <h3>Begin a campaign</h3><label>Campaign name<input required maxLength={150} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Lanterns over the coast" /></label>
        <label>Rules edition<select value={edition} onChange={e => setEdition(e.target.value)}><option value="5e-2024">D&amp;D 5e · 2024</option><option value="5e-2014">D&amp;D 5e · 2014</option></select></label>
        <label>Premise<textarea maxLength={4000} value={premise} onChange={e => setPremise(e.target.value)} placeholder="Where does your adventure begin?" /></label><button disabled={busy || !newName.trim()} className="campaign-primary">Create campaign</button>
      </form>
      <div><h3>Bring an existing world</h3><label>Export format<select value={importFormat} onChange={e => setImportFormat(e.target.value)}><option value="dmt">Dungeon Master Tool · .dmtz / JSON</option><option value="campfire">Campfire · JSON</option><option value="chatbot">Chatbot campaign save · JSON</option></select></label>
        <p>World imports bring in text records and private DM notes. Records start hidden until you reveal them. Images and other apps’ combat saves stay in their original app.</p>
        <label className="campaign-file">Choose world export<input type="file" accept=".json,.dmtz" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { const value = await importCampaign(file, importFormat, edition); accept(value); setDm(false); await loadSaved(); }); }} /></label>
      </div>
    </div> : <>
      <div className="campaign-toolbar"><strong>{campaign.name}</strong><span>{campaign.edition} · Saved</span><button disabled={busy} aria-pressed={dm} onClick={() => void run(() => open(campaign.id, !dm))}>{dm ? 'Return to player view' : 'DM notes & records'}</button><button disabled={busy} onClick={() => editSheet(blankSheet())}>Add character</button>
        <button disabled={busy} onClick={() => void run(async () => { const data = await campaignApi(`/${campaign.id}/export${dm ? '?view=dm' : ''}`); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${campaign.name.replace(/[^a-z0-9_-]/gi, '-')}-${dm ? 'dm-save' : 'player-notes'}.json`; a.click(); URL.revokeObjectURL(url); })}>{dm ? 'Export full DM save' : 'Export player notes'}</button>
      </div>
      {campaign.imports.map((i, n) => <p className="campaign-note" key={n}>{i.notice}</p>)}
      {notice && <p role="status" className="campaign-notice">{notice}</p>}
      {sheet && <form className="campaign-sheet-editor" onSubmit={e => { e.preventDefault(); void run(async () => { const items = inventory.split('\n').filter(l => l.trim()).map(l => { const [name, count] = l.split('|'); return { name: name.trim(), quantity: count?.trim() ? Number(count) : 1 }; }); await act({ type: 'character', character: { ...sheet, inventory: items } }); setSheet(null); }); }}>
        <h3>{sheet.name || 'New character'}</h3><label>Name<input required value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} /></label>
        <label>Kind<select value={sheet.kind} onChange={e => setSheet({ ...sheet, kind: e.target.value as 'player' | 'npc' })}><option value="player">Player character</option><option value="npc">NPC / creature</option></select></label>
        {(['level', 'ac', 'maxHp', 'hp', 'tempHp', 'initiativeMod', 'attackBonus', 'hitDie', 'constitutionMod', 'hitDiceUsed'] as const).map(key => <label key={key}>{({ level: 'Level', ac: 'Armor Class', maxHp: 'Maximum HP', hp: 'Current HP', tempHp: 'Temporary HP', initiativeMod: 'Initiative modifier', attackBonus: 'Attack bonus', hitDie: 'Hit die sides (6, 8, 10, 12)', constitutionMod: 'Constitution modifier', hitDiceUsed: 'Spent hit dice' })[key]}<input type="number" required value={sheet[key] ?? 0} onChange={e => setSheet({ ...sheet, [key]: Number(e.target.value) })} /></label>)}
        <label>Damage formula<input value={sheet.damage || ''} required onChange={e => setSheet({ ...sheet, damage: e.target.value })} placeholder="1d8+3" /></label>
        <label>Conditions (comma separated)<input value={sheet.conditions.join(', ')} onChange={e => setSheet({ ...sheet, conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
        <label>Inventory (one item | quantity per line)<textarea value={inventory} onChange={e => setInventory(e.target.value)} /></label>
        <label><input type="checkbox" checked={sheet.pactMagic || false} onChange={e => setSheet({ ...sheet, pactMagic: e.target.checked })} /> Spell slots recover on a short rest (Pact Magic)</label>
        <fieldset><legend>Spell slots</legend>{Array.from({ length: 9 }, (_, i) => String(i + 1)).map(level => <div className="campaign-slot-edit" key={level}><span>Level {level}</span>{(['max', 'used'] as const).map(key => <label key={key}>{key === 'max' ? 'Maximum' : 'Spent'}<input type="number" min={0} max={20} value={sheet.spellSlots?.[level]?.[key] ?? 0} onChange={e => setSheet({ ...sheet, spellSlots: { ...sheet.spellSlots, [level]: { max: sheet.spellSlots?.[level]?.max || 0, used: sheet.spellSlots?.[level]?.used || 0, [key]: Number(e.target.value) } } })} /></label>)}</div>)}</fieldset>
        <div className="campaign-button-row"><button disabled={busy} className="campaign-primary">Save sheet</button><button type="button" onClick={() => setSheet(null)}>Cancel</button></div>
      </form>}
      <div className="campaign-columns"><div className="campaign-story">
        <h3>{campaign.scene || 'The adventure awaits'}</h3>
        {!campaign.history.length && <p>Add your character, then tell the DM how you want to begin. Use the dice and combat controls when a roll is needed.</p>}
        <div className="campaign-transcript" aria-live="polite">{campaign.history.map((m, i) => <article key={i} className={m.role === 'user' ? 'campaign-player-turn' : ''}><strong>{m.role === 'user' ? 'You' : 'Dungeon Master'}</strong><p>{m.content}</p></article>)}</div>
        <form onSubmit={submitTurn}><label>Your next move<textarea required maxLength={4000} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="I enter the inn and ask about the missing caravan…" /></label><button className="campaign-primary" disabled={busy || !message.trim()}>{busy ? 'Working…' : 'Continue adventure'}</button></form>
        <details><summary>Campaign recap</summary><p className="campaign-prose">{campaign.recap || 'Your recap will grow as you play.'}</p></details>
      </div><div className="campaign-controls">
        <h3>Party &amp; encounters</h3>{campaign.characters.map(c => <div className="campaign-character-card" key={c.id}><strong>{c.name}{c.hidden ? ' · hidden' : ''}</strong><span>{c.hp !== undefined ? `${c.hp}/${c.maxHp} HP · AC ${c.ac}` : 'NPC stats are private'}{c.conditions.length ? ` · ${c.conditions.join(', ')}` : ''}</span>
          {(c.kind === 'player' || dm) && <div className="campaign-button-row"><button disabled={busy} onClick={() => editSheet(c)}>Edit sheet</button><button disabled={busy} onClick={() => void run(() => act({ type: 'hp', characterId: c.id, delta: -1 }))}>−1 HP</button><button disabled={busy} onClick={() => void run(() => act({ type: 'hp', characterId: c.id, delta: 1 }))}>+1 HP</button><button disabled={busy || !!campaign.combat} onClick={() => void run(() => act({ type: 'rest', characterId: c.id, kind: 'long' }))}>Long rest</button><button disabled={busy || !!campaign.combat} onClick={() => void run(() => act({ type: 'rest', characterId: c.id, kind: 'short', hitDice: 1 }))}>Short rest · 1 die</button></div>}
          {Object.entries(c.spellSlots || {}).filter(([, s]) => s.max > 0).map(([level, s]) => <div className="campaign-slot" key={level}>Level {level}: {s.max - s.used}/{s.max} slots <button disabled={busy || s.used >= s.max} onClick={() => void run(() => act({ type: 'slot', characterId: c.id, level: Number(level), delta: 1 }))}>Spend</button></div>)}
        </div>)}
        <form onSubmit={e => { e.preventDefault(); void run(() => act({ type: 'roll', expression: dice })); }}><label>Dice expression<input value={dice} onChange={e => setDice(e.target.value)} placeholder="2d20kh1+3" /></label><button disabled={busy}>Roll dice</button></form>
        <label>Attacker<select value={hero?.id || ''} onChange={e => setActor(e.target.value)}><option value="">Choose character</option>{campaign.characters.filter(c => !c.hidden).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Target<select value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose target</option>{campaign.characters.filter(c => !c.hidden && c.id !== hero?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="campaign-button-row"><button disabled={busy || !hero || !target} onClick={() => void run(() => act({ type: 'attack', actorId: hero!.id, targetId: target }))}>Attack</button><button disabled={busy} onClick={() => void run(() => act({ type: 'initiative' }))}>Roll initiative</button>{campaign.combat && <><button disabled={busy} onClick={() => void run(() => act({ type: 'next-turn' }))}>Next turn</button><button disabled={busy} onClick={() => void run(() => act({ type: 'end-combat' }))}>End encounter</button></>}</div>
        {campaign.combat && <p>Round {campaign.combat.round} · {campaign.characters.find(c => c.id === campaign.combat!.order[campaign.combat!.turn])?.name || 'Next combatant'} acts.</p>}
        <details open={!!notice}><summary>Dice &amp; action log</summary><ol>{campaign.log.slice(-12).reverse().map((l, i) => <li key={i}>{l}</li>)}</ol></details>
        <details><summary>Known campaign records</summary>{campaign.entities.filter(e => !e.hidden).map(e => <article key={e.id}><strong>{e.name} · {e.kind}</strong><p>{e.description}</p></article>)}</details>
      </div></div>
      {dm && <div className="campaign-dm"><h3>DM notes &amp; world records</h3><p>These notes are excluded from player-facing narration. Reveal a record when it becomes known.</p>
        <form onSubmit={e => { e.preventDefault(); void run(() => act({ type: 'journal', scene, recap, dmNotes })); }}><label>Current scene<input value={scene} onChange={e => setScene(e.target.value)} /></label><label>Public recap<textarea value={recap} onChange={e => setRecap(e.target.value)} /></label><label>Private DM notes<textarea value={dmNotes} onChange={e => setDmNotes(e.target.value)} /></label><button disabled={busy}>Save journal</button></form>
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await act({ type: 'entity', entity: { id: crypto.randomUUID(), kind: recordKind, name: recordName, description: recordBody, dmSecret: recordSecret, hidden: true, status: 'open' } }); setRecordName(''); setRecordBody(''); setRecordSecret(''); }); }}><h4>Add a private record</h4><label>Record name<input required value={recordName} onChange={e => setRecordName(e.target.value)} /></label><label>Kind<select value={recordKind} onChange={e => setRecordKind(e.target.value)}>{['npc', 'quest', 'location', 'faction', 'lore'].map(k => <option key={k}>{k}</option>)}</select></label><label>Public description when revealed<textarea value={recordBody} onChange={e => setRecordBody(e.target.value)} /></label><label>DM secret<textarea value={recordSecret} onChange={e => setRecordSecret(e.target.value)} /></label><button disabled={busy || !recordName}>Save hidden record</button></form>
        {campaign.entities.map(e => <article key={e.id}><strong>{e.name} · {e.status} · {e.hidden ? 'hidden' : 'revealed'}</strong><p>{e.description}</p>{e.dmSecret && <p>DM only: {e.dmSecret}</p>}<div className="campaign-button-row"><button disabled={busy} onClick={() => void run(() => act({ type: 'entity', entity: { ...e, hidden: !e.hidden } }))}>{e.hidden ? 'Reveal record' : 'Hide record'}</button>{e.kind === 'quest' && <button disabled={busy} onClick={() => void run(() => act({ type: 'entity', entity: { ...e, status: e.status === 'completed' ? 'active' : 'completed' } }))}>{e.status === 'completed' ? 'Reopen quest' : 'Complete quest'}</button>}</div></article>)}
      </div>}
    </>}
  </section>;
}

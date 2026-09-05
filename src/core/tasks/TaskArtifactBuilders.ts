import { ChatTaskArtifact, TaskArtifactStore } from './TaskArtifactStore';

export interface NumericDatum {
  label: string;
  value: number;
}

export class TaskArtifactBuilders {
  constructor(private readonly store: TaskArtifactStore) {}

  buildBrowserGame(sessionId: string, concept: string): ChatTaskArtifact[] {
    const title = this.titleFrom(concept, 'Playable Game');
    const variant = /shoot|space|asteroid|bullet/i.test(concept)
      ? 'shooter'
      : /platform|jump|runner/i.test(concept)
        ? 'platformer'
        : 'collector';
    const slug = this.slug(title);
    const html = this.browserGameHtml(title, concept, variant);
    const manifest = JSON.stringify({ title, concept, variant, controls: variant === 'shooter'
      ? ['Arrow keys or WASD to move', 'Space to shoot']
      : variant === 'platformer'
        ? ['A/D or arrow keys to move', 'Space or Up to jump']
        : ['Arrow keys or WASD to move'] }, null, 2);

    return [
      this.store.write(sessionId, `${slug}.html`, html, 'game', 'text/html'),
      this.store.write(sessionId, `${slug}-manifest.json`, manifest, 'supporting-data', 'application/json')
    ];
  }

  buildGodotGame(sessionId: string, concept: string): ChatTaskArtifact[] {
    const title = this.titleFrom(concept, 'Chat Built Game');
    const project = `[application]\nconfig/name=${JSON.stringify(title)}\nrun/main_scene="res://main.tscn"\n\n[display]\nwindow/size/viewport_width=800\nwindow/size/viewport_height=500\nwindow/size/window_width_override=800\nwindow/size/window_height_override=500\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n`;
    const scene = `[gd_scene load_steps=2 format=3]\n\n[ext_resource path="res://main.gd" type="Script" id="1"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n`;
    const script = `extends Node2D

var player := Vector2(400, 250)
var target := Vector2(160, 160)
var score := 0

func _ready() -> void:
    queue_redraw()

func _process(delta: float) -> void:
    var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    player += direction * 260.0 * delta
    player.x = clamp(player.x, 18.0, 782.0)
    player.y = clamp(player.y, 18.0, 482.0)
    if player.distance_to(target) < 32.0:
        score += 1
        target = Vector2(randf_range(40.0, 760.0), randf_range(70.0, 460.0))
    queue_redraw()

func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, Vector2(800, 500)), Color("10131f"))
    draw_circle(target, 15.0, Color("fdcb6e"))
    draw_rect(Rect2(player - Vector2(15, 15), Vector2(30, 30)), Color("74b9ff"))
    draw_string(ThemeDB.fallback_font, Vector2(24, 36), ${JSON.stringify(title)} + "  Score: " + str(score), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)
    draw_string(ThemeDB.fallback_font, Vector2(24, 66), "Arrow keys: move • collect the gold target", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("b2bec3"))
`;

    return [
      this.store.write(sessionId, 'project.godot', project, 'game', 'text/plain'),
      this.store.write(sessionId, 'main.tscn', scene, 'game', 'text/plain'),
      this.store.write(sessionId, 'main.gd', script, 'game', 'text/plain')
    ];
  }

  buildSpreadsheet(sessionId: string, description: string): ChatTaskArtifact[] {
    const rows = this.spreadsheetRows(description);
    const title = this.titleFrom(description, 'Spreadsheet');
    const csv = rows.map(row => row.map(cell => this.csvCell(cell)).join(',')).join('\n') + '\n';
    return [this.store.write(sessionId, `${this.slug(title)}.csv`, csv, 'spreadsheet', 'text/csv')];
  }

  buildChart(
    sessionId: string,
    chartType: 'pie' | 'bar' | 'line',
    description: string,
    data: NumericDatum[]
  ): ChatTaskArtifact[] {
    const title = this.titleFrom(description, `${chartType} chart`);
    const svg = chartType === 'pie'
      ? this.pieSvg(title, data)
      : chartType === 'line'
        ? this.lineSvg(title, data)
        : this.barSvg(title, data);
    const csv = [['Label', 'Value'], ...data.map(item => [item.label, String(item.value)])]
      .map(row => row.map(cell => this.csvCell(cell)).join(','))
      .join('\n') + '\n';
    const slug = this.slug(title);
    return [
      this.store.write(sessionId, `${slug}.svg`, svg, 'chart', 'image/svg+xml'),
      this.store.write(sessionId, `${slug}-data.csv`, csv, 'supporting-data', 'text/csv')
    ];
  }

  parseNumericData(input: string): NumericDatum[] {
    const normalized = input
      .replace(/^\s*(?:please\s+)?(?:make|create|build|generate|produce|prepare|design|draw)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:(?:pie|bar|line)\s+)?(?:chart|graph)\s*(?:for|of|with)?\s*/i, '')
      .replace(/\band\b/gi, ',')
      .split(/[,;\n]+/)
      .map(part => part.trim())
      .filter(Boolean);
    const data: NumericDatum[] = [];

    for (const part of normalized) {
      const match = part.match(/^(.+?)(?:\s*[:=]\s*|\s+)(-?\d+(?:\.\d+)?)\s*%?$/);
      if (!match) continue;
      const label = match[1].replace(/^(?:data|values?|for|of)\s+/i, '').trim();
      const value = Number(match[2]);
      if (label && Number.isFinite(value)) data.push({ label, value });
    }

    return data.slice(0, 30);
  }

  private spreadsheetRows(description: string): string[][] {
    const lines = description.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const delimited = lines
      .filter(line => /[,|\t]/.test(line))
      .map(line => line.replace(/^\|?|\|?$/g, '').split(/\s*(?:,|\||\t)\s*/).filter(Boolean));
    if (delimited.length >= 2) return delimited;

    const pairs = this.parseNumericData(description);
    if (pairs.length > 0) {
      return [['Item', 'Value'], ...pairs.map(item => [item.label, String(item.value)])];
    }

    const columnsMatch = description.match(/columns?\s*(?:are|:)?\s*([^.;]+)/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(/,|\band\b/i).map(value => value.trim()).filter(Boolean);
      if (columns.length > 1) return [columns, columns.map(() => '')];
    }

    return [
      ['Item', 'Category', 'Owner', 'Status', 'Due Date', 'Notes'],
      ['', '', '', 'Not started', '', '']
    ];
  }

  private pieSvg(title: string, data: NumericDatum[]): string {
    const positive = data.map(item => ({ ...item, value: Math.max(0, item.value) }));
    const total = positive.reduce((sum, item) => sum + item.value, 0) || 1;
    const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#d63031', '#00cec9', '#a29bfe'];
    let angle = -Math.PI / 2;
    const slices = positive.map((item, index) => {
      const next = angle + (item.value / total) * Math.PI * 2;
      const x1 = 250 + Math.cos(angle) * 150;
      const y1 = 250 + Math.sin(angle) * 150;
      const x2 = 250 + Math.cos(next) * 150;
      const y2 = 250 + Math.sin(next) * 150;
      const large = next - angle > Math.PI ? 1 : 0;
      const path = `<path d="M250 250 L${x1.toFixed(2)} ${y1.toFixed(2)} A150 150 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colors[index % colors.length]}"/>`;
      angle = next;
      return path;
    }).join('');
    const legend = positive.map((item, index) => `<g transform="translate(450 ${100 + index * 34})"><rect width="18" height="18" rx="4" fill="${colors[index % colors.length]}"/><text x="28" y="15">${this.xml(item.label)}: ${item.value}</text></g>`).join('');
    return this.svgShell(title, `${slices}${legend}`);
  }

  private barSvg(title: string, data: NumericDatum[]): string {
    const max = Math.max(...data.map(item => item.value), 1);
    const barWidth = Math.min(70, 600 / data.length - 12);
    const bars = data.map((item, index) => {
      const height = Math.max(0, item.value / max) * 300;
      const x = 90 + index * (650 / data.length);
      return `<g><rect x="${x}" y="${430 - height}" width="${barWidth}" height="${height}" rx="5" fill="#6c5ce7"/><text x="${x + barWidth / 2}" y="${450}" text-anchor="middle">${this.xml(item.label)}</text><text x="${x + barWidth / 2}" y="${420 - height}" text-anchor="middle">${item.value}</text></g>`;
    }).join('');
    return this.svgShell(title, `<line x1="70" y1="430" x2="760" y2="430" stroke="#636e72"/>${bars}`);
  }

  private lineSvg(title: string, data: NumericDatum[]): string {
    const max = Math.max(...data.map(item => item.value), 1);
    const points = data.map((item, index) => {
      const x = 90 + index * (650 / Math.max(1, data.length - 1));
      const y = 430 - Math.max(0, item.value / max) * 300;
      return { ...item, x, y };
    });
    const line = points.map(point => `${point.x},${point.y}`).join(' ');
    const marks = points.map(point => `<g><circle cx="${point.x}" cy="${point.y}" r="6" fill="#6c5ce7"/><text x="${point.x}" y="${point.y - 14}" text-anchor="middle">${point.value}</text><text x="${point.x}" y="455" text-anchor="middle">${this.xml(point.label)}</text></g>`).join('');
    return this.svgShell(title, `<line x1="70" y1="430" x2="760" y2="430" stroke="#636e72"/><polyline points="${line}" fill="none" stroke="#6c5ce7" stroke-width="5"/>${marks}`);
  }

  private svgShell(title: string, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><rect width="800" height="520" fill="#f8f9fa"/><style>text{font-family:Arial,sans-serif;fill:#2d3436;font-size:14px}</style><text x="400" y="45" text-anchor="middle" font-size="24" font-weight="700">${this.xml(title)}</text>${body}</svg>`;
  }

  private browserGameHtml(title: string, concept: string, variant: string): string {
    const safeTitle = this.xml(title);
    const safeConcept = this.xml(concept);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;background:#10131f;color:#fff;font-family:system-ui,sans-serif}main{max-width:900px;margin:auto;padding:24px}canvas{width:100%;background:linear-gradient(#151a2e,#080a12);border:1px solid #596080;border-radius:14px;box-shadow:0 20px 50px #0008}button{padding:10px 18px;border:0;border-radius:8px;background:#6c5ce7;color:#fff;font-weight:700}.row{display:flex;justify-content:space-between;align-items:center;gap:16px}.hint{color:#b2bec3}</style></head><body><main><div class="row"><div><h1>${safeTitle}</h1><p>${safeConcept}</p></div><button id="restart">Restart</button></div><p id="status" class="hint"></p><canvas id="game" width="800" height="500"></canvas></main><script>(()=>{'use strict';const V=${JSON.stringify(variant)},c=document.querySelector('#game'),x=c.getContext('2d'),status=document.querySelector('#status'),keys=new Set();let p,items,enemies,shots,platforms,score,over,lastShot;addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault()});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));document.querySelector('#restart').onclick=reset;const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;function reset(){p={x:380,y:V==='shooter'?430:380,w:28,h:28,vx:0,vy:0,onGround:false};items=[];enemies=[];shots=[];platforms=V==='platformer'?[{x:0,y:470,w:800,h:30},{x:120,y:370,w:170,h:18},{x:390,y:300,w:150,h:18},{x:610,y:220,w:130,h:18}]:[];score=0;over=false;lastShot=0;for(let i=0;i<6;i++)spawnItem();for(let i=0;i<4;i++)spawnEnemy();status.textContent=V==='shooter'?'Move with WASD/arrows. Shoot with Space.':'platformer'===V?'Move with A/D or arrows. Jump with Space/Up. Collect the gold.':'Move with WASD/arrows. Collect gold and avoid red.'}function spawnItem(){items.push({x:40+Math.random()*710,y:50+Math.random()*370,w:18,h:18})}function spawnEnemy(){enemies.push({x:30+Math.random()*730,y:V==='shooter'?-Math.random()*400:80+Math.random()*330,w:26,h:26,vx:(Math.random()>.5?1:-1)*(1+Math.random()*2),vy:1+Math.random()*1.4})}function update(t){if(over)return;const l=keys.has('arrowleft')||keys.has('a'),r=keys.has('arrowright')||keys.has('d'),u=keys.has('arrowup')||keys.has('w'),d=keys.has('arrowdown')||keys.has('s');if(V==='platformer'){p.vx=(r-l)*4;p.vy+=.55;if((keys.has(' ')||u)&&p.onGround){p.vy=-11;p.onGround=false}p.x+=p.vx;p.y+=p.vy;p.onGround=false;for(const q of platforms)if(p.vy>=0&&p.x+p.w>q.x&&p.x<q.x+q.w&&p.y+p.h>=q.y&&p.y+p.h<=q.y+p.vy+14){p.y=q.y-p.h;p.vy=0;p.onGround=true}}else{p.x+=(r-l)*5;p.y+=(d-u)*5}p.x=Math.max(0,Math.min(800-p.w,p.x));p.y=Math.max(0,Math.min(500-p.h,p.y));if(V==='shooter'&&keys.has(' ')&&t-lastShot>220){shots.push({x:p.x+11,y:p.y-12,w:6,h:14});lastShot=t}for(const s of shots)s.y-=8;shots=shots.filter(s=>s.y>-20);for(const e of enemies){if(V==='shooter'){e.y+=e.vy;if(e.y>520){e.y=-30;e.x=Math.random()*760}}else{e.x+=e.vx;if(e.x<0||e.x>800-e.w)e.vx*=-1}if(hit(p,e))over=true}for(const s of shots)for(const e of enemies)if(hit(s,e)){e.y=-40;e.x=Math.random()*760;s.y=-50;score+=2}items=items.filter(i=>{if(hit(p,i)){score++;spawnItem();return false}return true});status.textContent=(over?'Game over — press Restart. ':'')+'Score: '+score}function draw(){x.clearRect(0,0,800,500);x.fillStyle='#596080';for(const q of platforms)x.fillRect(q.x,q.y,q.w,q.h);x.fillStyle='#fdcb6e';for(const i of items)x.fillRect(i.x,i.y,i.w,i.h);x.fillStyle='#ff7675';for(const e of enemies)x.fillRect(e.x,e.y,e.w,e.h);x.fillStyle='#74b9ff';x.fillRect(p.x,p.y,p.w,p.h);x.fillStyle='#fff';for(const s of shots)x.fillRect(s.x,s.y,s.w,s.h)}function loop(t){update(t);draw();requestAnimationFrame(loop)}reset();requestAnimationFrame(loop)})();</script></body></html>`;
  }

  private titleFrom(description: string, fallback: string): string {
    const quoted = description.match(/["“]([^"”]{2,80})["”]/)?.[1];
    if (quoted) return quoted;
    const cleaned = description
      .replace(/\b(?:please|make|create|build|generate|a|an|the|for me|spreadsheet|chart|graph|pie|bar|line|game|browser|html)\b/gi, ' ')
      .replace(/[^a-zA-Z0-9 -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return fallback;
    return cleaned.split(' ').slice(0, 7).map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'artifact';
  }

  private csvCell(value: string): string {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private xml(value: string): string {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character] || character));
  }
}

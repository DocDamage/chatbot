import { TaskArtifactBuilders } from './TaskArtifactBuilders';
import { ChatTaskArtifact, TaskArtifactStore } from './TaskArtifactStore';

type TaskKind = 'game' | 'spreadsheet' | 'chart';
type AwaitingField = 'game_concept' | 'game_platform' | 'spreadsheet_data' | 'chart_type' | 'chart_data';

interface PendingTask {
  kind: TaskKind;
  originalRequest: string;
  awaiting: AwaitingField;
  concept?: string;
  platform?: 'browser' | 'godot';
  chartType?: 'pie' | 'bar' | 'line';
  dataText?: string;
  updatedAt: number;
}

export interface ConversationalTaskResult {
  response: string;
  sources: string[];
  mode: 'task_intake' | 'task_complete';
  model: 'capability-task-orchestrator';
  task: {
    kind: TaskKind;
    status: 'needs_input' | 'completed' | 'cancelled';
    awaiting?: AwaitingField;
  };
  artifacts?: ChatTaskArtifact[];
}

export class ConversationalTaskOrchestrator {
  private readonly pending = new Map<string, PendingTask>();
  private readonly builders: TaskArtifactBuilders;
  private readonly ttlMs = 60 * 60 * 1000;

  constructor(workspaceRoot = process.cwd()) {
    this.builders = new TaskArtifactBuilders(new TaskArtifactStore(workspaceRoot));
  }

  handle(sessionId: string, message: string, _mode?: string): ConversationalTaskResult | undefined {
    this.expireOldTasks();
    const existing = this.pending.get(sessionId);
    const detectedKind = this.detectKind(message);

    if (existing && /\b(?:cancel|never mind|nevermind|stop this|start over)\b/i.test(message)) {
      this.pending.delete(sessionId);
      return this.result(existing.kind, 'cancelled', 'Okay — I cancelled that task. Tell me what you would like to make next.');
    }

    if (existing && !detectedKind) {
      return this.continueTask(sessionId, existing, message);
    }

    if (!detectedKind) {
      return undefined;
    }

    return this.startTask(sessionId, detectedKind, message);
  }

  getPendingTask(sessionId: string): PendingTask | undefined {
    return this.pending.get(sessionId);
  }

  private startTask(sessionId: string, kind: TaskKind, message: string): ConversationalTaskResult {
    this.pending.delete(sessionId);
    if (kind === 'game') {
      const concept = this.gameConcept(message);
      const platform = this.gamePlatform(message);
      if (!concept) {
        return this.remember(sessionId, {
          kind,
          originalRequest: message,
          awaiting: 'game_concept',
          platform,
          updatedAt: Date.now()
        }, 'What kind of game should I make? Describe the genre, theme, and main objective—for example, “a space shooter where the player protects a moon base.”');
      }
      if (!platform) {
        return this.remember(sessionId, {
          kind,
          originalRequest: message,
          awaiting: 'game_platform',
          concept,
          updatedAt: Date.now()
        }, 'Where should the first playable version run? Choose “browser” for an immediately playable HTML game, or “Godot” for a starter project.');
      }
      return this.completeGame(sessionId, concept, platform);
    }

    if (kind === 'spreadsheet') {
      if (!this.hasSpreadsheetDetails(message)) {
        return this.remember(sessionId, {
          kind,
          originalRequest: message,
          awaiting: 'spreadsheet_data',
          updatedAt: Date.now()
        }, 'What should the spreadsheet track? Paste column names and sample rows, provide label/value pairs, or say “blank template” and describe the columns you want.');
      }
      return this.completeSpreadsheet(sessionId, message);
    }

    const chartType = this.chartType(message);
    const data = this.builders.parseNumericData(message);
    if (!chartType) {
      return this.remember(sessionId, {
        kind,
        originalRequest: message,
        awaiting: 'chart_type',
        dataText: data.length >= 2 ? message : undefined,
        updatedAt: Date.now()
      }, 'Which chart should I create: pie, bar, or line?');
    }
    if (data.length < 2) {
      return this.remember(sessionId, {
        kind,
        originalRequest: message,
        awaiting: 'chart_data',
        chartType,
        updatedAt: Date.now()
      }, `Send at least two label/value pairs for the ${chartType} chart, such as “Rent: 1200, Food: 450, Transport: 180.”`);
    }
    return this.completeChart(sessionId, chartType, message, data);
  }

  private continueTask(sessionId: string, task: PendingTask, message: string): ConversationalTaskResult {
    task.updatedAt = Date.now();
    if (task.awaiting === 'game_concept') {
      task.concept = message.trim();
      if (!task.platform) {
        task.awaiting = 'game_platform';
        this.pending.set(sessionId, task);
        return this.result('game', 'needs_input', 'Got it. Should I make the first playable version for the browser or as a Godot starter project?', 'game_platform');
      }
      return this.completeGame(sessionId, task.concept, task.platform);
    }

    if (task.awaiting === 'game_platform') {
      const platform = this.gamePlatform(message);
      if (!platform) {
        return this.remember(sessionId, task, 'Please choose “browser” or “Godot.” Browser is recommended when you want to play it immediately.');
      }
      return this.completeGame(sessionId, task.concept || task.originalRequest, platform);
    }

    if (task.awaiting === 'spreadsheet_data') {
      return this.completeSpreadsheet(sessionId, `${task.originalRequest}\n${message}`);
    }

    if (task.awaiting === 'chart_type') {
      const chartType = this.chartType(message);
      if (!chartType) {
        return this.remember(sessionId, task, 'Please choose pie, bar, or line.');
      }
      if (task.dataText) {
        const data = this.builders.parseNumericData(task.dataText);
        if (data.length >= 2) return this.completeChart(sessionId, chartType, task.originalRequest, data);
      }
      task.chartType = chartType;
      task.awaiting = 'chart_data';
      return this.remember(sessionId, task, `Now send the data as label/value pairs, for example “North: 42, South: 31, West: 27.”`);
    }

    const data = this.builders.parseNumericData(message);
    if (data.length < 2) {
      return this.remember(sessionId, task, 'I still need at least two label/value pairs, such as “A: 40, B: 35, C: 25.”');
    }
    return this.completeChart(sessionId, task.chartType || 'bar', task.originalRequest, data);
  }

  private completeGame(sessionId: string, concept: string, platform: 'browser' | 'godot'): ConversationalTaskResult {
    const artifacts = platform === 'godot'
      ? this.builders.buildGodotGame(sessionId, concept)
      : this.builders.buildBrowserGame(sessionId, concept);
    this.pending.delete(sessionId);
    const response = platform === 'godot'
      ? `I built a Godot starter game from your brief. Download the three project files into the same folder, then open “${artifacts[0].name}” in Godot 4.`
      : `I built a playable browser prototype from your brief. Open “${artifacts[0].name}” to play it. I also included a manifest with the concept, controls, and game variant.`;
    return this.completed('game', response, artifacts);
  }

  private completeSpreadsheet(sessionId: string, description: string): ConversationalTaskResult {
    const artifacts = this.builders.buildSpreadsheet(sessionId, description);
    this.pending.delete(sessionId);
    return this.completed('spreadsheet', `I created the spreadsheet as “${artifacts[0].name}.” It is a standards-compatible CSV that opens in Excel, Google Sheets, or LibreOffice.`, artifacts);
  }

  private completeChart(
    sessionId: string,
    chartType: 'pie' | 'bar' | 'line',
    description: string,
    data: ReturnType<TaskArtifactBuilders['parseNumericData']>
  ): ConversationalTaskResult {
    const artifacts = this.builders.buildChart(sessionId, chartType, description, data);
    this.pending.delete(sessionId);
    return this.completed('chart', `I created the ${chartType} chart as “${artifacts[0].name}” and included its source data as “${artifacts[1].name}.”`, artifacts);
  }

  private detectKind(message: string): TaskKind | undefined {
    if (!/\b(?:make|create|build|generate|produce|prepare|design|draw)\b/i.test(message)) return undefined;
    if (/\b(?:video game|game|playable prototype)\b/i.test(message)) return 'game';
    if (/\b(?:spreadsheet|workbook|worksheet|excel|csv)\b/i.test(message)) return 'spreadsheet';
    if (/\b(?:chart|graph|pie graph|pie chart|bar graph|line graph)\b/i.test(message)) return 'chart';
    return undefined;
  }

  private gameConcept(message: string): string | undefined {
    const stripped = message
      .replace(/\b(?:please|can you|could you|would you|make|create|build|generate|design|for me|a|an|the|browser|html|web|godot|game|playable|prototype)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.split(/\s+/).filter(Boolean).length >= 2 ? stripped : undefined;
  }

  private gamePlatform(message: string): 'browser' | 'godot' | undefined {
    if (/\b(?:browser|html|html5|web|javascript)\b/i.test(message)) return 'browser';
    if (/\bgodot\b/i.test(message)) return 'godot';
    return undefined;
  }

  private chartType(message: string): 'pie' | 'bar' | 'line' | undefined {
    if (/\bpie\b/i.test(message)) return 'pie';
    if (/\bbar\b/i.test(message)) return 'bar';
    if (/\bline\b/i.test(message)) return 'line';
    return undefined;
  }

  private hasSpreadsheetDetails(message: string): boolean {
    return /\b(?:blank template|columns?\s*(?:are|:)|rows?\s*(?:are|:))\b/i.test(message)
      || this.builders.parseNumericData(message).length > 0
      || message.split(/\r?\n/).filter(line => /[,|\t]/.test(line)).length >= 2;
  }

  private remember(sessionId: string, task: PendingTask, response: string): ConversationalTaskResult {
    this.pending.set(sessionId, task);
    return this.result(task.kind, 'needs_input', response, task.awaiting);
  }

  private completed(kind: TaskKind, response: string, artifacts: ChatTaskArtifact[]): ConversationalTaskResult {
    return {
      ...this.result(kind, 'completed', response),
      artifacts,
      sources: artifacts.map(artifact => artifact.path)
    };
  }

  private result(
    kind: TaskKind,
    status: ConversationalTaskResult['task']['status'],
    response: string,
    awaiting?: AwaitingField
  ): ConversationalTaskResult {
    return {
      response,
      sources: [],
      mode: status === 'completed' ? 'task_complete' : 'task_intake',
      model: 'capability-task-orchestrator',
      task: { kind, status, awaiting }
    };
  }

  private expireOldTasks(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [sessionId, task] of this.pending) {
      if (task.updatedAt < cutoff) this.pending.delete(sessionId);
    }
  }
}

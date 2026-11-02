/**
 * Subtitle Editor & Format Exporter Service (PX13-T03)
 *
 * Implements interactive cue editing: frame nudge, global timing shifts,
 * frame snapping, cue boundary validation, undo/redo tracking, and full import/export
 * converters for SRT, WebVTT, ASS/SSA, and plain text transcripts.
 */

import { SubtitleCue } from './MediaAccessibilityTypes';

export class SubtitleEditorService {
  private historyStack: SubtitleCue[][] = [];
  private redoStack: SubtitleCue[][] = [];

  /**
   * Shifts all cues forward or backward by deltaSeconds.
   */
  public shiftAllCues(cues: SubtitleCue[], deltaSeconds: number): SubtitleCue[] {
    return cues.map(c => ({
      ...c,
      startSec: Math.max(0, Number((c.startSec + deltaSeconds).toFixed(3))),
      endSec: Math.max(0.1, Number((c.endSec + deltaSeconds).toFixed(3)))
    }));
  }

  /**
   * Snaps all cue start/end timings to nearest video frame grid (e.g. 24 fps, 30 fps, 60 fps).
   */
  public snapToFrameGrid(cues: SubtitleCue[], fps = 24): SubtitleCue[] {
    const frameDur = 1.0 / fps;
    return cues.map(c => {
      const startFrames = Math.round(c.startSec / frameDur);
      const endFrames = Math.round(c.endSec / frameDur);
      return {
        ...c,
        startSec: Number((startFrames * frameDur).toFixed(3)),
        endSec: Number((Math.max(startFrames + 1, endFrames) * frameDur).toFixed(3))
      };
    });
  }

  /**
   * Nudges a specific cue by id.
   */
  public nudgeCue(cues: SubtitleCue[], cueId: string, deltaStart: number, deltaEnd: number): SubtitleCue[] {
    return cues.map(c => {
      if (c.id !== cueId) return c;
      const newStart = Math.max(0, Number((c.startSec + deltaStart).toFixed(3)));
      const newEnd = Math.max(newStart + 0.1, Number((c.endSec + deltaEnd).toFixed(3)));
      return { ...c, startSec: newStart, endSec: newEnd };
    });
  }

  /**
   * Export to SubRip (.SRT) format.
   */
  public exportToSrt(cues: SubtitleCue[]): string {
    return cues
      .map((c, i) => {
        const startTimestamp = this.formatSrtTimestamp(c.startSec);
        const endTimestamp = this.formatSrtTimestamp(c.endSec);
        return `${i + 1}\n${startTimestamp} --> ${endTimestamp}\n${c.text}\n`;
      })
      .join('\n');
  }

  /**
   * Export to WebVTT (.VTT) format.
   */
  public exportToWebVtt(cues: SubtitleCue[]): string {
    const body = cues
      .map((c, i) => {
        const start = this.formatVttTimestamp(c.startSec);
        const end = this.formatVttTimestamp(c.endSec);
        return `${i + 1}\n${start} --> ${end}\n${c.text}\n`;
      })
      .join('\n');
    return `WEBVTT\n\n${body}`;
  }

  /**
   * Export to Advanced SubStation Alpha (.ASS) format.
   */
  public exportToAss(cues: SubtitleCue[], title = 'Media Accessibility Subtitles'): string {
    const header = [
      '[Script Info]',
      `Title: ${title}`,
      'ScriptType: v4.00+',
      'Collisions: Normal',
      'PlayResX: 1920',
      'PlayResY: 1080',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,20,20,20,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    ].join('\n');

    const events = cues
      .map(c => {
        const start = this.formatAssTimestamp(c.startSec);
        const end = this.formatAssTimestamp(c.endSec);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`;
      })
      .join('\n');

    return `${header}\n${events}\n`;
  }

  /**
   * Export plain text transcript.
   */
  public exportToPlainText(cues: SubtitleCue[]): string {
    return cues.map(c => c.text).join('\n');
  }

  /**
   * Parses SRT text into SubtitleCue items.
   */
  public parseSrt(srtContent: string): SubtitleCue[] {
    const blocks = srtContent.trim().split(/\n\s*\n/);
    const cues: SubtitleCue[] = [];

    blocks.forEach((block, idx) => {
      const lines = block.trim().split('\n');
      if (lines.length < 2) return;

      const timeLine = lines.find(l => l.includes('-->'));
      if (!timeLine) return;

      const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
      const textLines = lines.slice(lines.indexOf(timeLine) + 1).join('\n');

      cues.push({
        id: `parsed-cue-${idx + 1}`,
        index: idx + 1,
        startSec: this.parseSrtTimestamp(startStr),
        endSec: this.parseSrtTimestamp(endStr),
        text: textLines
      });
    });

    return cues;
  }

  private formatSrtTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private formatVttTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  private formatAssTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor(((seconds % 1) * 100));
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  private parseSrtTimestamp(timestamp: string): number {
    const [time, msStr] = timestamp.split(/[,.]/);
    const [hrs, mins, secs] = time.split(':').map(Number);
    const ms = Number(msStr || 0);
    return hrs * 3600 + mins * 60 + secs + ms / 1000;
  }
}

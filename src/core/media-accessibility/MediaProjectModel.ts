/**
 * Media Project & Job Model (PX13-T01)
 *
 * Implements persistent project management for media accessibility, audio/video stream
 * descriptors, rights confirmations, variant tracks, and artifact provenance lineage.
 */

import crypto from 'node:crypto';
import { MediaProject, MediaTrackStream, SubtitleCue } from './MediaAccessibilityTypes';

export class MediaProjectModel {
  private projects: Map<string, MediaProject> = new Map();

  public createProject(params: {
    title: string;
    sourceFilePath: string;
    originalLanguage?: string;
    durationSec: number;
    streams?: MediaTrackStream[];
    rightsConfirmed: boolean;
  }): MediaProject {
    if (!params.rightsConfirmed) {
      throw new Error('Project creation rejected: User must confirm ownership or rights to process media asset.');
    }

    const projectId = `medproj-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sourceHash = crypto
      .createHash('sha256')
      .update(`${params.sourceFilePath}:${params.durationSec}`)
      .digest('hex');

    const defaultStreams: MediaTrackStream[] = params.streams || [
      {
        streamIndex: 0,
        type: 'video',
        codec: 'h264',
        durationSec: params.durationSec,
        resolution: { width: 1920, height: 1080 }
      },
      {
        streamIndex: 1,
        type: 'audio',
        codec: 'aac',
        language: params.originalLanguage || 'en',
        durationSec: params.durationSec,
        sampleRate: 48000,
        channels: 2
      }
    ];

    const project: MediaProject = {
      projectId,
      title: params.title,
      sourceFilePath: params.sourceFilePath,
      originalLanguage: params.originalLanguage || 'en',
      durationSec: params.durationSec,
      streams: defaultStreams,
      primaryCues: [],
      translationVariants: {},
      selectedVoices: {},
      provenance: {
        sourceHash,
        rightsConfirmed: true,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString()
      },
      retentionDays: 30
    };

    this.projects.set(projectId, project);
    return project;
  }

  public getProject(projectId: string): MediaProject | undefined {
    return this.projects.get(projectId);
  }

  public setPrimaryCues(projectId: string, cues: SubtitleCue[]): void {
    const proj = this.projects.get(projectId);
    if (!proj) throw new Error(`Project ${projectId} not found.`);
    proj.primaryCues = cues;
    proj.provenance.lastModifiedAt = new Date().toISOString();
  }

  public addTranslationVariant(projectId: string, languageCode: string, cues: SubtitleCue[]): void {
    const proj = this.projects.get(projectId);
    if (!proj) throw new Error(`Project ${projectId} not found.`);
    (proj.translationVariants as Record<string, SubtitleCue[]>)[languageCode] = cues;
    proj.provenance.lastModifiedAt = new Date().toISOString();
  }

  public deleteProject(projectId: string): boolean {
    return this.projects.delete(projectId);
  }
}

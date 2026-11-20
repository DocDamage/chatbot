import { EngineStatus } from '../engine/GameEngineTypes';

export interface ProjectSessionBinding {
  sessionId: string;
  projectId: string;
  profileDigest: string;
  profileRevision: number;
  runtimeId: string;
  physicalKey: string;
}

export interface ProjectSessionView extends EngineStatus {
  sessionId: string;
  projectId: string;
  profileDigest: string;
  profileRevision: number;
  runtimeId: string;
}

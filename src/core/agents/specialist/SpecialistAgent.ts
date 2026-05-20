export interface SpecialistIntent {
  kind: string;
  confidence: number;
  labels?: string[];
}

export interface SpecialistEvidence {
  source: string;
  content: string;
  timestamp: string;
  trust: 'tool' | 'official' | 'vendor' | 'local' | 'derived';
}

export interface SpecialistToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface DraftAnswer {
  content: string;
  finalResult?: string;
  steps?: string[];
}

export interface VerificationResult {
  verified: boolean;
  method: string;
  warnings: string[];
  approximate?: boolean;
}

export interface SpecialistResponse {
  answerType: string;
  content: string;
  evidence: SpecialistEvidence[];
  toolResults: SpecialistToolResult[];
  verification: VerificationResult;
}

export interface SpecialistAgent {
  classifyIntent(input: string): Promise<SpecialistIntent> | SpecialistIntent;
  gatherEvidence(input: string): Promise<SpecialistEvidence[]>;
  runTools(input: string, evidence: SpecialistEvidence[]): Promise<SpecialistToolResult[]>;
  verify(answer: DraftAnswer): Promise<VerificationResult>;
  respond(result: {
    input: string;
    intent: SpecialistIntent;
    evidence: SpecialistEvidence[];
    toolResults: SpecialistToolResult[];
    draft: DraftAnswer;
    verification: VerificationResult;
  }): Promise<SpecialistResponse>;
}

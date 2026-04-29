export type LearnworldsTriggerMode = 'manual' | 'scheduled' | 'webhook';

export interface LearnworldsProgressRecord {
  learnerId: string;
  courseId: string;
  moduleId: string | null;
  lessonId: string | null;
  completionStatus: string | null;
  progressPercentage: number | null;
  lastActivityTimestamp: string | null;
  raw: Record<string, unknown>;
}

export interface LearnworldsIngestionResult {
  syncRunId: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
}

export interface LearnworldsFetchResponse {
  records: LearnworldsProgressRecord[];
  rawCount: number;
  endpoint: string;
  httpStatus: number;
}

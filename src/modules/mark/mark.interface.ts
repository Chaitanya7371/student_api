export type ExamName = 'unit-1' | 'midterm' | 'unit-2' | 'final';

/** What the service works with. score and maxScore are numbers, never numeric strings. */
export interface Mark {
  id: number;
  studentId: number;
  exam: ExamName;
  subject: string;
  score: number;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One database row.
 * pg returns NUMERIC columns as strings, for example "78.50".
 */
export interface MarkRow {
  id: number;
  student_id: number;
  exam: string;
  subject: string;
  score: string;
  max_score: string;
  created_at: Date;
  updated_at: Date;
}

export interface MarkDraft {
  subject: string;
  score: number;
  maxScore: number;
}

export interface MarkWritableColumns {
  student_id?: number;
  exam?: ExamName;
  subject?: string;
  score?: number;
  max_score?: number;
}

export interface SubjectAverage {
  subject: string;
  averagePercentage: number;
  students: number;
}

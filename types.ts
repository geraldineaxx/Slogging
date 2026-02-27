
export type { User } from '@supabase/supabase-js';

export interface TimeSession {
  id: string;
  projectName: string;
  startTime: number;
  endTime?: number;
  durationMs: number;
  createdAt: string;
}

export enum AppView {
  LANDING = 'LANDING',
  TIMER = 'TIMER',
  LOG = 'LOG',
  PROJECTS = 'PROJECTS'
}

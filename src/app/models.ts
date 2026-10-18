export type Mood = 'calm' | 'stressed' | 'energetic' | 'curious';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface MoodSnapshot {
  mood: Mood;
  score: number;
  source: 'self-check' | 'typing' | 'camera' | 'text' | 'voice';
  createdAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  priority: TaskPriority;
  done: boolean;
  createdAt: number;
}

export interface ProjectItem {
  id: string;
  name: string;
}

export interface MeetingNote {
  id: string;
  title: string;
  summary: string;
  actions: string[];
  createdAt: number;
}

export interface KnowledgeResult {
  title: string;
  detail: string;
  kind: 'task' | 'meeting';
}

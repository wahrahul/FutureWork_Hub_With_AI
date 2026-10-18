import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MeetingNote } from '../models';
import { GeminiService } from './gemini.service';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly storage = inject(LocalStorageService);
  private readonly gemini = inject(GeminiService);
  readonly notes$ = new BehaviorSubject<MeetingNote[]>(this.storage.get('meetings', []));

  constructor() {
    const initialNotes = this.notes$.value;
    void this.storage.hydrate('meetings', initialNotes).then((notes) => {
      if (this.notes$.value === initialNotes) this.notes$.next(notes);
    });
  }

  async create(transcript: string): Promise<MeetingNote | null> {
    const text = transcript.trim();
    if (!text) return null;

    const response = await this.gemini.generate(
      `Summarize these meeting notes in 2 concise sentences and extract action items. Return only JSON: {"summary":"...","actions":["..."]}. Notes: ${text.slice(0, 5000)}`,
    );
    const result = this.parse(response) ?? this.summarizeLocally(text);
    const note: MeetingNote = {
      id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
      title: text.split(/[.!?\n]/)[0].slice(0, 56) || 'Meeting notes',
      summary: result.summary,
      actions: result.actions,
      createdAt: Date.now(),
    };
    const notes = [note, ...this.notes$.value];
    this.notes$.next(notes);
    this.storage.set('meetings', notes);
    return note;
  }

  remove(id: string): void {
    const notes = this.notes$.value.filter((note) => note.id !== id);
    this.notes$.next(notes);
    this.storage.set('meetings', notes);
  }

  private parse(response: string | null): { summary: string; actions: string[] } | null {
    if (!response) return null;
    try {
      const parsed = JSON.parse(response.replace(/```(?:json)?|```/g, '').trim()) as { summary?: string; actions?: string[] };
      if (!parsed.summary) return null;
      return { summary: parsed.summary, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
    } catch {
      return null;
    }
  }

  private summarizeLocally(text: string): { summary: string; actions: string[] } {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const actions = sentences.filter((line) => /\b(action|will|follow up|need to|owner|next step|send|share|schedule)\b/i.test(line)).slice(0, 5);
    return { summary: sentences.slice(0, 2).join(' ').slice(0, 280), actions };
  }
}

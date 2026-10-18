import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { KnowledgeResult, MeetingNote, Mood, TaskItem } from '../models';
import { GeminiService } from './gemini.service';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly storage = inject(LocalStorageService);
  private readonly gemini = inject(GeminiService);
  readonly recent$ = new BehaviorSubject<string[]>(this.storage.get('searches', []));

  async search(query: string, tasks: TaskItem[], notes: MeetingNote[], mood: Mood): Promise<KnowledgeResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];
    const corpus: KnowledgeResult[] = [
      ...tasks.map((task) => ({ title: task.title, detail: `${task.project} · ${task.priority} priority`, kind: 'task' as const })),
      ...notes.map((note) => ({ title: note.title, detail: note.summary, kind: 'meeting' as const })),
    ];
    const response = await this.gemini.generate(
      `Find the most relevant items for the query. Return only a JSON array of 0-based item indexes in relevance order. ${mood === 'stressed' ? 'Return at most 3 items.' : 'Return at most 6 items.'}\nQuery: ${cleanQuery}\nItems: ${JSON.stringify(corpus)}`,
    );
    const results = this.parseIndexes(response, corpus) ?? this.matchLocally(cleanQuery, corpus);
    const recent = [cleanQuery, ...this.recent$.value.filter((item) => item.toLowerCase() !== cleanQuery.toLowerCase())].slice(0, 6);
    this.recent$.next(recent);
    this.storage.set('searches', recent);
    return mood === 'stressed' ? results.slice(0, 3) : results;
  }

  private parseIndexes(response: string | null, corpus: KnowledgeResult[]): KnowledgeResult[] | null {
    if (!response) return null;
    try {
      const parsed = JSON.parse(response.replace(/```(?:json)?|```/g, '').trim()) as number[];
      return parsed.filter((index) => Number.isInteger(index) && corpus[index]).map((index) => corpus[index]);
    } catch {
      return null;
    }
  }

  private matchLocally(query: string, corpus: KnowledgeResult[]): KnowledgeResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
    return corpus
      .map((item) => ({ item, score: terms.reduce((sum, term) => sum + Number(`${item.title} ${item.detail}`.toLowerCase().includes(term)), 0) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }
}

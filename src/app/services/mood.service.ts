import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Mood, MoodSnapshot } from '../models';
import { GeminiService } from './gemini.service';
import { LocalStorageService } from './local-storage.service';

const initialMood: MoodSnapshot = {
  mood: 'calm',
  score: 82,
  source: 'self-check',
  createdAt: Date.now(),
};

@Injectable({ providedIn: 'root' })
export class MoodService {
  private readonly storage = inject(LocalStorageService);
  private readonly gemini = inject(GeminiService);
  private readonly keyTimes: number[] = [];
  private manualOverrideUntil = 0;
  private lastAutomaticHistoryAt = 0;
  readonly mood$ = new BehaviorSubject<MoodSnapshot>(this.storage.get('mood-last', initialMood));
  readonly history$ = new BehaviorSubject<MoodSnapshot[]>(this.storage.get('mood-history', [initialMood]));
  readonly cameraEnabled = this.storage.get('camera-enabled', false);

  get typingWordsPerMinute(): number {
    const elapsed = this.keyTimes.length > 1 ? (this.keyTimes.at(-1)! - this.keyTimes[0]) / 60_000 : 0;
    if (elapsed < 5 / 60) return 0;
    return Math.min(200, Math.round((this.keyTimes.length / 5) / elapsed));
  }

  get typingFatigueCue(): boolean {
    return this.keyTimes.length >= 12 && this.typingWordsPerMinute > 0 && this.typingWordsPerMinute < 18;
  }

  get typingSampleCount(): number {
    return this.keyTimes.length;
  }

  checkIn(mood: Mood, source: MoodSnapshot['source'] = 'self-check'): void {
    const now = Date.now();
    this.manualOverrideUntil = now + 5 * 60_000;
    const snapshot = { mood, score: this.scoreFor(mood), source, createdAt: now };
    this.mood$.next(snapshot);
    const history = [snapshot, ...this.history$.value].slice(0, 12);
    this.history$.next(history);
    this.storage.set('mood-last', snapshot);
    this.storage.set('mood-history', history);
  }

  setCameraEnabled(enabled: boolean): void {
    this.storage.set('camera-enabled', enabled);
  }

  recordKeystroke(key: string): void {
    if (key.length !== 1 || /\s/.test(key)) return;
    const now = Date.now();
    this.keyTimes.push(now);
    while (this.keyTimes.length && now - this.keyTimes[0] > 60_000) this.keyTimes.shift();

  }

  async inferFromTyping(): Promise<Mood> {
    const wordsPerMinute = this.typingWordsPerMinute;
    const response = await this.gemini.generate(
      `Infer a tentative workplace mood from typing rhythm only. Do not diagnose. Return only JSON like {"mood":"calm|stressed|energetic|curious"}. Approximate words per minute: ${wordsPerMinute}. Slow-pace cue: ${this.typingFatigueCue}. Never infer from or request typed content.`,
    );
    const localMood: Mood = this.typingFatigueCue ? 'stressed' : this.mood$.value.mood;
    const mood = this.parseMood(response) ?? localMood;
    this.applyAutomaticMood(mood, 'typing');
    return mood;
  }

  applyAutomaticMood(mood: Mood, source: 'typing' | 'camera' | 'voice'): boolean {
    const now = Date.now();
    if (now < this.manualOverrideUntil || this.mood$.value.mood === mood) return false;

    const snapshot: MoodSnapshot = { mood, score: this.scoreFor(mood), source, createdAt: now };
    this.mood$.next(snapshot);
    this.storage.set('mood-last', snapshot);

    if (now - this.lastAutomaticHistoryAt >= 10 * 60_000) {
      const history = [snapshot, ...this.history$.value].slice(0, 12);
      this.history$.next(history);
      this.storage.set('mood-history', history);
      this.lastAutomaticHistoryAt = now;
    }

    return true;
  }

  async inferFromText(text: string, source: 'text' | 'voice' = 'text'): Promise<Mood> {
    const response = await this.gemini.generate(
      `Infer a tentative workplace mood from this text. Do not diagnose. Return only JSON like {"mood":"calm|stressed|energetic|curious","score":0-100}. Text: ${text.slice(0, 1200)}`,
    );
    const mood = this.parseMood(response) ?? this.inferLocally(text);
    if (source === 'voice') this.applyAutomaticMood(mood, 'voice');
    else this.checkIn(mood, source);
    return mood;
  }

  private scoreFor(mood: Mood): number {
    return mood === 'calm' ? 91 : mood === 'curious' ? 86 : mood === 'energetic' ? 82 : 58;
  }

  private parseMood(response: string | null): Mood | null {
    if (!response) return null;
    try {
      const parsed = JSON.parse(response.replace(/```(?:json)?|```/g, '').trim()) as { mood?: Mood };
      return ['calm', 'stressed', 'energetic', 'curious'].includes(parsed.mood ?? '') ? parsed.mood! : null;
    } catch {
      return null;
    }
  }

  private inferLocally(text: string): Mood {
    const value = text.toLowerCase();
    if (/overwhelm|behind|urgent|exhaust|stuck|anxious|too much/.test(value)) return 'stressed';
    if (/excited|great|done|progress|looking forward|energized/.test(value)) return 'energetic';
    if (/wonder|explore|why|learn|idea|curious/.test(value)) return 'curious';
    return 'calm';
  }
}

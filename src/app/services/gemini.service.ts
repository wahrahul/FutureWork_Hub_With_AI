import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

const GEMINI_MODEL = 'gemini-3.8-flash';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly http = inject(HttpClient);
  private apiKey = '';

  get configured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setApiKey(value: string): void {
    this.apiKey = value.trim();
  }

  async generate(prompt: string): Promise<string | null> {
    if (!this.configured) return null;

    try {
      const response = await firstValueFrom(
        this.http.post<GeminiResponse>(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          { contents: [{ parts: [{ text: prompt }] }] },
          { headers: { 'x-goog-api-key': this.apiKey } },
        ),
      );
      return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || null;
    } catch {
      return null;
    }
  }
}

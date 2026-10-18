import { Injectable } from '@angular/core';

interface VoiceResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface VoiceRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<VoiceResult>;
}

interface VoiceRecognitionError {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
}

@Injectable({ providedIn: 'root' })
export class VoiceDetectionService {
  private recognition?: BrowserSpeechRecognition;
  private active = false;

  start(onTranscript: (transcript: string) => void, onError: () => void): boolean {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) return false;

    this.stop();
    const recognition = new Recognition();
    this.recognition = recognition;
    this.active = true;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language;
    recognition.onresult = (event) => {
      const transcripts: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal && result[0].transcript.trim()) transcripts.push(result[0].transcript.trim());
      }
      if (transcripts.length) onTranscript(transcripts.join(' '));
    };
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') onError();
    };
    recognition.onend = () => {
      if (!this.active) return;
      try {
        recognition.start();
      } catch {
        onError();
      }
    };

    try {
      recognition.start();
      return true;
    } catch {
      this.active = false;
      this.recognition = undefined;
      return false;
    }
  }

  stop(): void {
    this.active = false;
    this.recognition?.stop();
    this.recognition = undefined;
  }
}

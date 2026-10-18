import { Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { Chart as ChartInstance } from 'chart.js';
import { Mood, MoodSnapshot, ProjectItem, TaskItem } from './models';
import { EmotionDetectionService } from './services/emotion-detection.service';
import { GeminiService } from './services/gemini.service';
import { KnowledgeService } from './services/knowledge.service';
import { LocalStorageService } from './services/local-storage.service';
import { MeetingService } from './services/meeting.service';
import { MoodService } from './services/mood.service';
import { TaskService } from './services/task.service';
import { VoiceDetectionService } from './services/voice-detection.service';
import { GeminiSettingsDialog, GeminiSettingsDialogResult } from './gemini-settings-dialog';
import { ClearLocalDataDialog } from './clear-local-data-dialog';

type Section = 'dashboard' | 'mood' | 'tasks' | 'meetings' | 'wellbeing' | 'knowledge';

@Component({
  selector: 'app-root',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    TitleCasePipe,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  private readonly moodState = inject(MoodService);
  readonly taskState = inject(TaskService);
  readonly meetingState = inject(MeetingService);
  private readonly knowledgeState = inject(KnowledgeService);
  private readonly localStorage = inject(LocalStorageService);
  private readonly emotionDetection = inject(EmotionDetectionService);
  private readonly voiceDetection = inject(VoiceDetectionService);
  private readonly dialog = inject(MatDialog);
  readonly gemini = inject(GeminiService);

  readonly activeSection = signal<Section>('dashboard');
  readonly mood = toSignal(this.moodState.mood$, { initialValue: this.moodState.mood$.value });
  readonly moodHistory = toSignal(this.moodState.history$, { initialValue: this.moodState.history$.value });
  readonly tasks = toSignal(this.taskState.tasks$, { initialValue: this.taskState.tasks$.value });
  readonly projects = toSignal(this.taskState.projects$, { initialValue: this.taskState.projects$.value });
  readonly meetings = toSignal(this.meetingState.notes$, { initialValue: this.meetingState.notes$.value });
  readonly recentSearches = toSignal(this.knowledgeState.recent$, { initialValue: this.knowledgeState.recent$.value });
  readonly results = signal<Awaited<ReturnType<KnowledgeService['search']>>>([]);
  readonly completedTasks = computed(() => this.tasks().filter((task) => task.done).length);
  readonly openTasks = computed(() => this.tasks().filter((task) => !task.done));
  readonly moodBadge = computed(() => ({ calm: '🌊', energetic: '⚡', stressed: '🔥', curious: '✨' })[this.mood().mood]);
  readonly todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  readonly sections: Array<{ id: Section; label: string; index: string; icon: string }> = [
    { id: 'dashboard', label: 'Today', index: '01', icon: 'dashboard' },
    { id: 'mood', label: 'Mood', index: '02', icon: 'mood' },
    { id: 'tasks', label: 'Tasks', index: '03', icon: 'task_alt' },
    { id: 'meetings', label: 'Meetings', index: '04', icon: 'groups' },
    { id: 'wellbeing', label: 'Wellbeing', index: '05', icon: 'self_improvement' },
    { id: 'knowledge', label: 'Knowledge', index: '06', icon: 'search' },
  ];

  mobileViewport = typeof window !== 'undefined' && window.innerWidth <= 780;
  sideNavOpened = !this.mobileViewport;

  taskDraft = '';
  projectDraft = 'Personal';
  projectNameDraft = '';
  editingTaskId: string | null = null;
  taskEditTitle = '';
  taskEditProject = '';
  editingProjectId: string | null = null;
  projectEditName = '';
  meetingDraft = '';
  moodDraft = '';
  queryDraft = '';
  readonly feedback = signal('');
  busy = false;
  @ViewChild('cameraView')
  set cameraVideoView(view: ElementRef<HTMLVideoElement> | undefined) {
    this.cameraView = view;
    if (view && this.cameraEnabled && !this.cameraLive) void this.startCamera(view.nativeElement);
  }
  private cameraView?: ElementRef<HTMLVideoElement>;
  @ViewChild('moodChart')
  set moodChartCanvas(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    this.moodChart?.destroy();
    this.moodChart = undefined;
    if (canvas) void this.createMoodChart(canvas.nativeElement);
  }
  cameraEnabled = this.moodState.cameraEnabled;
  cameraLive = false;
  typingDetectionEnabled = this.localStorage.get('typing-analysis-enabled', false);
  voiceDetectionEnabled = false;
  voiceStatus = 'Off';
  typingWordsPerMinute = 0;
  timerSeconds = 0;
  timerRunning = false;
  private timerHandle?: ReturnType<typeof setInterval>;
  private cameraStream?: MediaStream;
  private cameraAutoTimer?: ReturnType<typeof setInterval>;
  private voiceInferenceTimer?: ReturnType<typeof setTimeout>;
  private voiceTranscript = '';
  private lastTypingInferenceAt = 0;
  private typingInferencePending = false;
  private moodChart?: ChartInstance<'line'>;

  selectSection(section: Section): void {
    if (section !== 'mood') {
      this.toggleVoiceDetection(false);
      if (this.cameraEnabled) {
        this.stopCamera();
        this.cameraEnabled = false;
        this.moodState.setCameraEnabled(false);
      }
    }
    this.activeSection.set(section);
    if (this.mobileViewport) this.sideNavOpened = false;
    this.feedback.set('');
  }

  toggleNavigation(): void {
    this.sideNavOpened = !this.sideNavOpened;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const isMobile = window.innerWidth <= 780;
    if (isMobile !== this.mobileViewport) {
      this.mobileViewport = isMobile;
      this.sideNavOpened = !isMobile;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.typingDetectionEnabled || event.repeat) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target instanceof HTMLInputElement && target.type === 'password') return;

    this.moodState.recordKeystroke(event.key);
    this.typingWordsPerMinute = this.moodState.typingWordsPerMinute;
    if (this.moodState.typingSampleCount < 20 || this.typingWordsPerMinute === 0 || this.typingInferencePending) return;
    if (Date.now() - this.lastTypingInferenceAt < 45_000) return;

    this.lastTypingInferenceAt = Date.now();
    this.typingInferencePending = true;
    void this.moodState.inferFromTyping().then((mood) => {
      this.refreshMoodChart();
      this.feedback.set(`Typing rhythm suggests ${mood}; use your own judgment.`);
    }).finally(() => {
      this.typingInferencePending = false;
    });
  }

  setMood(mood: Mood): void {
    this.moodState.checkIn(mood);
    this.refreshMoodChart();
    this.feedback.set(`Check-in saved. Your ${mood} theme is active.`);
  }

  async inferMood(): Promise<void> {
    if (!this.moodDraft.trim()) return;
    this.busy = true;
    try {
      const mood = await this.moodState.inferFromText(this.moodDraft);
      this.refreshMoodChart();
      this.feedback.set(`Your words sound ${mood}. Take that as a gentle signal, not a diagnosis.`);
    } finally {
      this.busy = false;
    }
  }

  toggleTypingDetection(enabled: boolean): void {
    this.typingDetectionEnabled = enabled;
    this.localStorage.set('typing-analysis-enabled', enabled);
    this.feedback.set(enabled ? 'Typing rhythm analysis is on; typed content is not collected.' : 'Typing rhythm analysis is off.');
  }

  toggleVoiceDetection(enabled: boolean): void {
    if (!enabled) {
      this.voiceDetectionEnabled = false;
      this.voiceStatus = 'Off';
      this.voiceDetection.stop();
      if (this.voiceInferenceTimer) clearTimeout(this.voiceInferenceTimer);
      this.voiceInferenceTimer = undefined;
      this.voiceTranscript = '';
      return;
    }

    const started = this.voiceDetection.start(
      (transcript) => this.queueVoiceTranscript(transcript),
      () => {
        this.voiceDetectionEnabled = false;
        this.voiceStatus = 'Unavailable';
        this.voiceDetection.stop();
        this.feedback.set('Voice recognition stopped. Check your browser microphone and speech-recognition support.');
      },
    );
    this.voiceDetectionEnabled = started;
    this.voiceStatus = started ? 'Listening' : 'Unavailable in this browser';
    if (!started) this.feedback.set('Voice recognition is not available in this browser.');
  }

  private queueVoiceTranscript(transcript: string): void {
    this.voiceTranscript = `${this.voiceTranscript} ${transcript}`.trim().slice(-1000);
    if (this.voiceInferenceTimer) clearTimeout(this.voiceInferenceTimer);
    this.voiceInferenceTimer = setTimeout(() => void this.inferVoiceMood(), 8_000);
  }

  private async inferVoiceMood(): Promise<void> {
    const transcript = this.voiceTranscript;
    this.voiceTranscript = '';
    this.voiceInferenceTimer = undefined;
    if (!transcript || !this.voiceDetectionEnabled) return;

    const mood = await this.moodState.inferFromText(transcript, 'voice');
    this.refreshMoodChart();
    this.voiceStatus = `Last language cue: ${mood}`;
    this.feedback.set(`Voice language cues suggest ${mood}; this is not an analysis of vocal tone.`);
  }

  get typingFatigueCue(): boolean {
    return this.moodState.typingFatigueCue;
  }

  addTask(): void {
    this.taskState.add(this.taskDraft, this.projectDraft || 'Personal');
    this.taskDraft = '';
  }

  beginTaskEdit(task: TaskItem): void {
    this.editingTaskId = task.id;
    this.taskEditTitle = task.title;
    this.taskEditProject = task.project;
  }

  saveTaskEdit(id: string): void {
    this.taskState.updateTask(id, this.taskEditTitle, this.taskEditProject);
    this.editingTaskId = null;
  }

  addProject(): void {
    this.taskState.addProject(this.projectNameDraft);
    this.projectNameDraft = '';
  }

  beginProjectEdit(project: ProjectItem): void {
    this.editingProjectId = project.id;
    this.projectEditName = project.name;
  }

  saveProjectEdit(id: string): void {
    this.taskState.renameProject(id, this.projectEditName);
    this.editingProjectId = null;
  }

  countProjectTasks(name: string): number {
    return this.tasks().filter((task) => task.project === name).length;
  }

  async prioritizeTasks(): Promise<void> {
    this.busy = true;
    await this.taskState.prioritize();
    this.busy = false;
    this.feedback.set(this.gemini.configured ? 'Tasks reprioritized with Gemini.' : 'Tasks ordered locally. Add a Gemini key for AI prioritization.');
  }

  async saveMeeting(): Promise<void> {
    if (!this.meetingDraft.trim()) return;
    this.busy = true;
    await this.meetingState.create(this.meetingDraft);
    this.meetingDraft = '';
    this.busy = false;
    this.feedback.set(this.gemini.configured ? 'Notes summarized and saved.' : 'Notes saved with a local summary.');
  }

  async searchKnowledge(query = this.queryDraft): Promise<void> {
    if (!query.trim()) return;
    this.queryDraft = query;
    this.busy = true;
    this.results.set(await this.knowledgeState.search(query, this.tasks(), this.meetings(), this.mood().mood));
    this.busy = false;
  }

  async openGeminiSettings(): Promise<void> {
    const result = await firstValueFrom(this.dialog.open<
      GeminiSettingsDialog,
      { configured: boolean },
      GeminiSettingsDialogResult
    >(GeminiSettingsDialog, {
      width: 'min(480px, calc(100vw - 32px))',
      maxWidth: 'none',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      data: { configured: this.gemini.configured },
    }).afterClosed());

    if (!result) return;
    if (result.action === 'clear') {
      this.gemini.setApiKey('');
      setTimeout(() => this.feedback.set('Gemini key cleared.'));
      return;
    }

    this.gemini.setApiKey(result.apiKey);
    setTimeout(() => this.feedback.set('Gemini is ready for this session. The key is not stored.'));
  }

  toggleCamera(enabled: boolean): void {
    this.cameraEnabled = enabled;
    this.moodState.setCameraEnabled(enabled);
    if (!enabled) this.stopCamera();
  }

  async startCamera(video: HTMLVideoElement): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!this.cameraEnabled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.cameraStream = stream;
      video.srcObject = stream;
      await video.play();
      this.cameraLive = true;
      this.feedback.set('Camera is on. Frames stay in this browser.');
      this.cameraAutoTimer = setInterval(() => void this.analyzeCamera(true), 15_000);
      void this.analyzeCamera(true);
    } catch {
      this.cameraEnabled = false;
      this.cameraLive = false;
      this.moodState.setCameraEnabled(false);
      this.feedback.set('Camera permission was not available. You can still use text and typing check-ins.');
    }
  }

  async analyzeCamera(automatic = false): Promise<void> {
    const video = this.cameraView?.nativeElement;
    if (!video || !this.cameraLive) return;
    this.busy = true;
    try {
      const mood = await this.emotionDetection.estimate(video);
      if (!mood) {
        this.feedback.set('No clear face signal found. Try again or use a self check-in.');
      } else {
        const applied = automatic
          ? this.moodState.applyAutomaticMood(mood, 'camera')
          : (this.moodState.checkIn(mood, 'camera'), true);
        if (applied) {
          this.refreshMoodChart();
          this.feedback.set(`A local facial-expression cue suggests ${mood}. This is only a rough signal.`);
        }
      }
    } catch {
      this.feedback.set('The on-device model could not load. Check your connection and try again.');
    } finally {
      this.busy = false;
    }
  }

  stopCamera(): void {
    if (this.cameraAutoTimer) clearInterval(this.cameraAutoTimer);
    this.cameraAutoTimer = undefined;
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;
    this.cameraLive = false;
  }

  startTimer(minutes: number): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerSeconds = minutes * 60;
    this.timerRunning = true;
    this.timerHandle = setInterval(() => {
      this.timerSeconds = Math.max(0, this.timerSeconds - 1);
      if (this.timerSeconds === 0) this.stopTimer();
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = undefined;
    this.timerRunning = false;
  }

  get timerDisplay(): string {
    const minutes = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.timerSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  async clearLocalData(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open<ClearLocalDataDialog, void, boolean>(ClearLocalDataDialog, {
      width: 'min(460px, calc(100vw - 32px))',
      maxWidth: 'none',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    }).afterClosed());
    if (!confirmed) return;

    this.stopTimer();
    this.stopCamera();
    this.toggleVoiceDetection(false);
    await this.localStorage.clearAppData();
    window.location.reload();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopCamera();
    this.toggleVoiceDetection(false);
    this.emotionDetection.dispose();
    this.moodChart?.destroy();
  }

  private async createMoodChart(canvas: HTMLCanvasElement): Promise<void> {
    const { default: Chart } = await import('chart.js/auto');
    if (!canvas.isConnected) return;
    const entries = [...this.moodHistory()].reverse();
    this.moodChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: entries.map((entry) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(entry.createdAt)),
        datasets: [{
          data: entries.map((entry) => entry.score),
          borderColor: this.chartColor(this.mood().mood),
          backgroundColor: 'rgba(82, 121, 103, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: entries.map((entry) => this.chartColor(entry.mood)),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#77857d', font: { family: 'DM Sans', size: 9 } } },
          y: { min: 0, max: 100, ticks: { stepSize: 25, color: '#77857d', font: { family: 'DM Sans', size: 9 } }, grid: { color: '#e6ebe4' }, border: { display: false } },
        },
      },
    });
  }

  private refreshMoodChart(): void {
    if (!this.moodChart) return;
    const entries = [...this.moodHistory()].reverse();
    this.moodChart.data.labels = entries.map((entry) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(entry.createdAt));
    const dataset = this.moodChart.data.datasets[0];
    dataset.data = entries.map((entry) => entry.score);
    dataset.borderColor = this.chartColor(this.mood().mood);
    dataset.pointBackgroundColor = entries.map((entry) => this.chartColor(entry.mood));
    this.moodChart.update();
  }

  private chartColor(mood: MoodSnapshot['mood']): string {
    return { calm: '#6f9b7e', stressed: '#d08b78', energetic: '#c69f41', curious: '#7794bf' }[mood];
  }
}

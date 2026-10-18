import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProjectItem, TaskItem, TaskPriority } from '../models';
import { GeminiService } from './gemini.service';
import { LocalStorageService } from './local-storage.service';

const starterTasks: TaskItem[] = [
  { id: 'focus-plan', title: 'Shape the weekly focus plan', project: 'Team rhythm', priority: 'high', done: false, createdAt: Date.now() },
  { id: 'review-notes', title: 'Review research notes', project: 'Product strategy', priority: 'medium', done: false, createdAt: Date.now() },
  { id: 'walkthrough', title: 'Share prototype walkthrough', project: 'Future of work', priority: 'low', done: true, createdAt: Date.now() },
];
const starterProjects: ProjectItem[] = [
  { id: 'team-rhythm', name: 'Team rhythm' },
  { id: 'product-strategy', name: 'Product strategy' },
  { id: 'future-of-work', name: 'Future of work' },
  { id: 'personal', name: 'Personal' },
];

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly storage = inject(LocalStorageService);
  private readonly gemini = inject(GeminiService);
  readonly tasks$ = new BehaviorSubject<TaskItem[]>(this.storage.get('tasks', starterTasks));
  readonly projects$ = new BehaviorSubject<ProjectItem[]>(this.storage.get('projects', starterProjects));

  constructor() {
    const initialTasks = this.tasks$.value;
    const initialProjects = this.projects$.value;
    void this.storage.hydrate('tasks', initialTasks).then((tasks) => {
      if (this.tasks$.value === initialTasks) this.tasks$.next(tasks);
    });
    void this.storage.hydrate('projects', initialProjects).then((projects) => {
      if (this.projects$.value === initialProjects) this.projects$.next(projects);
    });
  }

  add(title: string, project = 'Personal'): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (!this.projects$.value.some((item) => item.name.toLowerCase() === project.toLowerCase())) this.addProject(project);
    this.update([
      { id: this.id(), title: cleanTitle, project, priority: 'medium', done: false, createdAt: Date.now() },
      ...this.tasks$.value,
    ]);
  }

  toggle(id: string): void {
    this.update(this.tasks$.value.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  remove(id: string): void {
    this.update(this.tasks$.value.filter((task) => task.id !== id));
  }

  updateTask(id: string, title: string, project: string): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (!this.projects$.value.some((item) => item.name.toLowerCase() === project.toLowerCase())) this.addProject(project);
    this.update(this.tasks$.value.map((task) => task.id === id ? { ...task, title: cleanTitle, project } : task));
  }

  addProject(name: string): void {
    const cleanName = name.trim();
    if (!cleanName || this.projects$.value.some((project) => project.name.toLowerCase() === cleanName.toLowerCase())) return;
    const projects = [...this.projects$.value, { id: this.id(), name: cleanName }];
    this.projects$.next(projects);
    this.storage.set('projects', projects);
  }

  renameProject(id: string, name: string): void {
    const cleanName = name.trim();
    const project = this.projects$.value.find((item) => item.id === id);
    if (!project || !cleanName || this.projects$.value.some((item) => item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase())) return;
    const previousName = project.name;
    const projects = this.projects$.value.map((item) => item.id === id ? { ...item, name: cleanName } : item);
    this.projects$.next(projects);
    this.storage.set('projects', projects);
    this.update(this.tasks$.value.map((task) => task.project === previousName ? { ...task, project: cleanName } : task));
  }

  removeProject(id: string): void {
    const project = this.projects$.value.find((item) => item.id === id);
    if (!project || project.name === 'Personal') return;
    const projects = this.projects$.value.filter((item) => item.id !== id);
    this.projects$.next(projects);
    this.storage.set('projects', projects);
    this.update(this.tasks$.value.map((task) => task.project === project.name ? { ...task, project: 'Personal' } : task));
  }

  async prioritize(): Promise<void> {
    const tasks = this.tasks$.value.filter((task) => !task.done);
    const response = await this.gemini.generate(
      `Prioritize these work tasks. Return only a JSON array of objects with id and priority (high, medium, low). Tasks: ${JSON.stringify(tasks)}`,
    );
    if (!response) {
      const ordered = [...this.tasks$.value].sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high'));
      this.update(ordered);
      return;
    }

    try {
      const priorities = JSON.parse(response.replace(/```(?:json)?|```/g, '').trim()) as Array<{ id: string; priority: TaskPriority }>;
      const byId = new Map(priorities.map((item) => [item.id, item.priority]));
      this.update(this.tasks$.value.map((task) => ({ ...task, priority: byId.get(task.id) ?? task.priority }))
        .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high')));
    } catch {
      return;
    }
  }

  private update(tasks: TaskItem[]): void {
    this.tasks$.next(tasks);
    this.storage.set('tasks', tasks);
  }

  private id(): string {
    return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

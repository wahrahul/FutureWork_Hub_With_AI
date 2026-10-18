import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let tasks: TaskService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    await TestBed.inject(LocalStorageService).clearAppData();
    tasks = TestBed.inject(TaskService);
  });

  it('creates, edits, completes, and removes a task while persisting changes', () => {
    tasks.add('Write a brief', 'Planning');
    const created = tasks.tasks$.value[0];

    expect(created.title).toBe('Write a brief');
    expect(created.project).toBe('Planning');
    expect(localStorage.getItem('future-work-hub:tasks')).toContain('Write a brief');

    tasks.updateTask(created.id, 'Review the brief', 'Planning');
    tasks.toggle(created.id);
    expect(tasks.tasks$.value[0]).toMatchObject({ title: 'Review the brief', done: true });

    tasks.remove(created.id);
    expect(tasks.tasks$.value.some((task) => task.id === created.id)).toBe(false);
  });

  it('renames projects across existing tasks and prevents removing Personal', () => {
    tasks.add('Prepare notes', 'Planning');
    const project = tasks.projects$.value.find((item) => item.name === 'Planning')!;

    tasks.renameProject(project.id, 'Research');
    expect(tasks.tasks$.value[0].project).toBe('Research');

    const personal = tasks.projects$.value.find((item) => item.name === 'Personal')!;
    tasks.removeProject(personal.id);
    expect(tasks.projects$.value.some((item) => item.id === personal.id)).toBe(true);
  });
});

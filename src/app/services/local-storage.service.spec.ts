import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService.clearAppData', () => {
  let storage: LocalStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    storage = TestBed.inject(LocalStorageService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('removes all app-prefixed keys but preserves unrelated browser data', async () => {
    localStorage.setItem('future-work-hub:tasks', '[]');
    localStorage.setItem('future-work-hub:mood-history', '[]');
    localStorage.setItem('another-app:settings', 'keep');

    await storage.clearAppData();

    expect(localStorage.getItem('future-work-hub:tasks')).toBeNull();
    expect(localStorage.getItem('future-work-hub:mood-history')).toBeNull();
    expect(localStorage.getItem('another-app:settings')).toBe('keep');
  });
});

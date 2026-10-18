import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';
import { MoodService } from './mood.service';

describe('MoodService automatic suggestions', () => {
  let moods: MoodService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    await TestBed.inject(LocalStorageService).clearAppData();
    moods = TestBed.inject(MoodService);
  });

  it('lets a manual check-in take priority over automatic suggestions', () => {
    moods.checkIn('calm');

    expect(moods.applyAutomaticMood('stressed', 'typing')).toBe(false);
    expect(moods.mood$.value.mood).toBe('calm');
  });

  it('updates current mood while throttling automatic history entries', () => {
    expect(moods.applyAutomaticMood('stressed', 'camera')).toBe(true);
    expect(moods.history$.value).toHaveLength(2);

    expect(moods.applyAutomaticMood('energetic', 'typing')).toBe(true);
    expect(moods.mood$.value).toMatchObject({ mood: 'energetic', source: 'typing' });
    expect(moods.history$.value).toHaveLength(2);
  });
});

# FutureWork_Hub_With_AI

A private, mood-aware productivity workspace built with Angular 21. The dashboard brings together mood check-ins, tasks and projects, meeting notes, wellbeing timers, and a searchable knowledge hub.

## Run locally

From the project root:

```sh
npm start
```

Open `http://localhost:4200`.

## Gemini setup

Open the sparkle control in the top bar and enter a Gemini API key to enable text mood inference, task prioritization, meeting summaries, and semantic search. The app uses `gemini-3.8-flash`; Google lists its tokens as free of charge on the Free tier, subject to account/project rate limits and availability. Google may use Free-tier prompts and responses to improve its products, so do not submit confidential or personal work data. The key is held in memory for the current tab only and is never written to LocalStorage. Without a key, these workflows use local heuristics and remain available offline.

## Privacy and storage

Tasks, mood check-ins, meeting notes, preferences, and recent searches are stored in namespaced LocalStorage and mirrored to IndexedDB on this device. The Angular service worker caches the production app shell for offline reopening. Webcam access is off by default and requires an explicit opt-in. When enabled, facial landmarks are estimated locally; video frames are not saved or uploaded. The model loads from TensorFlow Hub when used, so camera inference may need network access. Mood and typing signals are lightweight wellbeing cues, not clinical assessments.

Automatic typing analysis is also opt-in and uses cadence only, not typed content. Voice cues require a separate microphone opt-in; browser speech recognition may send audio to the browser's recognition provider, while any Gemini request receives only a temporary transcript. Automatic mood suggestions are rate-limited, and manual check-ins take priority.

Use **Clear local data** in the sidebar to remove this app's stored data without clearing unrelated browser storage.

## Feature architecture

Mood, task, meeting, persistence, and knowledge workflows have separate Angular services, with Material providing the adaptive theme and toolbar. This remains one deployable Angular app; remote micro-frontend federation is not configured because the current workspace has no independently deployed feature apps.

## Build and test

```sh
npm run build
npm test -- --watch=false
```

Production output is written to `dist/future-work-hub-with-ai`.

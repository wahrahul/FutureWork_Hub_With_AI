import { Injectable } from '@angular/core';

const STORAGE_PREFIX = 'future-work-hub:';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private database?: Promise<IDBDatabase | undefined>;

  get<T>(key: string, fallback: T): T {
    try {
      const value = this.storage()?.getItem(this.key(key));
      return value === null || value === undefined ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      this.storage()?.setItem(this.key(key), JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing or when the quota is full.
    }
    void this.persistLarge(key, value);
  }

  async hydrate<T>(key: string, fallback: T): Promise<T> {
    const localValue = this.get<T | undefined>(key, undefined);
    if (localValue !== undefined) return localValue;
    const archivedValue = await this.readLarge<T>(key);
    if (archivedValue !== undefined) this.set(key, archivedValue);
    return archivedValue ?? fallback;
  }

  remove(key: string): void {
    try {
      this.storage()?.removeItem(this.key(key));
    } catch {
      return;
    }
    void this.deleteLarge(key);
  }

  async clearAppData(): Promise<void> {
    try {
      const storage = this.storage();
      if (storage) {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
        }
      }
    } catch {
      // IndexedDB cleanup should still run when LocalStorage is unavailable.
    } finally {
      await this.clearLarge();
    }
  }

  private key(key: string): string {
    return `${STORAGE_PREFIX}${key}`;
  }

  private storage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }

  private openDatabase(): Promise<IDBDatabase | undefined> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);
    if (!this.database) {
      this.database = new Promise((resolve) => {
        const request = indexedDB.open('future-work-hub', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('workspace')) request.result.createObjectStore('workspace');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
    }
    return this.database;
  }

  private async persistLarge<T>(key: string, value: T): Promise<void> {
    try {
      const database = await this.openDatabase();
      if (!database) return;
      await new Promise<void>((resolve) => {
        const transaction = database.transaction('workspace', 'readwrite');
        transaction.objectStore('workspace').put(value, this.key(key));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    } catch {
      return;
    }
  }

  private async readLarge<T>(key: string): Promise<T | undefined> {
    try {
      const database = await this.openDatabase();
      if (!database) return undefined;
      return await new Promise<T | undefined>((resolve) => {
        const request = database.transaction('workspace', 'readonly').objectStore('workspace').get(this.key(key));
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => resolve(undefined);
      });
    } catch {
      return undefined;
    }
  }

  private async deleteLarge(key: string): Promise<void> {
    try {
      const database = await this.openDatabase();
      if (!database) return;
      database.transaction('workspace', 'readwrite').objectStore('workspace').delete(this.key(key));
    } catch {
      return;
    }
  }

  private async clearLarge(): Promise<void> {
    try {
      const database = await this.openDatabase();
      if (!database) return;
      await new Promise<void>((resolve) => {
        const transaction = database.transaction('workspace', 'readwrite');
        const store = transaction.objectStore('workspace');
        const request = store.getAllKeys();
        request.onsuccess = () => {
          for (const key of request.result) {
            if (typeof key === 'string' && key.startsWith(STORAGE_PREFIX)) store.delete(key);
          }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    } catch {
      return;
    }
  }
}

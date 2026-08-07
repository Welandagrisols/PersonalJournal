import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalEntry, JournalSettings } from '@/types/journal';
import {
  deleteCloudEntry,
  getCloudSettings,
  isSupabaseConfigured,
  listCloudEntries,
  upsertCloudEntry,
  upsertCloudSettings,
} from '@/lib/supabase';

const ENTRIES_KEY = '@pages/entries';
const SETTINGS_KEY = '@pages/settings';

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

function buildSeedEntries(): JournalEntry[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  return [
    {
      id: generateId(),
      type: 'freewrite',
      title: 'The morning light',
      body: 'There is something about early morning light that makes everything feel possible. The soft amber glow through the curtains, the quiet before the world wakes — I want to hold onto this stillness.',
      mood: 'calm',
      tags: ['morning', 'reflection'],
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
      isFavorite: true,
    },
    {
      id: generateId(),
      type: 'gratitude',
      title: 'Three small things',
      body: '',
      mood: 'grateful',
      tags: [],
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: twoDaysAgo.toISOString(),
      isFavorite: false,
      gratitudeItems: [
        'A warm cup of tea in the afternoon',
        'A message from an old friend',
        'The sound of rain on the window',
      ],
    },
    {
      id: generateId(),
      type: 'mood',
      title: 'Feeling centered',
      body: 'Slow day, but a good one. I feel grounded in a way I have not in a while.',
      mood: 'content',
      tags: ['self-care'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isFavorite: false,
    },
  ];
}

interface JournalContextValue {
  entries: JournalEntry[];
  settings: JournalSettings;
  isLoaded: boolean;
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'offline';
  createEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEntry: (id: string, updates: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<JournalSettings>) => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [settings, setSettings] = useState<JournalSettings>({ userName: '', theme: 'system' });
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'offline'
  >('local');

  const persistEntries = useCallback(async (updated: JournalEntry[]) => {
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(updated));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [entriesRaw, settingsRaw] = await Promise.all([
          AsyncStorage.getItem(ENTRIES_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        const loadedEntries: JournalEntry[] = entriesRaw ? JSON.parse(entriesRaw) : null;
        const loadedSettings: JournalSettings = settingsRaw ? JSON.parse(settingsRaw) : null;
        const localEntries =
          loadedEntries && loadedEntries.length > 0 ? loadedEntries : buildSeedEntries();
        const localSettings = loadedSettings ?? { userName: '', theme: 'system' as const };

        setEntries(localEntries);
        setSettings(localSettings);

        if (!loadedEntries || loadedEntries.length === 0) {
          await persistEntries(localEntries);
        }
        if (!loadedSettings) {
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(localSettings));
        }

        if (isSupabaseConfigured) {
          setCloudSyncStatus('syncing');
          try {
            const [cloudEntries, cloudSettings] = await Promise.all([
              listCloudEntries(),
              getCloudSettings(),
            ]);
            const mergedById = new Map(cloudEntries.map(entry => [entry.id, entry]));
            const entriesToUpload: JournalEntry[] = [];

            for (const localEntry of localEntries) {
              const cloudEntry = mergedById.get(localEntry.id);
              if (!cloudEntry || localEntry.updatedAt > cloudEntry.updatedAt) {
                mergedById.set(localEntry.id, localEntry);
                entriesToUpload.push(localEntry);
              }
            }

            if (entriesToUpload.length > 0) {
              await Promise.all(entriesToUpload.map(upsertCloudEntry));
            }

            const mergedEntries = Array.from(mergedById.values()).sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            setEntries(mergedEntries);
            await persistEntries(mergedEntries);

            if (cloudSettings) {
              setSettings(cloudSettings);
              await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cloudSettings));
            } else {
              await upsertCloudSettings(localSettings);
            }
            setCloudSyncStatus('synced');
          } catch {
            // Supabase is optional until its SQL schema and anonymous auth are enabled.
            setCloudSyncStatus('offline');
          }
        }
      } catch {
        const seed = buildSeedEntries();
        setEntries(seed);
        setCloudSyncStatus('offline');
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, [persistEntries]);

  const createEntry = useCallback(
    async (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      const id = generateId();
      const now = new Date().toISOString();
      const newEntry: JournalEntry = { ...entry, id, createdAt: now, updatedAt: now };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      await persistEntries(updated);
      if (isSupabaseConfigured) {
        try {
          await upsertCloudEntry(newEntry);
          setCloudSyncStatus('synced');
        } catch {
          setCloudSyncStatus('offline');
        }
      }
      return id;
    },
    [entries, persistEntries],
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => {
      const updated = entries.map(e =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e,
      );
      setEntries(updated);
      await persistEntries(updated);
      if (isSupabaseConfigured) {
        try {
          const updatedEntry = updated.find(entry => entry.id === id);
          if (updatedEntry) await upsertCloudEntry(updatedEntry);
          setCloudSyncStatus('synced');
        } catch {
          setCloudSyncStatus('offline');
        }
      }
    },
    [entries, persistEntries],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const updated = entries.filter(e => e.id !== id);
      setEntries(updated);
      await persistEntries(updated);
      if (isSupabaseConfigured) {
        try {
          await deleteCloudEntry(id);
          setCloudSyncStatus('synced');
        } catch {
          setCloudSyncStatus('offline');
        }
      }
    },
    [entries, persistEntries],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const updated = entries.map(e =>
        e.id === id ? { ...e, isFavorite: !e.isFavorite, updatedAt: new Date().toISOString() } : e,
      );
      setEntries(updated);
      await persistEntries(updated);
      if (isSupabaseConfigured) {
        try {
          const updatedEntry = updated.find(entry => entry.id === id);
          if (updatedEntry) await upsertCloudEntry(updatedEntry);
          setCloudSyncStatus('synced');
        } catch {
          setCloudSyncStatus('offline');
        }
      }
    },
    [entries, persistEntries],
  );

  const updateSettings = useCallback(
    async (updates: Partial<JournalSettings>) => {
      const updated = { ...settings, ...updates };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      if (isSupabaseConfigured) {
        try {
          await upsertCloudSettings(updated);
          setCloudSyncStatus('synced');
        } catch {
          setCloudSyncStatus('offline');
        }
      }
    },
    [settings],
  );

  return (
    <JournalContext.Provider
      value={{
        entries,
        settings,
        isLoaded,
        cloudSyncStatus,
        createEntry,
        updateEntry,
        deleteEntry,
        toggleFavorite,
        updateSettings,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider');
  return ctx;
}

export function calculateStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cursor = new Date(today);
  const todayStr = cursor.toDateString();
  const hasToday = entries.some(e => new Date(e.createdAt).toDateString() === todayStr);
  if (!hasToday) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const str = cursor.toDateString();
    const has = entries.some(e => new Date(e.createdAt).toDateString() === str);
    if (!has) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

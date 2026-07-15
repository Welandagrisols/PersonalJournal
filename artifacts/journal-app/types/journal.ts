export type EntryType = 'freewrite' | 'gratitude' | 'dream' | 'mood' | 'prompt';

export interface JournalEntry {
  id: string;
  type: EntryType;
  title: string;
  body: string;
  mood: string;
  tags: string[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  isFavorite: boolean;
  gratitudeItems?: string[];
  promptQuestion?: string;
}

export interface JournalSettings {
  userName: string;
  theme: 'light' | 'dark' | 'system';
}

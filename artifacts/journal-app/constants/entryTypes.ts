import type { EntryType } from '@/types/journal';

export interface EntryTypeConfig {
  key: EntryType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const ENTRY_TYPES: EntryTypeConfig[] = [
  {
    key: 'freewrite',
    label: 'Free Write',
    icon: 'pencil-outline',
    color: '#C4714A',
    description: 'Write freely',
  },
  {
    key: 'gratitude',
    label: 'Gratitude',
    icon: 'heart-circle-outline',
    color: '#E07B5A',
    description: 'What you are grateful for',
  },
  {
    key: 'dream',
    label: 'Dream',
    icon: 'moon-outline',
    color: '#8E6BB5',
    description: 'Log a dream',
  },
  {
    key: 'mood',
    label: 'Mood',
    icon: 'pulse-outline',
    color: '#5BA4CF',
    description: 'Check in with yourself',
  },
  {
    key: 'prompt',
    label: 'Prompt',
    icon: 'chatbubble-ellipses-outline',
    color: '#6BAA75',
    description: 'Answer a daily question',
  },
];

export const getEntryTypeConfig = (type: EntryType): EntryTypeConfig =>
  ENTRY_TYPES.find(t => t.key === type) ?? ENTRY_TYPES[0];

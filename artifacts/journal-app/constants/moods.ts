export interface Mood {
  key: string;
  label: string;
  icon: string;
  color: string;
}

export const MOODS: Mood[] = [
  { key: 'joyful',     label: 'Joyful',     icon: 'sunny-outline',         color: '#F4A623' },
  { key: 'calm',       label: 'Calm',       icon: 'water-outline',         color: '#5BA4CF' },
  { key: 'grateful',   label: 'Grateful',   icon: 'heart-outline',         color: '#E07B5A' },
  { key: 'reflective', label: 'Reflective', icon: 'moon-outline',          color: '#8E6BB5' },
  { key: 'anxious',    label: 'Anxious',    icon: 'thunderstorm-outline',  color: '#E8A838' },
  { key: 'sad',        label: 'Sad',        icon: 'rainy-outline',         color: '#7B9EC9' },
  { key: 'excited',    label: 'Excited',    icon: 'flash-outline',         color: '#F06292' },
  { key: 'tired',      label: 'Tired',      icon: 'bed-outline',           color: '#A0887A' },
  { key: 'content',    label: 'Content',    icon: 'leaf-outline',          color: '#6BAA75' },
  { key: 'nostalgic',  label: 'Nostalgic',  icon: 'time-outline',          color: '#B07A5C' },
];

export const getMood = (key: string): Mood | undefined => MOODS.find(m => m.key === key);

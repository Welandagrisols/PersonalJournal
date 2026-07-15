import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getEntryTypeConfig } from '@/constants/entryTypes';
import { getMood } from '@/constants/moods';
import type { JournalEntry } from '@/types/journal';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - entryDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getPreviewText(entry: JournalEntry): string {
  if (entry.type === 'gratitude' && entry.gratitudeItems?.length) {
    return entry.gratitudeItems.filter(Boolean).join(' · ');
  }
  return entry.body || '';
}

interface EntryCardProps {
  entry: JournalEntry;
  onPress: () => void;
  onFavorite: () => void;
}

export default function EntryCard({ entry, onPress, onFavorite }: EntryCardProps) {
  const colors = useColors();
  const typeConfig = getEntryTypeConfig(entry.type);
  const moodData = getMood(entry.mood);
  const preview = getPreviewText(entry);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
        Platform.OS !== 'web' && styles.shadow,
      ]}
    >
      {/* Type stripe */}
      <View style={[styles.typeStripe, { backgroundColor: typeConfig.color, borderRadius: colors.radius }]} />

      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '22' }]}>
            <Ionicons name={typeConfig.icon as any} size={13} color={typeConfig.color} />
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
          </Text>
        </View>

        {/* Title */}
        {entry.title ? (
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {entry.title}
          </Text>
        ) : null}

        {/* Preview */}
        {preview ? (
          <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}

        {/* Footer row */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            {moodData ? (
              <View style={[styles.moodPill, { backgroundColor: moodData.color + '22' }]}>
                <Ionicons name={moodData.icon as any} size={12} color={moodData.color} />
                <Text style={[styles.moodText, { color: moodData.color }]}>{moodData.label}</Text>
              </View>
            ) : null}
            {entry.tags.slice(0, 2).map(tag => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>#{tag}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={onFavorite} hitSlop={8}>
            <Ionicons
              name={entry.isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={entry.isFavorite ? '#E07B5A' : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
  },
  shadow: {
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  typeStripe: {
    width: 4,
    borderRadius: 0,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
  preview: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  moodText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});

import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useJournal } from '@/context/JournalContext';
import { getEntryTypeConfig } from '@/constants/entryTypes';
import { getMood } from '@/constants/moods';

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { entries, toggleFavorite, deleteEntry } = useJournal();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const entry = entries.find(e => e.id === id);

  if (!entry) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Entry not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const typeConfig = getEntryTypeConfig(entry.type);
  const moodData = getMood(entry.mood);

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'This entry will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(entry.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={handleFavorite} hitSlop={8}>
            <Ionicons
              name={entry.isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={entry.isFavorite ? '#E07B5A' : colors.foreground}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/entry/new?id=${entry.id}` as any)}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Type + date row */}
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '22' }]}>
            <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          {moodData && (
            <View style={[styles.moodBadge, { backgroundColor: moodData.color + '22' }]}>
              <Ionicons name={moodData.icon as any} size={14} color={moodData.color} />
              <Text style={[styles.moodBadgeText, { color: moodData.color }]}>{moodData.label}</Text>
            </View>
          )}
        </View>

        {/* Date */}
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          {formatFullDate(entry.createdAt)} · {formatTime(entry.createdAt)}
        </Text>

        {/* Title */}
        {entry.title ? (
          <Text style={[styles.title, { color: colors.foreground }]}>{entry.title}</Text>
        ) : null}

        {/* Prompt question */}
        {entry.type === 'prompt' && entry.promptQuestion ? (
          <View style={[styles.promptBox, { backgroundColor: typeConfig.color + '15', borderLeftColor: typeConfig.color }]}>
            <Text style={[styles.promptText, { color: typeConfig.color }]}>{entry.promptQuestion}</Text>
          </View>
        ) : null}

        {/* Gratitude items */}
        {entry.type === 'gratitude' && entry.gratitudeItems?.length ? (
          <View style={styles.gratitudeList}>
            {entry.gratitudeItems.filter(Boolean).map((item, i) => (
              <View key={i} style={[styles.gratitudeItem, { borderLeftColor: typeConfig.color }]}>
                <Text style={[styles.gratitudeNumber, { color: typeConfig.color }]}>{i + 1}</Text>
                <Text style={[styles.gratitudeText, { color: colors.foreground }]}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Body */}
        {entry.body ? (
          <Text style={[styles.body, { color: colors.foreground }]}>{entry.body}</Text>
        ) : null}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {entry.tags.map(tag => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  backLink: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  moodBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 16,
  },
  promptBox: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  gratitudeList: {
    gap: 12,
    marginBottom: 16,
  },
  gratitudeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 2,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  gratitudeNumber: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    width: 20,
  },
  gratitudeText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  body: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    lineHeight: 28,
    letterSpacing: 0.1,
    marginBottom: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});

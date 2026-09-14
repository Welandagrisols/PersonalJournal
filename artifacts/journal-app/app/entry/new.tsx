import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useJournal } from '@/context/JournalContext';
import { useAuth } from '@/context/AuthContext';
import { ENTRY_TYPES, getEntryTypeConfig } from '@/constants/entryTypes';
import { MOODS } from '@/constants/moods';
import { getDailyPrompt } from '@/constants/prompts';
import type { EntryType } from '@/types/journal';
import AIComposer from '@/components/AIComposer';

interface EntryDraft {
  type: EntryType;
  title: string;
  body: string;
  mood: string;
  tagsInput: string;
  gratitudeItems: string[];
  savedAt: string;
}

export default function NewEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { entries, createEntry, updateEntry } = useJournal();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const initialized = useRef(false);
  const dailyPrompt = getDailyPrompt();

  const [type, setType] = useState<EntryType>('freewrite');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [gratitudeItems, setGratitudeItems] = useState<string[]>(['', '', '']);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIComposer, setShowAIComposer] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftLoaded = useRef(false);
  const draftRef = useRef<EntryDraft | null>(null);
  const draftKey = userId ? `@pages/draft:${userId}:${id ?? 'new'}` : null;

  const currentDraft = (): EntryDraft => ({
    type,
    title,
    body,
    mood,
    tagsInput,
    gratitudeItems,
    savedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (!userId || (isEditing && entries.length === 0) || draftLoaded.current) return;

    let cancelled = false;
    const loadDraft = async () => {
      if (isEditing && id && !initialized.current) {
        initialized.current = true;
        const entry = entries.find(e => e.id === id);
        if (entry) {
          setType(entry.type);
          setTitle(entry.title);
          setBody(entry.body);
          setMood(entry.mood);
          setTagsInput(entry.tags.join(', '));
          if (entry.gratitudeItems) {
            const items = [...entry.gratitudeItems, '', '', ''].slice(0, 3);
            setGratitudeItems(items);
          }
        }
      }

      if (!draftKey) return;
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (!raw || cancelled) return;
        const draft = JSON.parse(raw) as Partial<EntryDraft>;
        if (draft.type) setType(draft.type);
        if (typeof draft.title === 'string') setTitle(draft.title);
        if (typeof draft.body === 'string') setBody(draft.body);
        if (typeof draft.mood === 'string') setMood(draft.mood);
        if (typeof draft.tagsInput === 'string') setTagsInput(draft.tagsInput);
        if (Array.isArray(draft.gratitudeItems)) setGratitudeItems(draft.gratitudeItems);
        setDraftRestored(true);
      } catch {
        // A malformed local draft should not prevent the editor from opening.
      } finally {
        if (!cancelled) draftLoaded.current = true;
      }
    };

    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [draftKey, entries, id, isEditing, userId]);

  useEffect(() => {
    if (!draftKey || !draftLoaded.current) return;
    const draft = currentDraft();
    draftRef.current = draft;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [body, draftKey, gratitudeItems, mood, tagsInput, title, type]);

  useEffect(() => {
    if (!draftKey) return;
    const persistCurrentDraft = () => {
      const draft = draftRef.current;
      if (!draft) return;
      void AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
    };
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        persistCurrentDraft();
      }
    });
    return () => {
      subscription.remove();
      persistCurrentDraft();
    };
  }, [draftKey]);

  const typeConfig = getEntryTypeConfig(type);

  const parseTags = (raw: string): string[] =>
    raw.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);

  const handleSave = async () => {
    const hasContent =
      body.trim().length > 0 ||
      title.trim().length > 0 ||
      gratitudeItems.some(g => g.trim().length > 0);
    if (!hasContent) return;

    setIsSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const payload = {
        type,
        title: title.trim(),
        body: type === 'gratitude' ? '' : body.trim(),
        mood,
        tags: parseTags(tagsInput),
        isFavorite: false,
        gratitudeItems: type === 'gratitude' ? gratitudeItems.filter(Boolean) : undefined,
        promptQuestion: type === 'prompt' ? dailyPrompt : undefined,
      };

      if (isEditing && id) {
        await updateEntry(id, payload);
      } else {
        await createEntry(payload);
      }
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    body.trim().length > 0 ||
    title.trim().length > 0 ||
    gratitudeItems.some(g => g.trim().length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Entry' : 'New Entry'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? colors.primary : colors.muted },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, { color: canSave ? '#fff' : colors.mutedForeground }]}>
              {isEditing ? 'Update' : 'Save'}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {draftRestored ? (
          <View style={[styles.draftNotice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="cloud-download-outline" size={16} color={colors.primary} />
            <Text style={[styles.draftNoticeText, { color: colors.secondaryForeground }]}>
              Your unsaved draft was restored
            </Text>
          </View>
        ) : null}

        {/* Type selector */}
        <View style={styles.typeSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Entry type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {ENTRY_TYPES.map(t => {
              const active = type === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setType(t.key)}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: active ? t.color : colors.card,
                      borderColor: active ? t.color : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={t.icon as any} size={18} color={active ? '#fff' : t.color} />
                  <Text style={[styles.typeBtnText, { color: active ? '#fff' : colors.foreground }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Mood picker */}
        <View style={styles.moodSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How are you feeling?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
            {MOODS.map(m => {
              const active = mood === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMood(active ? '' : m.key)}
                  style={[
                    styles.moodBtn,
                    {
                      backgroundColor: active ? m.color : colors.card,
                      borderColor: active ? m.color : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={m.icon as any} size={16} color={active ? '#fff' : m.color} />
                  <Text style={[styles.moodBtnText, { color: active ? '#fff' : colors.foreground }]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Title */}
        {type !== 'mood' && (
          <View style={[styles.fieldBlock, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.titleInput, { color: colors.foreground }]}
              placeholder="Give it a title..."
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>
        )}

        {/* Prompt question */}
        {type === 'prompt' && (
          <View style={[styles.promptBox, { backgroundColor: typeConfig.color + '15', borderLeftColor: typeConfig.color }]}>
            <Text style={[styles.promptText, { color: typeConfig.color }]}>{dailyPrompt}</Text>
          </View>
        )}

        {/* Gratitude items */}
        {type === 'gratitude' ? (
          <View style={styles.gratitudeSection}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              I am grateful for...
            </Text>
            {gratitudeItems.map((item, i) => (
              <View key={i} style={[styles.gratitudeRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.gratitudeNum, { color: typeConfig.color }]}>{i + 1}.</Text>
                <TextInput
                  style={[styles.gratitudeInput, { color: colors.foreground }]}
                  placeholder={`Thing ${i + 1}...`}
                  placeholderTextColor={colors.mutedForeground}
                  value={item}
                  onChangeText={val => {
                    const updated = [...gratitudeItems];
                    updated[i] = val;
                    setGratitudeItems(updated);
                  }}
                  returnKeyType={i < 2 ? 'next' : 'done'}
                />
              </View>
            ))}
          </View>
        ) : (
          /* Body */
          <View style={styles.bodySection}>
            <TextInput
              style={[styles.bodyInput, { color: colors.foreground }]}
              placeholder={
                type === 'mood'
                  ? 'Write a short reflection...'
                  : type === 'prompt'
                  ? 'Your answer...'
                  : type === 'dream'
                  ? 'Describe your dream...'
                  : 'Write freely...'
              }
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              value={body}
              onChangeText={setBody}
            />
            <View style={styles.aiRow}>
              <Text style={[styles.aiHint, { color: colors.mutedForeground }]}>
                Need help finding the words?
              </Text>
              <Pressable
                onPress={() => setShowAIComposer(true)}
                disabled={!body.trim() && !title.trim()}
                style={[
                  styles.aiButton,
                  {
                    backgroundColor: body.trim() || title.trim() ? colors.secondary : colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={15}
                  color={body.trim() || title.trim() ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.aiButtonText,
                    { color: body.trim() || title.trim() ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  Writing companion
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Tags */}
        <View style={[styles.tagsField, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="pricetag-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.tagsInput, { color: colors.foreground }]}
            placeholder="Tags (comma separated)"
            placeholderTextColor={colors.mutedForeground}
            value={tagsInput}
            onChangeText={setTagsInput}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
      <AIComposer
        visible={showAIComposer}
        initialText={body || title}
        initialTitle={title}
        onClose={() => setShowAIComposer(false)}
        onApply={({ body: nextBody, title: nextTitle, tags }) => {
          setBody(nextBody);
          if (nextTitle) setTitle(nextTitle);
          if (tags?.length) setTagsInput(tags.join(', '));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  draftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  draftNoticeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  typeSection: { paddingTop: 16 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  typeRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  typeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  moodSection: { paddingTop: 16 },
  moodRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  moodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  moodBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  fieldBlock: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginTop: 16,
  },
  titleInput: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    paddingVertical: 10,
    letterSpacing: -0.3,
  },
  promptBox: {
    marginHorizontal: 20,
    marginTop: 16,
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 12,
    borderRadius: 4,
  },
  promptText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  gratitudeSection: { paddingTop: 16 },
  gratitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  gratitudeNum: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    width: 28,
  },
  gratitudeInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    lineHeight: 22,
  },
  bodySection: { flex: 1, minHeight: 200, paddingHorizontal: 20, paddingTop: 16 },
  bodyInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    lineHeight: 28,
    minHeight: 200,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 12,
  },
  aiHint: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  aiButtonText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tagsField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: 1,
  },
  tagsInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});

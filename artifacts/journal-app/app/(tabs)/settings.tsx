import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useJournal, calculateStreak } from '@/context/JournalContext';

interface StatCardProps {
  value: string | number;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { entries, settings, updateSettings, deleteEntry, cloudSyncStatus } = useJournal();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [nameInput, setNameInput] = useState(settings.userName);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setNameInput(settings.userName);
  }, [settings.userName]);

  const handleSaveName = async () => {
    await updateSettings({ userName: nameInput.trim() });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const streak = calculateStreak(entries);
  const thisWeek = entries.filter(e => {
    const d = new Date(e.createdAt);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return d >= weekAgo;
  }).length;
  const favorites = entries.filter(e => e.isFavorite).length;

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Entries',
      'This will permanently delete all your journal entries. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            for (const e of entries) {
              await deleteEntry(e.id);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        Platform.OS === 'web' && { paddingBottom: 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'J'}
          </Text>
        </View>
        <Text style={[styles.avatarSubtext, { color: colors.mutedForeground }]}>Your personal journal</Text>
      </View>

      {/* Name section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>YOUR NAME</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.nameInput, { color: colors.foreground }]}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Enter your name"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <Pressable
            onPress={handleSaveName}
            style={[styles.saveBtn, { backgroundColor: nameSaved ? colors.accent : colors.primary }]}
          >
            <Ionicons name={nameSaved ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard value={entries.length} label="Total Entries" />
        <StatCard value={streak} label={streak === 1 ? 'Day Streak' : 'Day Streak'} />
        <StatCard value={thisWeek} label="This Week" />
        <StatCard value={favorites} label="Favorites" />
      </View>

      {/* Appearance */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        {(['system', 'light', 'dark'] as const).map(theme => (
          <Pressable
            key={theme}
            onPress={() => updateSettings({ theme })}
            style={[styles.themeRow, { borderTopColor: theme !== 'system' ? colors.border : 'transparent', borderTopWidth: theme !== 'system' ? 1 : 0 }]}
          >
            <View style={styles.themeLeft}>
              <Ionicons
                name={theme === 'system' ? 'phone-portrait-outline' : theme === 'light' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={colors.foreground}
              />
              <Text style={[styles.themeLabel, { color: colors.foreground }]}>
                {theme === 'system' ? 'System Default' : theme === 'light' ? 'Light' : 'Dark'}
              </Text>
            </View>
            {settings.theme === theme && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Cloud sync */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CLOUD SYNC</Text>
        <View style={styles.themeRow}>
          <View style={styles.themeLeft}>
            <Ionicons name="cloud-outline" size={18} color={colors.foreground} />
            <Text style={[styles.themeLabel, { color: colors.foreground }]}>
              {cloudSyncStatus === 'synced'
                ? 'Synced with Supabase'
                : cloudSyncStatus === 'syncing'
                ? 'Syncing…'
                : cloudSyncStatus === 'offline'
                ? 'Offline — local storage active'
                : 'Local storage'}
            </Text>
          </View>
          <Ionicons
            name={cloudSyncStatus === 'synced' ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={cloudSyncStatus === 'synced' ? colors.accent : colors.mutedForeground}
          />
        </View>
      </View>

      {/* Danger zone */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DATA</Text>
        <Pressable onPress={handleClearAll} style={styles.dangerRow}>
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          <Text style={[styles.dangerText, { color: colors.destructive }]}>Clear All Entries</Text>
        </Pressable>
      </View>

      {/* Version */}
      <Text style={[styles.version, { color: colors.muted }]}>Pages · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  avatarSubtext: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 2,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeLabel: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    paddingBottom: 30,
    paddingTop: 8,
  },
});

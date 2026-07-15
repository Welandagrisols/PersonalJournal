import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useJournal } from '@/context/JournalContext';
import EntryCard from '@/components/EntryCard';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalendarDay {
  day: number;
  month: 'prev' | 'current' | 'next';
  date: Date | null;
}

function buildCalendarCells(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - firstDay;
    if (offset < 0) {
      cells.push({ day: daysInPrev + offset + 1, month: 'prev', date: null });
    } else if (offset >= daysInMonth) {
      cells.push({ day: offset - daysInMonth + 1, month: 'next', date: null });
    } else {
      cells.push({ day: offset + 1, month: 'current', date: new Date(year, month, offset + 1) });
    }
  }
  return cells;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { entries, toggleFavorite } = useJournal();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const today = new Date();
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const cells = useMemo(() => buildCalendarCells(displayYear, displayMonth), [displayYear, displayMonth]);

  const entryDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const d = new Date(e.createdAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [entries]);

  const hasEntryOnDate = (date: Date) =>
    entryDateSet.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);

  const selectedEntries = useMemo(() => {
    const selStr = selectedDate.toDateString();
    return entries.filter(e => new Date(e.createdAt).toDateString() === selStr);
  }, [entries, selectedDate]);

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11); }
    else setDisplayMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (displayMonth === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0); }
    else setDisplayMonth(m => m + 1);
  };

  const isSelected = (date: Date | null) =>
    date ? date.toDateString() === selectedDate.toDateString() : false;

  const isToday = (date: Date | null) =>
    date ? date.toDateString() === today.toDateString() : false;

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Calendar</Text>
      </View>

      {/* Month navigator */}
      <View style={[styles.monthNav, { borderBottomColor: colors.border }]}>
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>
          {MONTH_LABELS[displayMonth]} {displayYear}
        </Text>
        <Pressable onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[styles.dayLabel, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          const isCurrent = cell.month === 'current';
          const sel = isCurrent && isSelected(cell.date);
          const tod = isCurrent && isToday(cell.date);
          const hasEntry = isCurrent && cell.date ? hasEntryOnDate(cell.date) : false;

          return (
            <Pressable
              key={i}
              onPress={() => isCurrent && cell.date && setSelectedDate(cell.date)}
              style={[
                styles.cell,
                sel && { backgroundColor: colors.primary },
                !sel && tod && { backgroundColor: colors.muted },
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  { color: isCurrent ? (sel ? colors.primaryForeground : colors.foreground) : colors.muted },
                  tod && !sel && { color: colors.primary, fontFamily: 'Inter_700Bold' },
                ]}
              >
                {cell.day}
              </Text>
              {hasEntry && !sel && (
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              )}
              {hasEntry && sel && (
                <View style={[styles.dot, { backgroundColor: colors.primaryForeground }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Selected day entries */}
      <View style={[styles.daySection, { borderTopColor: colors.border }]}>
        <Text style={[styles.daySectionTitle, { color: colors.foreground }]}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        {selectedEntries.length === 0 ? (
          <View style={styles.dayEmpty}>
            <Ionicons name="journal-outline" size={32} color={colors.muted} />
            <Text style={[styles.dayEmptyText, { color: colors.mutedForeground }]}>
              No entries on this day
            </Text>
          </View>
        ) : (
          selectedEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => router.push(`/entry/${entry.id}` as any)}
              onFavorite={() => toggleFavorite(entry.id)}
            />
          ))
        )}
      </View>
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  navBtn: {
    padding: 4,
  },
  monthLabel: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    gap: 2,
  },
  cellText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  daySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 0,
  },
  daySectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dayEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  dayEmptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});

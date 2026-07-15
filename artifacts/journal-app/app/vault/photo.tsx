import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/context/VaultContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function PhotoViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { photos, deletePhoto, updatePhotoNote } = useVault();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const photo = photos.find(p => p.id === id);

  const [showControls, setShowControls] = useState(true);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(photo?.note ?? '');

  if (!photo) {
    return (
      <View style={[styles.notFound, { backgroundColor: '#000' }]}>
        <Text style={{ color: '#fff' }}>Photo not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 10 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete Photo', 'This photo will be permanently deleted from your vault.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deletePhoto(photo.id);
          router.back();
        },
      },
    ]);
  };

  const handleSaveNote = async () => {
    await updatePhotoNote(photo.id, noteText.trim());
    setEditingNote(false);
    Keyboard.dismiss();
  };

  const toggleControls = () => {
    if (!editingNote) setShowControls(v => !v);
  };

  return (
    <View style={styles.root}>
      {/* Full-screen photo */}
      <Pressable onPress={toggleControls} style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.image}
          resizeMode="contain"
        />
      </Pressable>

      {/* Top controls */}
      {showControls && (
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.dateText}>
            {new Date(photo.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Pressable onPress={handleDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
          </Pressable>
        </View>
      )}

      {/* Bottom note area */}
      {showControls && (
        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8 }]}>
          {editingNote ? (
            <View style={styles.noteEditRow}>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveNote}
              />
              <Pressable onPress={handleSaveNote} style={styles.saveNoteBtn}>
                <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingNote(true)} style={styles.noteRow}>
              <Ionicons
                name={photo.note ? 'document-text-outline' : 'add-circle-outline'}
                size={18}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.noteDisplay} numberOfLines={2}>
                {photo.note || 'Add a note...'}
              </Text>
              <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: {
    padding: 6,
  },
  dateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  noteDisplay: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  noteEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 4,
  },
  noteInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    maxHeight: 80,
    paddingVertical: 4,
  },
  saveNoteBtn: {
    padding: 4,
  },
});

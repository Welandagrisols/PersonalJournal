import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/context/VaultContext';

const NUM_COLS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLS + 1)) / NUM_COLS;

const haptic = async () => {
  if (Platform.OS !== 'web') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export default function VaultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { photos, importPhotos, deleteFromGallery, deletePhoto } = useVault();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const isSelecting = selectedIds.size > 0;

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await importPhotos();
      if (result.imported === 0) return;

      // Ask user if they want to remove from gallery AFTER copying to vault
      if (result.assetIds.length > 0 && Platform.OS !== 'web') {
        Alert.alert(
          `${result.imported} Photo${result.imported > 1 ? 's' : ''} Added`,
          'Remove these photos from your gallery? They are already safely stored in your vault.',
          [
            {
              text: 'Keep in Gallery',
              style: 'cancel',
            },
            {
              text: 'Remove from Gallery',
              style: 'destructive',
              onPress: () => deleteFromGallery(result.assetIds),
            },
          ],
        );
      } else {
        Alert.alert(
          'Done',
          `${result.imported} photo${result.imported > 1 ? 's' : ''} added to vault.`,
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = async (id: string) => {
    await haptic();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} Photo${count > 1 ? 's' : ''}`,
      'These photos will be permanently deleted from your vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await deletePhoto(id);
            }
            setSelectedIds(new Set());
          },
        },
      ],
    );
  };

  const handlePhotoPress = (id: string) => {
    if (isSelecting) {
      toggleSelect(id);
    } else {
      router.push({ pathname: '/vault/photo', params: { id } } as any);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Vault</Text>
          {photos.length > 0 && (
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {isSelecting && (
            <Pressable
              onPress={() => setSelectedIds(new Set())}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleImport}
            disabled={isImporting}
            style={[styles.importBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Delete bar when selecting */}
      {isSelecting && (
        <Pressable
          onPress={handleDeleteSelected}
          style={[styles.deleteBar, { backgroundColor: colors.destructive }]}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.deleteBarText}>
            Delete {selectedIds.size} selected
          </Text>
        </Pressable>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="images-outline" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your vault is empty
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Import photos from your gallery to keep them private. You'll be asked if you want to remove them from your gallery after import.
          </Text>
          <Pressable
            onPress={handleImport}
            disabled={isImporting}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Import Photos</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: (Platform.OS === 'web' ? 100 : insets.bottom) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {photos.map(photo => {
            const selected = selectedIds.has(photo.id);
            return (
              <Pressable
                key={photo.id}
                onPress={() => handlePhotoPress(photo.id)}
                onLongPress={() => toggleSelect(photo.id)}
                style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.img, selected && styles.imgSelected]}
                  resizeMode="cover"
                />
                {selected && (
                  <View style={styles.checkOverlay}>
                    <Ionicons name="checkmark-circle" size={28} color="#fff" />
                  </View>
                )}
                {photo.note ? (
                  <View style={styles.noteIndicator}>
                    <Ionicons name="document-text" size={10} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  count: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  importBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteBarText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    padding: GAP,
  },
  cell: {
    position: 'relative',
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgSelected: {
    opacity: 0.6,
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  noteIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});

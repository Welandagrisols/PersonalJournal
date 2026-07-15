import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
// expo-media-library has no web support — loaded conditionally at runtime
// import * as MediaLibrary from 'expo-media-library';
import type { VaultPhoto } from '@/types/vault';

const PIN_KEY = '@pages/pin';
const PHOTOS_KEY = '@pages/vault_photos';

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

const vaultDir =
  Platform.OS !== 'web' && FileSystem.documentDirectory
    ? FileSystem.documentDirectory + 'vault/'
    : null;

async function ensureVaultDir() {
  if (!vaultDir) return;
  const info = await FileSystem.getInfoAsync(vaultDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });
  }
}

interface VaultContextValue {
  isAuthenticated: boolean;
  hasPin: boolean;
  setupPin: (pin: string) => Promise<void>;
  authenticate: (pin: string) => Promise<boolean>;
  lock: () => void;
  resetPin: () => Promise<void>;
  photos: VaultPhoto[];
  photosLoaded: boolean;
  importPhotos: () => Promise<{ imported: number; deleted: number }>;
  deletePhoto: (id: string) => Promise<void>;
  updatePhotoNote: (id: string, note: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const load = async () => {
      try {
        let pin: string | null = null;
        if (Platform.OS === 'web') {
          pin = localStorage.getItem(PIN_KEY);
        } else {
          pin = await SecureStore.getItemAsync(PIN_KEY);
        }
        setHasPin(!!pin);

        const raw = await AsyncStorage.getItem(PHOTOS_KEY);
        if (raw) setPhotos(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setPhotosLoaded(true);
      }
    };
    load();

    const sub = AppState.addEventListener('change', nextState => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        setIsAuthenticated(false);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(PIN_KEY, pin);
    } else {
      await SecureStore.setItemAsync(PIN_KEY, pin);
    }
    setHasPin(true);
    setIsAuthenticated(true);
  }, []);

  const authenticate = useCallback(async (pin: string): Promise<boolean> => {
    let stored: string | null = null;
    if (Platform.OS === 'web') {
      stored = localStorage.getItem(PIN_KEY);
    } else {
      stored = await SecureStore.getItemAsync(PIN_KEY);
    }
    if (stored === pin) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => setIsAuthenticated(false), []);

  const resetPin = useCallback(async () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(PIN_KEY);
    } else {
      await SecureStore.deleteItemAsync(PIN_KEY);
    }
    // Also clear all vault photos
    if (vaultDir) {
      try { await FileSystem.deleteAsync(vaultDir, { idempotent: true }); } catch {}
    }
    await AsyncStorage.removeItem(PHOTOS_KEY);
    setPhotos([]);
    setHasPin(false);
    setIsAuthenticated(false);
  }, []);

  const persistPhotos = useCallback(async (updated: VaultPhoto[]) => {
    await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
  }, []);

  const importPhotos = useCallback(async (): Promise<{ imported: number; deleted: number }> => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return { imported: 0, deleted: 0 };

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: false,
    });

    if (result.canceled || !result.assets.length) return { imported: 0, deleted: 0 };

    await ensureVaultDir();
    const newPhotos: VaultPhoto[] = [];
    const assetIdsToDelete: string[] = [];

    for (const asset of result.assets) {
      const id = generateId();
      let uri = asset.uri;

      if (vaultDir) {
        const ext = asset.uri.split('.').pop()?.split('?')[0] ?? 'jpg';
        const dest = vaultDir + id + '.' + ext;
        try {
          await FileSystem.copyAsync({ from: asset.uri, to: dest });
          uri = dest;
        } catch {
          uri = asset.uri;
        }
      }

      newPhotos.push({
        id,
        uri,
        filename: id,
        createdAt: new Date().toISOString(),
        note: '',
        width: asset.width,
        height: asset.height,
      });

      if (asset.assetId) assetIdsToDelete.push(asset.assetId);
    }

    const updated = [...photos, ...newPhotos];
    setPhotos(updated);
    await persistPhotos(updated);

    // Offer to delete from gallery (native only)
    let deleted = 0;
    if (assetIdsToDelete.length > 0 && Platform.OS !== 'web') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const MediaLibrary = require('expo-media-library');
        const { status: delStatus } = await MediaLibrary.requestPermissionsAsync();
        if (delStatus === 'granted') {
          await MediaLibrary.deleteAssetsAsync(assetIdsToDelete);
          deleted = assetIdsToDelete.length;
        }
      } catch {
        // deletion from gallery not supported on this device/platform
      }
    }

    return { imported: newPhotos.length, deleted };
  }, [photos, persistPhotos]);

  const deletePhoto = useCallback(
    async (id: string) => {
      const photo = photos.find(p => p.id === id);
      if (photo && vaultDir && photo.uri.startsWith(vaultDir)) {
        try { await FileSystem.deleteAsync(photo.uri, { idempotent: true }); } catch {}
      }
      const updated = photos.filter(p => p.id !== id);
      setPhotos(updated);
      await persistPhotos(updated);
    },
    [photos, persistPhotos],
  );

  const updatePhotoNote = useCallback(
    async (id: string, note: string) => {
      const updated = photos.map(p => (p.id === id ? { ...p, note } : p));
      setPhotos(updated);
      await persistPhotos(updated);
    },
    [photos, persistPhotos],
  );

  return (
    <VaultContext.Provider
      value={{
        isAuthenticated,
        hasPin,
        setupPin,
        authenticate,
        lock,
        resetPin,
        photos,
        photosLoaded,
        importPhotos,
        deletePhoto,
        updatePhotoNote,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}

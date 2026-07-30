import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import type { VaultPhoto } from '@/types/vault';

const PIN_KEY = '@pages/pin';
const PHOTOS_KEY = '@pages/vault_photos';

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Lazy-load file-system and media-library — neither has full web support
async function getFileSystem() {
  if (Platform.OS === 'web') return null;
  return import('expo-file-system');
}

async function getVaultDir(): Promise<string | null> {
  const fs = await getFileSystem();
  if (!fs?.documentDirectory) return null;
  return fs.documentDirectory + 'vault/';
}

async function ensureVaultDir(): Promise<string | null> {
  const fs = await getFileSystem();
  const dir = await getVaultDir();
  if (!fs || !dir) return null;
  const info = await fs.getInfoAsync(dir);
  if (!info.exists) {
    await fs.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

interface VaultContextValue {
  isAuthenticated: boolean;
  hasPin: boolean;
  pinLoaded: boolean;
  setupPin: (pin: string) => Promise<void>;
  authenticate: (pin: string) => Promise<boolean>;
  lock: () => void;
  resetPin: () => Promise<void>;
  photos: VaultPhoto[];
  importPhotos: () => Promise<{ imported: number; assetIds: string[] }>;
  deleteFromGallery: (assetIds: string[]) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  updatePhotoNote: (id: string, note: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinLoaded, setPinLoaded] = useState(false);
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const load = async () => {
      try {
        let pin: string | null = null;
        if (Platform.OS === 'web') {
          pin = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null;
        } else {
          pin = await SecureStore.getItemAsync(PIN_KEY);
        }
        setHasPin(!!pin);

        const raw = await AsyncStorage.getItem(PHOTOS_KEY);
        if (raw) setPhotos(JSON.parse(raw));
      } catch {
        // ignore load errors — treat as no PIN set
      } finally {
        setPinLoaded(true);
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
      stored = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null;
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
      if (typeof localStorage !== 'undefined') localStorage.removeItem(PIN_KEY);
    } else {
      await SecureStore.deleteItemAsync(PIN_KEY);
    }
    // Delete all vault photo files
    try {
      const fs = await getFileSystem();
      const dir = await getVaultDir();
      if (fs && dir) {
        await fs.deleteAsync(dir, { idempotent: true });
      }
    } catch {}
    await AsyncStorage.removeItem(PHOTOS_KEY);
    setPhotos([]);
    setHasPin(false);
    setIsAuthenticated(false);
  }, []);

  const persistPhotos = useCallback(async (updated: VaultPhoto[]) => {
    await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
  }, []);

  const importPhotos = useCallback(async (): Promise<{ imported: number; assetIds: string[] }> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return { imported: 0, assetIds: [] };

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: false,
    });

    if (result.canceled || !result.assets.length) return { imported: 0, assetIds: [] };

    const vaultDir = await ensureVaultDir();
    const fs = await getFileSystem();
    const newPhotos: VaultPhoto[] = [];
    const collectedAssetIds: string[] = [];

    for (const asset of result.assets) {
      const id = generateId();
      let uri = asset.uri;

      if (fs && vaultDir) {
        const ext = asset.uri.split('.').pop()?.split('?')[0] ?? 'jpg';
        const dest = vaultDir + id + '.' + ext;
        try {
          await fs.copyAsync({ from: asset.uri, to: dest });
          uri = dest;
        } catch {
          uri = asset.uri; // fall back to original URI
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

      if (asset.assetId) collectedAssetIds.push(asset.assetId);
    }

    const updated = [...photos, ...newPhotos];
    setPhotos(updated);
    await persistPhotos(updated);

    return { imported: newPhotos.length, assetIds: collectedAssetIds };
  }, [photos, persistPhotos]);

  const deleteFromGallery = useCallback(async (assetIds: string[]) => {
    if (!assetIds.length || Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const MediaLibrary = require('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.deleteAssetsAsync(assetIds);
      }
    } catch {
      // Not supported on this platform/device
    }
  }, []);

  const deletePhoto = useCallback(
    async (id: string) => {
      const photo = photos.find(p => p.id === id);
      if (photo && Platform.OS !== 'web') {
        try {
          const fs = await getFileSystem();
          const dir = await getVaultDir();
          if (fs && dir && photo.uri.startsWith(dir)) {
            await fs.deleteAsync(photo.uri, { idempotent: true });
          }
        } catch {}
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
        pinLoaded,
        setupPin,
        authenticate,
        lock,
        resetPin,
        photos,
        importPhotos,
        deleteFromGallery,
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

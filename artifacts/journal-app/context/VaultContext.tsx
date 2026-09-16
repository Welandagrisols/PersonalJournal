import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import type { VaultPhoto } from '@/types/vault';
import {
  deleteCloudPhoto,
  deleteVaultPhotoFile,
  isSupabaseConfigured,
  listCloudPhotos,
  upsertCloudPhoto,
  uploadVaultPhoto,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const LEGACY_PIN_KEY = 'pages_pin_legacy';
const LEGACY_PHOTOS_KEY = '@pages/vault_photos';

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Lazy-load file-system and media-library — neither has full web support
type LegacyFileSystem = {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
  makeDirectoryAsync: (uri: string, options?: { intermediates?: boolean }) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
};

async function getFileSystem(): Promise<LegacyFileSystem | null> {
  if (Platform.OS === 'web') return null;
  const module = await import('expo-file-system');
  return (module.default ?? module) as unknown as LegacyFileSystem;
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
  const { userId } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinLoaded, setPinLoaded] = useState(false);
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId) {
      setPhotos([]);
      setHasPin(false);
      setIsAuthenticated(false);
      setPinLoaded(true);
      return;
    }

    setPhotos([]);
    setHasPin(false);
    setIsAuthenticated(false);
    setPinLoaded(false);
    const photosKey = `@pages/vault_photos:${userId}`;
    const pinKey = `pages_pin_${userId}`;
    const load = async () => {
      try {
        let pin: string | null = null;
        if (Platform.OS === 'web') {
          pin =
            typeof localStorage !== 'undefined'
              ? localStorage.getItem(pinKey)
              : null;
        } else {
          pin = await SecureStore.getItemAsync(pinKey);
          if (!pin) {
            const legacyPin = await SecureStore.getItemAsync(LEGACY_PIN_KEY);
            if (legacyPin) {
              await SecureStore.setItemAsync(pinKey, legacyPin);
              await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
              pin = legacyPin;
            }
          }
        }
        setHasPin(!!pin);

        const raw = await AsyncStorage.getItem(photosKey);
        const legacyRaw = await AsyncStorage.getItem(LEGACY_PHOTOS_KEY);
        const localPhotos: VaultPhoto[] = raw
          ? JSON.parse(raw)
          : legacyRaw
          ? JSON.parse(legacyRaw)
          : [];
        setPhotos(localPhotos);
        await AsyncStorage.setItem(photosKey, JSON.stringify(localPhotos));
        await AsyncStorage.removeItem(LEGACY_PHOTOS_KEY);

        if (isSupabaseConfigured) {
          try {
            const cloudPhotos = await listCloudPhotos();
            if (cloudPhotos.length === 0) {
              await Promise.all(
                localPhotos.map(async photo => {
                  let storagePath: string | null = null;
                  try {
                    storagePath = await uploadVaultPhoto(photo.uri, photo.id);
                  } catch {
                    // Keep the local-only copy if cloud upload is unavailable.
                  }
                  await upsertCloudPhoto({ ...photo, storagePath: storagePath ?? undefined });
                }),
              );
            } else {
              const mergedById = new Map(cloudPhotos.map(photo => [photo.id, photo]));
              for (const localPhoto of localPhotos) {
                const cloudPhoto = mergedById.get(localPhoto.id);
                if (!cloudPhoto) {
                  mergedById.set(localPhoto.id, localPhoto);
                  try {
                    const storagePath = await uploadVaultPhoto(localPhoto.uri, localPhoto.id);
                    await upsertCloudPhoto({ ...localPhoto, storagePath: storagePath ?? undefined });
                  } catch {
                    await upsertCloudPhoto(localPhoto);
                  }
                } else if (localPhoto.note !== cloudPhoto.note) {
                  // Notes edited on this device remain available offline.
                  mergedById.set(localPhoto.id, { ...cloudPhoto, note: localPhoto.note });
                  await upsertCloudPhoto({ ...cloudPhoto, ...localPhoto });
                }
              }
              const mergedPhotos = Array.from(mergedById.values()).sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              setPhotos(mergedPhotos);
              await AsyncStorage.setItem(photosKey, JSON.stringify(mergedPhotos));
            }
          } catch {
            // Supabase is optional until its schema/storage policies are enabled.
          }
        }
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
  }, [userId]);

  const setupPin = useCallback(async (pin: string) => {
    if (!userId) return;
    const pinKey = `pages_pin_${userId}`;
    if (Platform.OS === 'web') {
      localStorage.setItem(pinKey, pin);
    } else {
      await SecureStore.setItemAsync(pinKey, pin);
    }
    setHasPin(true);
    setIsAuthenticated(true);
  }, [userId]);

  const authenticate = useCallback(async (pin: string): Promise<boolean> => {
    if (!userId) return false;
    const pinKey = `pages_pin_${userId}`;
    let stored: string | null = null;
    if (Platform.OS === 'web') {
      stored =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(pinKey)
          : null;
    } else {
      stored = await SecureStore.getItemAsync(pinKey);
    }
    if (stored === pin) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, [userId]);

  const lock = useCallback(() => setIsAuthenticated(false), []);

  const resetPin = useCallback(async () => {
    if (!userId) return;
    const pinKey = `pages_pin_${userId}`;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(pinKey);
    } else {
      await SecureStore.deleteItemAsync(pinKey);
    }
    // Delete all vault photo files
    try {
      const fs = await getFileSystem();
      const dir = await getVaultDir();
      if (fs && dir) {
        await fs.deleteAsync(dir, { idempotent: true });
      }
    } catch {}
    if (userId) {
      await AsyncStorage.removeItem(`@pages/vault_photos:${userId}`);
    }
    await AsyncStorage.removeItem(LEGACY_PHOTOS_KEY);
    setPhotos([]);
    setHasPin(false);
    setIsAuthenticated(false);
  }, [userId]);

  const persistPhotos = useCallback(async (updated: VaultPhoto[]) => {
    if (!userId) return;
    await AsyncStorage.setItem(`@pages/vault_photos:${userId}`, JSON.stringify(updated));
  }, [userId]);

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

    // Upload in the background so importing remains fast on mobile.
    if (isSupabaseConfigured) {
      void Promise.all(
        newPhotos.map(async photo => {
          try {
            const storagePath = await uploadVaultPhoto(photo.uri, photo.id);
            await upsertCloudPhoto({ ...photo, storagePath: storagePath ?? undefined });
          } catch {
            // The local vault remains the source of truth while offline.
          }
        }),
      );
    }

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
  }, [userId]);

  const deletePhoto = useCallback(
    async (id: string) => {
      const photo = photos.find(p => p.id === id);
      if (isSupabaseConfigured && photo) {
        try {
          if (photo.storagePath) await deleteVaultPhotoFile(photo.storagePath);
          await deleteCloudPhoto(id);
        } catch {
          // Continue deleting the local copy even if cloud sync is unavailable.
        }
      }
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
    [photos, persistPhotos, userId],
  );

  const updatePhotoNote = useCallback(
    async (id: string, note: string) => {
      const updated = photos.map(p => (p.id === id ? { ...p, note } : p));
      setPhotos(updated);
      await persistPhotos(updated);
      if (isSupabaseConfigured) {
        try {
          const updatedPhoto = updated.find(photo => photo.id === id);
          if (updatedPhoto) await upsertCloudPhoto(updatedPhoto);
        } catch {
          // The note is safely persisted locally.
        }
      }
    },
    [photos, persistPhotos, userId],
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

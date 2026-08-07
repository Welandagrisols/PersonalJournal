import * as SecureStore from 'expo-secure-store';
import type { JournalEntry, JournalSettings } from '@/types/journal';
import type { VaultPhoto } from '@/types/vault';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';

const SESSION_KEY = '@pages/supabase_session';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { id: string };
}

interface JournalRow {
  id: string;
  user_id: string;
  type: JournalEntry['type'];
  title: string;
  body: string;
  mood: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  gratitude_items: string[] | null;
  prompt_question: string | null;
}

interface SettingsRow {
  user_id: string;
  user_name: string;
  theme: JournalSettings['theme'];
  updated_at: string;
}

interface PhotoRow {
  id: string;
  user_id: string;
  storage_path: string | null;
  local_uri: string | null;
  filename: string;
  created_at: string;
  note: string;
  width: number | null;
  height: number | null;
}

function requireConfig() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for this build');
  }
}

async function readSession(): Promise<SupabaseSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
}

async function saveSession(session: SupabaseSession | null) {
  if (session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

async function authRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<SupabaseSession> {
  requireConfig();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Supabase auth failed (${response.status})`);
  }
  const session = (await response.json()) as SupabaseSession;
  await saveSession(session);
  return session;
}

async function refreshSession(session: SupabaseSession) {
  if (!session.refresh_token) return authRequest('signup', {});
  try {
    return await authRequest('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    });
  } catch {
    return authRequest('signup', {});
  }
}

export async function ensureSupabaseSession() {
  requireConfig();
  const stored = await readSession();
  if (stored?.access_token) return stored;
  return authRequest('signup', {});
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  requireConfig();
  let session = await ensureSupabaseSession();
  const headers = new Headers(init.headers);
  headers.set('apikey', SUPABASE_ANON_KEY);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Content-Type', 'application/json');

  let response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry) {
    session = await refreshSession(session);
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('apikey', SUPABASE_ANON_KEY);
    retryHeaders.set('Authorization', `Bearer ${session.access_token}`);
    retryHeaders.set('Content-Type', 'application/json');
    response = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: retryHeaders,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase request failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function entryFromRow(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    mood: row.mood,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: row.is_favorite,
    gratitudeItems: row.gratitude_items ?? undefined,
    promptQuestion: row.prompt_question ?? undefined,
  };
}

function entryToRow(entry: JournalEntry) {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    body: entry.body,
    mood: entry.mood,
    tags: entry.tags,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    is_favorite: entry.isFavorite,
    gratitude_items: entry.gratitudeItems ?? null,
    prompt_question: entry.promptQuestion ?? null,
  };
}

export async function listCloudEntries(): Promise<JournalEntry[]> {
  const rows = await request<JournalRow[]>(
    '/rest/v1/journal_entries?select=*&order=created_at.desc',
  );
  return rows.map(entryFromRow);
}

export async function upsertCloudEntry(entry: JournalEntry) {
  await request('/rest/v1/journal_entries?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(entryToRow(entry)),
  });
}

export async function deleteCloudEntry(id: string) {
  await request(`/rest/v1/journal_entries?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getCloudSettings(): Promise<JournalSettings | null> {
  const rows = await request<SettingsRow[]>(
    '/rest/v1/journal_settings?select=*&limit=1',
  );
  if (!rows[0]) return null;
  return { userName: rows[0].user_name, theme: rows[0].theme };
}

export async function upsertCloudSettings(settings: JournalSettings) {
  await request('/rest/v1/journal_settings?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_name: settings.userName,
      theme: settings.theme,
      updated_at: new Date().toISOString(),
    }),
  });
}

function photoFromRow(row: PhotoRow, uri: string): VaultPhoto {
  return {
    id: row.id,
    uri,
    filename: row.filename,
    createdAt: row.created_at,
    note: row.note,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    storagePath: row.storage_path ?? undefined,
  };
}

export async function listCloudPhotos(): Promise<VaultPhoto[]> {
  const rows = await request<PhotoRow[]>(
    '/rest/v1/vault_photos?select=*&order=created_at.desc',
  );
  const photos: VaultPhoto[] = [];
  for (const row of rows) {
    let uri = row.local_uri ?? '';
    if (row.storage_path) {
      try {
        uri = await createSignedPhotoUrl(row.storage_path);
      } catch {
        // Keep the local URI if a signed URL cannot be created.
      }
    }
    photos.push(photoFromRow(row, uri));
  }
  return photos;
}

export async function upsertCloudPhoto(photo: VaultPhoto) {
  await request('/rest/v1/vault_photos?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: photo.id,
      storage_path: photo.storagePath ?? null,
      local_uri: photo.uri.startsWith('file:') ? photo.uri : null,
      filename: photo.filename,
      created_at: photo.createdAt,
      note: photo.note,
      width: photo.width ?? null,
      height: photo.height ?? null,
    }),
  });
}

export async function deleteCloudPhoto(id: string) {
  await request(`/rest/v1/vault_photos?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

async function getCurrentUserId(): Promise<string> {
  const session = await ensureSupabaseSession();
  if (!session.user?.id) throw new Error('Supabase session has no user id');
  return session.user.id;
}

export async function uploadVaultPhoto(
  uri: string,
  id: string,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  requireConfig();
  const session = await ensureSupabaseSession();
  const userId = await getCurrentUserId();
  const extension = mimeType.split('/')[1] || 'jpeg';
  const path = `${userId}/${id}.${extension}`;
  const form = new FormData();

  if (uri.startsWith('http') || uri.startsWith('blob:')) {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, `${id}.${extension}`);
  } else {
    form.append(
      'file',
      { uri, name: `${id}.${extension}`, type: mimeType } as unknown as Blob,
    );
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/vault/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'x-upsert': 'true',
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Supabase photo upload failed (${response.status})`);
  }
  return path;
}

export async function deleteVaultPhotoFile(path: string) {
  const session = await ensureSupabaseSession();
  await fetch(`${SUPABASE_URL}/storage/v1/object/vault`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function createSignedPhotoUrl(path: string): Promise<string> {
  const session = await ensureSupabaseSession();
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/vault/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!response.ok) throw new Error('Could not create signed photo URL');
  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error('Supabase returned no signed photo URL');
  return data.signedURL.startsWith('http')
    ? data.signedURL
    : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

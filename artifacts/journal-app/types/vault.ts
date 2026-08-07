export interface VaultPhoto {
  id: string;
  uri: string; // local file system URI (or original on web)
  filename: string;
  createdAt: string;
  note: string;
  width?: number;
  height?: number;
  storagePath?: string;
}

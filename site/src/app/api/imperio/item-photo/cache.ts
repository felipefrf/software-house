export type CachedItemPhoto = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
};

export async function readThroughItemPhotoCache(
  read: () => Promise<CachedItemPhoto | null>,
  fetchSource: () => Promise<CachedItemPhoto>,
  write: (photo: CachedItemPhoto) => Promise<void>,
) {
  try {
    const cached = await read();
    if (cached) return cached;
  } catch {
    // Cache failure must not make an available EstoqueNOW photo unavailable.
  }

  const photo = await fetchSource();
  try {
    await write(photo);
  } catch {
    // Concurrent uploads and transient Storage failures are safe to ignore.
  }
  return photo;
}

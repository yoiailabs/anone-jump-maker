/**
 * 人物写真のサンプル素材はリポジトリに無い。
 * 公開済みのジャンプ静止画とアプリアイコンを、本編と同じ loadPhotos に渡して試す。
 */
export const SAMPLE_PHOTO_URLS = ["/jump-loop-still.png", "/icons/icon-512.png"] as const;

export async function fetchSamplePhotoFiles(fetchImpl: typeof fetch = fetch): Promise<File[]> {
  const files: File[] = [];
  for (const url of SAMPLE_PHOTO_URLS) {
    let response: Response;
    try {
      response = await fetchImpl(url);
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const blob = await response.blob();
    if (blob.size === 0) continue;
    const name = url.slice(url.lastIndexOf("/") + 1) || "sample.png";
    const type = blob.type.startsWith("image/") ? blob.type : "image/png";
    files.push(new File([blob], name, { type }));
  }
  return files;
}

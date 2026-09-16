export type LoadedPhoto = {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  objectUrl: string;
};

export async function loadPhotos(files: File[]): Promise<LoadedPhoto[]> {
  const images = files.filter((file) => file.type.startsWith("image/"));
  return Promise.all(images.map((file) => loadPhoto(file)));
}

async function loadPhoto(file: File): Promise<LoadedPhoto> {
  const objectUrl = URL.createObjectURL(file);
  const bitmap = await decodeBitmap(file);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    bitmap,
    objectUrl,
  };
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadHtmlImage(url);
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = src;
  });
}

export function revokePhotos(photos: LoadedPhoto[]): void {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.objectUrl);
    photo.bitmap.close();
  }
}

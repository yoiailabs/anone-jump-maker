/** Retype so in-app browsers download the file instead of inline-playing video. */
export function blobForDownload(blob: Blob): Blob {
  return new Blob([blob], { type: "application/octet-stream" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blobForDownload(blob));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

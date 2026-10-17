function blobFromBytes(bytes: Uint8Array, type?: string): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], type ? { type } : undefined);
}

/**
 * 縦プレビューの音声源。`vertical.mp4` は AAC に加えて 608×1080 の H.264 を持つ。
 * `<audio>` / `<video>` にそのまま渡すと、絵の `landscape.mp4` とデコーダを取り合う。
 * iOS は後から鳴った映像に先の音声を止め、Android は音声クロックが遅れて途切れる。
 * 書き出しと同じく音声パケットだけを残す。
 */
export async function remuxMp4AudioOnly(bytes: Uint8Array): Promise<Uint8Array | null> {
  const {
    BlobSource,
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacketSink,
    Input,
    MP4,
    Mp4OutputFormat,
    Output,
  } = await import("mediabunny");
  const input = new Input({
    source: new BlobSource(blobFromBytes(bytes)),
    formats: [MP4],
  });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const codec = await track.getCodec();
  if (!codec) return null;
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const source = new EncodedAudioPacketSource(codec);
  output.addAudioTrack(source);
  await output.start();
  const sink = new EncodedPacketSink(track);
  const decoderConfig = await track.getDecoderConfig();
  let first = true;
  for await (const packet of sink.packets()) {
    await source.add(packet, first && decoderConfig ? { decoderConfig } : undefined);
    first = false;
  }
  await output.finalize();
  const buffer = target.buffer;
  if (!buffer) return null;
  return new Uint8Array(buffer);
}

const jobs = new Map<string, Promise<string | null>>();
const resolved = new Map<string, string | null>();

/** 音声だけの object URL。失敗したときは null。同じ src は一度だけ作る。 */
export function preparePortraitSoundtrack(src: string): Promise<string | null> {
  const existing = jobs.get(src);
  if (existing) return existing;
  const job = (async () => {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const audio = await remuxMp4AudioOnly(bytes);
      if (!audio || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
      return URL.createObjectURL(blobFromBytes(audio, "audio/mp4"));
    } catch {
      return null;
    }
  })().then((url) => {
    resolved.set(src, url);
    return url;
  });
  jobs.set(src, job);
  return job;
}

/**
 * 準備が終わっていなければ undefined。
 * 音声だけを作れなかったときは null（呼び出し側は元のファイルに戻す）。
 */
export function portraitSoundtrackIfReady(src: string): string | null | undefined {
  if (!resolved.has(src)) return undefined;
  return resolved.get(src) ?? null;
}

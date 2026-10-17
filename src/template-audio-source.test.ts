import { readFile } from "node:fs/promises";
import { BlobSource, Input, MP4 } from "mediabunny";
import { describe, expect, it } from "vitest";
import { remuxMp4AudioOnly } from "./template-audio-source.ts";

function toBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

describe("portrait soundtrack remux", () => {
  it("keeps the aac track and drops the h264 picture from vertical.mp4", async () => {
    const original = new Uint8Array(await readFile("public/official-assets/template/vertical.mp4"));
    const source = new Input({ source: new BlobSource(toBlob(original)), formats: [MP4] });
    const sourceAudio = await source.getPrimaryAudioTrack();
    expect(sourceAudio).toBeTruthy();
    expect(await source.getPrimaryVideoTrack()).toBeTruthy();

    const only = await remuxMp4AudioOnly(original);
    expect(only).toBeTruthy();
    expect(only!.byteLength).toBeGreaterThan(1000);
    expect(only!.byteLength).toBeLessThan(original.byteLength);

    const remuxed = new Input({ source: new BlobSource(toBlob(only!)), formats: [MP4] });
    expect(await remuxed.getPrimaryVideoTrack()).toBeNull();
    const audio = await remuxed.getPrimaryAudioTrack();
    expect(audio).toBeTruthy();
    expect(await audio!.getCodec()).toBe(await sourceAudio!.getCodec());
    const duration = await audio!.computeDuration();
    const sourceDuration = await sourceAudio!.computeDuration();
    expect(duration).toBeGreaterThan(15);
    expect(Math.abs(duration - sourceDuration)).toBeLessThan(0.05);
  });
});

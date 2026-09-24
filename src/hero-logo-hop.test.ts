import { describe, expect, it, vi } from "vitest";
import {
  HERO_LOGO_HOP_ID,
  HERO_LOGO_HOPS,
  HERO_LOGO_SQUASH,
  HERO_LOGO_STRETCH,
  heroLogoHopDurationMs,
  heroLogoHopDy,
  heroLogoHopFrames,
  heroLogoHopScale,
  heroLogoHopTransform,
  playHeroLogoHop,
  prefersReducedMotion,
} from "./hero-logo-hop.ts";
import { JUMP_CYCLE_FRAMES, JUMP_DROP_FRAC, JUMP_RISE_FRAMES, JUMP_RISE_POW, jumpCycle } from "./layout.ts";

function round4(value: number): number {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded === 0 ? 0 : rounded;
}

describe("hero logo hop", () => {
  it("follows the jump cycle rise (power 2.3) and quadratic settle, flipped upward", () => {
    expect(JUMP_RISE_POW).toBe(2.3);
    expect(JUMP_RISE_FRAMES).toBe(7);
    expect(HERO_LOGO_HOPS).toHaveLength(3);
    expect(HERO_LOGO_HOPS.map((hop) => hop.amplitudePx)).toEqual([9, 4, 1.5]);
    for (const amplitude of HERO_LOGO_HOPS) {
      expect(amplitude.amplitudePx).toBeLessThan(12);
      expect(amplitude.durationMs).toBeLessThan(500);
    }
    expect(heroLogoHopDurationMs()).toBe(840);

    for (const k of [0, 1, 3.5, 6, 7, 8, 11, 14, 15]) {
      const lift = 1 - jumpCycle(k).dy / JUMP_DROP_FRAC;
      expect(heroLogoHopDy(k / JUMP_CYCLE_FRAMES, 10)).toBeCloseTo(-10 * lift, 5);
    }
    expect(heroLogoHopDy(0, 9)).toBe(0);
    expect(heroLogoHopDy(1, 9)).toBeCloseTo(0, 5);
    expect(heroLogoHopDy(JUMP_RISE_FRAMES / JUMP_CYCLE_FRAMES, 9)).toBeCloseTo(-9, 5);
  });

  it("plays three softening hops and rests at the origin", () => {
    const frames = heroLogoHopFrames();
    const translateY = (transform: unknown) => Number(/translateY\(([-\d.]+)px\)/.exec(String(transform))?.[1]);
    expect(frames[0]).toEqual({ offset: 0, transform: "translateY(0px) scale(1, 1)" });
    expect(frames[frames.length - 1]).toEqual({ offset: 1, transform: "translateY(0px) scale(1, 1)" });
    const offsets = frames.map((frame) => frame.offset as number);
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]!);
    }
    const values = frames.map((frame) => translateY(frame.transform));
    for (const hop of HERO_LOGO_HOPS) {
      expect(values.some((dy) => Math.abs(dy - -hop.amplitudePx) < 0.02)).toBe(true);
    }
    expect(Math.min(...values)).toBeCloseTo(-HERO_LOGO_HOPS[0]!.amplitudePx, 5);
    expect(Math.min(...values)).toBeGreaterThan(-12);
  });

  it("squashes on contact and stretches in the air, softer on later hops", () => {
    expect(HERO_LOGO_SQUASH).toBeGreaterThan(HERO_LOGO_STRETCH);
    expect(HERO_LOGO_SQUASH).toBeLessThan(0.05);
    expect(HERO_LOGO_STRETCH).toBeLessThan(0.02);

    const contact = heroLogoHopScale(0, 9);
    expect(contact.scaleX).toBeGreaterThan(1);
    expect(contact.scaleY).toBeLessThan(1);
    expect(contact.scaleX).toBeCloseTo(1 / contact.scaleY, 5);
    expect(contact.scaleY).toBeCloseTo(1 - HERO_LOGO_SQUASH, 5);

    const air = heroLogoHopScale(JUMP_RISE_FRAMES / JUMP_CYCLE_FRAMES, 9);
    expect(air.scaleY).toBeGreaterThan(1);
    expect(air.scaleX).toBeLessThan(1);
    expect(air.scaleX).toBeCloseTo(1 / air.scaleY, 5);
    expect(air.scaleY).toBeCloseTo(1 + HERO_LOGO_STRETCH, 5);

    const softer = heroLogoHopScale(0, 4);
    expect(softer.scaleX).toBeGreaterThan(1);
    expect(softer.scaleX).toBeLessThan(contact.scaleX);
    expect(heroLogoHopScale(1, 1.5).scaleY).toBeCloseTo(1 - HERO_LOGO_SQUASH * (1.5 / 9), 5);

    const landed = heroLogoHopTransform(1, 9);
    expect(landed).toContain("translateY(0px)");
    expect(landed).toContain(`scale(${round4(contact.scaleX)}, ${round4(contact.scaleY)})`);
    const apex = heroLogoHopTransform(JUMP_RISE_FRAMES / JUMP_CYCLE_FRAMES, 9);
    expect(apex).toContain("translateY(-9px)");
    expect(apex).toContain(`scale(${round4(air.scaleX)}, ${round4(air.scaleY)})`);
  });

  it("skips playback when reduced motion is requested", () => {
    const reduced = { matchMedia: vi.fn(() => ({ matches: true })) } as unknown as Window;
    const full = { matchMedia: vi.fn(() => ({ matches: false })) } as unknown as Window;
    expect(prefersReducedMotion(reduced)).toBe(true);
    expect(prefersReducedMotion(full)).toBe(false);
    const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => {
      return { id: HERO_LOGO_HOP_ID } as Animation;
    });
    expect(playHeroLogoHop({ animate }, reduced)).toBeNull();
    expect(animate).not.toHaveBeenCalled();
    playHeroLogoHop({ animate }, full);
    expect(animate).toHaveBeenCalledOnce();
    const [frames, options] = animate.mock.calls[0]!;
    expect(frames).toEqual(heroLogoHopFrames());
    expect(options).toMatchObject({
      duration: 840,
      easing: "linear",
      fill: "none",
      iterations: 1,
      id: HERO_LOGO_HOP_ID,
    });
  });
});

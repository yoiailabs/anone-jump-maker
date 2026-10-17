import { useEffect, useRef } from "react";

export const JUMP_LOOP_STILL_SRC = "/official-assets/jump-loop-still.png";
export const JUMP_LOOP_VIDEO_SRC = "/official-assets/jump-loop.mp4";

type JumpLoopProps = {
  href: string;
  ariaLabel: string;
};

/**
 * 初回 LCP は静止画。動きは 153KB のミュート MP4。
 * タップ待ちはしない（muted + playsinline ならモバイルでも自動再生できる）。
 * 低電力モードなどで play() が拒否されたときだけ、次の操作で再試行する。
 */
export function JumpLoop({ href, ariaLabel }: JumpLoopProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("webkit-playsinline", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let srcAssigned = false;
    const show = () => {
      if (!cancelled) video.classList.add("is-ready");
    };
    const start = () => {
      if (cancelled) return;
      if (!srcAssigned) {
        srcAssigned = true;
        video.preload = "auto";
        video.src = JUMP_LOOP_VIDEO_SRC;
        video.addEventListener("playing", show, { once: true });
      }
      void video.play().catch(() => {
        /* 自動再生が拒否されても静止画のまま。操作で再試行する */
      });
    };

    start();
    window.addEventListener("pointerdown", start, { once: true, passive: true });

    return () => {
      cancelled = true;
      video.removeEventListener("playing", show);
      window.removeEventListener("pointerdown", start);
    };
  }, []);

  return (
    <a className="loop-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
      <span className="loop-frame">
        <img
          className="loop"
          src={JUMP_LOOP_STILL_SRC}
          alt=""
          width={448}
          height={252}
          decoding="async"
          {...{ fetchpriority: "high" }}
        />
        <video
          ref={videoRef}
          className="loop loop-video"
          muted
          loop
          autoPlay
          playsInline
          preload="none"
          width={448}
          height={252}
          aria-hidden="true"
          tabIndex={-1}
        />
      </span>
    </a>
  );
}

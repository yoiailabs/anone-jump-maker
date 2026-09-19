import { useEffect, useRef } from "react";

export const JUMP_LOOP_STILL_SRC = "/jump-loop-still.png";
export const JUMP_LOOP_VIDEO_SRC = "/jump-loop.mp4";

type JumpLoopProps = {
  href: string;
  ariaLabel: string;
};

/** 初回 LCP は静止画。動きはアイドル後の小さな MP4 に任せる。 */
export function JumpLoop({ href, ariaLabel }: JumpLoopProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("webkit-playsinline", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const show = () => {
      if (!cancelled) video.classList.add("is-ready");
    };
    const start = () => {
      if (cancelled) return;
      video.preload = "auto";
      video.src = JUMP_LOOP_VIDEO_SRC;
      video.addEventListener("playing", show, { once: true });
      void video.play().catch(() => {
        /* 自動再生が拒否されても静止画のままにする */
      });
    };

    let idleId = 0;
    let timeoutId = 0;
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(start, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(start, 400);
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", show);
      if (idleId && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
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
          fetchPriority="high"
          decoding="async"
        />
        <video
          ref={videoRef}
          className="loop loop-video"
          muted
          loop
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

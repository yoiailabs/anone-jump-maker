import { useEffect, useRef } from "react";

export const JUMP_LOOP_STILL_SRC = "/jump-loop-still.png";
export const JUMP_LOOP_VIDEO_SRC = "/jump-loop.mp4";

type JumpLoopProps = {
  href: string;
  ariaLabel: string;
};

/** 初回 LCP は静止画。ループ動画は操作か 20 秒後まで取らない。 */
export function JumpLoop({ href, ariaLabel }: JumpLoopProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("webkit-playsinline", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let started = false;
    const show = () => {
      if (!cancelled) video.classList.add("is-ready");
    };
    const start = () => {
      if (cancelled || started) return;
      started = true;
      video.preload = "auto";
      video.src = JUMP_LOOP_VIDEO_SRC;
      video.addEventListener("playing", show, { once: true });
      void video.play().catch(() => {
        /* 自動再生が拒否されても静止画のままにする */
      });
    };

    const onGesture = () => start();
    window.addEventListener("pointerdown", onGesture, { once: true, passive: true });
    window.addEventListener("keydown", onGesture, { once: true });
    window.addEventListener("scroll", onGesture, { once: true, passive: true });
    const timeoutId = window.setTimeout(start, 20000);

    return () => {
      cancelled = true;
      video.removeEventListener("playing", show);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("scroll", onGesture);
      window.clearTimeout(timeoutId);
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

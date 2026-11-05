import { useEffect, useRef, useState, type MouseEvent } from "react";
import { pathForApp, t, type Locale } from "../i18n.ts";
import { JaPhrase } from "@/components/JaPhrase.tsx";

function BackMark() {
  return (
    <svg className="studio-back-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 左上の「トップに戻る」。写真を選んだあと（edit）は、押し間違いで編集から離れないよう確かめてから戻る。
 * 戻る処理そのものは boot の #app のクリック処理（pathForApp → history.pushState → applyView）に任せる。
 * React のリスナーは #app より内側の島にあるので、ここで preventDefault すれば boot はクリックを素通りする。
 * 「トップに戻る」を選んだら、同じリンクをもう一度クリックして既存の経路に乗せる。
 * 写真と設定は applyView が studio を離れるときに捨てる。ここでは消さない。
 */
export function StudioBack({ locale, editing }: { locale: Locale; editing: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);
  const label = t(locale, "studioBack");

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // 新しいタブで開くなどは編集を離れないので、そのままブラウザと boot に任せる。
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    if (!editing) return;
    event.preventDefault();
    const dialog = dialogRef.current;
    // 書き出しの画面など、別のダイアログの上には重ねない。
    if (!dialog || document.querySelector("dialog[open]")) return;
    dialog.showModal();
    setOpen(true);
    // 開いたら安全な「編集を続ける」へ。
    stayRef.current?.focus();
  };

  const leave = () => {
    dialogRef.current?.close("leave");
    confirmed.current = true;
    linkRef.current?.click();
  };

  // ブラウザの「戻る」などで画面が切り替わったら、出したままにしない。
  useEffect(() => {
    if (!open) return;
    const close = () => dialogRef.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [open]);

  return (
    <>
      {/* 主役の保存と取り違えないよう、反対の端に小さなアイコンで置く。 */}
      <a
        ref={linkRef}
        className="studio-back"
        href={pathForApp(locale, "maker")}
        aria-label={label}
        title={label}
        aria-haspopup={editing ? "dialog" : undefined}
        onClick={onClick}
      >
        <BackMark />
      </a>
      <dialog
        ref={dialogRef}
        className="studio-leave"
        id="studioLeave"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="studioLeaveTitle"
        aria-describedby="studioLeaveBody"
        onClose={(event) => {
          setOpen(false);
          const left = event.currentTarget.returnValue === "leave";
          event.currentTarget.returnValue = "";
          // 留まるときは押した戻るボタンへ。戻るときは boot がトップの見出しへ移す。
          if (!left) linkRef.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
          const first = buttons[0];
          const last = buttons.at(-1);
          const active = document.activeElement;
          // ネイティブ dialog からブラウザの UI へ Tab が抜けるのを防ぐ。
          if (event.shiftKey && (active === first || active === event.currentTarget)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && (active === last || active === event.currentTarget)) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id="studioLeaveTitle" className="studio-leave-title">
          {t(locale, "studioLeaveTitle")}
        </h2>
        <JaPhrase
          id="studioLeaveBody"
          className="studio-leave-body"
          locale={locale}
          text={t(locale, "studioLeaveBody")}
        />
        <div className="studio-leave-actions">
          <button
            ref={stayRef}
            type="button"
            className="studio-leave-stay"
            onClick={() => dialogRef.current?.close()}
          >
            {t(locale, "studioLeaveStay")}
          </button>
          <button type="button" className="studio-leave-go" onClick={leave}>
            {t(locale, "studioLeaveConfirm")}
          </button>
        </div>
      </dialog>
    </>
  );
}

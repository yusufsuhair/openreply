"use client";

import { useEffect, useRef } from "react";

export default function VideoDialog({
  video,
  close,
}: {
  video: { url: string; postUrl: string | null } | null;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!video) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, [video]);
  return (
    <dialog
      ref={ref}
      aria-label="Reel preview"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto max-h-[90dvh] max-w-[calc(100vw-2rem)] rounded-xl bg-background p-4 backdrop:bg-black/70"
    >
      {video && (
        <>
          <div className="mb-3 flex items-center justify-between gap-4">
            {video.postUrl && (
              <a
                href={video.postUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm underline"
              >
                Open on Instagram
              </a>
            )}
            <button
              onClick={close}
              className="min-h-11 rounded-lg border border-border px-4"
            >
              Close
            </button>
          </div>
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            className="max-h-[65dvh] max-w-full rounded-lg"
          />
        </>
      )}
    </dialog>
  );
}

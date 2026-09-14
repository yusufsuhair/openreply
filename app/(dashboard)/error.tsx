"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="panel rounded-xl p-6">
      <h2 className="text-lg font-semibold">We couldn’t open this page</h2>
      <p className="my-3 text-muted">
        Please try again. This error does not mean your campaigns were deleted.
      </p>
      <button
        onClick={reset}
        className="min-h-11 rounded-lg border border-border px-4"
      >
        Try again
      </button>
    </div>
  );
}

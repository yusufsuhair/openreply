export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-muted">Opening page…</p>
      <div className="panel h-24 rounded-xl" />
      <div className="panel h-40 rounded-xl" />
    </div>
  );
}

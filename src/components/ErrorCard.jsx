export default function ErrorCard({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
      <span className="text-paper/30 text-3xl">⚠</span>
      <p className="text-paper/50 text-sm" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-mono text-rust border border-rust/30 px-4 py-1.5 hover:bg-rust hover:text-dark transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Try again
        </button>
      )}
    </div>
  )
}

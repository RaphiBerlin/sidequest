export default function Skeleton({ width = '100%', height = '1rem', borderRadius = '0.5rem', className = '' }) {
  return (
    <div
      className={`animate-pulse bg-paper/10 ${className}`}
      style={{ width, height, borderRadius }}
    />
  )
}

export default function TimeoutModal({ visible, trigger, freezeAvailable, onClose, onUseFreeze }) {
  if (!visible) return null

  const title = trigger === 'timeout' ? "Time's up." : 'You missed yesterday.'
  const body = trigger === 'timeout' ? 'Your quest window expired.' : 'You missed a quest day.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(26,22,18,0.80)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-6 shadow-2xl flex flex-col items-center"
        style={{ background: '#f4ede0' }}
      >
        {/* Icon */}
        <div className="text-5xl mb-3" style={{ color: '#c44829' }}>⏰</div>

        {/* Title */}
        <h2
          className="text-2xl mb-2 text-center"
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: 'italic',
            fontWeight: 600,
            color: '#1a1612',
          }}
        >
          {title}
        </h2>

        {/* Body */}
        <div
          className="text-sm text-center mb-6"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            color: 'rgba(26,22,18,0.60)',
          }}
        >
          <p>{body}</p>
          {freezeAvailable && (
            <p className="mt-1">Use your weekly streak freeze to keep your streak going?</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {freezeAvailable && (
            <button
              onClick={onUseFreeze}
              className="w-full py-3 rounded-lg text-sm font-medium"
              style={{
                background: '#c44829',
                color: '#f4ede0',
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              Use streak freeze 🧊
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-sm font-medium"
            style={{
              border: '1px solid rgba(26,22,18,0.20)',
              color: '#1a1612',
              fontFamily: "'Bricolage Grotesque', sans-serif",
              background: 'transparent',
            }}
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}

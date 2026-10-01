import { useEffect } from 'react'

export interface ToastData {
  id: number
  message: string
  tone?: 'info' | 'error'
  action?: { label: string; onClick: () => void }
}

interface Props {
  toast: ToastData | null
  onDismiss: () => void
}

const DURATION_MS = 4000

export default function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, toast.tone === 'error' ? DURATION_MS * 2 : DURATION_MS)
    return () => clearTimeout(id)
  }, [toast, onDismiss])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2 pr-2 pl-5 text-sm text-white shadow-lg ${
            toast.tone === 'error' ? 'bg-red-700' : 'bg-stone-900'
          }`}
        >
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                onDismiss()
              }}
              className="min-h-11 rounded-full px-3 font-semibold text-brand-200 hover:bg-white/10"
            >
              {toast.action.label}
            </button>
          ) : (
            <span className="w-2" />
          )}
        </div>
      )}
    </div>
  )
}

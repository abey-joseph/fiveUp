import { useOnline } from '../hooks/useOnline.ts'

/** Shown while the device is offline. Firestore keeps working from its local cache. */
export default function OfflineBanner({ canEdit }: { canEdit: boolean }) {
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      className="mx-4 mb-2 rounded-2xl bg-stone-800 px-4 py-2 text-center text-sm text-white"
    >
      <span aria-hidden="true">📴 </span>
      {canEdit
        ? "You're offline. Changes are saved on this device and sync when you're back online."
        : "You're offline. Showing the last synced data."}
    </p>
  )
}

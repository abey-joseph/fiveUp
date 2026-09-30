import Logo from './Logo.tsx'

export default function Splash({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
      <div className="animate-pulse">
        <Logo size={72} />
      </div>
      <p className="text-sm text-stone-600">{label}</p>
    </div>
  )
}

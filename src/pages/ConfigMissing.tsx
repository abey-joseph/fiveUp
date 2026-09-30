import CenteredCard from '../components/CenteredCard.tsx'

export default function ConfigMissing() {
  return (
    <CenteredCard>
      <h1 className="text-xl font-bold text-stone-900">Firebase isn't configured</h1>
      <p className="mt-3 text-sm text-stone-600">
        Copy <code className="rounded bg-stone-100 px-1">.env.example</code> to{' '}
        <code className="rounded bg-stone-100 px-1">.env.local</code>, fill in your Firebase web app
        config, and restart the dev server. See the README for details.
      </p>
    </CenteredCard>
  )
}

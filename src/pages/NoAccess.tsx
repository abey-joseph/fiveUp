import CenteredCard from '../components/CenteredCard.tsx'

interface Props {
  email: string | null
  onSignOut: () => Promise<void>
  /** Set when access failed for a reason other than "not on the list" (e.g. network). */
  errorMessage?: string
}

export default function NoAccess({ email, onSignOut, errorMessage }: Props) {
  return (
    <CenteredCard>
      <h1 className="text-xl font-bold text-stone-900">
        {errorMessage ? "Couldn't load the tracker" : "You don't have access to this tracker"}
      </h1>
      <p className="mt-3 text-sm text-stone-600">
        {errorMessage ?? (
          <>
            You're signed in as <span className="font-medium text-stone-800">{email}</span>. Ask the
            tracker's owner to add this Google account, or sign in with a different one.
          </>
        )}
      </p>
      {errorMessage && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 min-h-12 w-full rounded-full bg-brand-700 px-5 font-semibold text-white transition hover:bg-brand-800"
        >
          Try again
        </button>
      )}
      <button
        type="button"
        onClick={() => void onSignOut()}
        className={`${errorMessage ? 'mt-3 bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50' : 'mt-8 bg-brand-700 text-white hover:bg-brand-800'} min-h-12 w-full rounded-full px-5 font-semibold transition`}
      >
        Sign out
      </button>
    </CenteredCard>
  )
}

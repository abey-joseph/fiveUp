import { useEffect } from 'react'

/** Sets the browser tab / task-switcher title, e.g. "History · FiveUp". */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · FiveUp` : 'FiveUp'
  }, [page])
}

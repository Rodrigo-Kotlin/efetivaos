import { useEffect, useRef, useState } from 'react'

import { useDebouncedValue } from '@/hooks/use-debounced-value'

/**
 * Bridges a collection search input to a URL search parameter.
 *
 * The returned draft updates immediately on typing, but the settled value is
 * only pushed to the URL after `delay` (debounce). External URL changes such as
 * deep links, browser back/forward and "clear filters" are adopted back into the
 * draft. The last value written by this hook is tracked in a ref so a stale
 * debounced value can never overwrite an externally restored search.
 */
export function useCollectionSearch(urlSearch: string, applySearch: (search: string) => void, delay = 300) {
  const [draft, setDraft] = useState(urlSearch)
  const debouncedDraft = useDebouncedValue(draft, delay)
  const lastAppliedRef = useRef(urlSearch)
  const applySearchRef = useRef(applySearch)

  useEffect(() => {
    applySearchRef.current = applySearch
  }, [applySearch])

  useEffect(() => {
    if (debouncedDraft === lastAppliedRef.current) return
    lastAppliedRef.current = debouncedDraft
    applySearchRef.current(debouncedDraft)
  }, [debouncedDraft])

  useEffect(() => {
    if (urlSearch === lastAppliedRef.current) return
    // Adopt external URL changes (deep link, back/forward, clear) into the draft.
    lastAppliedRef.current = urlSearch
    setDraft(urlSearch)
  }, [urlSearch])

  return [draft, setDraft] as const
}

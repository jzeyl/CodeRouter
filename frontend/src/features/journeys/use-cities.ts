import { useQuery } from '@tanstack/react-query'
import { isLiveData } from '@/lib/data-source'
import { cities } from './search'
export function useCities() {
  return useQuery({
    queryKey: ['cities', isLiveData],
    queryFn: async ({ signal }) =>
      isLiveData ? (await import('./live-repository')).loadLiveCities(signal) : [...cities],
    staleTime: 60_000,
  })
}

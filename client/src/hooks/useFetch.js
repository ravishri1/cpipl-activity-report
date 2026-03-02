import { useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import api from '../utils/api';

/**
 * Fetch data on mount with loading/error states. Auto-refetch on dependency changes.
 *
 * Usage:
 *   const { data: expenses, loading, error, refetch } = useFetch('/expenses/my', []);
 *   const { data: stats, loading } = useFetch(`/analytics/summary?year=${year}`, null, [year]);
 */
export function useFetch(url, initialData = null, deps = []) {
  const state = useApi(initialData);

  const refetch = useCallback(() => {
    return state.execute(() => api.get(url));
  }, [url, state.execute]);

  useEffect(() => {
    if (url) {
      state.setLoading(true);
      state.execute(() => api.get(url)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { ...state, refetch };
}

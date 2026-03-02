import { useState, useCallback } from 'react';

/**
 * Hook for API calls with automatic loading/error/success state.
 *
 * Usage:
 *   const { data, loading, error, success, execute, clearMessages } = useApi([]);
 *
 *   // Fetch data:
 *   execute(() => api.get('/expenses/my'));
 *
 *   // Mutate with success message:
 *   execute(() => api.post('/expenses', form), 'Expense submitted!');
 *
 *   // Access response data:
 *   const result = await execute(() => api.post('/expenses', form));
 */
export function useApi(initialData = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const execute = useCallback(async (apiFn, successMsg = '') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFn();
      setData(res.data);
      if (successMsg) setSuccess(successMsg);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  return { data, setData, loading, setLoading, error, setError, success, setSuccess, execute, clearMessages };
}

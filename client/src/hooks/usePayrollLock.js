import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Hook to check if payroll is locked for a given month.
 * Returns { isLocked, lockInfo, loading } where lockInfo has lockedAt, lockedBy.
 */
export function usePayrollLock(month, companyId = 1) {
  const [isLocked, setIsLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!month) { setIsLocked(false); setLockInfo(null); return; }
    setLoading(true);
    api.get(`/payroll/month-locks/${month}?companyId=${companyId}`)
      .then(res => { setIsLocked(res.data.locked); setLockInfo(res.data.lock || null); })
      .catch(() => { setIsLocked(false); setLockInfo(null); })
      .finally(() => setLoading(false));
  }, [month, companyId]);

  return { isLocked, lockInfo, loading };
}

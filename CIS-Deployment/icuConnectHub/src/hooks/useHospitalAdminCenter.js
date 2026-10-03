import { useEffect, useState } from 'react';
import { listCenters } from '../api/hospitalAdmin';

export default function useHospitalAdminCenter() {
  const [centerId, setCenterId] = useState(null);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCenters();
        if (cancelled) return;
        setCenters(list);
        const active = list.find((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || list[0];
        setCenterId(active?.centerId || null);
      } catch {
        if (!cancelled) setCenterId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { centerId, centers, loading };
}

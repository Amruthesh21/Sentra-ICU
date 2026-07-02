import { useEffect, useState } from 'react';
import { listCenters } from '../api/hospitalAdmin';

const CONNECT_ENGINE_CENTER = 'RTWO';

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
        const active = list.find((c) => c.centerId === CONNECT_ENGINE_CENTER)
          || list.find((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
          || list[0];
        setCenterId(active?.centerId || CONNECT_ENGINE_CENTER);
      } catch {
        if (!cancelled) setCenterId(CONNECT_ENGINE_CENTER);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { centerId, centers, loading };
}

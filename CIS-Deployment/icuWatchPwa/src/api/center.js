import { apiFetch } from './apiFetch';

export async function fetchCenter() {
  const res = await apiFetch('/api/center');
  if (!res.ok) throw new Error('Failed to load ICU beds');
  return res.json();
}

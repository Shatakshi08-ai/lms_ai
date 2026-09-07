import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useApiQuery(key, fn, opts) {
  return useQuery({ queryKey: key, queryFn: fn, ...opts });
}

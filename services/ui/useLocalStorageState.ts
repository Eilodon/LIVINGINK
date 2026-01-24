import { useCallback, useEffect, useState } from 'react';

export const useLocalStorageState = <T,>(
  key: string,
  initialValue: T,
): [T, (next: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  const setAndPersist = useCallback((next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue ? (JSON.parse(e.newValue) as T) : initialValue);
      } catch {
        setValue(initialValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initialValue]);

  return [value, setAndPersist];
};


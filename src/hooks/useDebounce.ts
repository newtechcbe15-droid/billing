import { useEffect, useState } from "react";

/**
 * A highly performant, type-safe hook that defers value updates 
 * until a specific temporal tracking window has passed.
 * * @param value The incoming generic input value state to watch.
 * @param delay The stabilization window delay in milliseconds. Defaults to 400ms.
 * @returns The stabilized, debounced value.
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 1. Instantiate the asynchronous scheduling execution delay window
    const threadHandler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 2. Perform a clear garbage collection drop to reset the clock if parameters change early
    return () => {
      clearTimeout(threadHandler);
    };
  }, [value, delay]);

  return debouncedValue;
}
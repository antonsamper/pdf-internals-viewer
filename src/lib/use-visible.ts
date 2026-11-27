import { useEffect, useRef, useState } from 'react';
/** Start bounded work when its row is visible, rather than decoding the whole list. */
export const useVisible = function useVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (
        entries.some((entry) => {
          return entry.isIntersecting;
        })
      ) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => {
      return observer.disconnect();
    };
  }, []);
  return { ref, visible };
};

'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

interface LazyLoadProps {
  children: ReactNode;
  rootMargin?: string;
  fallback?: ReactNode;
}

export default function LazyLoad({ children, rootMargin = '200px', fallback }: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : (fallback ?? null)}</div>;
}

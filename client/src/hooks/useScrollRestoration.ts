import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const [location] = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Restore scroll position when location changes
    if (isFirstRender.current) {
      isFirstRender.current = false;
      
      const savedPosition = scrollPositions.get(location);
      if (savedPosition !== undefined) {
        // Need to wait for content to render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, savedPosition);
          });
        });
      } else {
        window.scrollTo(0, 0);
      }
    }

    // Save scroll position on scroll and before unmounting
    const handleScroll = () => {
      scrollPositions.set(location, window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      // Save final position before leaving
      scrollPositions.set(location, window.scrollY);
      window.removeEventListener('scroll', handleScroll);
      isFirstRender.current = true;
    };
  }, [location]);
}

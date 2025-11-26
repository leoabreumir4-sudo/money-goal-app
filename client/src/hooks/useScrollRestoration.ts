import { useEffect } from 'react';
import { useLocation } from 'wouter';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const [location] = useLocation();

  useEffect(() => {
    // Save scroll position before unmounting
    const saveScrollPosition = () => {
      scrollPositions.set(location, window.scrollY);
    };

    // Restore scroll position after mounting
    const restoreScrollPosition = () => {
      const savedPosition = scrollPositions.get(location);
      if (savedPosition !== undefined) {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          window.scrollTo(0, savedPosition);
        }, 0);
      } else {
        // New page, scroll to top
        window.scrollTo(0, 0);
      }
    };

    restoreScrollPosition();

    // Save scroll position on scroll
    const handleScroll = () => {
      scrollPositions.set(location, window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      saveScrollPosition();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location]);
}

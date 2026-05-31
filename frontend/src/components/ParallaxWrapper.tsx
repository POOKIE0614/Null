import React, { useRef, useEffect } from 'react';
import Rellax from 'rellax';

/**
 * ParallaxWrapper - wraps children with a div that has a Rellax parallax effect.
 * Pass `speed` prop to control the scroll speed (negative = slower, positive = faster).
 */
export const ParallaxWrapper: React.FC<{ speed?: number; className?: string }> = ({
  speed = -2,
  className = '',
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const instance = new Rellax(ref.current, { speed, center: false });
    return () => {
      instance.destroy();
    };
  }, [speed]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

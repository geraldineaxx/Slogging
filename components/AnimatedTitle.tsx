
import React, { useState, useRef, useCallback } from 'react';

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedTitle: React.FC<Props> = ({ text, className = '', style }) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  const getOpacity = (index: number): number => {
    if (!mousePos) return 0.1;
    const el = spanRefs.current[index];
    if (!el) return 0.1;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.sqrt((mousePos.x - cx) ** 2 + (mousePos.y - cy) ** 2);
    // Gaussian falloff — peak ~0.7, fades with distance
    return Math.max(0.1, 0.7 * Math.exp(-dist / 180));
  };

  return (
    <h1
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`whitespace-nowrap cursor-default select-none ${className}`}
      style={style}
    >
      {text.split('').map((letter, i) => (
        <span
          key={i}
          ref={el => { spanRefs.current[i] = el; }}
          className="inline-block hover:-translate-y-[20%] letter-rise"
          style={{ opacity: getOpacity(i) }}
        >
          {letter}
        </span>
      ))}
    </h1>
  );
};

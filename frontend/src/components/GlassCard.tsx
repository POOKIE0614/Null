import React, { ReactNode } from 'react';

/**
 * GlassCard - a reusable glassmorphism card component.
 * Applies a semi‑transparent background with blur, subtle border and rounded corners.
 * Accepts optional `title` prop to display a header.
 */
interface GlassCardProps {
  /** Optional title displayed at the top of the card */
  title?: string;
  /** Card content */
  children: ReactNode;
  /** Additional Tailwind class names for custom styling */
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ title, children, className = '' }) => {
  return (
    <div
      className={`
        bg-white/5   /* light translucent background */
        border border-white/10   /* subtle border */
        rounded-xl   /* rounded corners */
        backdrop-blur-xl   /* strong blur for glass effect */
        text-white   /* default text color */
        p-6   /* inner padding */
        shadow-[0_4px_30px_rgba(0,0,0,0.2)]   /* faint shadow */
        ${className}
      `}
    >
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-orange-400">{title}</h2>
      )}
      {children}
    </div>
  );
};

export default GlassCard;

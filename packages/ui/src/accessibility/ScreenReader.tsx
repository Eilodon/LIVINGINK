import React from 'react';

interface ScreenReaderProps {
  text: string;
  priority?: 'polite' | 'assertive';
}

export const ScreenReader: React.FC<ScreenReaderProps> = ({
  text,
  priority = 'polite',
}) => {
  return (
    <span
      className="sr-only"
      role="status"
      aria-live={priority}
      aria-atomic="true"
    >
      {text}
    </span>
  );
};

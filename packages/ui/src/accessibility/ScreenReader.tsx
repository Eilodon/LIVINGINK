import React from 'react';

interface ScreenReaderProps {
  text: string;
  priority?: 'polite' | 'assertive';
}

export const ScreenReader: React.FC<ScreenReaderProps> = ({
  text,
  priority = 'polite',
}) => {
  // EIDOLON-V: Explicit aria-live values for accessibility compliance
  if (priority === 'assertive') {
    return (
      <span
        className="sr-only"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
      >
        {text}
      </span>
    );
  }

  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </span>
  );
};

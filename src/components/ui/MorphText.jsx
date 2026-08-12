import React, { useId } from 'react';

// small classname helper
const cn = (...args) => args.filter(Boolean).join(' ');

export function MorphText({
  words = ['CREATE', 'DESIGN', 'DEVELOP'],
  interval = 3000,
  subtext,
  fontSize = 'clamp(3rem, 15vw, 10rem)',
  fontFamily = '"Space Grotesk", sans-serif',
  className,
  textClassName,
  subtextClassName,
}) {
  const uid = useId().replace(/:/g, '');
  const filterId = `morph-threshold-${uid}`;

  const totalDuration = (interval / 1000) * words.length; // seconds
  const wordDuration = interval / 1000;

  const wordStyles = words.map((_, i) => ({
    animationDelay: `${i * wordDuration}s`,
    animationDuration: `${totalDuration}s`,
  }));

  return (
    <div className={cn('morph-text-root relative flex flex-col items-start', className)}>
      <svg
        aria-hidden="true"
        focusable="false"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className={cn('morph-text-container relative select-none', textClassName)}
        style={{ fontSize, fontWeight: 700, filter: `url(#${filterId})`, fontFamily }}
      >
        <div
          className="morph-word-rotator relative flex items-center justify-start"
          style={{ height: '1.2em', minWidth: '10ch' }}
        >
          {words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="morph-word absolute"
              style={{
                top: '50%',
                left: '0%',
                transform: 'translate(0%, -50%)',
                opacity: 0,
                whiteSpace: 'nowrap',
                animationName: 'morph-word-rotate',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationFillMode: 'both',
                ...wordStyles[i],
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {subtext && (
        <p
          className={cn('morph-subtext mt-6 uppercase tracking-[0.2em] text-[#ccc]', subtextClassName)}
          style={{ fontSize: '1rem', opacity: 0, animation: 'morph-fade-up 1s ease-out 1s forwards', fontFamily }}
        >
          {subtext}
        </p>
      )}

      <style>{`\n        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap');\n\n        @keyframes morph-word-rotate {\n          0% {\n            opacity: 0;\n            filter: blur(20px);\n            transform: translate(0%, -50%) scale(0.8);\n          }\n          5% {\n            opacity: 0.5;\n            filter: blur(10px);\n          }\n          15%, 35% {\n            opacity: 1;\n            filter: blur(0px);\n            transform: translate(0%, -50%) scale(1);\n          }\n          45% {\n            opacity: 0.5;\n            filter: blur(10px);\n          }\n          50%, 100% {\n            opacity: 0;\n            filter: blur(20px);\n            transform: translate(0%, -50%) scale(1.2);\n          }\n        }\n\n        @keyframes morph-fade-up {\n          from { opacity: 0; transform: translateY(12px); }\n          to   { opacity: 1; transform: translateY(0); }\n        }\n      `}</style>
    </div>
  );
}

export default MorphText;

'use client';

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

export function AnimatedTitle({ text, className = '' }: AnimatedTitleProps) {
  const characters = text.split('');

  return (
    <h1 className={`${className} inline-block`}>
      {characters.map((char, index) => (
        <span
          key={index}
          className="animated-char inline-block"
          style={{
            animationDelay: `${index * 0.1}s`,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </h1>
  );
}

import { useEffect, useState } from 'react';

interface LoaderProps {
  onFinished: () => void;
}

export function Loader({ onFinished }: LoaderProps) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const increment = 100 / steps;
    const interval = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= 100) {
        current = 100;
        clearInterval(timer);
      }
      setProgress(current);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        setFading(true);
        setTimeout(onFinished, 400);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress, onFinished]);

  return (
    <div className={`loader ${fading ? 'loader--fade-out' : ''}`}>
      <div className="loader__content">
        <span className="loader__title">Fit</span>
        <div className="loader__bar-track">
          <div
            className="loader__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

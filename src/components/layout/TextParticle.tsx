import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  baseX: number;
  baseY: number;
  density: number;
  color: string;
}

interface TextParticleProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  particleSize?: number;
  particleColor?: string;
  particleDensity?: number;
  className?: string;
}

export function TextParticle({
  text,
  fontSize = 120,
  fontFamily = "'Instrument Serif', Georgia, serif",
  particleSize = 2.5,
  particleColor = 'rgba(247, 245, 240, 0.6)',
  particleDensity = 6,
  className = '',
}: TextParticleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mouse, setMouse] = useState({ x: null as number | null, y: null as number | null });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initText = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const x = canvas.width / 2;
      const y = canvas.height / 2;

      ctx.fillText(text, x, y);

      const textCoordinates = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const newParticles: Particle[] = [];

      for (let y = 0; y < textCoordinates.height; y += particleDensity) {
        for (let x = 0; x < textCoordinates.width; x += particleDensity) {
          const index = (y * textCoordinates.width + x) * 4;
          const alpha = textCoordinates.data[index + 3];

          if (alpha > 128) {
            newParticles.push({
              x,
              y,
              size: particleSize,
              baseX: x,
              baseY: y,
              density: Math.random() * 30 + 1,
              color: particleColor,
            });
          }
        }
      }

      setParticles(newParticles);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleResize = () => {
      initText();
    };

    window.addEventListener('resize', handleResize);
    initText();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [text, fontSize, fontFamily, particleSize, particleColor, particleDensity]);

  useEffect(() => {
    if (particles.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        let dx = 0;
        let dy = 0;
        let distance = 0;
        let forceDirectionX = 0;
        let forceDirectionY = 0;

        if (mouse.x !== null && mouse.y !== null) {
          dx = mouse.x - particle.x;
          dy = mouse.y - particle.y;
          distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            forceDirectionX = (dx / distance) * 3;
            forceDirectionY = (dy / distance) * 3;
          }
        }

        const moveX = forceDirectionX + (particle.baseX - particle.x) * 0.05;
        const moveY = forceDirectionY + (particle.baseY - particle.y) * 0.05;

        particle.x += moveX;
        particle.y += moveY;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particles, mouse]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMouse({ x: null, y: null });
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}

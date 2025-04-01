import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LoadingLogoProps {
  size?: number;
  color?: string;
}

export function LoadingLogo({ size = 100, color = '#ffffff' }: LoadingLogoProps) {
  const [arms, setArms] = useState<Array<{ length: number; angle: number; delay: number }>>(
    Array.from({ length: 8 }, (_, i) => ({
      length: Math.random() * 30 + 20, // Random length between 20-50
      angle: (i * 360) / 8, // Evenly distributed angles
      delay: i * 0.2, // Staggered animation delay
    }))
  );

  // Update arms randomly
  useEffect(() => {
    const interval = setInterval(() => {
      setArms(prev => 
        prev.map(arm => ({
          ...arm,
          length: Math.random() * 30 + 20, // Random new length
        }))
      );
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        initial="initial"
        animate="animate"
      >
        {/* Center circle */}
        <motion.circle
          cx="50"
          cy="50"
          r="10"
          fill={color}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Animated arms */}
        {arms.map((arm, index) => (
          <motion.g key={index} style={{ originX: 50, originY: 50 }}>
            <motion.line
              x1="50"
              y1="50"
              x2="50"
              y2={50 - arm.length}
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ rotate: arm.angle }}
              animate={{
                rotate: [arm.angle, arm.angle + 360],
                scaleY: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: arm.delay,
              }}
            />
          </motion.g>
        ))}

        {/* Outer glow effect */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          stroke={color}
          strokeWidth="1"
          fill="none"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.svg>
    </div>
  );
} 
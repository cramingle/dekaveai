import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LoadingLogoProps {
  size?: number;
  color?: string;
}

export function LoadingLogo({ size = 100, color = '#ffffff' }: LoadingLogoProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        initial="initial"
        animate="animate"
      >
        {/* X Logo shape */}
        <motion.path
          d="M50 15 C60 25, 70 25, 80 15 L85 20 C75 30, 75 40, 85 50 C75 60, 75 70, 85 80 L80 85 C70 75, 60 75, 50 85 C40 75, 30 75, 20 85 L15 80 C25 70, 25 60, 15 50 C25 40, 25 30, 15 20 L20 15 C30 25, 40 25, 50 15"
          fill={color}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
            rotate: [0, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Glowing effect */}
        <motion.path
          d="M50 15 C60 25, 70 25, 80 15 L85 20 C75 30, 75 40, 85 50 C75 60, 75 70, 85 80 L80 85 C70 75, 60 75, 50 85 C40 75, 30 75, 20 85 L15 80 C25 70, 25 60, 15 50 C25 40, 25 30, 15 20 L20 15 C30 25, 40 25, 50 15"
          stroke={color}
          strokeWidth="2"
          fill="none"
          animate={{
            scale: [1.1, 1.2, 1.1],
            opacity: [0.1, 0.3, 0.1],
            rotate: [0, -360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            filter: "blur(4px)",
          }}
        />

        {/* Center dot */}
        <motion.circle
          cx="50"
          cy="50"
          r="4"
          fill={color}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.svg>
    </div>
  );
} 
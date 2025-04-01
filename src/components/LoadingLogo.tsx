import { motion } from 'framer-motion';

interface LoadingLogoProps {
  size?: number;
}

export function LoadingLogo({ size = 100 }: LoadingLogoProps) {
  return (
    <div 
      className="relative" 
      style={{ 
        width: size, 
        height: size 
      }}
    >
      <img
        src="/skolp.gif"
        alt="Loading..."
        className="w-full h-full object-contain"
      />
    </div>
  );
} 
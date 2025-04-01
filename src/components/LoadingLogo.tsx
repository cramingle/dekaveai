import { motion } from 'framer-motion';

interface LoadingLogoProps {
  size?: number;
  variant?: 'small' | 'medium' | 'large';
  color?: string;
}

export function LoadingLogo({ size, variant = 'small', color }: LoadingLogoProps) {
  const getSize = () => {
    if (size) return size;
    switch (variant) {
      case 'small':
        return 40;
      case 'medium':
        return 60;
      case 'large':
        return 100;
      default:
        return 40;
    }
  };

  return (
    <div 
      className="relative" 
      style={{ 
        width: getSize(), 
        height: getSize() 
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
import { LoadingLogo } from './LoadingLogo';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  message?: string;
  variant?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({ 
  size, 
  color = '#ffffff', 
  message,
  variant = 'small'
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <LoadingLogo size={size} color={color} variant={variant} />
      {message && (
        <p className="text-zinc-400 text-sm animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
} 
import { LoadingLogo } from './LoadingLogo';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  message?: string;
}

export function LoadingSpinner({ size = 60, color = '#ffffff', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <LoadingLogo size={size} color={color} />
      {message && (
        <p className="text-zinc-400 text-sm animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
} 
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ size = 'md', text = '', className = '' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} text-emerald-500 animate-spin`} />
      {text && (
        <p className="text-sm text-slate-400 animate-pulse">{text}</p>
      )}
    </div>
  );
};

export const FullPageLoader = ({ text = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-dark-900">
    <LoadingSpinner size="xl" text={text} />
  </div>
);

export const SectionLoader = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-20">
    <LoadingSpinner size="lg" text={text} />
  </div>
);

export default LoadingSpinner;

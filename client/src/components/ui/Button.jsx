import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'bg-transparent hover:bg-white/5 text-slate-300 hover:text-white',
  success: 'btn-primary', // map success to primary or custom class
  warning: 'btn-secondary', 
};

// Sizes can just adjust font size and padding slightly on top of base .btn
const sizes = {
  sm: 'text-xs px-3 py-1.5',
  md: '', // base .btn padding
  lg: 'text-base px-6 py-3',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  id,
  onClick,
  ...props
}) => {
  return (
    <button
      id={id}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`btn ${variants[variant] || 'btn-primary'} ${sizes[size] || ''} ${loading ? 'opacity-70 cursor-wait' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children}
    </button>
  );
};

export default Button;

const variantStyles = {
  success: 'text-green-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  info: 'text-blue-400',
  purple: 'text-purple-400',
  default: 'text-slate-400',
};

const sizeStyles = {
  sm: 'px-2.5 py-0.5 text-[11px] font-semibold',
  md: 'px-3 py-1 text-xs font-semibold',
  lg: 'px-3.5 py-1.5 text-sm font-semibold',
};

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
  uppercase = false,
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${uppercase ? 'uppercase tracking-wider' : ''}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-green-400' :
          variant === 'warning' ? 'bg-amber-400' :
          variant === 'danger' ? 'bg-red-400' :
          variant === 'info' ? 'bg-blue-400' :
          variant === 'purple' ? 'bg-purple-400' :
          'bg-slate-400'
        }`} />
      )}
      {children}
    </span>
  );
};

export default Badge;

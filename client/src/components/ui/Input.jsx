import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  className = '',
  id,
  type = 'text',
  disabled = false,
  ...props
}, ref) => {
  return (
    <div className={`form-group-premium ${error ? 'border-red-500/50' : ''}`}>
      {label && (
        <label
          htmlFor={id}
          className="form-label-premium"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="input-icon-left-premium">
            <Icon size={16} strokeWidth={2.0} />
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          disabled={disabled}
          step={type === 'number' ? (props.step !== undefined ? props.step : 'any') : undefined}
          className={`
            form-input-premium
            ${Icon ? 'has-icon' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

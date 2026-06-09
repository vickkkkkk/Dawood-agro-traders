import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({
  label,
  error,
  icon: Icon,
  options = [],
  placeholder = 'Select...',
  className = '',
  id,
  disabled = false,
  ...props
}, ref) => {
  return (
    <div className={`form-group-premium ${error ? 'border-red-500/50' : ''}`}>
      {label && (
        <label htmlFor={id} className="form-label-premium">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="input-icon-left-premium">
            <Icon size={16} strokeWidth={2.0} />
          </div>
        )}
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          className={`
            form-input-premium appearance-none
            ${Icon ? 'has-icon' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        >
          {!options?.some(opt => opt.value === '') && (
            <option value="" className="bg-select-option text-slate-400">{placeholder}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-select-option text-primary-text">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
          <ChevronDown size={16} />
        </div>
      </div>
      {error && (
        <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;

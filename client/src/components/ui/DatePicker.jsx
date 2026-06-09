import { forwardRef } from 'react';
import { Calendar } from 'lucide-react';

const DatePicker = forwardRef(({
  label,
  error,
  className = '',
  id,
  ...props
}, ref) => {
  return (
    <div className={`form-group-premium date-group ${error ? 'border-red-500/50' : ''}`}>
      {label && (
        <label htmlFor={id} className="form-label-premium">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <div className="input-icon-left-premium">
          <Calendar size={16} strokeWidth={2.0} />
        </div>
        <input
          ref={ref}
          id={id}
          type="date"
          className={`
            form-input-premium has-icon
            [color-scheme:dark]
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

DatePicker.displayName = 'DatePicker';

export default DatePicker;

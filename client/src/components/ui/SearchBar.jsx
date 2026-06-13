import { Search, X } from 'lucide-react';

const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search...',
  id,
  className = '',
}) => {
  return (
    <div
      className={`
        relative flex items-center h-[38px] w-full sm:w-80
        border border-white/10 rounded-lg bg-slate-950/75 px-3 gap-2
        focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20
        transition-all duration-200 ${className}
      `}
    >
      <Search size={16} className="text-slate-400 shrink-0" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-500 p-0"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          type="button"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;

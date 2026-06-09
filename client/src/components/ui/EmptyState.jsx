import { InboxIcon } from 'lucide-react';

const EmptyState = ({
  icon: Icon = InboxIcon,
  title = 'No data found',
  description = '',
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-6 ${className}`}>
      <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
        <Icon size={36} className="text-slate-500 relative z-10" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 text-center max-w-sm mb-5">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;

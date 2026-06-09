import { ChevronLeft, ChevronRight, InboxIcon } from 'lucide-react';

const Table = ({
  headers = [],
  children,
  pagination,
  onPageChange,
  loading = false,
  emptyMessage = 'No data found',
  id,
  currentPage = 1,
  totalPages = 1,
  showPagination = true
}) => {
  // Check if children is empty (no rows rendered)
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;

  return (
    <div id={id} className="table-wrapper">
      <table className="ledger-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {headers.map((_, j) => (
                  <td key={j}>
                    <div className="h-4 skeleton rounded w-20" />
                  </td>
                ))}
              </tr>
            ))
          ) : !hasChildren ? (
            <tr>
              <td colSpan={headers.length} className="text-center py-10">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <InboxIcon size={28} className="text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 mt-2">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-white px-3 min-w-[32px] text-center">{currentPage}</span>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;

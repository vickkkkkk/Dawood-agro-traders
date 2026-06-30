import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RotateCcw, Search, Eye, Calendar, User, 
  Tag, RefreshCw, FileText, CheckCircle, Info
} from 'lucide-react';
import { getReturns } from '../api/returns';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import DatePicker from '../components/ui/DatePicker';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, formatDateTime } from '../utils/formatDate';

const SaleReturnLedger = () => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Fetch Return Records
  const { data: returnsData, isLoading, refetch } = useQuery({
    queryKey: ['sale-returns', search, startDate, endDate],
    queryFn: () => getReturns({
      type: 'SALE',
      search,
      startDate,
      endDate,
      limit: 1000
    })
  });

  const returnRecords = returnsData?.data || [];

  // Summary Metrics
  const totalAmount = returnRecords.reduce((sum, r) => sum + Number(r.netAmount), 0);
  const totalCount = returnRecords.length;

  // Find top reason
  const reasonMap = {};
  returnRecords.forEach(r => {
    if (r.reason) {
      reasonMap[r.reason] = (reasonMap[r.reason] || 0) + 1;
    }
  });
  let topReason = 'None';
  let maxCount = 0;
  Object.keys(reasonMap).forEach(key => {
    if (reasonMap[key] > maxCount) {
      maxCount = reasonMap[key];
      topReason = key.toUpperCase();
    }
  });

  const getReasonBadgeVariant = (reason) => {
    switch (reason?.toLowerCase()) {
      case 'damaged': return 'danger';
      case 'wrong item': return 'warning';
      case 'customer cancelled': return 'info';
      case 'quality issue': return 'danger';
      default: return 'secondary';
    }
  };

  const getRefundMethodColor = (method) => {
    switch (method?.toUpperCase()) {
      case 'CASH': return 'text-green-400 font-bold';
      case 'CREDIT': return 'text-amber-400 font-bold';
      case 'ONLINE': return 'text-blue-400 font-bold';
      default: return 'text-slate-400';
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('return-receipt-print').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    window.location.reload();
  };

  return (
    <div className="app-container animate-fade-in space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-600/20 to-teal-800/20 border-emerald-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Sales Refunded</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg">
              <RotateCcw size={24} className="text-emerald-400 animate-spin-slow" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-indigo-800/20 border-purple-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Return Invoices</p>
              <p className="text-3xl font-extrabold text-purple-400 mt-1">{totalCount} Returns</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-lg">
              <FileText size={24} className="text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-orange-800/20 border-amber-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Top Return Reason</p>
              <p className="text-3xl font-extrabold text-amber-400 mt-1 truncate max-w-[200px]">{topReason}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg">
              <Tag size={24} className="text-amber-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Card */}
      <Card compact>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div>
            <SearchBar
              id="return-search"
              placeholder="Search return # or invoice #..."
              value={search}
              onChange={(val) => setSearch(val)}
              className="w-full sm:!w-full"
            />
          </div>
          <div>
            <DatePicker
              id="return-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pos-filter-input w-full bg-slate-900 border-white/10"
              placeholder="Start Date"
            />
          </div>
          <div>
            <DatePicker
              id="return-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pos-filter-input w-full bg-slate-900 border-white/10"
              placeholder="End Date"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
              }}
              className="cursor-pointer"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Return list table */}
      <Card padding={false}>
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <Table
            id="sale-returns-table"
            loading={isLoading}
            headers={['Return ID', 'Return Date', 'Ref Invoice', 'Customer', 'Reason', 'Refund Method', 'Net Refund', 'Processed By', 'Actions']}
            showPagination={false}
          >
            {returnRecords.length > 0 ? (
              returnRecords.map((record) => (
                <tr key={record.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-white">
                    {record.returnNo}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {formatDateTime(record.returnDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-emerald-400 font-mono">
                    {record.referenceNo}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {record.customer?.name || 'Walk-in Customer'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Badge variant={getReasonBadgeVariant(record.reason)}>
                      {record.reason}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={getRefundMethodColor(record.refundMethod)}>
                      {record.refundMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-extrabold text-white">
                    {formatCurrency(record.netAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-medium">
                    {record.user?.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={() => {
                        setSelectedReturn(record);
                        setShowViewModal(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center py-8 text-slate-500 font-bold">
                  No sales returns matched your search criteria.
                </td>
              </tr>
            )}
          </Table>
        </div>
      </Card>

      {/* Return Detail Modal */}
      {showViewModal && selectedReturn && (
        <Modal
          id="sale-return-detail-modal"
          title={`Return Detail: ${selectedReturn.returnNo}`}
          onClose={() => {
            setShowViewModal(false);
            setSelectedReturn(null);
          }}
        >
          <div className="space-y-6">
            
            {/* Printable Area Wrapper */}
            <div id="return-receipt-print" className="bg-white text-black p-6 rounded-lg font-sans border border-slate-200">
              <div className="text-center border-b border-gray-300 pb-4 space-y-1">
                <h2 className="text-xl font-extrabold tracking-wide uppercase">Dawood Agro Traders</h2>
                <p className="text-[10px] text-gray-500 font-bold">Chowk Sarwar Shaheed, Muzaffargarh</p>
                <p className="text-[10px] text-gray-500 font-bold">Phone: 0300-1234567</p>
                <div className="bg-black text-white py-1 px-3 inline-block rounded text-[10px] font-extrabold uppercase mt-2 tracking-wider">
                  Sales Return Receipt
                </div>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-y-2 text-xs border-b border-gray-300 py-4 font-medium">
                <div>
                  <span className="text-gray-500">Return Number:</span>
                  <p className="font-extrabold text-black">{selectedReturn.returnNo}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Return Date:</span>
                  <p className="font-extrabold text-black">{formatDateTime(selectedReturn.returnDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Original Invoice:</span>
                  <p className="font-extrabold text-black font-mono">{selectedReturn.referenceNo}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Customer:</span>
                  <p className="font-extrabold text-black">{selectedReturn.customer?.name || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Processed By:</span>
                  <p className="font-bold text-gray-800">{selectedReturn.user?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Refund Method:</span>
                  <p className="font-extrabold text-emerald-700">{selectedReturn.refundMethod}</p>
                </div>
              </div>

              {/* Reason Details */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1 my-3 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">Return Reason:</span>
                  <span className="font-bold text-red-700 capitalize">{selectedReturn.reason}</span>
                </div>
                {selectedReturn.reasonDetails && (
                  <div className="pt-1 border-t border-slate-200/60 mt-1">
                    <span className="text-gray-500 block">Remarks:</span>
                    <p className="text-gray-800 font-bold leading-relaxed">{selectedReturn.reasonDetails}</p>
                  </div>
                )}
              </div>

              {/* Returned Items */}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Returned Items List</p>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 font-extrabold text-gray-700 uppercase tracking-wider text-[10px]">
                      <th className="py-1.5">Product</th>
                      <th className="py-1.5 text-right">Qty</th>
                      <th className="py-1.5 text-right">Unit Price</th>
                      <th className="py-1.5 text-right">Refund Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {selectedReturn.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-black font-extrabold">{item.productName}</td>
                        <td className="py-2 text-right text-black font-bold">{parseFloat(item.quantity)} bags</td>
                        <td className="py-2 text-right text-gray-600">Rs. {parseFloat(item.unitPrice).toFixed(0)}</td>
                        <td className="py-2 text-right font-extrabold text-black">Rs. {parseFloat(item.total).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Refund Summary */}
              <div className="pt-4 border-t border-gray-300 space-y-1.5 text-right font-semibold mt-4 text-xs">
                <div className="flex justify-between items-center text-sm font-extrabold text-black pt-1">
                  <span>Net Refund Amount:</span>
                  <span className="text-base font-black">Rs. {parseFloat(selectedReturn.netAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
              <Button variant="primary" icon={CheckCircle} onClick={handlePrint}>Print Return Voucher</Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default SaleReturnLedger;

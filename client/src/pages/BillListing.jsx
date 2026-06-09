import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Eye, Printer, Calendar, RefreshCw, XCircle, CreditCard, RotateCcw } from 'lucide-react';
import { getBills, getBillById, voidBill, returnBillItem } from '../api/billing';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime } from '../utils/formatDate';
import { BILL_STATUS_COLORS, PAYMENT_METHOD_LABELS } from '../utils/constants';


const BillListing = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  // States
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected bill for view/print modal
  const [selectedBill, setSelectedBill] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  // Return Item state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [showReturnItemsModal, setShowReturnItemsModal] = useState(false);

  // Fetch full details of the selected bill (including items)
  const { data: selectedBillDetailsData, isLoading: isLoadingBill } = useQuery({
    queryKey: ['bill-details', selectedBill?.id],
    queryFn: () => getBillById(selectedBill.id),
    enabled: !!selectedBill?.id,
  });

  const selectedBillDetails = selectedBillDetailsData?.data;

  // Fetch Bills
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['bills', search, paymentMethod, startDate, endDate, page],
    queryFn: () => getBills({
      page,
      limit,
      search,
      paymentMethod,
      startDate,
      endDate,
      sort: '-createdAt'
    }),
  });

  const bills = Array.isArray(data?.data) ? data.data : (data?.data?.bills || data?.bills || []);
  const totalBills = data?.pagination?.total || data?.data?.total || data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalBills / limit));

  // Void Bill Mutation
  const voidBillMutation = useMutation({
    mutationFn: voidBill,
    onSuccess: () => {
      toast.success('Bill voided successfully! Stock levels restored.');
      queryClient.invalidateQueries(['bills']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['products']);
      setShowVoidModal(false);
      setShowViewModal(false);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to void bill');
    }
  });

  const handleVoidConfirm = () => {
    if (selectedBill) {
      voidBillMutation.mutate(selectedBill.id);
    }
  };

  const returnItemMutation = useMutation({
    mutationFn: (payload) => returnBillItem(selectedBill.id, payload),
    onSuccess: (res) => {
      toast.success('Item returned successfully!');
      queryClient.invalidateQueries(['bills']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['products']);
      if (selectedBill?.id) {
        queryClient.invalidateQueries(['bill-details', selectedBill.id]);
      }
      setShowReturnModal(false);
      setSelectedReturnItem(null);
      setReturnQuantity('');
      // Update selected bill in view modal with the new data
      if (res.data) {
        setSelectedBill(res.data);
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to return item');
    }
  });

  const handleReturnConfirm = () => {
    if (!selectedReturnItem || !returnQuantity || Number(returnQuantity) <= 0) {
      return toast.error('Please enter a valid quantity to return.');
    }
    const maxQty = Number(selectedReturnItem.quantity) - Number(selectedReturnItem.returnedQuantity || 0);
    if (Number(returnQuantity) > maxQty) {
      return toast.error(`Cannot return more than available (${maxQty}).`);
    }
    returnItemMutation.mutate({
      billItemId: selectedReturnItem.id,
      quantity: Number(returnQuantity)
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    window.location.reload();
  };

  const paymentMethodOptions = [
    { value: '', label: 'All Payments' },
    { value: 'CASH', label: 'Cash' },
    { value: 'JAZZCASH', label: 'JazzCash' },
    { value: 'EASYPAISA', label: 'EasyPaisa' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CREDIT', label: 'Credit (Udhar)' },
  ];

  return (
    <div className="app-container animate-fade-in">
      {/* Filter Bar */}
      <Card compact>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Input
              id="bill-search"
              placeholder="Search by Bill Number..."
              icon={Search}
              className="pos-filter-input pos-filter-input-icon"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <Select
              id="bill-payment-method"
              icon={CreditCard}
              options={paymentMethodOptions}
              className="pos-filter-input pos-filter-select"
              value={paymentMethod}
              onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <DatePicker
              id="bill-start-date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="pos-filter-input"
            />
          </div>
          <div>
            <DatePicker
              id="bill-end-date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="pos-filter-input"
            />
          </div>
          <div className="flex items-end justify-end">
            <Button
              variant="secondary"
              icon={RefreshCw}
              className="pos-filter-btn w-full"
              onClick={() => {
                setSearch('');
                setPaymentMethod('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>


      {/* Bills Table */}
      <Card padding={false}>
        <Table
          id="bills-table"
          loading={isLoading || isFetching}
          headers={['Bill No', 'Date', 'Customer', 'Payment Method', 'Discount', 'Total Bill', 'Status', 'Actions']}
          onPageChange={setPage}
          currentPage={page}
          totalPages={totalPages}
        >
          {bills.length > 0 ? (
            bills.map((bill) => {
              const statusColors = BILL_STATUS_COLORS[bill.isVoid ? 'VOID' : bill.paymentStatus] || BILL_STATUS_COLORS.PAID;
              return (
                <tr key={bill.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-7 py-4">
                    <span className="font-mono text-sm text-emerald-400 font-semibold">{bill.billNo}</span>
                  </td>
                  <td className="px-7 py-4 text-sm text-slate-300">
                    {formatDateTime(bill.billDate)}
                  </td>
                  <td className="px-7 py-4 text-sm text-slate-300">
                    {bill.customer?.name || 'Walk-in'}
                  </td>
                  <td className="px-7 py-4 text-sm text-slate-300">
                    {PAYMENT_METHOD_LABELS[bill.paymentMethod]}
                  </td>
                  <td className="px-7 py-4 text-sm text-slate-400">
                    {formatCurrency(bill.discount)}
                  </td>
                  <td className="px-7 py-4 text-sm font-bold text-white">
                    {formatCurrency(bill.total)}
                  </td>
                  <td className="px-7 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant={bill.isVoid ? 'danger' : bill.paymentStatus === 'CREDIT' ? 'warning' : 'success'}>
                        {bill.isVoid ? 'VOIDED' : bill.paymentStatus}
                      </Badge>
                      {bill.hasReturns && !bill.isVoid && (
                        <Badge variant="info" size="sm">
                          RETURNED
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-7 py-4">
                    <div className="flex gap-2">
                      <Button
                        id={`btn-view-${bill.billNo}`}
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => { setSelectedBill(bill); setShowViewModal(true); }}
                      >
                        Details
                      </Button>
                      {(hasRole('ADMIN') || hasRole('MANAGER')) && !bill.isVoid && (
                        <Button
                          id={`btn-return-${bill.billNo}`}
                          variant="warning"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => { setSelectedBill(bill); setShowReturnItemsModal(true); }}
                        >
                          Return
                        </Button>
                      )}
                      {hasRole('ADMIN') && !bill.isVoid && (
                        <Button
                          id={`btn-void-${bill.billNo}`}
                          variant="danger"
                          size="sm"
                          icon={XCircle}
                          onClick={() => { setSelectedBill(bill); setShowVoidModal(true); }}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} className="px-7 py-16 text-center text-slate-500">
                No bills found
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Bill View Modal */}
      {showViewModal && selectedBill && (
        <Modal
          id="view-bill-modal"
          title={`Bill Details: ${selectedBill.billNo}`}
          onClose={() => setShowViewModal(false)}
        >
          {isLoadingBill ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-400">Loading bill details...</span>
            </div>
          ) : selectedBillDetails ? (
            <div className="space-y-6">
              <div
                id="receipt-print-area"
                className="bg-white text-black p-6 rounded-xl font-sans text-xs max-w-sm mx-auto shadow-inner"
              >
                <div className="text-center space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3">
                  <h2 className="text-sm font-bold tracking-wide">DAWOOD AGRO TRADERS</h2>
                  <p className="text-[10px] text-gray-600">Old Grain Market, Vehari, Pakistan</p>
                  <p className="text-[10px] text-gray-600">Phone: 0300-1234567</p>
                  <p className="text-[10px] font-mono mt-2 text-gray-700">INVOICE: {selectedBillDetails.billNo}</p>
                  <p className="text-[9px] text-gray-500">Date: {new Date(selectedBillDetails.billDate).toLocaleString('en-PK')}</p>
                </div>

                {selectedBillDetails.isVoid && (
                  <div className="border border-red-500 text-red-500 text-center font-bold text-sm p-1 rounded mb-4 tracking-widest rotate-2">
                    VOIDED / CANCELLED
                  </div>
                )}

                <div className="space-y-1 mb-4">
                  <p><span className="font-semibold text-gray-700">Created By:</span> {selectedBillDetails.user?.name || 'Counter Staff'}</p>
                  <p><span className="font-semibold text-gray-700">Customer:</span> {selectedBillDetails.customer?.name || 'Walk-in'}</p>
                  {selectedBillDetails.customer?.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {selectedBillDetails.customer.phone}</p>}
                  <p><span className="font-semibold text-gray-700">Payment:</span> {PAYMENT_METHOD_LABELS[selectedBillDetails.paymentMethod]}</p>
                </div>

                <table className="w-full border-t border-b border-dashed border-gray-400 py-2 my-2">
                  <thead>
                    <tr className="border-b border-gray-300 font-semibold text-gray-700">
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Price</th>
                      <th className="text-right py-1">Total</th>
                      {(hasRole('ADMIN') || hasRole('MANAGER')) && !selectedBillDetails.isVoid && (
                        <th className="text-right py-1 print:hidden no-print">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedBillDetails.items?.map((item, idx) => {
                      const availableToReturn = parseFloat(item.quantity) - parseFloat(item.returnedQuantity || 0);
                      return (
                        <tr key={idx} className="py-1">
                          <td className="py-1 text-left">
                            <div>{item.product?.name || `Product #${item.productId}`}</div>
                            {parseFloat(item.returnedQuantity || 0) > 0 && (
                              <div className="text-[10px] text-red-600 font-semibold">
                                (Returned: {parseFloat(item.returnedQuantity)})
                              </div>
                            )}
                          </td>
                          <td className="text-center py-1">{parseFloat(item.quantity)}</td>
                          <td className="text-right py-1">{parseFloat(item.unitPrice).toFixed(0)}</td>
                          <td className="text-right py-1">{parseFloat(item.total).toFixed(0)}</td>
                          {(hasRole('ADMIN') || hasRole('MANAGER')) && !selectedBillDetails.isVoid && (
                            <td className="text-right py-1 print:hidden no-print">
                              {availableToReturn > 0 ? (
                                <button
                                  type="button"
                                  className="text-emerald-600 hover:text-emerald-700 hover:underline font-bold text-[10px] ml-2 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedReturnItem(item);
                                    setShowReturnModal(true);
                                  }}
                                >
                                  Return
                                </button>
                              ) : (
                                <span className="text-gray-400 text-[10px] ml-2 font-normal">Returned</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="space-y-1.5 text-right font-medium mt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>Rs. {parseFloat(selectedBillDetails.subtotal).toLocaleString()}</span>
                  </div>
                  {parseFloat(selectedBillDetails.discount) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span>-Rs. {parseFloat(selectedBillDetails.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-black border-t border-gray-300 pt-1">
                    <span>Grand Total:</span>
                    <span>Rs. {parseFloat(selectedBillDetails.total).toLocaleString()}</span>
                  </div>

                  {selectedBillDetails.paymentMethod === 'CREDIT' ? (
                    <div className="space-y-1 border-t border-dashed border-gray-300 pt-1 text-[10px]">
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Credit Amount:</span>
                        <span>Rs. {parseFloat(selectedBillDetails.creditAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>Amount Paid:</span>
                      <span>Rs. {parseFloat(selectedBillDetails.amountPaid).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
                <Button variant="primary" icon={Printer} onClick={handlePrint}>Print Invoice</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">Failed to load bill details.</div>
          )}
        </Modal>
      )}

      {/* Void confirmation modal */}
      {showVoidModal && selectedBill && (
        <Modal
          id="void-bill-confirm-modal"
          title="Void Bill Confirmation"
          onClose={() => setShowVoidModal(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to void/cancel bill <strong className="text-white">{selectedBill.billNo}</strong>?
            </p>
            <p className="text-xs text-red-400 font-medium">
              ⚠️ This action is irreversible. The stock levels of all products in this bill will be RESTORED and the sales record will be marked as VOID. Any outstanding credit linked to this bill will be automatically reversed.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowVoidModal(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleVoidConfirm}
                loading={voidBillMutation.isPending}
              >
                Yes, Void Bill
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Return Item Modal */}
      {showReturnModal && selectedReturnItem && (
        <Modal
          id="return-item-modal"
          title={`Return Item: ${selectedReturnItem.product?.name || 'Product'}`}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedReturnItem(null);
            setReturnQuantity('');
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Please enter the quantity of <strong className="text-white">{selectedReturnItem.product?.name}</strong> you want to return.
            </p>
            <div className="bg-white/5 p-3 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Original Quantity:</span>
                <span className="text-white font-semibold">{parseFloat(selectedReturnItem.quantity)} {selectedReturnItem.product?.unit || 'bags'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Already Returned:</span>
                <span className="text-amber-400 font-semibold">{parseFloat(selectedReturnItem.returnedQuantity || 0)} {selectedReturnItem.product?.unit || 'bags'}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-1 mt-1 font-medium">
                <span className="text-slate-300">Max Returnable:</span>
                <span className="text-emerald-400 font-semibold">
                  {parseFloat(selectedReturnItem.quantity) - parseFloat(selectedReturnItem.returnedQuantity || 0)} {selectedReturnItem.product?.unit || 'bags'}
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="return-quantity-input" className="block text-xs font-medium text-slate-400 mb-1">
                Quantity to Return
              </label>
              <Input
                id="return-quantity-input"
                type="number"
                step="any"
                min="0.01"
                max={parseFloat(selectedReturnItem.quantity) - parseFloat(selectedReturnItem.returnedQuantity || 0)}
                placeholder="Enter return quantity..."
                value={returnQuantity}
                onChange={(e) => setReturnQuantity(e.target.value)}
                className="pos-filter-input w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReturnModal(false);
                  setSelectedReturnItem(null);
                  setReturnQuantity('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleReturnConfirm}
                loading={returnItemMutation.isPending}
              >
                Confirm Return
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Return Items Modal */}
      {showReturnItemsModal && selectedBill && (
        <Modal
          id="return-items-modal"
          title={`Return Items - Bill: ${selectedBill.billNo}`}
          onClose={() => {
            setShowReturnItemsModal(false);
            setSelectedBill(null);
            setReturnQuantity('');
            setSelectedReturnItem(null);
          }}
        >
          {isLoadingBill ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-400">Loading items...</span>
            </div>
          ) : selectedBillDetails ? (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-xl text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bill Number:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{selectedBillDetails.billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-white font-medium">{selectedBillDetails.customer?.name || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Bill:</span>
                  <span className="text-white font-bold">{formatCurrency(selectedBillDetails.total)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 pr-2 font-semibold">Item Name</th>
                      <th className="py-2 text-center font-semibold">Sold Qty</th>
                      <th className="py-2 text-center font-semibold text-amber-400">Returned</th>
                      <th className="py-2 text-center font-semibold text-emerald-400">Max Returnable</th>
                      <th className="py-2 text-right font-semibold">Return Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedBillDetails.items?.map((item) => {
                      const availableToReturn = parseFloat(item.quantity) - parseFloat(item.returnedQuantity || 0);
                      const isItemReturnPending = returnItemMutation.isPending && selectedReturnItem?.id === item.id;

                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-2 font-medium text-white">
                            {item.product?.name || `Product #${item.productId}`}
                          </td>
                          <td className="py-3 text-center text-slate-300">
                            {parseFloat(item.quantity)} {item.product?.unit || 'bags'}
                          </td>
                          <td className="py-3 text-center text-amber-400 font-semibold">
                            {parseFloat(item.returnedQuantity || 0)}
                          </td>
                          <td className="py-3 text-center text-emerald-400 font-semibold">
                            {availableToReturn}
                          </td>
                          <td className="py-3 text-right">
                            {availableToReturn > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  max={availableToReturn}
                                  placeholder="Qty"
                                  className="w-16 h-8 text-center bg-slate-800 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                                  id={`input-return-qty-${item.id}`}
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={isItemReturnPending}
                                  onClick={() => {
                                    const inputVal = document.getElementById(`input-return-qty-${item.id}`).value;
                                    if (!inputVal || parseFloat(inputVal) <= 0) {
                                      return toast.error('Please enter a valid quantity.');
                                    }
                                    if (parseFloat(inputVal) > availableToReturn) {
                                      return toast.error(`Maximum returnable quantity is ${availableToReturn}`);
                                    }
                                    setSelectedReturnItem(item);
                                    returnItemMutation.mutate({
                                      billItemId: item.id,
                                      quantity: parseFloat(inputVal)
                                    });
                                  }}
                                >
                                  Return
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-medium text-[11px] px-2.5 py-1 bg-white/5 rounded-md">Fully Returned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowReturnItemsModal(false);
                    setSelectedBill(null);
                    setReturnQuantity('');
                    setSelectedReturnItem(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">Failed to load bill details.</div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default BillListing;

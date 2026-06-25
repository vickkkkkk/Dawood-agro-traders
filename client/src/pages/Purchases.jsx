import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Search, Plus, Eye, Truck, RefreshCw, 
  Trash2, Edit2, ShoppingBag, PlusCircle, Package, Layers, DollarSign, Hash, Calendar,
  User, Phone, MapPin, ClipboardList, ShieldAlert, CreditCard
} from 'lucide-react';
import { 
  getPurchases, createPurchase, getPurchaseById,
  getSuppliers, createSupplier, updateSupplier 
} from '../api/purchases';
import { getProducts } from '../api/inventory';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime, formatDate } from '../utils/formatDate';

const Purchases = () => {
  const queryClient = useQueryClient();
  
  // Lists filters state
  const [search, setSearch] = useState('');

  // Modals state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // New Purchase Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseOrderRef, setPurchaseOrderRef] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([{ productId: '', quantity: '', unitPrice: '', salePrice: '', batchNo: '', expiryDate: '' }]);
  
  // Logistics / Transport State
  const [biltyNo, setBiltyNo] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [biltyDate, setBiltyDate] = useState(new Date().toISOString().split('T')[0]);
  const [transportPaymentMethod, setTransportPaymentMethod] = useState('CASH');

  // Goods Payment Selector Modal State
  const [goodsPaymentMethod, setGoodsPaymentMethod] = useState('CASH');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [pendingPayload, setPendingPayload] = useState(null);

  const [errors, setErrors] = useState({});

  // Supplier Form State
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supErrors, setSupErrors] = useState({});

  // Fetch Purchases
  const { data: purchasesData, isLoading: purchasesLoading, isFetching: purchasesFetching } = useQuery({
    queryKey: ['purchases', search],
    queryFn: () => getPurchases({ page: 1, limit: 9999, search, sort: '-createdAt' }),
  });
  const purchases = Array.isArray(purchasesData?.data) ? purchasesData.data : (purchasesData?.data?.purchases || purchasesData?.purchases || []);

  // Fetch Suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers({ limit: 100 }),
  });
  const suppliers = Array.isArray(suppliersData?.data) ? suppliersData.data : (suppliersData?.data?.suppliers || suppliersData?.suppliers || []);

  // Fetch Products (for purchase item selection)
  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => getProducts({ limit: 500 }),
  });
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.products || productsData?.products || []);

  // Mutations
  const createPurchaseMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (res) => {
      toast.success(res?.message || 'Purchase GRN recorded! Stock levels updated.');
      queryClient.invalidateQueries(['purchases']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['cash-summary']);
      queryClient.invalidateQueries(['cash-ledger']);
      queryClient.invalidateQueries(['liabilities']);
      queryClient.invalidateQueries(['dashboard']);
      setShowPaymentModal(false);
      setShowPurchaseModal(false);
      resetPurchaseForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record purchase. Verify cash limits.');
    }
  });

  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      toast.success('Supplier added successfully');
      queryClient.invalidateQueries(['suppliers']);
      resetSupplierForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create supplier');
    }
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, data }) => updateSupplier(id, data),
    onSuccess: () => {
      toast.success('Supplier updated successfully');
      queryClient.invalidateQueries(['suppliers']);
      resetSupplierForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update supplier');
    }
  });

  // Supplier Form Handlers
  const handleSupplierSubmit = (e) => {
    e.preventDefault();
    
    const nameErr = !supName ? 'Supplier name is required' : supName.trim().length < 3 ? 'Name must be at least 3 characters' : null;
    const phoneErr = supPhone && !/^\d{10,11}$/.test(supPhone.replace(/[\s-]/g, '')) ? 'Phone must be a valid number (10-11 digits)' : null;
    
    if (nameErr || phoneErr) {
      setSupErrors({
        name: nameErr,
        phone: phoneErr
      });
      toast.error('Please resolve validation errors in the form');
      return;
    }
    
    setSupErrors({});
    const data = { name: supName, phone: supPhone, company: supCompany, address: supAddress };
    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data });
    } else {
      createSupplierMutation.mutate(data);
    }
  };

  const handleEditSupplier = (sup) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone || '');
    setSupCompany(sup.company || '');
    setSupAddress(sup.address || '');
    setSupErrors({});
  };

  const handleRowChange = (idx, field, val) => {
    setPurchaseItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      
      // Auto fill prices if product changes
      if (field === 'productId') {
        const prod = products.find(p => p.id === parseInt(val));
        if (prod) {
          updated.unitPrice = prod.purchasePrice;
          updated.salePrice = prod.salePrice;
        }
      }
      return updated;
    }));

    if (errors.items) {
      validateRowField(idx, field, val);
    }
  };

  const validateRowField = (idx, field, val) => {
    let errs = { ...errors };
    if (!errs.items) errs.items = [];
    while (errs.items.length <= idx) {
      errs.items.push({});
    }
    if (!errs.items[idx]) errs.items[idx] = {};

    if (field === 'productId') {
      if (!val) errs.items[idx].productId = 'Required';
      else delete errs.items[idx].productId;
    }
    if (field === 'quantity') {
      if (!val) {
        errs.items[idx].quantity = 'Required';
      } else if (parseFloat(val) <= 0) {
        errs.items[idx].quantity = 'Must be > 0';
      } else if (!Number.isInteger(Number(val))) {
        errs.items[idx].quantity = 'Must be an integer';
      } else {
        delete errs.items[idx].quantity;
      }
    }
    if (field === 'unitPrice') {
      if (!val) {
        errs.items[idx].unitPrice = 'Purchase Price is required';
      } else if (parseFloat(val) <= 0) {
        errs.items[idx].unitPrice = 'Must be > 0';
      } else {
        delete errs.items[idx].unitPrice;
      }
    }
    if (field === 'salePrice') {
      if (!val) {
        errs.items[idx].salePrice = 'Required';
      } else if (parseFloat(val) <= 0) {
        errs.items[idx].salePrice = 'Must be > 0';
      } else {
        delete errs.items[idx].salePrice;
      }
    }
    setErrors(errs);
  };

  const resetPurchaseForm = () => {
    setSelectedSupplierId('');
    setPurchaseOrderRef('');
    setPurchaseItems([{ productId: '', quantity: '', unitPrice: '', salePrice: '', batchNo: '', expiryDate: '' }]);
    setBiltyNo('');
    setTransporterName('');
    setTransportCost('');
    setBiltyDate(new Date().toISOString().split('T')[0]);
    setTransportPaymentMethod('CASH');
    setGoodsPaymentMethod('CASH');
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPendingPayload(null);
    setErrors({});
  };

  const handleAddRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      { productId: '', quantity: '', unitPrice: '', salePrice: '', batchNo: '', expiryDate: '' }
    ]);
  };

  const handleRemoveRow = (idx) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
    if (errors.items) {
      setErrors(prev => {
        const newItems = prev.items ? prev.items.filter((_, i) => i !== idx) : [];
        return { ...prev, items: newItems };
      });
    }
  };

  const resetSupplierForm = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupCompany('');
    setSupAddress('');
    setSupErrors({});
  };

  // Triggers Payment Method Modal
  const handlePurchasePreSubmit = (e) => {
    e.preventDefault();
    
    let hasError = false;
    let errs = { items: [] };

    if (!selectedSupplierId) {
      errs.supplierId = 'Supplier is required';
      hasError = true;
    }

    purchaseItems.forEach((item, idx) => {
      let rowErr = {};
      if (!item.productId) {
        rowErr.productId = 'Product is required';
        hasError = true;
      }
      if (!item.quantity) {
        rowErr.quantity = 'Qty is required';
        hasError = true;
      } else if (parseFloat(item.quantity) <= 0) {
        rowErr.quantity = 'Must be > 0';
        hasError = true;
      } else if (!Number.isInteger(Number(item.quantity))) {
        rowErr.quantity = 'Must be an integer';
        hasError = true;
      }
      if (!item.unitPrice) {
        rowErr.unitPrice = 'Purchase Price is required';
        hasError = true;
      } else if (parseFloat(item.unitPrice) <= 0) {
        rowErr.unitPrice = 'Must be > 0';
        hasError = true;
      }
      if (!item.salePrice) {
        rowErr.salePrice = 'Sale Price is required';
        hasError = true;
      } else if (parseFloat(item.salePrice) <= 0) {
        rowErr.salePrice = 'Must be > 0';
        hasError = true;
      }
      errs.items[idx] = rowErr;
    });

    if (hasError) {
      setErrors(errs);
      toast.error('Please resolve the errors in the form');
      return;
    }

    setErrors({});

    const payload = {
      supplierId: parseInt(selectedSupplierId),
      purchaseOrderRef: purchaseOrderRef || null,
      biltyNo: biltyNo || null,
      transporterName: transporterName || null,
      transportCost: parseFloat(transportCost) || 0,
      biltyDate: biltyNo ? new Date(biltyDate).toISOString() : null,
      transportPaymentMethod: parseFloat(transportCost) > 0 ? transportPaymentMethod : null,
      items: purchaseItems.map(item => ({
        productId: parseInt(item.productId),
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unitPrice),
        salePrice: parseFloat(item.salePrice),
        batchNo: item.batchNo || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
      }))
    };

    setPendingPayload(payload);
    setShowPaymentModal(true);
  };

  // Finalizes the purchase creation
  const handleFinalConfirm = () => {
    if (!pendingPayload) return;

    const payload = {
      ...pendingPayload,
      paymentMethod: goodsPaymentMethod,
      dueDate: goodsPaymentMethod === 'LIABILITY' ? new Date(dueDate).toISOString() : null
    };

    createPurchaseMutation.mutate(payload);
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };

  return (
    <div className="app-container animate-fade-in">
      
      {/* Control filters bar */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="purchases-search"
              placeholder="Search by GRN number..."
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setShowSupplierModal(true)}
              className="pos-filter-btn w-full sm:w-auto"
            >
              Suppliers Directory
            </Button>
            <Button
              id="btn-new-purchase"
              variant="primary"
              icon={Plus}
              onClick={() => setShowPurchaseModal(true)}
              className="pos-filter-btn w-full sm:w-auto"
            >
              Record Purchase
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <Table
          id="purchases-table"
          loading={purchasesLoading || purchasesFetching}
          headers={['GRN Number', 'Date', 'Supplier', 'Items Qty', 'Grand Total', 'Method', 'Liability status', 'Actions']}
          showPagination={false}
        >
          {purchases.length > 0 ? (
            purchases.map((pur) => {
              const hasLiability = pur.liability;
              return (
                <tr key={pur.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-emerald-400 font-semibold">{pur.grnNo}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatDateTime(pur.purchaseDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {pur.supplier?.name} {pur.supplier?.company ? `(${pur.supplier.company})` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {pur.items?.length || 0} items
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-white">
                    {formatCurrency(pur.grandTotal || pur.total)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Badge variant={pur.paymentMethod === 'LIABILITY' ? 'warning' : 'success'}>
                      {pur.paymentMethod}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {hasLiability ? (
                      <Badge variant={pur.liability.status === 'PAID' ? 'success' : 'danger'}>
                        {pur.liability.status}
                      </Badge>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      id={`btn-view-pur-${pur.grnNo}`}
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => { setSelectedPurchase(pur); setShowViewModal(true); }}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} className="px-7 py-16 text-center text-slate-500">
                No purchases found
              </td>
            </tr>
          )}
        </Table>
        </div>
      </Card>

      {/* Record Purchase Modal (GRN Form) */}
      {showPurchaseModal && (
        <Modal
          id="new-purchase-modal"
          title="Record Goods Received (GRN)"
          onClose={() => setShowPurchaseModal(false)}
          size="xl"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowPurchaseModal(false)}>Cancel</Button>
              <Button 
                type="submit" 
                variant="primary"
                form="purchase-form"
              >
                Proceed to Payment
              </Button>
            </>
          }
        >
          <form id="purchase-form" onSubmit={handlePurchasePreSubmit} className="space-y-6">
            
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                id="pur-supplier-select"
                label="Supplier Name *"
                required
                icon={Truck}
                options={suppliers.map(s => ({ value: s.id, label: `${s.name} ${s.company ? `(${s.company})` : ''}` }))}
                value={selectedSupplierId}
                error={errors.supplierId}
                onChange={(e) => { setSelectedSupplierId(e.target.value); if (errors.supplierId) setErrors(prev => ({ ...prev, supplierId: null })); }}
              />

              <Input
                id="pur-order-ref"
                label="Purchase Order Ref (Optional)"
                placeholder="e.g. PO-5412..."
                icon={ClipboardList}
                value={purchaseOrderRef}
                onChange={(e) => setPurchaseOrderRef(e.target.value)}
              />
            </div>

            {/* Logistics & Transport cost */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
              <h4 className="text-[13px] font-bold text-white flex items-center gap-2">
                <Truck size={14} className="text-emerald-400" />
                Logistics & Transport details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <Input
                  id="pur-bilty-no"
                  label="Bilty Number"
                  placeholder="e.g. B-8798"
                  value={biltyNo}
                  onChange={(e) => setBiltyNo(e.target.value)}
                />
                <Input
                  id="pur-transporter"
                  label="Transporter Name"
                  placeholder="e.g. Shalimar Cargo"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                />
                <Input
                  id="pur-transport-cost"
                  label="Transport Cost (PKR)"
                  type="number"
                  placeholder="0.00"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                />
                <DatePicker
                  id="pur-bilty-date"
                  label="Bilty Date"
                  value={biltyDate}
                  onChange={(e) => setBiltyDate(e.target.value)}
                />
                <Select
                  id="pur-transport-method"
                  label="Payment Method"
                  options={[
                    { value: 'CASH', label: 'Cash in Hand' },
                    { value: 'BANK', label: 'Bank Account' },
                    { value: 'LIABILITY', label: 'Supplier Liability' }
                  ]}
                  value={transportPaymentMethod}
                  onChange={(e) => setTransportPaymentMethod(e.target.value)}
                />
              </div>
            </div>

            {/* Items Rows */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#1e2330]">
                <h4 className="text-[14px] font-bold text-white">GRN Item Table</h4>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  icon={PlusCircle}
                  onClick={handleAddRow}
                >
                  Add Row
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }} className="max-h-[350px] overflow-y-auto pr-1 pt-1">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[3fr_1fr_2fr_2fr_2fr_2fr_50px] gap-3 pt-4 pb-3 px-4 bg-white/[0.01] border border-white/5 rounded-xl items-end">
                    
                    <div>
                      <Select
                        id={`pur-prod-${idx}`}
                        label="Product *"
                        required
                        icon={Package}
                        options={products.map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                        value={item.productId}
                        error={errors.items?.[idx]?.productId}
                        onChange={(e) => handleRowChange(idx, 'productId', e.target.value)}
                      />
                    </div>

                    <div>
                      <Input
                        id={`pur-qty-${idx}`}
                        label="Quantity *"
                        type="number"
                        required
                        min="1"
                        step="1"
                        icon={Layers}
                        placeholder="0"
                        value={item.quantity}
                        error={errors.items?.[idx]?.quantity}
                        onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                      />
                    </div>

                    <div>
                      <Input
                        id={`pur-price-${idx}`}
                        label="Purchase Price *"
                        type="number"
                        required
                        min="0.01"
                        placeholder="0"
                        icon={DollarSign}
                        value={item.unitPrice}
                        error={errors.items?.[idx]?.unitPrice}
                        onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                      />
                    </div>

                    <div>
                      <Input
                        id={`pur-sale-${idx}`}
                        label="Sale Price *"
                        type="number"
                        required
                        min="0.01"
                        placeholder="0"
                        icon={DollarSign}
                        value={item.salePrice}
                        error={errors.items?.[idx]?.salePrice}
                        onChange={(e) => handleRowChange(idx, 'salePrice', e.target.value)}
                      />
                    </div>

                    <div>
                      <Input
                        id={`pur-batch-${idx}`}
                        label="Batch"
                        placeholder="Batch..."
                        value={item.batchNo}
                        onChange={(e) => handleRowChange(idx, 'batchNo', e.target.value)}
                      />
                    </div>

                    <div>
                      <DatePicker
                        id={`pur-expiry-${idx}`}
                        label="Expiry"
                        value={item.expiryDate}
                        onChange={(e) => handleRowChange(idx, 'expiryDate', e.target.value)}
                      />
                    </div>

                    <div className="flex justify-center pb-1">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleRemoveRow(idx)}
                        disabled={purchaseItems.length === 1}
                        className="p-2.5"
                      />
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Footer */}
            <div className="flex justify-between items-center border-t border-white/10 pt-4">
              <div className="text-sm text-slate-400">
                Goods Purchase Total:
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(calculatePurchaseTotal())}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Select Payment Method Modal */}
      {showPaymentModal && pendingPayload && (
        <Modal
          id="confirm-payment-modal"
          title="Select GRN Payment Method"
          onClose={() => setShowPaymentModal(false)}
          size="md"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>Back</Button>
              <Button 
                type="button" 
                variant="primary"
                onClick={handleFinalConfirm}
                loading={createPurchaseMutation.isPending}
              >
                Finalize & Post GRN
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* Bill Summary */}
            <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Goods Purchase Total:</span>
                <span className="text-white font-semibold">{formatCurrency(calculatePurchaseTotal())}</span>
              </div>
              {pendingPayload.transportCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Transport Cost ({pendingPayload.transportPaymentMethod}):</span>
                  <span className="text-white font-semibold">{formatCurrency(pendingPayload.transportCost)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-white/5 font-extrabold">
                <span className="text-white">Grand Total:</span>
                <span className="text-emerald-400 text-lg">
                  {formatCurrency(calculatePurchaseTotal() + pendingPayload.transportCost)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <Select
                id="pur-payment-method"
                label="Goods Purchase Payment Method *"
                options={[
                  { value: 'CASH', label: '💵 Cash in Hand' },
                  { value: 'BANK', label: '🏦 Bank Account' },
                  { value: 'LIABILITY', label: '📋 Supplier Liability (Credit)' }
                ]}
                value={goodsPaymentMethod}
                onChange={(e) => setGoodsPaymentMethod(e.target.value)}
              />

              {goodsPaymentMethod === 'LIABILITY' && (
                <DatePicker
                  id="pur-due-date"
                  label="Liability Due Date *"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              )}
            </div>

            {/* Accounting Note */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 flex gap-2 items-start">
              <ShieldAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                {goodsPaymentMethod === 'CASH' && "Deducts the purchase cost immediately from Cash in Hand store balance."}
                {goodsPaymentMethod === 'BANK' && "Deducts the purchase cost immediately from Bank Account balance."}
                {goodsPaymentMethod === 'LIABILITY' && `Creates a liability log linked to this GRN. Total unpaid balance will be Rs. ${calculatePurchaseTotal().toLocaleString()}.`}
              </p>
            </div>

          </div>
        </Modal>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <Modal
          id="supplier-mgmt-modal"
          title="Supplier Management"
          onClose={() => setShowSupplierModal(false)}
          size="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Create/Edit Supplier Form */}
            <form onSubmit={handleSupplierSubmit} className="md:col-span-5 space-y-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col">
              <h4 className="text-sm font-bold text-white mb-2">
                {editingSupplier ? 'Edit Supplier' : 'Create Supplier'}
              </h4>
              
              <Input
                id="sup-name"
                label="Supplier Name *"
                placeholder="Enter name..."
                icon={User}
                value={supName}
                error={supErrors.name}
                onChange={(e) => { setSupName(e.target.value); if (supErrors.name) setSupErrors(prev => ({ ...prev, name: null })); }}
                required
              />
              
              <Input
                id="sup-phone"
                label="Phone"
                placeholder="Enter phone..."
                icon={Phone}
                value={supPhone}
                error={supErrors.phone}
                onChange={(e) => { setSupPhone(e.target.value); if (supErrors.phone) setSupErrors(prev => ({ ...prev, phone: null })); }}
              />
              
              <Input
                id="sup-company"
                label="Company / Shop Name"
                placeholder="Enter company..."
                icon={Truck}
                value={supCompany}
                onChange={(e) => setSupCompany(e.target.value)}
              />
              
              <Input
                id="sup-addr"
                label="Address"
                placeholder="Enter address..."
                icon={MapPin}
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
              />
              
              <div className="flex gap-2 pt-2 mt-auto">
                {editingSupplier && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={resetSupplierForm}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm" 
                  loading={createSupplierMutation.isPending || updateSupplierMutation.isPending}
                  className="w-full"
                >
                  {editingSupplier ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>

            {/* List */}
            <div className="md:col-span-7 space-y-3">
              <h4 className="text-sm font-bold text-white pb-2 border-b border-white/5 flex items-center gap-2">
                <Truck size={16} className="text-emerald-400" />
                Supplier Directory
              </h4>
              <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto pr-1">
                {suppliers.length > 0 ? (
                  suppliers.map((s) => (
                    <div key={s.id} className="flex justify-between items-center py-2.5 hover:bg-white/[0.01] px-2 rounded-lg transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">{s.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {s.company ? `${s.company}` : 'No company'}
                        </p>
                        {s.phone && (
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone size={10} />
                            {s.phone}
                          </p>
                        )}
                        {s.address && (
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} />
                            {s.address}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit2}
                        onClick={() => handleEditSupplier(s)}
                        className="p-2"
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-slate-500 text-sm">No suppliers found</p>
                )}
              </div>
            </div>

          </div>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && selectedPurchase && (
        <Modal
          id="view-purchase-modal"
          title={`GRN Details: ${selectedPurchase.grnNo}`}
          onClose={() => setShowViewModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            
            {/* Header cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">Supplier Info</span>
                <p className="font-bold text-sm text-white mt-1">{selectedPurchase.supplier?.name}</p>
                {selectedPurchase.supplier?.company && <p className="text-slate-400 text-xs mt-0.5">{selectedPurchase.supplier.company}</p>}
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">GRN Details</span>
                <p className="font-mono text-xs text-emerald-400 font-bold mt-1">Ref: {selectedPurchase.purchaseOrderRef || 'None'}</p>
                <p className="text-slate-400 text-xs mt-0.5">Date: {formatDate(selectedPurchase.purchaseDate)}</p>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">Payment Information</span>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={selectedPurchase.paymentMethod === 'LIABILITY' ? 'warning' : 'success'}>
                    {selectedPurchase.paymentMethod}
                  </Badge>
                  {selectedPurchase.liability && (
                    <Badge variant={selectedPurchase.liability.status === 'PAID' ? 'success' : 'danger'}>
                      Liability: {selectedPurchase.liability.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Bilty Details */}
            {selectedPurchase.biltyNo && (
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2 text-xs">
                <h4 className="font-bold text-white text-[13px] flex items-center gap-1.5 border-b border-white/5 pb-1">
                  <Truck size={14} className="text-emerald-400" />
                  Bilty / Transporter Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                  <div>
                    <span className="text-slate-500">Bilty Number:</span>
                    <p className="font-semibold text-white mt-0.5">{selectedPurchase.biltyNo}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Transporter:</span>
                    <p className="font-semibold text-white mt-0.5">{selectedPurchase.transporterName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Transport Cost:</span>
                    <p className="font-semibold text-white mt-0.5">{formatCurrency(selectedPurchase.transportCost)} ({selectedPurchase.transportPaymentMethod})</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Bilty Date:</span>
                    <p className="font-semibold text-white mt-0.5">{selectedPurchase.biltyDate ? formatDate(selectedPurchase.biltyDate) : '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Item Details</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Purchase Price</th>
                      <th className="py-2 text-right">Sale Price</th>
                      <th className="py-2 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedPurchase.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01]">
                        <td className="py-2.5 font-medium text-white">
                          {item.product?.name || `Product #${item.productId}`}
                          {item.batchNo && <span className="block text-[10px] text-slate-500">Batch: {item.batchNo} {item.expiryDate && `| Expiry: ${formatDate(item.expiryDate)}`}</span>}
                        </td>
                        <td className="py-2.5 text-right text-slate-300">
                          {item.quantity} {item.product?.unit || 'bags'}
                        </td>
                        <td className="py-2.5 text-right text-slate-300">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2.5 text-right text-emerald-400">
                          {formatCurrency(item.salePrice || 0)}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-white">
                          {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary details */}
            <div className="pt-4 border-t border-white/5 space-y-2 text-sm">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Goods purchase total:</span>
                <span>{formatCurrency(selectedPurchase.total)}</span>
              </div>
              {selectedPurchase.transportCost > 0 && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Transport cost:</span>
                  <span>{formatCurrency(selectedPurchase.transportCost)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-white/5 font-extrabold text-white text-base">
                <span>Grand Total:</span>
                <span className="text-emerald-400 text-lg">
                  {formatCurrency(selectedPurchase.grandTotal || selectedPurchase.total)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Purchases;

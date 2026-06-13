import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Search, Plus, Eye, Truck, RefreshCw, 
  Trash2, Edit2, ShoppingBag, PlusCircle, Package, Layers, DollarSign, Hash, Calendar,
  User, Phone, MapPin
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
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // New Purchase Form State & Validation
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([{ productId: '', quantity: '', unitPrice: '', batchNo: '', expiryDate: '' }]);
  const [errors, setErrors] = useState({});

  // Supplier Form State & Validation
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supErrors, setSupErrors] = useState({});

  // Fetch Purchases
  const { data: purchasesData, isLoading: purchasesLoading, isFetching: purchasesFetching } = useQuery({
    queryKey: ['purchases', search, page],
    queryFn: () => getPurchases({ page, limit, search, sort: '-createdAt' }),
  });
  const purchases = Array.isArray(purchasesData?.data) ? purchasesData.data : (purchasesData?.data?.purchases || purchasesData?.purchases || []);
  const totalPurchases = purchasesData?.pagination?.total || purchasesData?.data?.total || purchasesData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalPurchases / limit));

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
    onSuccess: () => {
      toast.success('Purchase GRN recorded! Stock levels updated.');
      queryClient.invalidateQueries(['purchases']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboard']);
      setShowPurchaseModal(false);
      resetPurchaseForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record purchase');
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
      
      // Auto fill price from product sale/purchase price if product changes
      if (field === 'productId') {
        const prod = products.find(p => p.id === parseInt(val));
        if (prod) {
          updated.unitPrice = prod.purchasePrice;
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
      } else {
        delete errs.items[idx].quantity;
      }
    }
    if (field === 'unitPrice') {
      if (!val) {
        errs.items[idx].unitPrice = 'Required';
      } else if (parseFloat(val) <= 0) {
        errs.items[idx].unitPrice = 'Must be > 0';
      } else {
        delete errs.items[idx].unitPrice;
      }
    }
    setErrors(errs);
  };

  const resetPurchaseForm = () => {
    setSelectedSupplierId('');
    setPurchaseItems([{ productId: '', quantity: '', unitPrice: '', batchNo: '', expiryDate: '' }]);
    setErrors({});
  };

  const handlePurchaseSubmit = (e) => {
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
      }
      if (!item.unitPrice) {
        rowErr.unitPrice = 'Cost is required';
        hasError = true;
      } else if (parseFloat(item.unitPrice) <= 0) {
        rowErr.unitPrice = 'Must be > 0';
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
      items: purchaseItems.map(item => ({
        productId: parseInt(item.productId),
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        batchNo: item.batchNo || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
      }))
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
              onChange={(val) => { setSearch(val); setPage(1); }}
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
        <Table
          id="purchases-table"
          loading={purchasesLoading || purchasesFetching}
          headers={['GRN Number', 'Date', 'Supplier', 'Items Qty', 'Total Bill', 'Status', 'Actions']}
          onPageChange={setPage}
          currentPage={page}
          totalPages={totalPages}
        >
          {purchases.length > 0 ? (
            purchases.map((pur) => (
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
                  {formatCurrency(pur.total)}
                </td>
                <td className="px-4 py-3 text-xs">
                  <Badge variant="success">RECEIVED</Badge>
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
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-7 py-16 text-center text-slate-500">
                No purchases found
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Record Purchase Modal */}
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
                loading={createPurchaseMutation.isPending}
              >
                Confirm Goods Received
              </Button>
            </>
          }
        >
          <form id="purchase-form" onSubmit={handlePurchaseSubmit} className="space-y-6">
            
            {/* Supplier Select */}
            <Select
              id="pur-supplier-select"
              label="Supplier *"
              required
              icon={Truck}
              options={suppliers.map(s => ({ value: s.id, label: `${s.name} ${s.company ? `(${s.company})` : ''}` }))}
              value={selectedSupplierId}
              error={errors.supplierId}
              onChange={(e) => { setSelectedSupplierId(e.target.value); if (errors.supplierId) setErrors(prev => ({ ...prev, supplierId: null })); }}
            />

            {/* Items Rows */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#1e2330]">
                <h4 className="text-[15px] font-bold text-white">Purchase Items</h4>
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

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-[#161b27]/50 border border-[#2a2f3d] rounded-xl items-end">
                    
                    <div className="sm:col-span-4">
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

                    <div className="sm:col-span-2">
                      <Input
                        id={`pur-qty-${idx}`}
                        label="Qty *"
                        type="number"
                        required
                        min="1"
                        icon={Layers}
                        placeholder="0"
                        value={item.quantity}
                        error={errors.items?.[idx]?.quantity}
                        onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        id={`pur-price-${idx}`}
                        label="Cost *"
                        type="number"
                        required
                        min="1"
                        placeholder="0"
                        icon={DollarSign}
                        value={item.unitPrice}
                        error={errors.items?.[idx]?.unitPrice}
                        onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        id={`pur-batch-${idx}`}
                        label="Batch"
                        icon={Hash}
                        placeholder="Batch..."
                        value={item.batchNo}
                        onChange={(e) => handleRowChange(idx, 'batchNo', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <DatePicker
                        id={`pur-expiry-${idx}`}
                        label="Expiry"
                        value={item.expiryDate}
                        onChange={(e) => handleRowChange(idx, 'expiryDate', e.target.value)}
                        className="!text-[11px]"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-center pb-1">
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
                Total purchase cost:
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(calculatePurchaseTotal())}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <Modal
          id="supplier-mgmt-modal"
          title="Supplier Management"
          onClose={() => setShowSupplierModal(false)}
        >
          <div className="space-y-6">
            
            {/* Create/Edit Supplier Form */}
            <form onSubmit={handleSupplierSubmit} className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <h4 className="text-sm font-semibold text-white mb-2">
                {editingSupplier ? 'Edit Supplier Details' : 'Create New Supplier'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="sup-name"
                  placeholder="Supplier Name *"
                  icon={User}
                  value={supName}
                  error={supErrors.name}
                  onChange={(e) => { setSupName(e.target.value); if (supErrors.name) setSupErrors(prev => ({ ...prev, name: null })); }}
                  required
                />
                <Input
                  id="sup-phone"
                  placeholder="Phone..."
                  icon={Phone}
                  value={supPhone}
                  error={supErrors.phone}
                  onChange={(e) => { setSupPhone(e.target.value); if (supErrors.phone) setSupErrors(prev => ({ ...prev, phone: null })); }}
                />
              </div>
              <Input
                id="sup-company"
                placeholder="Company / Shop Name..."
                icon={Truck}
                value={supCompany}
                onChange={(e) => setSupCompany(e.target.value)}
              />
              <Input
                id="sup-addr"
                placeholder="Address..."
                icon={MapPin}
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
              />
              <div className="flex gap-2">
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
                  {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </Button>
              </div>
            </form>


            {/* List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Supplier Directory</h4>
              <div className="divide-y divide-white/5 max-h-56 overflow-y-auto pr-1">
                {suppliers.map((s) => (
                  <div key={s.id} className="flex justify-between items-center py-2.5">
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.company ? `${s.company} | ` : ''}{s.phone || 'No phone'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleEditSupplier(s)}
                      className="p-2"
                    />
                  </div>
                ))}
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
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5 text-sm">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-semibold text-white">{selectedPurchase.supplier?.name}</p>
                {selectedPurchase.supplier?.company && <p className="text-slate-400 text-xs">{selectedPurchase.supplier.company}</p>}
              </div>
              <div className="text-right">
                <p className="text-slate-500">Received Date</p>
                <p className="font-semibold text-white">{formatDate(selectedPurchase.purchaseDate)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item Details</p>
              <div className="divide-y divide-white/5">
                {selectedPurchase.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 text-sm">
                    <div>
                      <p className="font-semibold text-white">{item.product?.name || `Product #${item.productId}`}</p>
                      <p className="text-xs text-slate-500">
                        Cost: {formatCurrency(item.unitPrice)} | Qty: {item.quantity} {item.product?.unit || 'bags'}
                        {item.batchNo && ` | Batch: ${item.batchNo}`}
                      </p>
                    </div>
                    <div className="font-bold text-white">
                      {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitPrice))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/5 font-bold">
              <span className="text-white">Total Amount:</span>
              <span className="text-emerald-400 text-lg">{formatCurrency(selectedPurchase.total)}</span>
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

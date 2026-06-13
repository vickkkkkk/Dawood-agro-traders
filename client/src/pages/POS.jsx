import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, UserPlus,
  CreditCard, Printer, ShoppingBag, Landmark, Phone,
  User, MapPin, DollarSign
} from 'lucide-react';
import { getProducts, getCategories } from '../api/inventory';
import { getCustomers, createCustomer } from '../api/customers';
import { createBill } from '../api/billing';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { formatCurrency } from '../utils/formatCurrency';
import { PAYMENT_METHOD_LABELS } from '../utils/constants';

const POS = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Keyboard shortcut listener to focus search input when '/' is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('pos-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [creditAmountPaid, setCreditAmountPaid] = useState('');

  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [latestBill, setLatestBill] = useState(null);

  // Customer form state & Validation
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerBalanceType, setCustomerBalanceType] = useState('OUTSTANDING');
  const [customerBalanceAmount, setCustomerBalanceAmount] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch products with corrected categoryId param
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => getProducts({
      limit: 100,
      categoryId: selectedCategory || undefined
    }),
  });
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.products || productsData?.products || []);

  // Fetch categories dynamically
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  const categoriesList = categoriesData?.data || categoriesData || [];

  const categoriesOptions = [
    { value: '', label: 'Filter by Category' },
    ...categoriesList.map(c => ({ value: c.id, label: c.name }))
  ];

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => getCustomers({ limit: 500 }),
  });
  const customers = Array.isArray(customersData?.data) ? customersData.data : (customersData?.data?.customers || customersData?.customers || []);

  // Customer creation mutation
  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      toast.success('Customer added successfully!');
      queryClient.invalidateQueries(['customers']);
      setSelectedCustomerId(data?.data?.id || data?.id);
      setShowCustomerModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerBalanceType('OUTSTANDING');
      setCustomerBalanceAmount('');
      setErrors({});
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to add customer');
    }
  });


  // Bill creation mutation
  const createBillMutation = useMutation({
    mutationFn: createBill,
    onSuccess: (data) => {
      toast.success('Bill generated successfully!');
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['dashboard']);
      setLatestBill(data?.data || data);
      setCart([]);
      setDiscount(0);
      setSelectedCustomerId('');
      setCashTendered('');
      setCreditAmountPaid('');
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to generate bill');
    }
  });

  // Cart Handlers
  const addToCart = (product) => {
    if (parseFloat(product.stockQty) <= 0) {
      toast.error('Product is out of stock!');
      return;
    }

    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > parseFloat(product.stockQty)) {
          toast.error(`Cannot add more. Available stock: ${product.stockQty}`);
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, newQty, maxStock) => {
    if (newQty === '') {
      setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: '' } : item));
      return;
    }
    const num = parseFloat(newQty);
    if (isNaN(num) || num <= 0) {
      removeFromCart(productId);
      return;
    }
    if (num > maxStock) {
      toast.error(`Cannot exceed available stock of ${maxStock} bags`);
      return;
    }
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: num } : item));
  };

  const updatePrice = (productId, newPrice) => {
    if (newPrice === '') {
      setCart(prev => prev.map(item => item.id === productId ? { ...item, salePrice: '' } : item));
      return;
    }
    const num = parseFloat(newPrice);
    if (isNaN(num) || num < 0) return;
    setCart(prev => prev.map(item => item.id === productId ? { ...item, salePrice: num } : item));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + ((parseFloat(item.salePrice) || 0) * (parseFloat(item.quantity) || 0)), 0);
  const discountAmount = (subtotal * parseFloat(discount || 0)) / 100;
  const total = Math.max(0, subtotal - discountAmount);
  const changeDue = cashTendered ? Math.max(0, parseFloat(cashTendered) - total) : 0;

  // Client-side search filters
  const filteredProducts = products.filter(p =>
    p.isActive &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const validateCustomerField = (field, value) => {
    let errs = { ...errors };
    if (field === 'customerName') {
      if (!value) {
        errs.customerName = 'Customer name is required';
      } else if (value.trim().length < 3) {
        errs.customerName = 'Name must be at least 3 characters';
      } else {
        delete errs.customerName;
      }
    }
    if (field === 'customerPhone') {
      if (!value) {
        errs.customerPhone = 'Phone number is required';
      } else if (!/^\d{10,11}$/.test(value.replace(/[\s-]/g, ''))) {
        errs.customerPhone = 'Phone must be a valid number (10-11 digits)';
      } else {
        delete errs.customerPhone;
      }
    }
    setErrors(errs);
  };

  const validateCashTendered = (val) => {
    let errs = { ...errors };
    if (val && parseFloat(val) < total) {
      errs.cashTendered = `Amount must be at least the total bill of Rs. ${total.toLocaleString()}`;
    } else {
      delete errs.cashTendered;
    }
    setErrors(errs);
  };

  const handleAddCustomerSubmit = (e) => {
    e.preventDefault();

    const nameErr = !customerName ? 'Customer name is required' : customerName.trim().length < 3 ? 'Name must be at least 3 characters' : null;
    const phoneErr = !customerPhone ? 'Phone number is required' : !/^\d{10,11}$/.test(customerPhone.replace(/[\s-]/g, '')) ? 'Phone must be a valid number (10-11 digits)' : null;

    if (nameErr || phoneErr) {
      setErrors({
        customerName: nameErr,
        customerPhone: phoneErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }

    const amountVal = parseFloat(customerBalanceAmount) || 0;
    const signedBalance = customerBalanceType === 'ADVANCE' ? -amountVal : amountVal;

    createCustomerMutation.mutate({
      name: customerName,
      phone: customerPhone,
      address: customerAddress,
      initialBalance: signedBalance
    });
  };

  const handleCheckoutSubmit = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (paymentMethod === 'CREDIT' && !selectedCustomerId) {
      toast.error('Customer is REQUIRED for Credit/Udhar transactions');
      return;
    }

    if (paymentMethod === 'CASH' && cashTendered && parseFloat(cashTendered) < total) {
      setErrors(prev => ({
        ...prev,
        cashTendered: `Amount must be at least the total bill of Rs. ${total.toLocaleString()}`
      }));
      toast.error('Cash tendered is less than total bill');
      return;
    }

    const cashPaidVal = paymentMethod === 'CREDIT' ? (parseFloat(creditAmountPaid) || 0) : total;

    if (paymentMethod === 'CREDIT' && cashPaidVal > total) {
      toast.error('Cash paid cannot exceed total bill amount');
      return;
    }

    const billItems = cart.map(item => ({
      productId: item.id,
      quantity: parseFloat(item.quantity) || 0,
      unitPrice: parseFloat(item.salePrice) || 0
    }));

    const payload = {
      customerId: selectedCustomerId ? parseInt(selectedCustomerId) : undefined,
      discount: discountAmount,
      paymentMethod,
      amountPaid: cashPaidVal,
      items: billItems
    };

    createBillMutation.mutate(payload);
  };

  const printReceipt = () => {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    window.location.reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative min-h-[calc(100vh-120px)]">

      {/* Left Column: Product Catalogue (7/12 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-5">

        {/* Search & Filter Header Card */}
        <Card compact className="bg-slate-900/40 backdrop-blur-xl border-white/5">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <Input
                id="pos-search"
                placeholder="Search products by name/SKU... (Press /)"
                icon={Search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pos-filter-input pos-filter-input-icon"
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                id="pos-category"
                options={categoriesOptions}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pos-filter-input pos-filter-select"
              />
            </div>
          </div>
        </Card>

        {/* Product Catalog Grid */}
        {productsLoading ? (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-900/20 border-white/5 p-8 text-center">
            <ShoppingBag size={56} className="mb-4 text-slate-600 animate-bounce-subtle" />
            <p className="text-base font-semibold text-slate-400">No products found</p>
            <p className="text-xs text-slate-500 mt-1 mb-6">Add items to inventory or check your search criteria.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate('/inventory', { state: { openAdd: true } })}
              >
                Add Product
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/inventory')}
              >
                Go to Inventory
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
            {filteredProducts.map((p) => {
              const outOfStock = parseFloat(p.stockQty) <= 0;
              const lowStock = parseFloat(p.stockQty) <= parseFloat(p.lowStockAlert);
              return (
                <div
                  key={p.id}
                  onClick={() => !outOfStock && addToCart(p)}
                  className={`
                    group flex items-center justify-between gap-4 rounded-xl bg-white/5 border border-white/5 p-3.5
                    cursor-pointer transition-all duration-200 hover:bg-white/10 hover:translate-x-1
                    ${outOfStock ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm tracking-wide truncate">{p.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-0.5 uppercase">{p.sku}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <Badge variant={outOfStock ? 'danger' : lowStock ? 'warning' : 'success'} size="sm">
                        {p.stockQty} bags
                      </Badge>
                    </div>

                    <div className="min-w-[100px] text-right">
                      <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-0.5">Price</p>
                      <span className="text-emerald-400 font-extrabold text-sm">
                        {formatCurrency(p.salePrice)}
                      </span>
                    </div>

                    <button
                      className={`
                        w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 
                        flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200
                        ${outOfStock ? 'pointer-events-none' : ''}
                      `}
                      aria-label="Add to cart"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Active Bill Panel (5/12 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <Card className="flex flex-col h-[calc(100vh-140px)] bg-slate-900/40 backdrop-blur-xl border-white/5 overflow-hidden" compact>

          {/* Cart Header */}
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShoppingCart size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Current Bill</h3>
            </div>
            <Badge variant="info" className="px-3 py-1 font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}
            </Badge>
          </div>

          {/* Customer Selection Row */}
          <div className="py-4 border-b border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="customer-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Selector</label>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">(Optional)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  id="customer-select"
                  placeholder="Walk-in Customer"
                  icon={User}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.phone}) - Udhar: ${formatCurrency(c.creditBalance)}`
                  }))}
                  className="w-full"
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setErrors({}); setShowCustomerModal(true); }}
                className="!p-3.5 !rounded-2xl"
                icon={UserPlus}
                title="Add New Customer"
                aria-label="Add New Customer"
              />
            </div>
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <ShoppingCart size={44} className="mb-3 text-slate-700 animate-pulse" />
                <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-500 mt-1">Select items from catalog list</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-1 mt-1 bg-slate-950/20 border border-white/5 rounded-lg px-2 py-0.5 w-max">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Price:</span>
                      <span className="text-[11px] text-slate-400 font-semibold">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        value={item.salePrice}
                        onChange={(e) => updatePrice(item.id, e.target.value)}
                        className="w-16 bg-transparent text-white focus:outline-none border-none text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 bg-slate-950/40 border border-white/10 rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.id, (parseFloat(item.quantity) || 0) - 1, item.stockQty)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.stockQty}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, e.target.value, item.stockQty)}
                      className="w-8 text-center bg-transparent text-white focus:outline-none border-none text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, (parseFloat(item.quantity) || 0) + 1, item.stockQty)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="text-right min-w-[80px] pr-1">
                    <p className="text-sm font-bold text-white">
                      {formatCurrency((parseFloat(item.salePrice) || 0) * (parseFloat(item.quantity) || 0))}
                    </p>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout Calculations */}
          <div className="pt-5 pb-2 border-t border-white/10 space-y-4">
            <div className="flex justify-between items-center text-sm text-slate-400 font-medium px-1">
              <span>Subtotal:</span>
              <span className="font-bold text-white">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center gap-4 px-1">
              <span className="text-sm text-slate-400 font-medium">Discount:</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-red-400">-{formatCurrency(discountAmount)}</span>
                <div className="flex items-center bg-slate-950/60 border border-white/10 rounded-xl focus-within:border-emerald-500/50 overflow-hidden transition-all duration-200">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-14 text-right bg-transparent text-white pl-2.5 pr-0.5 py-1.5 text-sm focus:outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-bold"
                  />
                  <span className="text-slate-400 text-xs font-bold pr-2.5 pl-0.5 pointer-events-none select-none">%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 pb-2 border-t-2 border-white/15 text-xl font-black text-white px-1">
              <span>Total Bill:</span>
              <span className="text-emerald-400 text-2xl font-black tracking-wide">{formatCurrency(total)}</span>
            </div>

            <div className="px-1" title={cart.length === 0 ? "Cart is empty. Please add products to checkout." : ""}>
              <Button
                id="btn-checkout"
                variant="primary"
                className="w-full !py-3.5 !rounded-2xl font-bold uppercase tracking-wider text-sm mt-1"
                disabled={cart.length === 0}
                onClick={() => { setErrors({}); setCreditAmountPaid(''); setShowCheckoutModal(true); }}
              >
                Checkout & Pay
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <Modal
          id="checkout-modal"
          title="Payment Details"
          onClose={() => setShowCheckoutModal(false)}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CASH', label: 'Cash', icon: Landmark },
                  { id: 'JAZZCASH', label: 'JazzCash', icon: CreditCard },
                  { id: 'EASYPAISA', label: 'EasyPaisa', icon: CreditCard },
                  { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark },
                  { id: 'CREDIT', label: 'Credit (Udhar)', icon: CreditCard }
                ].map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`
                        flex items-center gap-2.5 p-3.5 rounded-2xl border text-sm font-semibold transition-all cursor-pointer
                        ${isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/5'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }
                      `}
                    >
                      <Icon size={16} />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === 'CREDIT' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                  <p className="text-xs text-amber-300 font-medium leading-relaxed">
                    ⚠️ Credit/Udhar is selected. Customer profile is REQUIRED.
                  </p>
                  {!selectedCustomerId ? (
                    <p className="text-xs text-red-400 font-bold">
                      Please select a customer on the cart panel before checking out.
                    </p>
                  ) : (
                    <div className="space-y-3 pt-1 border-t border-amber-500/10">
                      <Input
                        id="credit-cash-paid"
                        label="Cash Paid (Down Payment)"
                        type="number"
                        placeholder="Enter cash received (if any)..."
                        value={creditAmountPaid}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= total)) {
                            setCreditAmountPaid(val);
                            setErrors(prev => ({ ...prev, creditAmountPaid: null }));
                          } else {
                            setErrors(prev => ({ ...prev, creditAmountPaid: `Amount cannot exceed the total bill of Rs. ${total.toLocaleString()}` }));
                          }
                        }}
                        error={errors.creditAmountPaid}
                        icon={DollarSign}
                        className="!py-3 !rounded-xl"
                      />
                      
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5 text-xs font-semibold">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Paid in Cash:</span>
                          <span className="text-white">Rs. {(parseFloat(creditAmountPaid) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-amber-400">
                          <span>Going to Credit (Udhar):</span>
                          <span>Rs. {Math.max(0, total - (parseFloat(creditAmountPaid) || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div className="space-y-3 p-4 bg-slate-950/40 border border-white/10 rounded-2xl">
                <Input
                  id="cash-tendered-input"
                  label="Cash Tendered"
                  type="number"
                  placeholder="Enter amount customer gave..."
                  value={cashTendered}
                  error={errors.cashTendered}
                  icon={DollarSign}
                  onChange={(e) => { setCashTendered(e.target.value); if (errors.cashTendered) validateCashTendered(e.target.value); }}
                  onBlur={(e) => validateCashTendered(e.target.value)}
                  className="!py-3 !rounded-xl"
                />
                <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-white/5 font-semibold">
                  <span className="text-slate-400">Change Due:</span>
                  <span className="font-extrabold text-white text-base">{formatCurrency(changeDue)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-sm pt-4 border-t border-white/10">
              <span className="text-slate-400 font-medium">Total payable:</span>
              <span className="font-extrabold text-lg text-emerald-400">{formatCurrency(total)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" className="!rounded-xl" onClick={() => setShowCheckoutModal(false)}>Cancel</Button>
              <Button
                id="btn-confirm-checkout"
                variant="primary"
                className="!rounded-xl px-5 font-bold"
                onClick={handleCheckoutSubmit}
                loading={createBillMutation.isPending}
                disabled={paymentMethod === 'CREDIT' && !selectedCustomerId}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Customer Add Modal */}
      {showCustomerModal && (
        <Modal
          id="customer-modal"
          title="Add New Customer"
          onClose={() => setShowCustomerModal(false)}
          size="lg"
          footer={
            <>
              <Button variant="secondary" className="!rounded-xl" onClick={() => setShowCustomerModal(false)}>Cancel</Button>
              <Button
                type="submit"
                form="pos-add-customer-form"
                variant="primary"
                className="!rounded-xl font-bold"
                loading={createCustomerMutation.isPending}
              >
                Save Customer
              </Button>
            </>
          }
        >
          <form id="pos-add-customer-form" onSubmit={handleAddCustomerSubmit} className="space-y-5">
            <Input
              id="cust-name-input"
              label="Customer Name *"
              required
              icon={User}
              placeholder="e.g. Haji Muhammad..."
              value={customerName}
              error={errors.customerName}
              onChange={(e) => { setCustomerName(e.target.value); if (errors.customerName) validateCustomerField('customerName', e.target.value); }}
              onBlur={(e) => validateCustomerField('customerName', e.target.value)}
            />
            <Input
              id="cust-phone-input"
              label="Phone Number *"
              required
              icon={Phone}
              placeholder="e.g. 03001234567"
              value={customerPhone}
              error={errors.customerPhone}
              onChange={(e) => { setCustomerPhone(e.target.value); if (errors.customerPhone) validateCustomerField('customerPhone', e.target.value); }}
              onBlur={(e) => validateCustomerField('customerPhone', e.target.value)}
            />
            <Input
              id="cust-addr-input"
              label="Address (Optional)"
              icon={MapPin}
              placeholder="e.g. Chak No. 45, Sahiwal..."
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="cust-balance-type"
                label="Initial Balance Type"
                options={[
                  { value: 'OUTSTANDING', label: 'Outstanding Udhar (Owed to Shop)' },
                  { value: 'ADVANCE', label: 'Advance Payment (Paid to Shop)' }
                ]}
                value={customerBalanceType}
                onChange={(e) => setCustomerBalanceType(e.target.value)}
              />
              <Input
                id="cust-balance-amount"
                label="Initial Balance Amount (PKR)"
                type="number"
                min="0"
                icon={Landmark}
                placeholder="e.g. 5000"
                value={customerBalanceAmount}
                onChange={(e) => setCustomerBalanceAmount(e.target.value)}
              />
            </div>

          </form>
        </Modal>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && latestBill && (
        <Modal
          id="receipt-modal"
          title="Sale Completed"
          onClose={() => setShowReceiptModal(false)}
        >
          <div className="space-y-4">
            <div
              id="receipt-print-area"
              className="bg-white text-black p-6 rounded-xl font-sans text-xs max-w-sm mx-auto shadow-inner"
            >
              <div className="text-center space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3">
                <h2 className="text-sm font-bold tracking-wide">DAWOOD AGRO TRADERS</h2>
                <p className="text-[10px] text-gray-600">Old Grain Market, Vehari, Pakistan</p>
                <p className="text-[10px] text-gray-600">Phone: 0300-1234567</p>
                <p className="text-[10px] font-mono mt-2 text-gray-700">INVOICE: {latestBill.billNo}</p>
                <p className="text-[9px] text-gray-500">Date: {new Date(latestBill.billDate).toLocaleString('en-PK')}</p>
              </div>

              <div className="space-y-1 mb-4">
                <p><span className="font-semibold text-gray-700">Cashier:</span> {latestBill.user?.name || 'Cashier Counter'}</p>
                <p><span className="font-semibold text-gray-700">Customer:</span> {latestBill.customer?.name || 'Walk-in Customer'}</p>
                {latestBill.customer?.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {latestBill.customer.phone}</p>}
                <p><span className="font-semibold text-gray-700">Payment:</span> {PAYMENT_METHOD_LABELS[latestBill.paymentMethod]}</p>
              </div>

              <table className="w-full border-t border-b border-dashed border-gray-400 py-2 my-2">
                <thead>
                  <tr className="border-b border-gray-300 font-semibold text-gray-700">
                    <th className="text-left py-1">Item</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Price</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {latestBill.items?.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1">{item.product?.name}</td>
                      <td className="text-center py-1">{parseFloat(item.quantity)}</td>
                      <td className="text-right py-1">{parseFloat(item.unitPrice).toFixed(0)}</td>
                      <td className="text-right py-1">{parseFloat(item.total).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1.5 text-right font-medium mt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>Rs. {parseFloat(latestBill.subtotal).toLocaleString()}</span>
                </div>
                {parseFloat(latestBill.discount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-Rs. {parseFloat(latestBill.discount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-black border-t border-gray-300 pt-1">
                  <span>Grand Total:</span>
                  <span>Rs. {parseFloat(latestBill.total).toLocaleString()}</span>
                </div>

                {latestBill.paymentMethod === 'CREDIT' ? (
                  <div className="space-y-1 border-t border-dashed border-gray-300 pt-1 text-[10px]">
                    {parseFloat(latestBill.amountPaid) > 0 && (
                      <div className="flex justify-between text-gray-600 font-semibold">
                        <span>Down Payment (Cash):</span>
                        <span>Rs. {parseFloat(latestBill.amountPaid).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Credit Added:</span>
                      <span>Rs. {parseFloat(latestBill.creditAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-700 font-semibold">
                      <span>Total Balance:</span>
                      <span>Rs. {parseFloat(latestBill.customer?.creditBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-600">
                    <span>Amount Paid:</span>
                    <span>Rs. {parseFloat(latestBill.amountPaid).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-400">
                <p className="font-semibold text-[10px]">Thank you for your business!</p>
                <p className="text-[9px] text-gray-500">Produce of Pakistan</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="!rounded-xl" onClick={() => setShowReceiptModal(false)}>Close</Button>
              <Button variant="primary" className="!rounded-xl font-bold" icon={Printer} onClick={printReceipt}>Print Bill</Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default POS;

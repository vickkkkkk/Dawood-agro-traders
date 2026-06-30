import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Search, Plus, Edit2, Trash2, Package, RefreshCw,
  AlertTriangle, Calendar, Award, Barcode, Layers, DollarSign, Hash, Tag, FileText
} from 'lucide-react';
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getCategories, createCategory, updateCategory, deleteCategory,
  getLowStock, getExpiring
} from '../api/inventory';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import DatePicker from '../components/ui/DatePicker';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { getStockStatusColor } from '../utils/constants';

const Inventory = () => {
  const queryClient = useQueryClient();
  const location = useLocation();

  // Open Add Product Modal if navigated from POS page with openAdd state
  useEffect(() => {
    if (location.state?.openAdd) {
      handleOpenAdd();
      // Clear navigation state to prevent re-opening on manual refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  // Debounce search input
  const searchTimerRef = useRef(null);
  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  }, []);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Form State - Product & Validation
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [unit, setUnit] = useState('bags');
  const [lowStockAlert, setLowStockAlert] = useState(10);
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [errors, setErrors] = useState({});

  // Form State - Category
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catErrors, setCatErrors] = useState({});

  // Fetch Products
  const { data: productsData, isLoading: productsLoading, isFetching: productsFetching } = useQuery({
    queryKey: ['products', debouncedSearch, categoryFilter, stockStatusFilter],
    queryFn: () => getProducts({
      page: 1,
      limit: 9999,
      search: debouncedSearch,
      category: categoryFilter,
      stockStatus: stockStatusFilter
    }),
    placeholderData: keepPreviousData,
  });
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.products || productsData?.products || []);

  // Fetch Categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  const categoriesList = categoriesData?.data || categoriesData || [];

  // Low Stock & Expiring Queries
  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock'],
    queryFn: getLowStock,
  });
  const lowStockList = lowStockData?.data || lowStockData || [];

  const { data: expiringData } = useQuery({
    queryKey: ['expiring-products'],
    queryFn: getExpiring,
  });
  const expiringList = expiringData?.data || expiringData || [];

  // Mutations
  const addProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast.success('Product created successfully!');
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['low-stock']);
      setShowProductModal(false);
      resetProductForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create product');
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => updateProduct(id, data),
    onSuccess: () => {
      toast.success('Product updated successfully!');
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['low-stock']);
      setShowProductModal(false);
      resetProductForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update product');
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success('Product deleted successfully');
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['low-stock']);
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to delete product');
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success('Category added!');
      queryClient.invalidateQueries(['categories']);
      setNewCatName('');
      setNewCatDesc('');
      setCatErrors({});
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to add category');
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success('Category deleted!');
      queryClient.invalidateQueries(['categories']);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to delete category');
    }
  });

  // Validation helper
  const validateField = (field, value) => {
    let errs = { ...errors };
    if (field === 'name') {
      if (!value) {
        errs.name = 'Product name is required';
      } else if (value.trim().length < 3) {
        errs.name = 'Product name must be at least 3 characters';
      } else {
        delete errs.name;
      }
    }
    if (field === 'sku') {
      delete errs.sku;
    }
    if (field === 'categoryId') {
      delete errs.categoryId;
    }
    if (field === 'stockQty') {
      if (value !== '' && parseFloat(value) < 0) {
        errs.stockQty = 'Stock cannot be negative';
      } else {
        delete errs.stockQty;
      }
    }
    if (field === 'lowStockAlert') {
      if (value !== '' && parseFloat(value) < 0) {
        errs.lowStockAlert = 'Alert level cannot be negative';
      } else {
        delete errs.lowStockAlert;
      }
    }
    if (field === 'purchasePrice') {
      if (value !== '' && parseFloat(value) < 0) {
        errs.purchasePrice = 'Purchase price cannot be negative';
      } else {
        delete errs.purchasePrice;
      }
    }
    if (field === 'salePrice') {
      if (value !== '' && parseFloat(value) < 0) {
        errs.salePrice = 'Sale price cannot be negative';
      } else {
        delete errs.salePrice;
      }
    }
    setErrors(errs);
  };

  // Helper Handlers
  const handleOpenAdd = () => {
    setEditingProduct(null);
    resetProductForm();
    setShowProductModal(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setCategoryId(product.categoryId);
    setPurchasePrice(product.purchasePrice);
    setSalePrice(product.salePrice);
    setStockQty(product.stockQty);
    setUnit(product.unit || 'bags');
    setLowStockAlert(product.lowStockAlert);
    setExpiryDate(product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : '');
    setBatchNo(product.batchNo || '');
    setErrors({});
    setShowProductModal(true);
  };

  const resetProductForm = () => {
    setName('');
    setSku('');
    setCategoryId('');
    setPurchasePrice('');
    setSalePrice('');
    setStockQty('');
    setUnit('bags');
    setLowStockAlert(10);
    setExpiryDate('');
    setBatchNo('');
    setErrors({});
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();

    let finalSku = sku;
    if (!editingProduct) {
      const cleanName = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      finalSku = `${cleanName || 'prod'}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Run all validations
    const nameErr = !name ? 'Product name is required' : name.trim().length < 3 ? 'Product name must be at least 3 characters' : null;
    const skuErr = null;
    const categoryErr = null;
    const stockErr = stockQty !== '' && parseFloat(stockQty) < 0 ? 'Stock cannot be negative' : null;
    const alertErr = lowStockAlert !== '' && parseFloat(lowStockAlert) < 0 ? 'Alert level cannot be negative' : null;
    const purchaseErr = purchasePrice !== '' && parseFloat(purchasePrice) < 0 ? 'Purchase price cannot be negative' : null;
    const saleErr = salePrice !== '' && parseFloat(salePrice) < 0 ? 'Sale price cannot be negative' : null;

    if (nameErr || skuErr || categoryErr || stockErr || alertErr || purchaseErr || saleErr) {
      setErrors({
        name: nameErr,
        sku: skuErr,
        categoryId: categoryErr,
        stockQty: stockErr,
        lowStockAlert: alertErr,
        purchasePrice: purchaseErr,
        salePrice: saleErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }


    const payload = {
      name,
      sku: finalSku,
      categoryId: categoryId ? parseInt(categoryId) : null,
      purchasePrice: purchasePrice !== '' ? parseFloat(purchasePrice) : 0,
      salePrice: salePrice !== '' ? parseFloat(salePrice) : 0,
      stockQty: stockQty !== '' ? parseFloat(stockQty) : 0,
      unit: unit || 'bags',
      lowStockAlert: lowStockAlert !== '' ? parseFloat(lowStockAlert) : 10,
      expiryDate: expiryDate || null,
      batchNo: batchNo || null
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      addProductMutation.mutate(payload);
    }
  };

  const handleAddCategorySubmit = (e) => {
    e.preventDefault();
    if (!newCatName) return;
    addCategoryMutation.mutate({ name: newCatName, description: newCatDesc });
  };

  const categoryOptions = [
    { value: '', label: 'Select Category' },
    ...categoriesList.map(c => ({ value: c.id, label: c.name }))
  ];

  const categoryFilterOptions = [
    { value: '', label: 'All Categories' },
    ...categoriesList.map(c => ({ value: c.name, label: c.name }))
  ];

  const stockStatusOptions = [
    { value: '', label: 'All Stock Levels' },
    { value: 'normal', label: 'Normal Stock' },
    { value: 'low', label: 'Low Stock' },
    { value: 'out', label: 'Out of Stock' },
  ];

  return (
    <div className="app-container animate-fade-in">

      {/* Top action cards: Low Stock alerts, Expiring list */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Low Stock Alerts */}
        <Card className="border-red-500/10 bg-red-500/[0.02]">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-semibold text-white">Low Stock Alerts</h3>
            </div>
            <Badge variant="danger" size="sm">{lowStockList.length} items</Badge>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {lowStockList.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center">All products are well stocked!</p>
            ) : (
              lowStockList.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg border border-red-500/15">
                  <span className="text-xs text-slate-300 font-semibold truncate max-w-[200px]">{item.name}</span>
                  <span className="text-xs font-bold text-red-400">{item.stockQty} {item.unit || 'bags'} left (Alert: {item.lowStockAlert})</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Expiring Soon */}
        <Card className="border-amber-500/10 bg-amber-500/[0.02]">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Calendar size={20} />
              <h3 className="text-lg font-semibold text-white">Expiring Within 30 Days</h3>
            </div>
            <Badge variant="warning" size="sm">{expiringList.length} items</Badge>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {expiringList.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center">No products expiring soon.</p>
            ) : (
              expiringList.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg border border-amber-500/15">
                  <span className="text-xs text-slate-300 font-semibold truncate max-w-[200px]">{item.name}</span>
                  <span className="text-xs font-bold text-amber-400">Expires: {formatDate(item.expiryDate)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Main control panel */}
      <Card compact>
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-1 w-full">
            <SearchBar
              id="inventory-search"
              placeholder="Search products by name/SKU..."
              value={search}
              onChange={handleSearchChange}
            />
            <Select
              id="inventory-category"
              options={categoryFilterOptions}
              className="pos-filter-input pos-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select
              id="inventory-stock-status"
              options={stockStatusOptions}
              className="pos-filter-input pos-filter-select"
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
            />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button
              variant="secondary"
              onClick={() => setShowCategoryModal(true)}
              className="pos-filter-btn w-full md:w-auto"
            >
              Categories
            </Button>
            <Button
              id="btn-add-product"
              variant="primary"
              icon={Plus}
              onClick={handleOpenAdd}
              className="pos-filter-btn w-full md:w-auto"
            >
              Add Product
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <Table
          id="products-table"
          loading={productsLoading || productsFetching}
          headers={['Product Name', 'Category', 'Purchase Price', 'Sale Price', 'Stock Qty', 'Low Stock Alert', 'Batch / Expiry', 'Actions']}
          showPagination={false}
        >
          {products.length > 0 ? (
            products.map((p) => {
              const statusColor = getStockStatusColor(parseFloat(p.stockQty));
              return (
                <tr key={p.id}>
                  <td>
                    <p className="font-semibold text-white text-sm">{p.name}</p>
                  </td>
                  <td className="text-sm text-slate-300">
                    {p.category?.name || 'General'}
                  </td>
                  <td className="text-sm text-slate-400">
                    {formatCurrency(p.purchasePrice)}
                  </td>
                  <td className="text-sm font-bold text-white">
                    {formatCurrency(p.salePrice)}
                  </td>
                  <td>
                    <span className={`text-xs font-bold ${statusColor.text}`}>
                      {p.stockQty} {p.unit || 'bags'}
                    </span>
                  </td>
                  <td className="text-sm text-slate-400">
                    {p.lowStockAlert} {p.unit || 'bags'}
                  </td>
                  <td className="text-xs text-slate-400 space-y-0.5">
                    {p.batchNo && <p><span className="text-slate-500">Batch:</span> {p.batchNo}</p>}
                    {p.expiryDate ? (
                      <p><span className="text-slate-500">Exp:</span> {formatDate(p.expiryDate)}</p>
                    ) : (
                      <p className="text-slate-600">-</p>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button
                        id={`btn-edit-${p.sku}`}
                        variant="secondary"
                        size="sm"
                        icon={Edit2}
                        onClick={() => handleOpenEditModal(p)}
                        className="p-1"
                      />
                      <Button
                        id={`btn-delete-${p.sku}`}
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => { setProductToDelete(p); setShowDeleteConfirm(true); }}
                        className="p-1"
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} className="px-7 py-16 text-center text-slate-500">
                No products found
              </td>
            </tr>
          )}
        </Table>
        </div>
      </Card>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <Modal
          id="product-form-modal"
          title={editingProduct ? 'Edit Product Details' : 'Add New Product'}
          onClose={() => setShowProductModal(false)}
          size="xl"
          footer={
            <>
              <Button variant="secondary" className="p-5" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                className="p-10"
                form="product-form"
                loading={addProductMutation.isPending || updateProductMutation.isPending}
              >
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </>
          }
        >
          <form id="product-form" onSubmit={handleProductSubmit} className="space-y-5">
            <Input
              id="prod-name"
              label="Product Name *"
              required
              icon={Package}
              placeholder="e.g. DAP Fertilizer 50kg..."
              value={name}
              error={errors.name}
              onChange={(e) => { setName(e.target.value); if (errors.name) validateField('name', e.target.value); }}
              onBlur={(e) => validateField('name', e.target.value)}
            />

            <Select
              id="prod-category"
              label="Category"
              icon={Tag}
              options={categoryOptions}
              value={categoryId}
              error={errors.categoryId}
              onChange={(e) => { setCategoryId(e.target.value); if (errors.categoryId) validateField('categoryId', e.target.value); }}
              onBlur={(e) => validateField('categoryId', e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                id="prod-stock-qty"
                label="Stock Quantity"
                type="number"
                icon={Layers}
                placeholder="Initial stock qty..."
                value={stockQty}
                error={errors.stockQty}
                onChange={(e) => { setStockQty(e.target.value); if (errors.stockQty) validateField('stockQty', e.target.value); }}
                onBlur={(e) => validateField('stockQty', e.target.value)}
              />

              <Select
                id="prod-unit"
                label="Unit"
                icon={Layers}
                options={[
                  { value: 'bags', label: 'Bags' },
                  { value: 'bottles', label: 'Bottles' },
                  { value: 'sacks', label: 'Sacks' },
                  { value: 'kg', label: 'KG' }
                ]}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />

              <Input
                id="prod-low-alert"
                label="Low Stock Alert"
                type="number"
                icon={AlertTriangle}
                placeholder="Alert level..."
                value={lowStockAlert}
                error={errors.lowStockAlert}
                onChange={(e) => { setLowStockAlert(e.target.value); if (errors.lowStockAlert) validateField('lowStockAlert', e.target.value); }}
                onBlur={(e) => validateField('lowStockAlert', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="prod-purchase-price"
                label="Purchase Price (PKR)"
                type="number"
                icon={DollarSign}
                iconColor="text-rose-400"
                placeholder="Price paid to supplier..."
                value={purchasePrice}
                error={errors.purchasePrice}
                onChange={(e) => { setPurchasePrice(e.target.value); if (errors.purchasePrice) validateField('purchasePrice', e.target.value); }}
                onBlur={(e) => validateField('purchasePrice', e.target.value)}
              />

              <Input
                id="prod-sale-price"
                label="Sale Price (PKR)"
                type="number"
                icon={DollarSign}
                iconColor="text-emerald-400"
                placeholder="Price charged to customers..."
                value={salePrice}
                error={errors.salePrice}
                onChange={(e) => { setSalePrice(e.target.value); if (errors.salePrice) validateField('salePrice', e.target.value); }}
                onBlur={(e) => validateField('salePrice', e.target.value)}
              />
            </div>

            <div className="border-t border-[#1c2233] pt-5 mt-1">
              <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-[0.05em] mb-4">Additional Details (Optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="prod-batch"
                  label="Batch Number"
                  icon={Hash}
                  placeholder="e.g. BATCH-2023-XYZ..."
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                />
                <DatePicker
                  id="prod-expiry"
                  label="Expiry Date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Categories Modal */}
      {showCategoryModal && (
        <Modal
          id="category-mgmt-modal"
          title="Category Management"
          onClose={() => setShowCategoryModal(false)}
        >
          <div className="space-y-6">

            {/* Add Category Form */}
            <form onSubmit={handleAddCategorySubmit} className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <h4 className="text-sm font-semibold text-white mb-2">Create New Category</h4>
              <Input
                id="new-cat-name"
                placeholder="Category Name..."
                icon={Tag}
                value={newCatName}
                error={catErrors.name}
                onChange={(e) => { setNewCatName(e.target.value); if (catErrors.name) setCatErrors({}); }}
                required
              />
              <Input
                id="new-cat-desc"
                placeholder="Short Description (Optional)..."
                icon={FileText}
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={addCategoryMutation.isPending}
                className="w-full"
              >
                Add Category
              </Button>
            </form>

            {/* Categories list */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Existing Categories</h4>
              <div className="divide-y divide-white/5 max-h-56 overflow-y-auto pr-1">
                {categoriesList.map((cat) => (
                  <div key={cat.id} className="flex justify-between items-center py-2.5">
                    <div>
                      <p className="text-sm font-medium text-white">{cat.name}</p>
                      {cat.description && <p className="text-xs text-slate-500">{cat.description}</p>}
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => deleteCategoryMutation.mutate(cat.id)}
                      className="p-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && productToDelete && (
        <Modal
          id="delete-product-modal"
          title="Deactivate Product"
          onClose={() => setShowDeleteConfirm(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to deactivate <strong className="text-white">{productToDelete.name}</strong>?
            </p>
            <p className="text-xs text-slate-500">
              Note: The product will be marked as inactive and won't appear in the POS catalogs, but historical bill logs will preserve its information.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => deleteProductMutation.mutate(productToDelete.id)}
                loading={deleteProductMutation.isPending}
              >
                Confirm Deactivate
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Inventory;

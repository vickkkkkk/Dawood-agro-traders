import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Plus, Eye, Edit2, Phone, MapPin, Landmark, BookOpen, User } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, getCustomerById } from '../api/customers';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, formatDateTime } from '../utils/formatDate';

const Customers = () => {
  const queryClient = useQueryClient();
  
  // List State
  const [search, setSearch] = useState('');

  // Selected customer for detail view
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Form State & Validation
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [balanceType, setBalanceType] = useState('OUTSTANDING');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch Customers
  const { data: customersData, isLoading, isFetching } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => getCustomers({ page: 1, limit: 9999, search, sort: '-createdAt' }),
  });
  const customers = Array.isArray(customersData?.data) ? customersData.data : (customersData?.data?.customers || customersData?.customers || []);

  // Fetch Single Customer Detail (on-demand)
  const { data: customerDetailData, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomerId],
    queryFn: () => getCustomerById(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });
  const customerDetail = customerDetailData?.data || customerDetailData || null;

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      toast.success('Customer profile created successfully!');
      queryClient.invalidateQueries(['customers']);
      setShowFormModal(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create customer');
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => updateCustomer(id, data),
    onSuccess: () => {
      toast.success('Customer profile updated!');
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['customer-detail', selectedCustomerId]);
      setShowFormModal(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update customer');
    }
  });

  // Validation helper
  const validateField = (field, value) => {
    let errs = { ...errors };
    if (field === 'name') {
      if (!value) {
        errs.name = 'Customer name is required';
      } else if (value.trim().length < 3) {
        errs.name = 'Name must be at least 3 characters';
      } else {
        delete errs.name;
      }
    }
    if (field === 'phone') {
      if (!value) {
        delete errs.phone;
      } else if (!/^\d{10,11}$/.test(value.replace(/[\s-]/g, ''))) {
        errs.phone = 'Phone must be a valid number (10-11 digits)';
      } else {
        delete errs.phone;
      }
    }
    setErrors(errs);
  };

  // Handlers
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    resetForm();
    setShowFormModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setAddress(c.address || '');
    const currentBalance = parseFloat(c.creditBalance) || 0;
    if (currentBalance < 0) {
      setBalanceType('ADVANCE');
      setBalanceAmount(Math.abs(currentBalance).toString());
    } else {
      setBalanceType('OUTSTANDING');
      setBalanceAmount(currentBalance === 0 ? '' : currentBalance.toString());
    }
    setErrors({});
    setShowFormModal(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setBalanceType('OUTSTANDING');
    setBalanceAmount('');
    setErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Run all validations
    const nameErr = !name ? 'Customer name is required' : name.trim().length < 3 ? 'Name must be at least 3 characters' : null;
    const phoneErr = phone && !/^\d{10,11}$/.test(phone.replace(/[\s-]/g, '')) ? 'Phone must be a valid number (10-11 digits)' : null;
    
    if (nameErr || phoneErr) {
      setErrors({
        name: nameErr,
        phone: phoneErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }

    const amountVal = parseFloat(balanceAmount) || 0;
    const signedBalance = balanceType === 'ADVANCE' ? -amountVal : amountVal;

    if (editingCustomer) {
      const payload = { name, phone, address, creditBalance: signedBalance };
      updateCustomerMutation.mutate({ id: editingCustomer.id, data: payload });
    } else {
      const payload = { name, phone, address, initialBalance: signedBalance };
      createCustomerMutation.mutate(payload);
    }
  };

  const handleOpenDetail = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowDetailModal(true);
  };

  return (
    <div className="app-container animate-fade-in">
      
      {/* Control panel */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="customers-search"
              placeholder="Search customers by name or phone..."
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
          <Button
            id="btn-add-customer"
            variant="primary"
            icon={Plus}
            onClick={handleOpenAdd}
            className="pos-filter-btn w-full sm:w-auto"
          >
            Add Customer
          </Button>
        </div>
      </Card>

      {/* List Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <Table
          id="customers-table"
          loading={isLoading || isFetching}
          headers={['Name', 'Phone Number', 'Address', 'Credit Balance (Udhar)', 'Registration Date', 'Actions']}
          showPagination={false}
        >
          {customers.length > 0 ? (
            customers.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white text-sm">{c.name}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {c.phone}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 truncate max-w-[200px]">
                  {c.address || '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${parseFloat(c.creditBalance) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {parseFloat(c.creditBalance) < 0
                      ? `Advance: ${formatCurrency(Math.abs(c.creditBalance))}`
                      : formatCurrency(c.creditBalance)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {formatDate(c.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      id={`btn-view-${c.phone}`}
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => handleOpenDetail(c.id)}
                    >
                      Ledger & Bills
                    </Button>
                    <Button
                      id={`btn-edit-${c.phone}`}
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(c)}
                      className="p-2"
                    />
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-7 py-16 text-center text-slate-500">
                No customers found
              </td>
            </tr>
          )}
        </Table>
        </div>
      </Card>

      {/* Add / Edit Form Modal */}
      {showFormModal && (
        <Modal
          id="customer-form-modal"
          title={editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
          onClose={() => setShowFormModal(false)}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Button>
              <Button 
                type="submit" 
                variant="primary"
                form="customer-form"
                loading={createCustomerMutation.isPending || updateCustomerMutation.isPending}
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </Button>
            </>
          }
        >
          <form id="customer-form" onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="c-name"
                label="Customer Name *"
                required
                icon={User}
                placeholder="e.g. Haji Muhammad..."
                value={name}
                error={errors.name}
                onChange={(e) => { setName(e.target.value); if (errors.name) validateField('name', e.target.value); }}
                onBlur={(e) => validateField('name', e.target.value)}
              />
              <Input
                id="c-phone"
                label="Phone Number (Optional)"
                icon={Phone}
                placeholder="e.g. 03001234567..."
                value={phone}
                error={errors.phone}
                onChange={(e) => { setPhone(e.target.value); if (errors.phone) validateField('phone', e.target.value); }}
                onBlur={(e) => validateField('phone', e.target.value)}
              />
              <Input
                id="c-address"
                label="Address (Optional)"
                icon={MapPin}
                placeholder="e.g. Chak No. 45, Sahiwal..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  id="c-balance-type"
                  label={editingCustomer ? "Adjust Balance Type" : "Initial Balance Type"}
                  options={[
                    { value: 'OUTSTANDING', label: 'Outstanding Udhar (Owed to Shop)' },
                    { value: 'ADVANCE', label: 'Advance Payment (Paid to Shop)' }
                  ]}
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value)}
                />
                <Input
                  id="c-balance-amount"
                  label={editingCustomer ? "Adjust Balance Amount (PKR)" : "Initial Balance Amount (PKR)"}
                  type="number"
                  min="0"
                  icon={Landmark}
                  placeholder="e.g. 5000"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                />
              </div>
          </form>
        </Modal>
      )}


      {/* Detailed Customer View Modal (Bills and Credit logs) */}
      {showDetailModal && (
        <Modal
          id="customer-detail-modal"
          title="Customer Profile & History"
          onClose={() => { setShowDetailModal(false); setSelectedCustomerId(null); }}
          size="lg"
        >
          {detailLoading || !customerDetail ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Profile Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-500 flex items-center gap-1"><Eye size={14} /> Name</p>
                  <p className="font-semibold text-white">{customerDetail.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 flex items-center gap-1"><Phone size={14} /> Phone</p>
                  <p className="font-semibold text-white">{customerDetail.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 flex items-center gap-1"><Landmark size={14} /> Udhar Balance</p>
                  <p className={`font-bold ${parseFloat(customerDetail.creditBalance) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {parseFloat(customerDetail.creditBalance) < 0
                      ? `Advance: ${formatCurrency(Math.abs(customerDetail.creditBalance))}`
                      : formatCurrency(customerDetail.creditBalance)}
                  </p>
                </div>
                {customerDetail.address && (
                  <div className="sm:col-span-3 space-y-1 border-t border-white/5 pt-2 mt-1">
                    <p className="text-slate-500 flex items-center gap-1"><MapPin size={14} /> Address</p>
                    <p className="text-slate-300">{customerDetail.address}</p>
                  </div>
                )}
              </div>

              {/* Tabs for Bills vs Ledger */}
              <div className="space-y-4">
                <div className="border-b border-white/5">
                  <h4 className="text-sm font-semibold text-white pb-2 flex items-center gap-2">
                    <BookOpen size={16} className="text-emerald-400" />
                    Bill & Invoice History
                  </h4>
                </div>
                
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {customerDetail.bills?.length === 0 ? (
                    <p className="text-slate-500 text-center text-xs py-8">No purchase history found.</p>
                  ) : (
                    customerDetail.bills?.map((bill) => (
                      <div key={bill.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                        <div className="space-y-0.5">
                          <p className="font-mono text-emerald-400 text-xs font-semibold">{bill.billNo}</p>
                          <p className="text-[10px] text-slate-500">{formatDateTime(bill.billDate)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{formatCurrency(bill.total)}</p>
                            <p className="text-[10px] text-slate-500">{bill.paymentMethod}</p>
                          </div>
                          <Badge variant={bill.isVoid ? 'danger' : bill.paymentStatus === 'CREDIT' ? 'warning' : 'success'}>
                            {bill.isVoid ? 'VOID' : bill.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </Modal>
      )}

    </div>
  );
};

export default Customers;

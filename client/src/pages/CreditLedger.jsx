import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Landmark, BookOpen, Plus, Eye, DollarSign, Calendar, AlertCircle, User, FileText } from 'lucide-react';
import { getCreditSummary, getCustomerCredits, recordPayment, getOverdue } from '../api/credits';
import { getCustomers } from '../api/customers';
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

const CreditLedger = () => {
  const queryClient = useQueryClient();
  
  // Filters
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected customer for detailed ledger
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Recovery modal & Validation
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [recoveryCustomerId, setRecoveryCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch credit customers list
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['credits-summary'],
    queryFn: getCreditSummary,
  });
  const creditSummary = summaryData?.data || summaryData || {};
  const creditCustomers = creditSummary.customers || [];
  const totalOutstanding = creditSummary.totalOutstanding || 0;

  // Fetch overdue credits
  const { data: overdueData } = useQuery({
    queryKey: ['overdue-credits'],
    queryFn: getOverdue,
  });
  const overdueList = overdueData?.data || overdueData || [];

  // Fetch specific customer ledger transactions
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['customer-ledger', selectedCustomerId],
    queryFn: () => getCustomerCredits(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });
  const ledgerTransactions = ledgerData?.data?.transactions || ledgerData?.transactions || [];
  const selectedCustomerDetails = ledgerData?.data?.customer || ledgerData?.customer || {};

  // Fetch customers (for dropdown inside payment modal)
  const { data: customersData } = useQuery({
    queryKey: ['all-customers-for-dropdown'],
    queryFn: () => getCustomers({ limit: 1000 }),
  });

  const customers = Array.isArray(customersData?.data) ? customersData.data : (customersData?.data?.customers || customersData?.customers || []);
  const creditCustomersOptions = customers;

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      toast.success('Payment recorded successfully! Balance updated.');
      queryClient.invalidateQueries(['credits-summary']);
      queryClient.invalidateQueries(['customer-ledger']);
      queryClient.invalidateQueries(['all-customers-for-dropdown']);
      queryClient.invalidateQueries(['dashboard']);
      setShowPaymentModal(false);
      resetPaymentForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    }
  });

  const handleOpenLedger = (cId, cName) => {
    setSelectedCustomerId(cId);
    setSelectedCustomerName(cName);
    setShowLedgerModal(true);
  };

  const handleOpenRecordPayment = (cId = '') => {
    setRecoveryCustomerId(cId);
    setErrors({});
    setShowPaymentModal(true);
  };

  const resetPaymentForm = () => {
    setRecoveryCustomerId('');
    setAmount('');
    setDescription('');
    setErrors({});
  };

  const validateField = (field, value) => {
    let errs = { ...errors };
    
    if (field === 'recoveryCustomerId') {
      if (!value) {
        errs.recoveryCustomerId = 'Please select a customer';
      } else {
        delete errs.recoveryCustomerId;
      }
    }

    if (field === 'amount') {
      if (!value) {
        errs.amount = 'Amount is required';
      } else if (parseFloat(value) <= 0) {
        errs.amount = 'Amount must be greater than 0';
      } else {
        delete errs.amount;
      }
    }

    setErrors(errs);
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    
    // Run all validations
    const customerErr = !recoveryCustomerId ? 'Please select a customer' : null;
    let amountErr = null;
    if (!amount) {
      amountErr = 'Amount is required';
    } else if (parseFloat(amount) <= 0) {
      amountErr = 'Amount must be greater than 0';
    }

    if (customerErr || amountErr) {
      setErrors({
        recoveryCustomerId: customerErr,
        amount: amountErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }

    recordPaymentMutation.mutate({
      customerId: parseInt(recoveryCustomerId),
      amount: parseFloat(amount),
      description: description || 'Credit Recovery Payment'
    });
  };


  // Filter local credit list
  const filteredCustomers = creditCustomers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="app-container animate-fade-in">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Outstanding */}
        <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Outstanding Udhar</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalOutstanding)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Landmark size={24} className="text-white" />
            </div>
          </div>
        </Card>

        {/* Credit Customer Count */}
        <Card className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border-amber-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Active Credit Customers</p>
              <p className="text-2xl font-bold text-white mt-1">{creditCustomers.length} Accounts</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
          </div>
        </Card>

        {/* Overdue Accounts Count */}
        <Card className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border-orange-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Overdue Accounts (30+ Days)</p>
              <p className="text-2xl font-bold text-white mt-1">{overdueList.length} Accounts</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <AlertCircle size={24} className="text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Overdue accounts table widget (if exists) */}
      {overdueList.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/[0.01]">
          <div className="flex items-center gap-2 text-red-400 mb-3 pb-2 border-b border-white/5">
            <AlertCircle size={16} />
            <h3 className="text-lg font-semibold text-white">Overdue Balances Highlighted</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {overdueList.map(cust => (
              <div key={cust.id} className="p-3 bg-white/5 border border-red-500/10 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <p className="font-semibold text-white">{cust.name}</p>
                  <p className="text-slate-500">{cust.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-400">{formatCurrency(cust.creditBalance)}</p>
                  <p className="text-slate-500">Oldest balance pending</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters & Actions */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="credits-search"
              placeholder="Search credit accounts by name/phone..."
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
          <Button
            id="btn-record-recovery"
            variant="success"
            icon={Plus}
            onClick={() => handleOpenRecordPayment()}
            className="pos-filter-btn w-full sm:w-auto"
          >
            Record Payment Recovery
          </Button>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card padding={false}>
        <Table
          id="credits-table"
          loading={summaryLoading}
          headers={['Customer Name', 'Phone Number', 'Last Transaction', 'Outstanding Balance (Udhar)', 'Actions']}
          onPageChange={setPage}
          currentPage={page}
          totalPages={1}
          showPagination={false}
        >
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white text-sm">{c.name}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {c.phone || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {c.updatedAt ? formatDate(c.updatedAt) : 'N/A'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${c.creditBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {c.creditBalance < 0 
                      ? `Advance: ${formatCurrency(Math.abs(c.creditBalance))}` 
                      : formatCurrency(c.creditBalance)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      id={`btn-ledger-${c.phone}`}
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => handleOpenLedger(c.id, c.name)}
                    >
                      View Ledger
                    </Button>
                    <Button
                      id={`btn-collect-${c.phone}`}
                      variant="primary"
                      size="sm"
                      icon={DollarSign}
                      onClick={() => handleOpenRecordPayment(c.id)}
                    >
                      Receive Cash
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-7 py-16 text-center text-slate-500">
                No credit customer records found
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Detailed Customer Ledger Modal */}
      {showLedgerModal && (
        <Modal
          id="ledger-details-modal"
          title={`Credit Ledger: ${selectedCustomerName}`}
          onClose={() => { setShowLedgerModal(false); setSelectedCustomerId(null); }}
          size="lg"
        >
          {ledgerLoading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-white/5 border border-white/5 rounded-xl">
                <div>
                  <span className="text-slate-500">Outstanding Balance:</span>
                  <p className={`text-lg font-bold ${selectedCustomerDetails.creditBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedCustomerDetails.creditBalance < 0 
                      ? `Advance: ${formatCurrency(Math.abs(selectedCustomerDetails.creditBalance))}` 
                      : formatCurrency(selectedCustomerDetails.creditBalance || 0)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Last Payment Date:</span>
                  <p className="text-sm font-semibold text-white mt-1">
                    {ledgerTransactions.filter(t => t.type === 'PAYMENT').length > 0 
                      ? formatDate(ledgerTransactions.filter(t => t.type === 'PAYMENT')[0].transactionDate) 
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              <div className="overflow-x-auto border border-white/15 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-6 py-3.5 text-left">Date</th>
                      <th className="px-6 py-3.5 text-left">Ref Bill / Description</th>
                      <th className="px-6 py-3.5 text-left">Type</th>
                      <th className="px-6 py-3.5 text-right">Debit (Added)</th>
                      <th className="px-6 py-3.5 text-right">Credit (Paid)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No ledger transactions found</td>
                      </tr>
                    ) : (
                      ledgerTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3.5 text-xs text-slate-400">
                            {formatDateTime(tx.transactionDate)}
                          </td>
                          <td className="px-6 py-3.5 text-slate-300">
                            {tx.bill?.billNo ? (
                              <span className="font-mono text-emerald-400 font-semibold">Bill: {tx.bill.billNo}</span>
                            ) : (
                              <span>{tx.description}</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge variant={tx.type === 'CREDIT' ? 'danger' : 'success'}>
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold text-red-400">
                            {tx.type === 'CREDIT' ? formatCurrency(tx.amount) : '-'}
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold text-emerald-400">
                            {tx.type === 'PAYMENT' ? formatCurrency(tx.amount) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowLedgerModal(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Record Payment Recovery Modal */}
      {showPaymentModal && (
        <Modal
          id="record-recovery-modal"
          title="Record Udhar Recovery Payment"
          onClose={() => setShowPaymentModal(false)}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button 
                type="submit" 
                variant="success"
                form="recovery-form"
                loading={recordPaymentMutation.isPending}
              >
                Record Recovery Payment
              </Button>
            </>
          }
        >
          <form id="recovery-form" onSubmit={handlePaymentSubmit} className="space-y-5">
              <Select
                id="payment-customer-select"
                label="Select Customer *"
                required
                icon={User}
                options={creditCustomersOptions.map(c => {
                  const balance = parseFloat(c.creditBalance) || 0;
                  const balanceStr = balance < 0 
                    ? `Advance: ${formatCurrency(Math.abs(balance))}` 
                    : `Udhar: ${formatCurrency(balance)}`;
                  return {
                    value: c.id,
                    label: `${c.name} (${c.phone || 'No Phone'}) - ${balanceStr}`
                  };
                })}
                value={recoveryCustomerId}
                error={errors.recoveryCustomerId}
                onChange={(e) => { setRecoveryCustomerId(e.target.value); if (errors.recoveryCustomerId || errors.amount) validateField('recoveryCustomerId', e.target.value); }}
                onBlur={(e) => validateField('recoveryCustomerId', e.target.value)}
              />

              <Input
                id="recovery-amount"
                label="Amount Paid (PKR) *"
                type="number"
                required
                min="1"
                icon={DollarSign}
                value={amount}
                error={errors.amount}
                onChange={(e) => { setAmount(e.target.value); if (errors.amount) validateField('amount', e.target.value); }}
                onBlur={(e) => validateField('amount', e.target.value)}
              />

              <Input
                id="recovery-desc"
                label="Payment Reference / Description"
                icon={FileText}
                placeholder="e.g. Cash recovery payment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
          </form>
        </Modal>
      )}


    </div>
  );
};

export default CreditLedger;

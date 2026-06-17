import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Landmark, BookOpen, Plus, Eye, DollarSign, Calendar, AlertCircle, User, FileText, CreditCard, Printer, RefreshCw } from 'lucide-react';
import { getCreditSummary, getCustomerCredits, recordPayment, recordPayback, getOverdue } from '../api/credits';
import { getCustomers } from '../api/customers';
import { getBillById } from '../api/billing';
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
import { PAYMENT_METHOD_LABELS, MONTHS } from '../utils/constants';

const CreditLedger = () => {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState('udhar'); // 'udhar' or 'advance'
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: currentDate.getFullYear() - i,
    label: String(currentDate.getFullYear() - i),
  }));

  // Selected customer for detailed ledger
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Recovery modal & Validation
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [recoveryCustomerId, setRecoveryCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [errors, setErrors] = useState({});

  // Payback modal & Validation
  const [showPaybackModal, setShowPaybackModal] = useState(false);
  const [paybackCustomerId, setPaybackCustomerId] = useState('');
  const [paybackAmount, setPaybackAmount] = useState('');
  const [paybackDescription, setPaybackDescription] = useState('');
  const [paybackMethod, setPaybackMethod] = useState('CASH');
  const [paybackErrors, setPaybackErrors] = useState({});

  // Printing receipt state
  const [selectedTxForPrint, setSelectedTxForPrint] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printBillDetails, setPrintBillDetails] = useState(null);
  const [loadingPrintBill, setLoadingPrintBill] = useState(false);

  // Fetch credit customers list
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['credits-summary', activeTab, month, year],
    queryFn: () => getCreditSummary(activeTab === 'advance' ? { month, year } : {}),
  });
  const creditSummary = summaryData?.data || summaryData || {};
  const creditCustomers = creditSummary.customers || [];
  const totalOutstanding = creditSummary.totalOutstanding || 0;
  const totalAdvance = creditSummary.totalAdvance || 0;

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

  const recordPaybackMutation = useMutation({
    mutationFn: recordPayback,
    onSuccess: () => {
      toast.success('Cash returned successfully! Balance updated.');
      queryClient.invalidateQueries(['credits-summary']);
      queryClient.invalidateQueries(['customer-ledger']);
      queryClient.invalidateQueries(['all-customers-for-dropdown']);
      queryClient.invalidateQueries(['dashboard']);
      setShowPaybackModal(false);
      resetPaybackForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record refund');
    }
  });

  const handleOpenLedger = (cId, cName) => {
    setSelectedCustomerId(cId);
    setSelectedCustomerName(cName);
    setShowLedgerModal(true);
  };

  const handleOpenReceipt = async (tx) => {
    setSelectedTxForPrint(tx);
    setShowPrintModal(true);
    if (tx.type === 'CREDIT' && tx.billId) {
      setLoadingPrintBill(true);
      try {
        const res = await getBillById(tx.billId);
        setPrintBillDetails(res.data);
      } catch (err) {
        toast.error('Failed to load bill details');
      } finally {
        setLoadingPrintBill(false);
      }
    } else {
      setPrintBillDetails(null);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    window.location.reload();
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
    setPaymentMethod('CASH');
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
      description: description || 'Credit Recovery Payment',
      paymentMethod
    });
  };

  const handleOpenRecordPayback = (cId = '') => {
    setPaybackCustomerId(cId);
    setPaybackErrors({});
    setShowPaybackModal(true);
  };

  const resetPaybackForm = () => {
    setPaybackCustomerId('');
    setPaybackAmount('');
    setPaybackDescription('');
    setPaybackMethod('CASH');
    setPaybackErrors({});
  };

  const validatePaybackField = (field, value) => {
    let errs = { ...paybackErrors };
    
    if (field === 'paybackCustomerId') {
      if (!value) {
        errs.paybackCustomerId = 'Please select a customer';
      } else {
        delete errs.paybackCustomerId;
      }
    }

    if (field === 'paybackAmount') {
      if (!value) {
        errs.paybackAmount = 'Amount is required';
      } else if (parseFloat(value) <= 0) {
        errs.paybackAmount = 'Amount must be greater than 0';
      } else {
        delete errs.paybackAmount;
      }
    }

    setPaybackErrors(errs);
  };

  const handlePaybackSubmit = (e) => {
    e.preventDefault();
    
    const customerErr = !paybackCustomerId ? 'Please select a customer' : null;
    let amountErr = null;
    if (!paybackAmount) {
      amountErr = 'Amount is required';
    } else if (parseFloat(paybackAmount) <= 0) {
      amountErr = 'Amount must be greater than 0';
    }

    if (customerErr || amountErr) {
      setPaybackErrors({
        paybackCustomerId: customerErr,
        paybackAmount: amountErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }

    const cust = creditCustomersOptions.find(c => c.id === parseInt(paybackCustomerId));
    if (cust) {
      const balance = parseFloat(cust.creditBalance) || 0;
      if (balance >= 0) {
        toast.error('Customer does not have any advance payment balance to refund.');
        return;
      }
      const availableAdvance = Math.abs(balance);
      if (parseFloat(paybackAmount) > availableAdvance) {
        toast.error(`Refund amount cannot exceed available advance of Rs. ${availableAdvance}`);
        return;
      }
    }

    recordPaybackMutation.mutate({
      customerId: parseInt(paybackCustomerId),
      amount: parseFloat(paybackAmount),
      description: paybackDescription || 'Advance payment refund',
      paymentMethod: paybackMethod
    });
  };



  // Filter local credit list
  const filteredCustomers = creditCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.phone && c.phone.includes(search));
    const matchesTab = activeTab === 'advance' ? c.creditBalance < 0 : c.creditBalance > 0;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="app-container animate-fade-in">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
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

        {/* Total Advance Payments */}
        <Card className="bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border-indigo-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Advance Payments</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalAdvance)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <DollarSign size={24} className="text-white" />
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

      {/* Tabs Switcher */}
      <div className="flex gap-3">
        <Button
          id="tab-udhar-ledger"
          variant={activeTab === 'udhar' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('udhar')}
          className="w-full sm:w-auto"
        >
          Udhar Ledger
        </Button>
        <Button
          id="tab-advance-payments"
          variant={activeTab === 'advance' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('advance')}
          className="w-full sm:w-auto"
        >
          Advance Payments
        </Button>
      </div>

      {/* Filters & Actions */}
      <Card compact>
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
            <div className="w-full sm:w-80">
              <SearchBar
                id="credits-search"
                placeholder="Search accounts by name/phone..."
                value={search}
                onChange={(val) => setSearch(val)}
              />
            </div>
            
            {activeTab === 'advance' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Calendar size={16} />
                  <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Period:</span>
                </div>
                <div className="w-36">
                  <Select
                    id="credits-month"
                    options={MONTHS}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="pos-filter-input pos-filter-select h-[38px] text-xs"
                  />
                </div>
                <div className="w-24">
                  <Select
                    id="credits-year"
                    options={yearOptions}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="pos-filter-input pos-filter-select h-[38px] text-xs"
                  />
                </div>
              </div>
            )}
          </div>
          
          <Button
            id="btn-record-recovery"
            variant="success"
            icon={Plus}
            onClick={() => handleOpenRecordPayment()}
            className="pos-filter-btn w-full lg:w-auto"
          >
            Record Payment Recovery
          </Button>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <Table
          id="credits-table"
          loading={summaryLoading}
          headers={[
            'Customer Name', 
            'Phone Number', 
            'Last Transaction', 
            activeTab === 'advance' ? 'Advance Balance' : 'Outstanding Balance (Udhar)', 
            'Actions'
          ]}
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
                    {activeTab === 'advance' && (
                      <Button
                        id={`btn-payback-${c.phone}`}
                        variant="warning"
                        size="sm"
                        icon={RefreshCw}
                        onClick={() => handleOpenRecordPayback(c.id)}
                      >
                        Return Cash
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-7 py-16 text-center text-slate-500">
                {activeTab === 'advance' ? 'No advance payment records found' : 'No credit customer records found'}
              </td>
            </tr>
          )}
        </Table>
        </div>
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
                      <th className="px-6 py-3.5 text-center no-print">Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No ledger transactions found</td>
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
                              <div className="flex flex-col">
                                <span>{tx.description}</span>
                                {(tx.type === 'PAYMENT' || tx.type === 'PAYBACK') && (
                                  <span className="text-[11px] text-slate-400 mt-0.5">
                                    Method: {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod || 'Cash'}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                           <td className="px-6 py-3.5">
                             <Badge variant={tx.type === 'CREDIT' ? 'danger' : tx.type === 'PAYBACK' ? 'warning' : 'success'}>
                               {tx.type === 'CREDIT' 
                                 ? 'CREDIT' 
                                 : tx.type === 'PAYBACK'
                                   ? 'CASH BACK'
                                   : (PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod || 'Cash')}
                             </Badge>
                           </td>
                           <td className="px-6 py-3.5 text-right font-semibold text-red-400">
                             {(tx.type === 'CREDIT' || tx.type === 'PAYBACK') ? formatCurrency(tx.amount) : ''}
                           </td>
                           <td className="px-6 py-3.5 text-right font-semibold text-emerald-400">
                             {tx.type === 'PAYMENT' ? formatCurrency(tx.amount) : ''}
                           </td>
                           <td className="px-6 py-3.5 text-center no-print">
                             <Button
                               variant="secondary"
                               size="xs"
                               icon={Printer}
                               onClick={() => handleOpenReceipt(tx)}
                               className="px-2 py-1 h-auto"
                             >
                               Print
                             </Button>
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

              <Select
                id="recovery-payment-method"
                label="Payment Type *"
                required
                icon={CreditCard}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'JAZZCASH', label: 'JazzCash' },
                  { value: 'EASYPAISA', label: 'EasyPaisa' },
                  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                ]}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
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

      {/* Record Advance Refund (Payback) Modal */}
      {showPaybackModal && (
        <Modal
          id="record-payback-modal"
          title="Return Advance Payment (Cash Back)"
          onClose={() => setShowPaybackModal(false)}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowPaybackModal(false)}>Cancel</Button>
              <Button 
                type="submit" 
                variant="warning"
                form="payback-form"
                loading={recordPaybackMutation.isPending}
              >
                Return Cash
              </Button>
            </>
          }
        >
          <form id="payback-form" onSubmit={handlePaybackSubmit} className="space-y-5">
              <Select
                id="payback-customer-select"
                label="Select Customer *"
                required
                icon={User}
                options={creditCustomersOptions
                  .filter(c => parseFloat(c.creditBalance) < 0)
                  .map(c => {
                    const balance = parseFloat(c.creditBalance) || 0;
                    return {
                      value: c.id,
                      label: `${c.name} (${c.phone || 'No Phone'}) - Advance: ${formatCurrency(Math.abs(balance))}`
                    };
                  })}
                value={paybackCustomerId}
                error={paybackErrors.paybackCustomerId}
                onChange={(e) => { setPaybackCustomerId(e.target.value); if (paybackErrors.paybackCustomerId || paybackErrors.paybackAmount) validatePaybackField('paybackCustomerId', e.target.value); }}
                onBlur={(e) => validatePaybackField('paybackCustomerId', e.target.value)}
              />

              <Input
                id="payback-amount"
                label="Refund Amount (PKR) *"
                type="number"
                required
                min="1"
                icon={DollarSign}
                value={paybackAmount}
                error={paybackErrors.paybackAmount}
                onChange={(e) => { setPaybackAmount(e.target.value); if (paybackErrors.paybackAmount) validatePaybackField('paybackAmount', e.target.value); }}
                onBlur={(e) => validatePaybackField('paybackAmount', e.target.value)}
              />

              <Select
                id="payback-payment-method"
                label="Refund Method *"
                required
                icon={CreditCard}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'JAZZCASH', label: 'JazzCash' },
                  { value: 'EASYPAISA', label: 'EasyPaisa' },
                  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                ]}
                value={paybackMethod}
                onChange={(e) => setPaybackMethod(e.target.value)}
              />

              <Input
                id="payback-desc"
                label="Refund Reference / Description"
                icon={FileText}
                placeholder="e.g. Advance payment refund..."
                value={paybackDescription}
                onChange={(e) => setPaybackDescription(e.target.value)}
              />
          </form>
        </Modal>
      )}
      {/* Receipt Print Modal */}
      {showPrintModal && selectedTxForPrint && (
        <Modal
          id="print-receipt-modal"
          title={selectedTxForPrint.type === 'CREDIT' ? 'Print Bill Invoice' : selectedTxForPrint.type === 'PAYBACK' ? 'Print Cash Back Receipt' : 'Print Recovery Receipt'}
          onClose={() => { setShowPrintModal(false); setSelectedTxForPrint(null); setPrintBillDetails(null); }}
        >
          {loadingPrintBill ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-400">Loading bill details...</span>
            </div>
          ) : selectedTxForPrint.type === 'CREDIT' && printBillDetails ? (
            <div className="space-y-6">
              <div
                id="receipt-print-area"
                className="bg-white text-black p-6 rounded-xl font-sans text-xs max-w-sm mx-auto shadow-inner"
              >
                <div className="text-center space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3">
                  <h2 className="text-sm font-bold tracking-wide">DAWOOD AGRO TRADERS</h2>
                  <p className="text-[10px] text-gray-600">Jatoi Road Near Zrai Bank Shah Jamal</p>
                  <p className="text-[10px] text-gray-600">Phone: 0340-0736201, 0302-7338805</p>
                  <p className="text-[10px] font-mono mt-2 text-gray-700">INVOICE: {printBillDetails.billNo}</p>
                  <p className="text-[9px] text-gray-500">Date: {new Date(printBillDetails.billDate).toLocaleString('en-PK')}</p>
                </div>

                {printBillDetails.isVoid && (
                  <div className="border border-red-500 text-red-500 text-center font-bold text-sm p-1 rounded mb-4 tracking-widest rotate-2">
                    VOIDED / CANCELLED
                  </div>
                )}

                <div className="space-y-1 mb-4 text-gray-900">
                  <p><span className="font-semibold text-gray-700">Created By:</span> {printBillDetails.user?.name || 'Counter Staff'}</p>
                  <p><span className="font-semibold text-gray-700">Customer:</span> {printBillDetails.customer?.name || 'Walk-in'}</p>
                  {printBillDetails.customer?.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {printBillDetails.customer.phone}</p>}
                  <p><span className="font-semibold text-gray-700">Payment:</span> {PAYMENT_METHOD_LABELS[printBillDetails.paymentMethod]}</p>
                </div>

                <table className="w-full border-t border-b border-dashed border-gray-400 py-2 my-2 text-gray-900">
                  <thead>
                    <tr className="border-b border-gray-300 font-semibold text-gray-700">
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Price</th>
                      <th className="text-right py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {printBillDetails.items?.map((item, idx) => {
                      return (
                        <tr key={idx} className="py-1">
                          <td className="py-1 text-left">
                            <div>{item.product?.name || `Product #${item.productId}`}</div>
                          </td>
                          <td className="text-center py-1">{parseFloat(item.quantity)}</td>
                          <td className="text-right py-1">{parseFloat(item.unitPrice).toFixed(0)}</td>
                          <td className="text-right py-1">{parseFloat(item.total).toFixed(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="space-y-1.5 text-right font-medium mt-4 text-gray-900">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>Rs. {parseFloat(printBillDetails.subtotal).toLocaleString()}</span>
                  </div>
                  {parseFloat(printBillDetails.discount) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span>-Rs. {parseFloat(printBillDetails.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-black border-t border-gray-300 pt-1">
                    <span>Grand Total:</span>
                    <span>Rs. {parseFloat(printBillDetails.total).toLocaleString()}</span>
                  </div>

                  {printBillDetails.paymentMethod === 'CREDIT' ? (
                    <div className="space-y-1 border-t border-dashed border-gray-300 pt-1 text-[10px]">
                      {parseFloat(printBillDetails.amountPaid) > 0 && (
                        <div className="flex justify-between text-gray-600 font-semibold">
                          <span>Down Payment (Cash):</span>
                          <span>Rs. {parseFloat(printBillDetails.amountPaid).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Credit Amount:</span>
                        <span>Rs. {parseFloat(printBillDetails.creditAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>Amount Paid:</span>
                      <span>Rs. {parseFloat(printBillDetails.amountPaid).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setShowPrintModal(false); setSelectedTxForPrint(null); setPrintBillDetails(null); }}>Close</Button>
                <Button variant="primary" icon={Printer} onClick={handlePrint}>Print Invoice</Button>
              </div>
            </div>
          ) : (selectedTxForPrint.type === 'PAYMENT' || selectedTxForPrint.type === 'PAYBACK') ? (
            <div className="space-y-6">
              <div
                id="receipt-print-area"
                className="bg-white text-black p-6 rounded-xl font-sans text-xs max-w-sm mx-auto shadow-inner"
              >
                <div className="text-center space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3">
                  <h2 className="text-sm font-bold tracking-wide">DAWOOD AGRO TRADERS</h2>
                  <p className="text-[10px] text-gray-600">Jatoi Road Near Zrai Bank Shah Jamal</p>
                  <p className="text-[10px] text-gray-600">Phone: 0340-0736201, 0302-7338805</p>
                  <p className="text-[10px] font-mono mt-2 text-gray-700">
                    {selectedTxForPrint.type === 'PAYBACK' ? `REFUND NO: REF-${selectedTxForPrint.id}` : `RECEIPT NO: REC-${selectedTxForPrint.id}`}
                  </p>
                  <p className="text-[9px] text-gray-500">Date: {new Date(selectedTxForPrint.transactionDate).toLocaleString('en-PK')}</p>
                </div>

                <div className="space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3 text-gray-900 text-left">
                  <p><span className="font-semibold text-gray-700">Customer Name:</span> {selectedCustomerName || 'N/A'}</p>
                  <p><span className="font-semibold text-gray-700">
                    {selectedTxForPrint.type === 'PAYBACK' ? 'Refund Method:' : 'Payment Method:'}
                  </span> {PAYMENT_METHOD_LABELS[selectedTxForPrint.paymentMethod] || selectedTxForPrint.paymentMethod || 'Cash'}</p>
                  <p><span className="font-semibold text-gray-700">Description:</span> {selectedTxForPrint.description || (selectedTxForPrint.type === 'PAYBACK' ? 'Advance Payment Refund' : 'Credit Recovery Payment')}</p>
                </div>

                <div className="space-y-2.5 font-medium mt-4 text-gray-900">
                  <div className="flex justify-between text-sm font-bold text-black border-b border-gray-300 pb-1">
                    <span>
                      {selectedTxForPrint.type === 'PAYBACK' ? 'Amount Refunded:' : 'Amount Recovered:'}
                    </span>
                    <span>Rs. {parseFloat(selectedTxForPrint.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 pt-1">
                    <span>{parseFloat(selectedCustomerDetails.creditBalance || 0) < 0 ? 'Remaining Advance:' : 'Remaining Udhar Balance:'}</span>
                    <span className="font-bold">Rs. {Math.abs(parseFloat(selectedCustomerDetails.creditBalance || 0)).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-center space-y-1 mt-6 pt-3 border-t border-dashed border-gray-400">
                  <p className="text-[10px] font-semibold text-gray-700">
                    {selectedTxForPrint.type === 'PAYBACK' ? 'Refund processed successfully.' : 'Thank you for your payment!'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setShowPrintModal(false); setSelectedTxForPrint(null); }}>Close</Button>
                <Button variant="primary" icon={Printer} onClick={handlePrint}>Print Receipt</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">Failed to load receipt details.</div>
          )}
        </Modal>
      )}


    </div>
  );
};

export default CreditLedger;

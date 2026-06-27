import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Landmark, Building, Plus, Search,
  Users, AlertCircle, ShoppingCart, TrendingDown, TrendingUp, Info, HelpCircle, Truck,
  Eye, Calendar, ClipboardList, ShieldAlert
} from 'lucide-react';
import {
  getCashSummary, getCashLedger, createCashTransaction, getExpenses, deleteExpense
} from '../api/cash';
import {
  getLiabilities, payLiability
} from '../api/liabilities';
import {
  getPurchases
} from '../api/purchases';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, formatDateTime } from '../utils/formatDate';

const CashManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('cash'); // cash, bank, transfer, party, liability, goods, transport, expense

  // Log tables states
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [purchaseSearch, setPurchaseSearch] = useState('');

  // Daily Expense filters & pagination states
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expensePage, setExpensePage] = useState(1);

  // Drill down details modals state
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);

  // Quick Pay Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingLiability, setPayingLiability] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payDescription, setPayDescription] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State (Bank Transfer / Party Payment / Expense)
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [category, setCategory] = useState('Miscellaneous');

  // Queries
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['cash-summary'],
    queryFn: getCashSummary
  });
  const summary = summaryData?.data || { 
    cashInHand: 0, 
    bankBalance: 0, 
    totalInflows: 0, 
    totalOutflows: 0, 
    totalBankTransferred: 0,
    totalLiabilities: 0,
    totalPaidLiabilities: 0,
    totalRemainingLiabilities: 0
  };

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['cash-ledger', ledgerSearch, ledgerPage],
    queryFn: () => getCashLedger({ page: ledgerPage, limit: 15, search: ledgerSearch })
  });
  const ledgerItems = ledgerData?.data || [];
  const ledgerPagination = ledgerData?.pagination || { page: 1, totalPages: 1, total: 0 };

  const { data: liabilitiesData, isLoading: liabilitiesLoading } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => getLiabilities({ limit: 100 })
  });
  const liabilities = liabilitiesData?.data || [];

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases-all-cash'],
    queryFn: () => getPurchases({ limit: 100 })
  });
  const purchases = purchasesData?.data || [];

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['cash-expenses', expenseSearch, expenseCategory, expensePage],
    queryFn: () => getExpenses({ page: expensePage, limit: 15, search: expenseSearch, category: expenseCategory }),
    enabled: activeTab === 'expense'
  });
  const expensesList = expensesData?.data || [];
  const expensesPagination = expensesData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Filtered Ledgers for Tabs
  const cashLedgerItems = ledgerItems.filter(item => item.paymentMethod === 'CASH');
  const bankLedgerItems = ledgerItems.filter(item => item.paymentMethod === 'BANK');

  // Mutations
  const addTransactionMutation = useMutation({
    mutationFn: createCashTransaction,
    onSuccess: (res) => {
      toast.success(res?.message || 'Transaction recorded successfully!');
      queryClient.invalidateQueries(['cash-summary']);
      queryClient.invalidateQueries(['cash-ledger']);
      queryClient.invalidateQueries(['cash-expenses']);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record transaction.');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: (res) => {
      toast.success(res?.message || 'Expense deleted/minus successfully!');
      queryClient.invalidateQueries(['cash-summary']);
      queryClient.invalidateQueries(['cash-ledger']);
      queryClient.invalidateQueries(['cash-expenses']);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to delete expense.');
    }
  });

  const payLiabilityMutation = useMutation({
    mutationFn: ({ id, data }) => payLiability(id, data),
    onSuccess: (res) => {
      toast.success(res?.message || 'Payment recorded successfully!');
      queryClient.invalidateQueries(['cash-summary']);
      queryClient.invalidateQueries(['cash-ledger']);
      queryClient.invalidateQueries(['liabilities']);
      queryClient.invalidateQueries(['purchases-all-cash']);
      setShowPayModal(false);
      setPayAmount('');
      setPayMethod('CASH');
      setPayDescription('');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to process payment.');
    }
  });

  // Helpers
  const resetForm = () => {
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setPartyName('');
    setPaymentMethod('CASH');
    setCategory('Miscellaneous');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetForm();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    const payload = {
      type: activeTab === 'transfer' ? 'BANK_TRANSFER' : 
            activeTab === 'party' ? 'PARTY_PAYMENT' : 
            activeTab === 'expense' ? 'EXPENSE' : '',
      date,
      description,
      paymentMethod: activeTab === 'transfer' ? 'CASH' : paymentMethod
    };

    if (!amount) {
      toast.error('Amount is required.');
      return;
    }
    payload.amount = parseFloat(amount);

    if (activeTab === 'party') {
      if (!partyName) {
        toast.error('Party name is required.');
        return;
      }
      payload.partyName = partyName;
    }

    if (activeTab === 'expense') {
      payload.category = category;
    }

    // Check balance limits
    if (activeTab === 'transfer') {
      if (payload.amount > summary.cashInHand) {
        toast.error(`Transfer exceeds available Cash in Hand (PKR ${summary.cashInHand.toFixed(2)})`);
        return;
      }
    } else {
      if (paymentMethod === 'CASH' && payload.amount > summary.cashInHand) {
        toast.error(`Transaction exceeds available Cash in Hand (PKR ${summary.cashInHand.toFixed(2)})`);
        return;
      } else if (paymentMethod === 'BANK' && payload.amount > summary.bankBalance) {
        toast.error(`Transaction exceeds available Bank Balance (PKR ${summary.bankBalance.toFixed(2)})`);
        return;
      }
    }

    addTransactionMutation.mutate(payload);
  };

  const handleLiabilityPaymentSubmit = (e) => {
    e.preventDefault();

    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Valid payment amount is required.');
      return;
    }

    const pAmt = parseFloat(payAmount);

    // Overdraft check
    if (payMethod === 'CASH' && pAmt > summary.cashInHand) {
      toast.error(`Insufficient Cash in Hand. Available: PKR ${summary.cashInHand.toFixed(2)}`);
      return;
    } else if (payMethod === 'BANK' && pAmt > summary.bankBalance) {
      toast.error(`Insufficient Bank Balance. Available: PKR ${summary.bankBalance.toFixed(2)}`);
      return;
    }

    payLiabilityMutation.mutate({
      id: payingLiability.id,
      data: {
        amount: pAmt,
        paymentMethod: payMethod,
        description: payDescription || null,
        date: payDate
      }
    });
  };

  return (
    <div className="app-container space-y-6">
      
      {/* 1. Header Details */}
      <div className="app-header app-header-content pt-2">
        <div className="header-left">
          <div className="shop-badge">Bookkeeping</div>
          <h2 className="header-title">Cash & Ledger Management</h2>
          <p className="header-subtitle">Monitor real-time cash in hand, bank balances, log transporter bills, and track supplier credit liabilities.</p>
        </div>
      </div>

      {/* 2. Top Summary Cards (5 Grid Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-4 sm:px-0">
        
        {/* Card 1: Cash in Hand */}
        <div className="glass-card stat-card sales relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-sans">Cash In Hand</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.cashInHand)}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Real-time store cash</p>
          </div>
        </div>

        {/* Card 2: Bank Balance */}
        <div className="glass-card stat-card netbenefit relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-sans">Bank Balance</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Building size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.bankBalance)}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium mt-1">POS Online + Deposits</p>
          </div>
        </div>

        {/* Card 3: Total Liabilities */}
        <div className="glass-card stat-card purchases relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-sans">Total Liabilities</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.totalLiabilities)}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Total credit purchases</p>
          </div>
        </div>

        {/* Card 4: Total Paid Liabilities */}
        <div className="glass-card stat-card drawer relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-sans">Total Paid</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.totalPaidLiabilities)}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Total liability paydowns</p>
          </div>
        </div>

        {/* Card 5: Total Remaining Liabilities */}
        <div className="glass-card stat-card relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 to-red-500/5 border border-rose-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-sans">Total Remaining</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.totalRemainingLiabilities)}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Active supplier balances</p>
          </div>
        </div>

      </div>

      {/* 3. Main Dashboard Layout (Grid sidebar tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Navigation Tabs List */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 p-1.5 bg-slate-900/50 rounded-xl border border-white/5 scrollbar-none">
          <button
            onClick={() => handleTabChange('cash')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'cash'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Wallet size={16} />
            <span>Cash in Hand</span>
          </button>

          <button
            onClick={() => handleTabChange('bank')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'bank'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Building size={16} />
            <span>Bank Payment</span>
          </button>
          
          <button
            onClick={() => handleTabChange('transfer')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'transfer'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Landmark size={16} />
            <span>Bank Transfer</span>
          </button>
          
          <button
            onClick={() => handleTabChange('party')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'party'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Users size={16} />
            <span>Party Payment</span>
          </button>
          
          <button
            onClick={() => handleTabChange('liability')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'liability'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <AlertCircle size={16} />
            <span>Payment for Liability</span>
          </button>
          
          <button
            onClick={() => handleTabChange('goods')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'goods'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <ShoppingCart size={16} />
            <span>Purchase of Goods</span>
          </button>

          <button
            onClick={() => handleTabChange('transport')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'transport'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Truck size={16} />
            <span>Transport / Bilty</span>
          </button>

          <button
            onClick={() => handleTabChange('expense')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'expense'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <TrendingDown size={16} />
            <span>Daily Expense</span>
          </button>
        </div>

        {/* Right Side: Tab Contents */}
        <div className="lg:col-span-9 space-y-6">

          {/* TAB 1 & 2: LEDGERS (CASH vs BANK) */}
          {(activeTab === 'cash' || activeTab === 'bank') && (
            <Card padding={true}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {activeTab === 'cash' ? 'Cash In Hand Ledger' : 'Bank Transactions Ledger'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Chronological log of all manual and automated {activeTab === 'cash' ? 'cash' : 'bank'} transactions.
                    </p>
                  </div>
                  <div className="w-full sm:w-64">
                    <SearchBar
                      id="ledger-search"
                      placeholder="Search ledger..."
                      value={ledgerSearch}
                      onChange={(val) => { setLedgerSearch(val); setLedgerPage(1); }}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                  <Table
                    id="ledger-table"
                    loading={ledgerLoading}
                    headers={['Date & Time', 'Transaction Type', 'Category', 'Description', 'Amount (PKR)']}
                    showPagination={false}
                  >
                    {(activeTab === 'cash' ? cashLedgerItems : bankLedgerItems).length > 0 ? (
                      (activeTab === 'cash' ? cashLedgerItems : bankLedgerItems).map((item) => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {formatDateTime(item.date)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={item.category === 'Inflow' ? 'success' : 'danger'}>
                              {item.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold">
                            <span className={item.category === 'Inflow' ? 'text-emerald-400' : 'text-rose-400'}>
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-xs font-extrabold text-white text-right">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-500 text-sm">
                          No ledger records found.
                        </td>
                      </tr>
                    )}
                  </Table>
                </div>

                {/* Pagination */}
                {ledgerPagination.totalPages > 1 && (
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span className="text-xs text-slate-400">
                      Showing page {ledgerPage} of {ledgerPagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={ledgerPage === 1}
                        onClick={() => setLedgerPage(prev => Math.max(1, prev - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={ledgerPage === ledgerPagination.totalPages}
                        onClick={() => setLedgerPage(prev => Math.min(ledgerPagination.totalPages, prev + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* TAB 3, 4 & EXPENSE: FORM AND LOGS */}
          {(activeTab === 'transfer' || activeTab === 'party' || activeTab === 'expense') && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Form Side */}
              <div className="md:col-span-5">
                <Card padding={true}>
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {activeTab === 'transfer' && <Landmark size={16} className="text-cyan-400" />}
                        {activeTab === 'party' && <Users size={16} className="text-emerald-400" />}
                        {activeTab === 'expense' && <TrendingDown size={16} className="text-rose-400" />}
                        Record {
                          activeTab === 'transfer' ? 'Bank Deposit' : 
                          activeTab === 'party' ? 'Party Payment' : 
                          'Daily Shop Expense'
                        }
                      </h3>
                    </div>

                    {/* Balance Info Helper */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 flex gap-2 items-start">
                      <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        {activeTab === 'transfer' || paymentMethod === 'CASH' ? (
                          <>Available Cash in Hand: <strong className="text-white">{formatCurrency(summary.cashInHand)}</strong>.</>
                        ) : (
                          <>Available Bank Balance: <strong className="text-white">{formatCurrency(summary.bankBalance)}</strong>.</>
                        )}
                        {" "}Your payment amount will be deducted from this balance.
                      </div>
                    </div>

                    {activeTab === 'party' && (
                      <Input
                        id="form-party-name"
                        label="Party Name *"
                        required
                        placeholder="e.g. Engro Fertilizers Ltd..."
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                      />
                    )}

                    {activeTab === 'expense' && (
                      <Select
                        id="form-category"
                        label="Expense Category *"
                        options={[
                          { value: 'Rent', label: 'Rent' },
                          { value: 'Salary', label: 'Salary' },
                          { value: 'Utilities', label: 'Utilities (Electricity, Water, Gas)' },
                          { value: 'Maintenance', label: 'Maintenance' },
                          { value: 'Tea & Refreshments', label: 'Tea & Refreshments' },
                          { value: 'Miscellaneous', label: 'Miscellaneous / Other' }
                        ]}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      />
                    )}

                    <Input
                      id="form-amount"
                      label="Amount (PKR) *"
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 10000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />

                    {(activeTab === 'party' || activeTab === 'expense') && (
                      <Select
                        id="form-payment-method"
                        label="Payment Method *"
                        options={[
                          { value: 'CASH', label: 'Cash in Hand' },
                          { value: 'BANK', label: 'Bank Account' }
                        ]}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                    )}

                    <DatePicker
                      id="form-date"
                      label="Transaction Date *"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />

                    <Input
                      id="form-desc"
                      label={activeTab === 'transfer' ? 'Reference Note' : 'Description / Notes'}
                      placeholder={
                        activeTab === 'transfer' ? 'Cheque no, deposit slip, or online ref...' : 
                        activeTab === 'expense' ? 'e.g. Electricity bill, tea service...' :
                        'Add transaction remarks...'
                      }
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />

                    <Button
                      id="form-btn-submit"
                      type="submit"
                      variant="primary"
                      className="w-full justify-center"
                      loading={addTransactionMutation.isPending}
                    >
                      Save Transaction
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Logs Side */}
              <div className="md:col-span-7">
                <Card padding={true}>
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 animate-fadeIn">
                      <h3 className="text-sm font-bold text-white">
                        {activeTab === 'transfer' ? 'Bank Deposit Logs' : 
                         activeTab === 'party' ? 'Party Payment Logs' : 
                         'Detailed Expense Ledger'}
                      </h3>
                      {activeTab === 'expense' && (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <select
                            id="expense-category-filter"
                            className="bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1 focus:outline-none focus:border-emerald-500"
                            value={expenseCategory}
                            onChange={(e) => { setExpenseCategory(e.target.value); setExpensePage(1); }}
                          >
                            <option value="">All Categories</option>
                            <option value="Rent">Rent</option>
                            <option value="Salary">Salary</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Tea & Refreshments">Tea & Refreshments</option>
                            <option value="Miscellaneous">Miscellaneous</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Search..."
                            className="bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-500 w-28"
                            value={expenseSearch}
                            onChange={(e) => { setExpenseSearch(e.target.value); setExpensePage(1); }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto min-h-[280px]">
                      <Table
                        id="form-log-table"
                        loading={activeTab === 'expense' ? expensesLoading : ledgerLoading}
                        headers={
                          activeTab === 'transfer' ? ['Date', 'Notes', 'Amount'] : 
                          activeTab === 'party' ? ['Date', 'Party', 'Method', 'Amount'] :
                          ['Date', 'Category', 'Method', 'Notes', 'Amount', 'Actions']
                        }
                        showPagination={false}
                      >
                        {activeTab === 'expense' ? (
                          expensesList.length > 0 ? (
                            expensesList.map((exp) => (
                              <tr key={exp.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-2.5 text-[11px] text-slate-400">
                                  {formatDate(exp.date)}
                                </td>
                                <td className="px-4 py-2.5 text-xs font-semibold text-white">
                                  {exp.category || 'Miscellaneous'}
                                </td>
                                <td className="px-4 py-2.5 text-xs">
                                  <Badge variant={exp.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                                    {exp.paymentMethod || 'CASH'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-300 max-w-[150px] truncate" title={exp.description}>
                                  {exp.description || '-'}
                                </td>
                                <td className="px-4 py-2.5 text-xs font-extrabold text-white text-right">
                                  {formatCurrency(exp.amount)}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-center">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete/minus this daily expense? This will restore the cash/bank balance.')) {
                                        deleteExpenseMutation.mutate(exp.id);
                                      }
                                    }}
                                    className="px-2 py-1 text-[10px]"
                                  >
                                    Minus
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-16 text-center text-slate-500 text-xs">
                                No daily expenses recorded.
                              </td>
                            </tr>
                          )
                        ) : (
                          ledgerItems.filter(tx => tx.type === (activeTab === 'transfer' ? 'BANK_TRANSFER' : 'PARTY_PAYMENT')).length > 0 ? (
                            ledgerItems
                              .filter(tx => tx.type === (activeTab === 'transfer' ? 'BANK_TRANSFER' : 'PARTY_PAYMENT'))
                              .map((log) => (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                  <td className="px-4 py-2.5 text-[11px] text-slate-400">
                                    {formatDate(log.date)}
                                  </td>

                                  {activeTab === 'transfer' && (
                                    <td className="px-4 py-2.5 text-xs text-slate-300">
                                      {log.description || '-'}
                                    </td>
                                  )}

                                  {activeTab === 'party' && (
                                    <>
                                      <td className="px-4 py-2.5 text-xs font-semibold text-white">
                                        {log.details?.partyName || 'Unknown'}
                                      </td>
                                      <td className="px-4 py-2.5 text-xs">
                                        <Badge variant={log.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                                          {log.paymentMethod || 'CASH'}
                                        </Badge>
                                      </td>
                                    </>
                                  )}

                                  <td className="px-4 py-2.5 text-xs font-extrabold text-white text-right">
                                    {formatCurrency(log.amount)}
                                  </td>
                                </tr>
                              ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-16 text-center text-slate-500 text-xs">
                                No transaction logs found for this section.
                              </td>
                            </tr>
                          )
                        )}
                      </Table>
                    </div>

                    {activeTab === 'expense' && expensesPagination.totalPages > 1 && (
                      <div className="flex justify-between items-center pt-4 border-t border-white/5 animate-fadeIn">
                        <span className="text-xs text-slate-400">
                          Showing page {expensePage} of {expensesPagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={expensePage === 1}
                            onClick={() => setExpensePage(prev => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={expensePage === expensesPagination.totalPages}
                            onClick={() => setExpensePage(prev => Math.min(expensesPagination.totalPages, prev + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* TAB 5: PAYMENT FOR LIABILITY */}
          {activeTab === 'liability' && (
            <Card padding={true}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Outstanding Supplier Liabilities</h3>
                  <p className="text-xs text-slate-400">Lists all purchases registered as credit liability. Record payments against any open liability.</p>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                  <Table
                    id="liabilities-table"
                    loading={liabilitiesLoading}
                    headers={['Liability ID', 'GRN Number', 'Supplier', 'Total Amount', 'Paid Amount', 'Remaining', 'Due Date', 'Status', 'Actions']}
                    showPagination={false}
                  >
                    {liabilities.length > 0 ? (
                      liabilities.map((liab) => (
                        <tr key={liab.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-xs font-semibold text-white">
                            L-{liab.id}
                          </td>
                          <td className="px-4 py-3">
                            <span 
                              className="font-mono text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                              onClick={() => { setSelectedPurchase(liab.purchase); setShowPurchaseModal(true); }}
                            >
                              {liab.grnNo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {liab.supplier?.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300 font-semibold">
                            {formatCurrency(liab.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {formatCurrency(liab.paidAmount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-white font-extrabold">
                            {formatCurrency(liab.remainingBalance)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {formatDate(liab.dueDate)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge variant={liab.status === 'PAID' ? 'success' : liab.status === 'PARTIAL' ? 'warning' : 'danger'}>
                              {liab.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              className="px-2"
                              onClick={() => { setSelectedLiability(liab); setShowLiabilityModal(true); }}
                            />
                            {liab.remainingBalance > 0 && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => { setPayingLiability(liab); setPayAmount(liab.remainingBalance.toString()); setShowPayModal(true); }}
                              >
                                Pay Now
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-500 text-sm">
                          No outstanding credit liabilities found.
                        </td>
                      </tr>
                    )}
                  </Table>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 6: PURCHASE OF GOODS */}
          {activeTab === 'goods' && (
            <Card padding={true}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Purchase & GRN Registry</h3>
                  <p className="text-xs text-slate-400">Chronological registry of all Goods Receipt Notes (GRNs) along with supplier credit status.</p>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                  <Table
                    id="goods-purchase-table"
                    loading={purchasesLoading}
                    headers={['GRN Number', 'Supplier', 'Items Quantity', 'Purchase Cost', 'Transport Cost', 'Grand Total', 'Method', 'Liability status', 'Actions']}
                    showPagination={false}
                  >
                    {purchases.length > 0 ? (
                      purchases.map((pur) => (
                        <tr key={pur.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <span 
                              className="font-mono text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                              onClick={() => { setSelectedPurchase(pur); setShowPurchaseModal(true); }}
                            >
                              {pur.grnNo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {pur.supplier?.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {pur.items?.length || 0} items
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {formatCurrency(pur.total)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {formatCurrency(pur.transportCost)}
                          </td>
                          <td className="px-4 py-3 text-xs text-white font-extrabold">
                            {formatCurrency(pur.grandTotal || pur.total)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge variant={pur.paymentMethod === 'LIABILITY' ? 'warning' : 'success'}>
                              {pur.paymentMethod}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {pur.liability ? (
                              <span 
                                className="hover:underline cursor-pointer" 
                                onClick={async () => {
                                  // Find liability record from cache or search it
                                  const match = liabilities.find(l => l.grnNo === pur.grnNo);
                                  if (match) {
                                    setSelectedLiability(match);
                                    setShowLiabilityModal(true);
                                  } else {
                                    toast.error('Liability details not loaded in list.');
                                  }
                                }}
                              >
                                <Badge variant={pur.liability.status === 'PAID' ? 'success' : 'danger'}>
                                  {pur.liability.status}
                                </Badge>
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              onClick={() => { setSelectedPurchase(pur); setShowPurchaseModal(true); }}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-500 text-sm">
                          No purchases registered.
                        </td>
                      </tr>
                    )}
                  </Table>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 7: TRANSPORT / BILTY */}
          {activeTab === 'transport' && (
            <Card padding={true}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Transporter & Bilty Records</h3>
                  <p className="text-xs text-slate-400">Transporter cargo details and bilty numbers linked to registered GRN goods deliveries.</p>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                  <Table
                    id="transporter-bilty-table"
                    loading={purchasesLoading}
                    headers={['Bilty Number', 'Transporter Name', 'Linked GRN No', 'Order Reference', 'Transport Cost', 'Payment Method', 'Bilty Date']}
                    showPagination={false}
                  >
                    {purchases.filter(pur => pur.transportCost > 0).length > 0 ? (
                      purchases
                        .filter(pur => pur.transportCost > 0)
                        .map((pur) => (
                          <tr key={pur.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-xs font-semibold text-white">
                              {pur.biltyNo || 'No Bilty No'}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              {pur.transporterName || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span 
                                className="font-mono text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                                onClick={() => { setSelectedPurchase(pur); setShowPurchaseModal(true); }}
                              >
                                {pur.grnNo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {pur.purchaseOrderRef || '-'}
                            </td>
                            <td className="px-4 py-3 text-xs text-white font-bold">
                              {formatCurrency(pur.transportCost)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <Badge variant={pur.transportPaymentMethod === 'LIABILITY' ? 'warning' : 'success'}>
                                {pur.transportPaymentMethod || 'CASH'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {pur.biltyDate ? formatDate(pur.biltyDate) : formatDate(pur.purchaseDate)}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-500 text-sm">
                          No transporter transport cost records found.
                        </td>
                      </tr>
                    )}
                  </Table>
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* MODAL 1: RECORD LIABILITY PAYMENT (Quick Pay Now) */}
      {showPayModal && payingLiability && (
        <Modal
          id="liability-pay-modal"
          title={`Pay Supplier Liability: L-${payingLiability.id}`}
          onClose={() => setShowPayModal(false)}
          size="md"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowPayModal(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                form="liability-pay-form"
                loading={payLiabilityMutation.isPending}
              >
                Confirm Payment
              </Button>
            </>
          }
        >
          <form id="liability-pay-form" onSubmit={handleLiabilityPaymentSubmit} className="space-y-4">
            
            <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Supplier:</span>
                <span className="text-white font-semibold">{payingLiability.supplier?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked GRN:</span>
                <span className="text-emerald-400 font-mono font-bold">{payingLiability.grnNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Remaining Balance:</span>
                <span className="text-white font-extrabold">{formatCurrency(payingLiability.remainingBalance)}</span>
              </div>
            </div>

            {/* Helper cash limits */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 flex gap-2 items-start">
              <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                {payMethod === 'CASH' ? (
                  <>Available Cash in Hand: <strong className="text-white">{formatCurrency(summary.cashInHand)}</strong>.</>
                ) : (
                  <>Available Bank Balance: <strong className="text-white">{formatCurrency(summary.bankBalance)}</strong>.</>
                )}
                {" "}Payment will be deducted immediately from your selected method.
              </div>
            </div>

            <Input
              id="liab-pay-amount"
              label="Payment Amount (PKR) *"
              type="number"
              required
              step="any"
              min="0.01"
              max={payingLiability.remainingBalance}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />

            <Select
              id="liab-pay-method"
              label="Payment Method *"
              options={[
                { value: 'CASH', label: 'Cash in Hand' },
                { value: 'BANK', label: 'Bank Account' }
              ]}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            />

            <DatePicker
              id="liab-pay-date"
              label="Payment Date *"
              required
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />

            <Input
              id="liab-pay-desc"
              label="Description / Notes"
              placeholder="e.g. Partial cash payment to supplier..."
              value={payDescription}
              onChange={(e) => setPayDescription(e.target.value)}
            />

          </form>
        </Modal>
      )}

      {/* MODAL 2: LIABILITY DETAIL CARD */}
      {showLiabilityModal && selectedLiability && (
        <Modal
          id="liability-detail-modal"
          title={`Liability Ledger: L-${selectedLiability.id}`}
          onClose={() => setShowLiabilityModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            
            {/* Summary details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">Unpaid Balance</span>
                <p className="font-extrabold text-base text-rose-400 mt-1">{formatCurrency(selectedLiability.remainingBalance)}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Due Date: {formatDate(selectedLiability.dueDate)}</p>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">Total Bill Paid</span>
                <p className="font-bold text-base text-emerald-400 mt-1">{formatCurrency(selectedLiability.paidAmount)}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">out of {formatCurrency(selectedLiability.totalAmount)}</p>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-slate-500 text-xs">Linked GRN</span>
                <p className="font-mono text-sm text-emerald-400 font-bold mt-1 hover:underline cursor-pointer" onClick={() => { setSelectedPurchase(selectedLiability.purchase); setShowPurchaseModal(true); }}>
                  {selectedLiability.grnNo}
                </p>
                <p className="text-slate-500 text-[10px] mt-0.5">Supplier: {selectedLiability.supplier?.name}</p>
              </div>
            </div>

            {/* Payments history ledger list */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liability Payment History</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2">Date & Time</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedLiability.payments && selectedLiability.payments.length > 0 ? (
                      selectedLiability.payments.map((p, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-2 text-slate-400">{formatDateTime(p.paymentDate)}</td>
                          <td className="py-2">
                            <Badge variant={p.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                              {p.paymentMethod}
                            </Badge>
                          </td>
                          <td className="py-2 text-slate-300">{p.description || '-'}</td>
                          <td className="py-2 text-right font-extrabold text-white">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No payments recorded on this credit liability.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowLiabilityModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: GRN DETAIL CARD (Reused for quick view) */}
      {showPurchaseModal && selectedPurchase && (
        <Modal
          id="grn-detail-quick-modal"
          title={`GRN Details: ${selectedPurchase.grnNo}`}
          onClose={() => setShowPurchaseModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            
            {/* Header info */}
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

            {/* Transport details */}
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

            {/* Items details table */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Item Details</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Cost Price</th>
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

            {/* Total breakdown */}
            <div className="pt-4 border-t border-white/5 space-y-2 text-sm">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Goods total:</span>
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
              <Button variant="secondary" onClick={() => setShowPurchaseModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default CashManagement;

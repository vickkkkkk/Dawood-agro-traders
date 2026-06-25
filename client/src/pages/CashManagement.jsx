import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Landmark, Building, Plus, Search,
  Users, AlertCircle, ShoppingCart, TrendingDown, TrendingUp, Info, HelpCircle, Truck
} from 'lucide-react';
import {
  getCashSummary, getCashLedger, getCashTransactions, createCashTransaction
} from '../api/cash';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, formatDateTime } from '../utils/formatDate';

const CashManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ledger');

  // Ledger state
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);

  // Individual logs state
  const [txLogsPage, setTxLogsPage] = useState(1);

  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  
  // Specific Form Fields
  const [partyName, setPartyName] = useState('');
  const [liabilityName, setLiabilityName] = useState('');
  const [remainingBalance, setRemainingBalance] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Queries
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['cash-summary'],
    queryFn: getCashSummary
  });
  const summary = summaryData?.data || { cashInHand: 0, bankBalance: 0, totalInflows: 0, totalOutflows: 0, totalBankTransferred: 0 };

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['cash-ledger', ledgerSearch, ledgerPage],
    queryFn: () => getCashLedger({ page: ledgerPage, limit: 15, search: ledgerSearch })
  });
  const ledgerItems = ledgerData?.data || [];
  const ledgerPagination = ledgerData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Fetch type-specific logs depending on the active tab
  const activeTxType = {
    transfer: 'BANK_TRANSFER',
    party: 'PARTY_PAYMENT',
    liability: 'LIABILITY',
    goods: 'GOODS_PURCHASE',
    expense: 'EXPENSE',
    inflow: 'INFLOW',
    transport: 'TRANSPORT'
  }[activeTab];

  const { data: txLogsData, isLoading: txLogsLoading } = useQuery({
    queryKey: ['cash-transactions', activeTxType, txLogsPage],
    queryFn: () => getCashTransactions({ type: activeTxType, page: txLogsPage, limit: 10 }),
    enabled: !!activeTxType
  });
  const txLogsItems = txLogsData?.data || [];
  const txLogsPagination = txLogsData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Mutation
  const addTransactionMutation = useMutation({
    mutationFn: createCashTransaction,
    onSuccess: (res) => {
      toast.success(res?.message || 'Transaction recorded successfully!');
      queryClient.invalidateQueries(['cash-summary']);
      queryClient.invalidateQueries(['cash-ledger']);
      if (activeTxType) {
        queryClient.invalidateQueries(['cash-transactions', activeTxType]);
      }
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to record transaction. Ensure you have enough Cash in Hand.');
    }
  });

  // Helpers
  const resetForm = () => {
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setPartyName('');
    setLiabilityName('');
    setRemainingBalance('');
    setItemName('');
    setQuantity('');
    setUnitPrice('');
    setPaymentMethod('CASH');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setTxLogsPage(1);
    resetForm();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    const payload = {
      type: activeTxType,
      date,
      description,
      paymentMethod
    };

    if (activeTab === 'goods') {
      if (!itemName || !quantity || !unitPrice) {
        toast.error('Item name, quantity, and unit price are required.');
        return;
      }
      payload.itemName = itemName;
      payload.quantity = parseFloat(quantity);
      payload.unitPrice = parseFloat(unitPrice);
      payload.amount = payload.quantity * payload.unitPrice;
    } else {
      if (!amount) {
        toast.error('Amount is required.');
        return;
      }
      payload.amount = parseFloat(amount);
    }

    if (activeTab === 'party') {
      if (!partyName) {
        toast.error('Party name is required.');
        return;
      }
      payload.partyName = partyName;
    } else if (activeTab === 'liability') {
      if (!liabilityName) {
        toast.error('Liability name is required.');
        return;
      }
      payload.liabilityName = liabilityName;
      payload.remainingBalance = remainingBalance ? parseFloat(remainingBalance) : 0;
    }

    // Check balance limit
    if (activeTab !== 'inflow') {
      const neededAmt = activeTab === 'goods' ? (parseFloat(quantity) * parseFloat(unitPrice)) : parseFloat(amount);
      if (paymentMethod === 'CASH' && neededAmt > summary.cashInHand) {
        toast.error(`Transaction exceeds available Cash in Hand (PKR ${summary.cashInHand.toFixed(2)})`);
        return;
      } else if (paymentMethod === 'BANK' && neededAmt > summary.bankBalance) {
        toast.error(`Transaction exceeds available Bank Balance (PKR ${summary.bankBalance.toFixed(2)})`);
        return;
      }
    }

    addTransactionMutation.mutate(payload);
  };

  return (
    <div className="app-container space-y-6">
      
      {/* 1. Header Details */}
      <div className="app-header app-header-content pt-2">
        <div className="header-left">
          <div className="shop-badge">Bookkeeping</div>
          <h2 className="header-title">Cash & Ledger Management</h2>
          <p className="header-subtitle">Monitor real-time cash in hand, record party payments, liability settlements, and bank deposits.</p>
        </div>
      </div>

      {/* 2. Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0">
        
        {/* Card 1: Cash in Hand */}
        <div className="glass-card stat-card sales relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Cash In Hand</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.cashInHand)}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Real-time store cash balance</p>
          </div>
        </div>

        {/* Card 2: Bank Balance */}
        <div className="glass-card stat-card netbenefit relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Bank Balance</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Building size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.bankBalance)}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">POS Online + Deposits</p>
          </div>
        </div>

        {/* Card 3: Total Out */}
        <div className="glass-card stat-card purchases relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 to-amber-500/5 border border-rose-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Total spent cash</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.totalOutflows)}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Expenses, parties & liabilities</p>
          </div>
        </div>

        {/* Card 4: Total Bank Transferred */}
        <div className="glass-card stat-card drawer relative overflow-hidden flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Bank Deposited</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Landmark size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {summaryLoading ? '...' : formatCurrency(summary.totalBankTransferred)}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Total transferred from cash</p>
          </div>
        </div>

      </div>

      {/* 3. Main Dashboard Layout (Grid sidebar tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Navigation Tabs List */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 p-1.5 bg-slate-900/50 rounded-xl border border-white/5 scrollbar-none">
          <button
            onClick={() => handleTabChange('ledger')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'ledger'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Wallet size={16} />
            <span>Running Ledger</span>
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
            <span>Liability Payment</span>
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
            <span>Goods Purchase</span>
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
            <span>Daily Expenses</span>
          </button>

          <button
            onClick={() => handleTabChange('inflow')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap lg:w-full ${
              activeTab === 'inflow'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <TrendingUp size={16} />
            <span>Manual Inflows</span>
          </button>
        </div>

        {/* Right Side: Tab Contents */}
        <div className="lg:col-span-9 space-y-6">

          {/* TAB 1: RUNNING LEDGER */}
          {activeTab === 'ledger' && (
            <Card padding={true}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Store Running Cash Ledger</h3>
                    <p className="text-xs text-slate-400">Historical chronological log of all store cash inflows and cash outflows.</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <SearchBar
                      id="ledger-search"
                      placeholder="Search ledger logs..."
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
                    {ledgerItems.length > 0 ? (
                      ledgerItems.map((item) => (
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
                      Showing page {ledgerPage} of {ledgerPagination.totalPages} ({ledgerPagination.total} items)
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

          {/* TAB 2 to 7: FORMS AND LOGS LAYOUT */}
          {activeTab !== 'ledger' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Form Side */}
              <div className="md:col-span-5">
                <Card padding={true}>
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {activeTab === 'transfer' && <Landmark size={16} className="text-cyan-400" />}
                        {activeTab === 'party' && <Users size={16} className="text-emerald-400" />}
                        {activeTab === 'liability' && <AlertCircle size={16} className="text-rose-400" />}
                        {activeTab === 'goods' && <ShoppingCart size={16} className="text-amber-400" />}
                        {activeTab === 'transport' && <Truck size={16} className="text-blue-400" />}
                        {activeTab === 'expense' && <TrendingDown size={16} className="text-rose-400" />}
                        {activeTab === 'inflow' && <TrendingUp size={16} className="text-emerald-400" />}
                        Record {
                          activeTab === 'transfer' ? 'Bank Deposit' :
                          activeTab === 'party' ? 'Party Payment' :
                          activeTab === 'liability' ? 'Liability Settle' :
                          activeTab === 'goods' ? 'Goods Purchase' :
                          activeTab === 'transport' ? 'Transport / Bilty' :
                          activeTab === 'expense' ? 'Daily Expense' :
                          'Manual Inflow'
                        }
                      </h3>
                    </div>

                    {/* Balance Info Helper */}
                    {activeTab !== 'inflow' && (
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 flex gap-2 items-start">
                        <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          {paymentMethod === 'CASH' ? (
                            <>Available Cash in Hand: <strong className="text-white">{formatCurrency(summary.cashInHand)}</strong>.</>
                          ) : (
                            <>Available Bank Balance: <strong className="text-white">{formatCurrency(summary.bankBalance)}</strong>.</>
                          )}
                          {" "}Your payment amount will be deducted from this balance.
                        </div>
                      </div>
                    )}

                    {/* Form Fields depending on Tab */}
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

                    {activeTab === 'liability' && (
                      <>
                        <Input
                          id="form-liability-name"
                          label="Liability Name / Supplier *"
                          required
                          placeholder="e.g. Sahiwal Agri Wholesale..."
                          value={liabilityName}
                          onChange={(e) => setLiabilityName(e.target.value)}
                        />
                        <Input
                          id="form-liability-remain"
                          label="Remaining Balance (PKR)"
                          type="number"
                          placeholder="e.g. 15000"
                          value={remainingBalance}
                          onChange={(e) => setRemainingBalance(e.target.value)}
                        />
                      </>
                    )}

                    {activeTab === 'goods' ? (
                      <>
                        <Input
                          id="form-goods-item"
                          label="Item Name *"
                          required
                          placeholder="e.g. Urea bags..."
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            id="form-goods-qty"
                            label="Quantity *"
                            type="number"
                            step="0.01"
                            required
                            placeholder="e.g. 50"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                          />
                          <Input
                            id="form-goods-price"
                            label="Unit Price (PKR) *"
                            type="number"
                            step="0.01"
                            required
                            placeholder="e.g. 3400"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(e.target.value)}
                          />
                        </div>
                        {quantity && unitPrice && (
                          <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                            <span className="text-slate-400">Total Cost:</span>
                            <strong className="text-emerald-400 font-extrabold text-sm">
                              {formatCurrency(parseFloat(quantity) * parseFloat(unitPrice))}
                            </strong>
                          </div>
                        )}
                      </>
                    ) : (
                      <Input
                        id="form-amount"
                        label="Amount (PKR) *"
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 10000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    )}

                    {activeTab !== 'transfer' && (
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
                        activeTab === 'goods' ? 'Add batch details, remarks...' :
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

              {/* Log Side */}
              <div className="md:col-span-7">
                <Card padding={true}>
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h3 className="text-sm font-bold text-white">
                        Transaction History Log
                      </h3>
                    </div>

                    <div className="overflow-x-auto min-h-[280px]">
                      <Table
                        id="type-log-table"
                        loading={txLogsLoading}
                        headers={
                          activeTab === 'transfer' ? ['Date', 'Notes', 'Amount'] :
                          activeTab === 'party' ? ['Date', 'Party', 'Description', 'Method', 'Amount'] :
                          activeTab === 'liability' ? ['Date', 'Liability Name', 'Remaining', 'Method', 'Paid'] :
                          activeTab === 'goods' ? ['Date', 'Item', 'Qty x Price', 'Method', 'Total Paid'] :
                          ['Date', 'Description', 'Method', 'Amount']
                        }
                        showPagination={false}
                      >
                        {txLogsItems.length > 0 ? (
                          txLogsItems.map((log) => (
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
                                    {log.partyName}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-slate-300">
                                    {log.description || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs">
                                    <Badge variant={log.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                                      {log.paymentMethod || 'CASH'}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {activeTab === 'liability' && (
                                <>
                                  <td className="px-4 py-2.5 text-xs font-semibold text-white">
                                    {log.liabilityName}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-rose-400 font-bold">
                                    {formatCurrency(log.remainingBalance)}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs">
                                    <Badge variant={log.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                                      {log.paymentMethod || 'CASH'}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {activeTab === 'goods' && (
                                <>
                                  <td className="px-4 py-2.5 text-xs font-semibold text-white">
                                    {log.itemName}
                                  </td>
                                  <td className="px-4 py-2.5 text-[11px] text-slate-400">
                                    {log.quantity} x {formatCurrency(log.unitPrice)}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs">
                                    <Badge variant={log.paymentMethod === 'BANK' ? 'warning' : 'success'}>
                                      {log.paymentMethod || 'CASH'}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {activeTab !== 'transfer' && activeTab !== 'party' && activeTab !== 'liability' && activeTab !== 'goods' && (
                                <>
                                  <td className="px-4 py-2.5 text-xs text-slate-300">
                                    {log.description || '-'}
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
                            <td colSpan={6} className="py-16 text-center text-slate-500 text-xs">
                              No transaction logs found for this section.
                            </td>
                          </tr>
                        )}
                      </Table>
                    </div>

                    {/* Pagination */}
                    {txLogsPagination.totalPages > 1 && (
                      <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <span className="text-[10px] text-slate-500">
                          Page {txLogsPage} of {txLogsPagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 py-0 text-[10px]"
                            disabled={txLogsPage === 1}
                            onClick={() => setTxLogsPage(prev => Math.max(1, prev - 1))}
                          >
                            Prev
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 py-0 text-[10px]"
                            disabled={txLogsPage === txLogsPagination.totalPages}
                            onClick={() => setTxLogsPage(prev => Math.min(txLogsPagination.totalPages, prev + 1))}
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

        </div>
      </div>

    </div>
  );
};

export default CashManagement;

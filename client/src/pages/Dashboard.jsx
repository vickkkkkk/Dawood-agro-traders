import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, CreditCard, Banknote,
  Smartphone, BarChart3, ArrowUpRight, ArrowDownRight,
  Calendar, Printer, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { SectionLoader } from '../components/ui/LoadingSpinner';
import { getDashboard, getDailySales } from '../api/reports';
import { getBills, getBillById } from '../api/billing';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { MONTHS, PAYMENT_METHOD_LABELS, BILL_STATUS_COLORS } from '../utils/constants';

const StatCard = ({ title, value, icon: Icon, gradient, iconColor = 'text-white', iconBg = 'bg-white/10', change, changeLabel }) => (
  <Card className={`relative overflow-hidden ${gradient}`}>
    <div className="relative z-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="text-2xl font-bold text-white mt-1.5">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={24} className={iconColor} />
        </div>
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          {change >= 0 ? (
            <ArrowUpRight size={14} className="text-emerald-400" />
          ) : (
            <ArrowDownRight size={14} className="text-red-400" />
          )}
          <span className={`text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-white/50">{changeLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
    {/* Background pattern */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
  </Card>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-xl">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold text-white">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [selectedBill, setSelectedBill] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const { data: selectedBillDetailsData, isLoading: isLoadingBill } = useQuery({
    queryKey: ['bill-details', selectedBill?._id || selectedBill?.id],
    queryFn: () => getBillById(selectedBill?._id || selectedBill?.id),
    enabled: !!(selectedBill?._id || selectedBill?.id),
  });

  const selectedBillDetails = selectedBillDetailsData?.data;

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    window.location.reload();
  };

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => getDashboard({ month, year }),
  });

  const { data: dailySalesData, isLoading: salesLoading } = useQuery({
    queryKey: ['dailySales', month, year],
    queryFn: () => getDailySales(month, year),
  });

  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: recentBillsData, isLoading: billsLoading } = useQuery({
    queryKey: ['recentBills', month, year],
    queryFn: () => getBills({
      limit: 10,
      startDate: startDateStr,
      endDate: endDateStr,
      sort: '-createdAt'
    }),
  });

  const stats = dashboardData?.data || dashboardData || {};
  const dailySales = dailySalesData?.data || dailySalesData || [];
  const recentBills = recentBillsData?.data?.bills || recentBillsData?.bills || recentBillsData?.data || [];

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: currentDate.getFullYear() - i,
    label: String(currentDate.getFullYear() - i),
  }));

  if (dashboardLoading) {
    return <SectionLoader text="Loading dashboard..." />;
  }

  return (
    <div className="app-container animate-fade-in">
      {/* Filters — wrapped in a Card for consistent design */}
      <Card compact>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 text-slate-400">
            <Calendar size={18} />
            <span className="text-sm font-semibold tracking-wide">Period:</span>
          </div>
          <div className="w-44">
            <Select
              id="dashboard-month"
              options={MONTHS}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="pos-filter-input pos-filter-select"
            />
          </div>
          <div className="w-32">
            <Select
              id="dashboard-year"
              options={yearOptions}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="pos-filter-input pos-filter-select"
            />
          </div>
        </div>
      </Card>

      {/* Stat Cards */}
      <div className="dashboard-grid">
        <StatCard
          title="Total Sales"
          value={formatCurrency(stats.totalSales || 0)}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border-emerald-500/20"
          iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20"
          change={stats.salesChange}
        />
        <StatCard
          title="Total Stock Consume"
          value={formatCurrency(stats.totalCreditConsume || 0)}
          icon={ArrowDownRight}
          gradient="bg-gradient-to-br from-rose-600/20 to-rose-800/20 border-rose-500/20"
          iconBg="bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/20"
        />
        <StatCard
          title="Total Stock Value"
          value={formatCurrency(stats.totalStockValue || 0)}
          icon={Package}
          gradient="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/20"
          iconBg="bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20"
        />
        <StatCard
          title="Receivables"
          value={formatCurrency(stats.totalCredits || 0)}
          icon={CreditCard}
          gradient="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border-amber-500/20"
          iconBg="bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
          change={stats.creditsChange}
        />
        <StatCard
          title="Cash Sales"
          value={formatCurrency(stats.cashPayments || 0)}
          icon={Banknote}
          gradient="bg-gradient-to-br from-green-600/20 to-green-800/20 border-green-500/20"
          iconBg="bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/20"
        />
        <StatCard
          title="Online Sales"
          value={formatCurrency(stats.onlinePayments || 0)}
          icon={Smartphone}
          gradient="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-purple-500/20"
          iconBg="bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/20"
        />
        <StatCard
          title="Credit Sales"
          value={formatCurrency(stats.creditPayments || 0)}
          icon={BarChart3}
          gradient="bg-gradient-to-br from-teal-600/20 to-teal-800/20 border-teal-500/20"
          iconBg="bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/20"
        />
        <StatCard
          title="Advance Payment"
          value={formatCurrency(stats.totalAdvance || 0)}
          icon={Banknote}
          gradient="bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border-indigo-500/20"
          iconBg="bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/20"
        />
      </div>


      {/* Daily Sales Table & Recent Bills */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Daily Sales Table */}
        <Card padding={false}>
          <div className="px-7 py-5 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Daily Sales Breakdown</h3>
          </div>
          <Table
            loading={salesLoading}
            headers={['Date', 'Bills', 'Cash', 'Online', 'Credit', 'Rcv/Adv', 'Cash in Hand']}
            showPagination={false}
            emptyMessage="No sales data for this period"
          >
            {Array.isArray(dailySales) && dailySales.length > 0 ? (
              dailySales.map((day, idx) => (
                <tr key={idx}>
                  <td>{formatDate(day.date)}</td>
                  <td>{day.billCount || day.count || 0}</td>
                  <td className="text-green-400">{formatCurrency(day.cash || 0)}</td>
                  <td className="text-purple-400">{formatCurrency(day.online || 0)}</td>
                  <td className="text-amber-400">{formatCurrency(day.credit || 0)}</td>
                  <td className="text-sky-400">{formatCurrency(day.receivablesCollected || 0)}</td>
                  <td className="text-emerald-300 font-semibold">{formatCurrency(day.cashInHand || 0)}</td>
                </tr>
              ))
            ) : null}
          </Table>
        </Card>

        {/* Recent Bills */}
        <Card padding={false}>
          <div className="px-7 py-5 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Recent Bills</h3>
          </div>
          <Table
            loading={billsLoading}
            headers={['Bill No', 'Customer', 'Amount', 'Status']}
            showPagination={false}
            emptyMessage="No recent bills"
          >
            {Array.isArray(recentBills) && recentBills.length > 0 ? (
              recentBills.slice(0, 10).map((bill) => {
                return (
                  <tr key={bill._id || bill.id}>
                    <td>
                      <button
                        onClick={() => {
                          setSelectedBill({
                            id: bill._id || bill.id,
                            billNo: bill.billNumber || bill.billNo || '-'
                          });
                          setShowViewModal(true);
                        }}
                        className="text-emerald-400 font-mono hover:underline focus:outline-none text-left cursor-pointer font-semibold bg-transparent border-none p-0"
                      >
                        {bill.billNumber || bill.billNo || '-'}
                      </button>
                    </td>
                    <td>
                      {bill.customer?.name || bill.customerName || 'Walk-in'}
                    </td>
                    <td className="text-white font-medium">
                      {formatCurrency(bill.total || 0)}
                    </td>
                    <td>
                      <Badge
                        variant={
                          bill.isVoid ? 'danger' :
                            bill.paymentStatus === 'CREDIT'
                              ? (parseFloat(bill.amountPaid || 0) > 0 ? 'warning' : 'danger')
                              : 'success'
                        }
                        size="sm"
                      >
                        {bill.isVoid ? 'VOIDED' :
                          bill.paymentStatus === 'CREDIT'
                            ? (parseFloat(bill.amountPaid || 0) > 0 ? 'PARTIAL' : 'CREDIT')
                            : 'PAID'}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            ) : null}
          </Table>
        </Card>
      </div>

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
                  <p className="text-[10px] text-gray-600">Jatoi Road Near Zrai Bank Shah Jamal</p>
                  <p className="text-[10px] text-gray-600">Phone: 0340-0736201, 0302-7338805</p>
                  <p className="text-[10px] font-mono mt-2 text-gray-700">INVOICE: {selectedBillDetails.billNo}</p>
                  <p className="text-[9px] text-gray-500">Date: {new Date(selectedBillDetails.billDate).toLocaleString('en-PK')}</p>
                </div>

                {selectedBillDetails.isVoid && (
                  <div className="border border-red-500 text-red-500 text-center font-bold text-sm p-1 rounded mb-4 tracking-widest rotate-2">
                    VOIDED / CANCELLED
                  </div>
                )}

                <div className="space-y-1 mb-4 text-left">
                  <p><span className="font-semibold text-gray-700">Created By:</span> {selectedBillDetails.user?.name || 'Counter Staff'}</p>
                  <p><span className="font-semibold text-gray-700">Customer:</span> {selectedBillDetails.customer?.name || 'Walk-in'}</p>
                  {selectedBillDetails.customer?.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {selectedBillDetails.customer.phone}</p>}
                  <p><span className="font-semibold text-gray-700">Payment:</span> {PAYMENT_METHOD_LABELS[selectedBillDetails.paymentMethod]}</p>
                </div>

                <table className="w-full border-t border-b border-dashed border-gray-400 py-2 my-2 text-black">
                  <thead>
                    <tr className="border-b border-gray-300 font-semibold text-gray-700">
                      <th className="text-left py-1 font-semibold text-gray-700">Item</th>
                      <th className="text-center py-1 font-semibold text-gray-700">Qty</th>
                      <th className="text-right py-1 font-semibold text-gray-700">Price</th>
                      <th className="text-right py-1 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedBillDetails.items?.map((item, idx) => {
                      return (
                        <tr key={idx} className="py-1">
                          <td className="py-1 text-left text-gray-800">
                            <div>{item.product?.name || `Product #${item.productId}`}</div>
                            {parseFloat(item.returnedQuantity || 0) > 0 && (
                              <div className="text-[10px] text-red-600 font-semibold">
                                (Returned: {parseFloat(item.returnedQuantity)})
                              </div>
                            )}
                          </td>
                          <td className="text-center py-1 text-gray-800">{parseFloat(item.quantity)}</td>
                          <td className="text-right py-1 text-gray-800">{parseFloat(item.unitPrice).toFixed(0)}</td>
                          <td className="text-right py-1 text-gray-800">{parseFloat(item.total).toFixed(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="space-y-1.5 text-right font-medium mt-4">
                  <div className="flex justify-between text-gray-700">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>Rs. {parseFloat(selectedBillDetails.subtotal).toLocaleString()}</span>
                  </div>
                  {parseFloat(selectedBillDetails.discount) > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
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
                      {parseFloat(selectedBillDetails.amountPaid) > 0 && (
                        <div className="flex justify-between text-gray-600 font-semibold">
                          <span>Down Payment (Cash):</span>
                          <span>Rs. {parseFloat(selectedBillDetails.amountPaid).toLocaleString()}</span>
                        </div>
                      )}
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
    </div>
  );
};

export default Dashboard;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, CreditCard, Banknote,
  Smartphone, BarChart3, ArrowUpRight, ArrowDownRight,
  Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import { SectionLoader } from '../components/ui/LoadingSpinner';
import { getDashboard, getDailySales } from '../api/reports';
import { getBills } from '../api/billing';
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

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => getDashboard({ month, year }),
  });

  const { data: dailySalesData, isLoading: salesLoading } = useQuery({
    queryKey: ['dailySales', month, year],
    queryFn: () => getDailySales(month, year),
  });

  const { data: recentBillsData, isLoading: billsLoading } = useQuery({
    queryKey: ['recentBills'],
    queryFn: () => getBills({ limit: 10, sort: '-createdAt' }),
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
          title="Total Stock Value"
          value={formatCurrency(stats.stockValue || 0)}
          icon={Package}
          gradient="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/20"
          iconBg="bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20"
        />
        <StatCard
          title="Outstanding Credits"
          value={formatCurrency(stats.outstandingCredits || 0)}
          icon={CreditCard}
          gradient="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border-amber-500/20"
          iconBg="bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
          change={stats.creditsChange}
        />
        <StatCard
          title="Cash Payments"
          value={formatCurrency(stats.cashPayments || 0)}
          icon={Banknote}
          gradient="bg-gradient-to-br from-green-600/20 to-green-800/20 border-green-500/20"
          iconBg="bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/20"
        />
        <StatCard
          title="Online Payments"
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
            headers={['Date', 'Bills', 'Cash', 'Online', 'Credit', 'Total']}
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
                  <td className="text-white font-medium">{formatCurrency(day.total || 0)}</td>
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
                      <span className="text-emerald-400 font-mono">{bill.billNumber || bill.billNo || '-'}</span>
                    </td>
                    <td>
                      {bill.customer?.name || bill.customerName || 'Walk-in'}
                    </td>
                    <td className="text-white font-medium">
                      {formatCurrency(bill.total || bill.totalAmount || 0)}
                    </td>
                    <td>
                      <Badge
                        variant={
                          bill.status === 'PAID' ? 'success' :
                          bill.status === 'PARTIAL' ? 'warning' :
                          bill.status === 'CREDIT' ? 'danger' : 'default'
                        }
                        size="sm"
                      >
                        {bill.status || 'Paid'}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            ) : null}
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

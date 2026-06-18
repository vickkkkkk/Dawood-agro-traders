import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, TrendingUp, ShoppingBag, DollarSign, Award } from 'lucide-react';
import { getSalesLedger } from '../api/reports';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';

const SalesLedger = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['sales-ledger'],
    queryFn: getSalesLedger,
  });

  const products = Array.isArray(ledgerData?.data) ? ledgerData.data : [];

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = products.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);
  const totalCogs = products.reduce((sum, p) => sum + (p.cogs || 0), 0);
  const totalProfit = totalRevenue - totalCogs;

  return (
    <div className="app-container animate-fade-in">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Revenue</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <ShoppingBag size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-red-800/20 border-amber-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Cost of Goods Sold (COGS)</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalCogs)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <DollarSign size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600/20 to-teal-800/20 border-emerald-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Net Profit</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalProfit)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Control bar */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="sales-ledger-search"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
        </div>
      </Card>

      {/* Sales Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <Table
            id="sales-ledger-table"
            loading={isLoading}
            headers={[
              'Product Name', 
              'SKU', 
              'Purchased Qty', 
              'Sold Qty', 
              'Remaining Qty', 
              'Avg Cost (WAC)', 
              'Avg Sale Price', 
              'Net Profit', 
              'Actions'
            ]}
            showPagination={false}
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white text-sm">{p.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                    {p.sku}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {p.totalQuantityPurchased} {p.unit || 'bags'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-semibold">
                    {p.totalQuantitySold} {p.unit || 'bags'}
                  </td>
                  <td className={`px-4 py-3 text-sm font-semibold ${p.remainingQuantity > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                    {p.remainingQuantity} {p.unit || 'bags'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatCurrency(p.weightedAverageCost)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-semibold">
                    {formatCurrency(p.averageSalePrice)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${p.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(p.netProfit)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      id={`btn-view-sales-ledger-${p.id}`}
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => navigate(`/sales-ledger/${p.id}`)}
                    >
                      Sales Details
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-7 py-16 text-center text-slate-500">
                  No products found in sales ledger
                </td>
              </tr>
            )}
          </Table>
        </div>
      </Card>

    </div>
  );
};

export default SalesLedger;

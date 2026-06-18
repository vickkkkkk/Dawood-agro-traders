import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileSpreadsheet, Layers, DollarSign, Tag } from 'lucide-react';
import { getPurchaseLedger } from '../api/reports';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { formatCurrency } from '../utils/formatCurrency';

const PurchaseLedger = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['purchase-ledger'],
    queryFn: getPurchaseLedger,
  });

  const products = Array.isArray(ledgerData?.data) ? ledgerData.data : [];

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container animate-fade-in">
      
      {/* Header Cards for stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-600/20 to-teal-800/20 border-emerald-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Products Tracked</p>
              <p className="text-2xl font-bold text-white mt-1">{products.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Tag size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border-indigo-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Total Batches Purchased</p>
              <p className="text-2xl font-bold text-white mt-1">
                {products.reduce((sum, p) => sum + (p.batchCount || 0), 0)} Batches
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Layers size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-pink-800/20 border-purple-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Purchase Ledger Status</p>
              <p className="text-2xl font-bold text-white mt-1">Active & Persistent</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Control bar */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="purchase-ledger-search"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card padding={false}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <Table
            id="purchase-ledger-table"
            loading={isLoading}
            headers={['Product Name', 'SKU', 'Total Purchased', 'Avg Purchase Cost', 'Latest Purchase Cost', 'Batches Count', 'Actions']}
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
                  <td className="px-4 py-3 text-sm text-slate-300">
                    <span className="font-semibold">{p.totalQuantityPurchased}</span> {p.unit || 'bags'}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-sky-400">
                    {formatCurrency(p.averagePurchasePrice)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-teal-400">
                    {formatCurrency(p.latestPurchasePrice)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {p.batchCount} batches
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      id={`btn-view-pur-ledger-${p.id}`}
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => navigate(`/purchase-ledger/${p.id}`)}
                    >
                      View Details
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-7 py-16 text-center text-slate-500">
                  No products found in purchase ledger
                </td>
              </tr>
            )}
          </Table>
        </div>
      </Card>

    </div>
  );
};

export default PurchaseLedger;

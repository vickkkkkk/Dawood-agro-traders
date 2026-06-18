import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, ShoppingBag, DollarSign, Layers, Calendar, User } from 'lucide-react';
import { getProductSalesDetail } from '../api/reports';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime, formatDate } from '../utils/formatDate';

const SalesLedgerDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['product-sales-detail', productId],
    queryFn: () => getProductSalesDetail(productId),
    enabled: !!productId,
  });

  const product = detailData?.data?.product || {};
  const wac = detailData?.data?.weightedAverageCost || 0;
  const totalQtySold = detailData?.data?.totalQuantitySold || 0;
  const totalNetProfit = detailData?.data?.totalNetProfit || 0;
  const history = Array.isArray(detailData?.data?.history) ? detailData.data.history : [];

  const totalRevenue = history.reduce((sum, h) => sum + h.totalRevenue, 0);

  return (
    <div className="app-container animate-fade-in">
      
      {/* Header with back navigation */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <button
            onClick={() => navigate('/sales-ledger')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-2"
          >
            <ArrowLeft size={16} />
            Back to Sales Ledger
          </button>
          <h2 className="text-xl font-extrabold text-white leading-tight">
            Sales History: {product.name || 'Loading...'}
          </h2>
          {product.sku && (
            <p className="text-xs text-slate-500 font-mono mt-1">SKU: {product.sku}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units Sold</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {totalQtySold} {product.unit || 'bags'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Cost (WAC)</p>
              <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(wac)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Revenue</p>
              <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Net Profit</p>
              <p className={`text-xl font-bold mt-0.5 ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(totalNetProfit)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Individual Sales Transactions */}
      <Card padding={false}>
        <div className="px-7 py-5 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Sales Transactions</h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {history.length} Transactions
          </span>
        </div>
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <Table
            id="product-sales-table"
            loading={isLoading}
            headers={['Date & Time', 'Bill Number', 'Customer', 'Quantity', 'Sale Price', 'Total Revenue', 'Cost Basis (WAC)', 'Net Profit']}
            showPagination={false}
          >
            {history.length > 0 ? (
              history.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatDateTime(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-emerald-400 font-semibold">{tx.billNo}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {tx.customerName}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    {tx.quantitySold} {product.unit || 'bags'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatCurrency(tx.salePrice)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-white">
                    {formatCurrency(tx.totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatCurrency(tx.costBasis)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${tx.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(tx.profit)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-7 py-16 text-center text-slate-500">
                  No sales transactions found for this product
                </td>
              </tr>
            )}
          </Table>
        </div>

        {/* Aggregate Net Profit summary row */}
        {history.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white/[0.02] border-t border-white/10 px-7 py-5 font-bold gap-3">
            <span className="text-white text-sm">Product Profitability Summary:</span>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex gap-2 text-slate-400">
                <span>Total Revenue:</span>
                <span className="text-white">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex gap-2 text-slate-400">
                <span>Total COGS:</span>
                <span className="text-white">{formatCurrency(totalQtySold * wac)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400">Net Profit:</span>
                <span className={totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {formatCurrency(totalNetProfit)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
};

export default SalesLedgerDetail;

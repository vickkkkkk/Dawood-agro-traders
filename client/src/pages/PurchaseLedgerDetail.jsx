import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Calendar, Layers, DollarSign, FileText } from 'lucide-react';
import { getProductPurchaseDetail } from '../api/reports';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime, formatDate } from '../utils/formatDate';

const PurchaseLedgerDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['product-purchase-detail', productId],
    queryFn: () => getProductPurchaseDetail(productId),
    enabled: !!productId,
  });

  const product = detailData?.data?.product || {};
  const history = Array.isArray(detailData?.data?.history) ? detailData.data.history : [];

  const totalQty = history.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalSpend = history.reduce((sum, item) => sum + Number(item.total), 0);
  const avgCost = totalQty > 0 ? totalSpend / totalQty : 0;

  return (
    <div className="app-container animate-fade-in">
      
      {/* Header / Title bar with back button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <button
            onClick={() => navigate('/purchase-ledger')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 mb-2"
          >
            <ArrowLeft size={16} />
            Back to Purchase Ledger
          </button>
          <h2 className="text-xl font-extrabold text-white leading-tight">
            Purchase History: {product.name || 'Loading...'}
          </h2>
          {product.sku && (
            <p className="text-xs text-slate-500 font-mono mt-1">SKU: {product.sku}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units Purchased</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {totalQty} {product.unit || 'bags'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weighted Avg Cost</p>
              <p className="text-2xl font-bold text-white mt-0.5">{formatCurrency(avgCost)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Historic Spend</p>
              <p className="text-2xl font-bold text-white mt-0.5">{formatCurrency(totalSpend)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Purchase Batches List */}
      <Card padding={false}>
        <div className="px-7 py-5 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Purchase Batches</h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {history.length} Transactions
          </span>
        </div>
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <Table
            id="product-purchases-table"
            loading={isLoading}
            headers={['Date & Time', 'GRN Number', 'Supplier', 'Quantity', 'Cost Price', 'Total Cost', 'Batch/Expiry']}
            showPagination={false}
          >
            {history.length > 0 ? (
              history.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatDateTime(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-emerald-400 font-semibold">{tx.grnNo}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {tx.supplierName} {tx.supplierCompany ? `(${tx.supplierCompany})` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    {tx.quantity} {product.unit || 'bags'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatCurrency(tx.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-400">
                    {formatCurrency(tx.total)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <div className="flex flex-col gap-0.5">
                      {tx.batchNo && <span>Batch: {tx.batchNo}</span>}
                      {tx.expiryDate && <span>Expiry: {formatDate(tx.expiryDate)}</span>}
                      {!tx.batchNo && !tx.expiryDate && <span>-</span>}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-7 py-16 text-center text-slate-500">
                  No purchase records found for this product
                </td>
              </tr>
            )}
          </Table>
        </div>
      </Card>

    </div>
  );
};

export default PurchaseLedgerDetail;

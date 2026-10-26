import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, X, Package, Filter } from 'lucide-react';
import { productApi, categoryApi, unitApi, Product, Category, Unit } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    nameEn: '', sku: '', barcode: '', categoryId: '', unitId: '',
    storageType: 'DRY' as 'DRY' | 'CHILLED' | 'FROZEN',
    retailPrice: '', purchaseCost: '', trackExpiry: false,
    reorderLevel: '10', reorderQty: '20',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedStorage) params.storageType = selectedStorage;
      const [prods, cats, us] = await Promise.all([
        productApi.getAll(params),
        categoryApi.getAll(),
        unitApi.getAll(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setUnits(us);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [search, selectedCategory, selectedStorage]);

  const openAddModal = () => {
    setEditProduct(null);
    setForm({ nameEn: '', sku: '', barcode: '', categoryId: categories[0]?.id || '', unitId: units[0]?.id || '', storageType: 'DRY', retailPrice: '', purchaseCost: '', trackExpiry: false, reorderLevel: '10', reorderQty: '20' });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    const price = product.prices?.[0];
    setForm({
      nameEn: product.name_en,
      sku: product.sku,
      barcode: product.barcode || '',
      categoryId: product.category?.id || '',
      unitId: product.unit?.id || '',
      storageType: product.storage_type,
      retailPrice: price?.retail_price.toString() || '',
      purchaseCost: price?.purchase_cost.toString() || '',
      trackExpiry: product.track_expiry,
      reorderLevel: '10',
      reorderQty: '20',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nameEn || !form.sku || !form.retailPrice || !form.purchaseCost) {
      setError('Please fill in all required fields'); return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nameEn: form.nameEn, sku: form.sku, barcode: form.barcode || undefined,
        categoryId: form.categoryId, unitId: form.unitId,
        storageType: form.storageType, trackExpiry: form.trackExpiry,
        retailPrice: parseFloat(form.retailPrice),
        purchaseCost: parseFloat(form.purchaseCost),
        reorderLevel: parseInt(form.reorderLevel),
        reorderQty: parseInt(form.reorderQty),
      };
      if (editProduct) {
        await productApi.update(editProduct.id, payload);
      } else {
        await productApi.create(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const storageColors = { DRY: 'bg-amber-100 text-amber-700', CHILLED: 'bg-blue-100 text-blue-700', FROZEN: 'bg-cyan-100 text-cyan-700' };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-gray-500 text-sm">{products.length} products</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green w-64"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-store-green"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={selectedStorage}
            onChange={(e) => setSelectedStorage(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-store-green"
          >
            <option value="">All Storage</option>
            <option value="DRY">Dry</option>
            <option value="CHILLED">Chilled</option>
            <option value="FROZEN">Frozen</option>
          </select>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU / Barcode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Storage</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retail Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="shimmer h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No products found</p>
                </td></tr>
              ) : (
                products.map((product) => {
                  const price = product.prices?.[0];
                  const margin = price ? ((price.margin_amount / price.retail_price) * 100).toFixed(0) : 0;
                  const stock = product.inventory_bals?.[0];
                  const isLow = stock && stock.on_hand_qty <= stock.reorder_level;
                  return (
                    <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800 text-sm">{product.name_en}</p>
                        {product.name_ur && <p className="text-xs text-gray-400">{product.name_ur}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-mono text-gray-600">{product.sku}</p>
                        {product.barcode && <p className="text-xs text-gray-400 font-mono">{product.barcode}</p>}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{product.category?.name || '—'}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${storageColors[product.storage_type]}`}>
                          {product.storage_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-800 text-sm">
                        {price ? formatCurrency(price.retail_price) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-store-green">{margin}%</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {stock ? (
                          <span className={`text-sm font-bold ${isLow ? 'text-orange-600' : 'text-gray-700'}`}>
                            {stock.on_hand_qty}
                            {isLow && <span className="text-orange-500 text-xs ml-1">⚠</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-gray-400 hover:text-store-green hover:bg-store-green-bg rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-heading font-bold text-lg text-gray-800">
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Name (English) *</label>
                  <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="e.g., Basmati Rice 5KG" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">SKU *</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="RICE-001" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Barcode</label>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green font-mono" placeholder="8901234560001" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category *</label>
                  <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit *</label>
                  <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green">
                    <option value="">Select unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Storage Type</label>
                  <select value={form.storageType} onChange={(e) => setForm({ ...form, storageType: e.target.value as 'DRY' | 'CHILLED' | 'FROZEN' })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green">
                    <option value="DRY">🌾 Dry</option>
                    <option value="CHILLED">❄️ Chilled</option>
                    <option value="FROZEN">🧊 Frozen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Retail Price (Rs.) *</label>
                  <input type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Purchase Cost (Rs.) *</label>
                  <input type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="0" />
                </div>

                {/* Margin preview */}
                {form.retailPrice && form.purchaseCost && (
                  <div className="col-span-2 p-3 bg-store-green-bg rounded-xl flex items-center justify-between">
                    <span className="text-sm text-gray-600">Profit Margin</span>
                    <span className="font-bold text-store-green">
                      {formatCurrency(parseFloat(form.retailPrice) - parseFloat(form.purchaseCost))}
                      {' '}({((parseFloat(form.retailPrice) - parseFloat(form.purchaseCost)) / parseFloat(form.retailPrice) * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reorder Level</label>
                  <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reorder Qty</label>
                  <input type="number" value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" />
                </div>

                <div className="col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <input type="checkbox" id="trackExpiry" checked={form.trackExpiry}
                    onChange={(e) => setForm({ ...form, trackExpiry: e.target.checked })}
                    className="w-4 h-4 accent-store-green" />
                  <label htmlFor="trackExpiry" className="text-sm font-medium text-gray-700 cursor-pointer">Track expiry dates for this product</label>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

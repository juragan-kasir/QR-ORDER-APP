import React, { Suspense, useEffect } from 'react';
import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, ShoppingBag, ListOrdered, Headphones, User, AlertTriangle } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useOrderStore } from '../store/useOrderStore';
import { fetchCustomerOrder } from '../services/orderService';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { path: '/', icon: Home, label: 'Menu' },
  { path: '/orders', icon: ListOrdered, label: 'Pesanan' },
  { path: '/cart', icon: ShoppingBag, label: 'Keranjang' },
  { path: '/waiter', icon: Headphones, label: 'Pelayan' },
  { path: '/history', icon: User, label: 'Riwayat' },
];

function buildHref(base: string, params: URLSearchParams) {
  const table = params.get('table') || '';
  const store = params.get('store') || '';
  const session = params.get('session') || '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}table=${encodeURIComponent(table)}&store=${encodeURIComponent(store)}&session=${encodeURIComponent(session)}`;
}

const NavLinks: React.FC<{ badge?: number }> = ({ badge }) => {
  const location = useLocation();

  const currentParams = new URLSearchParams(location.search);
  const table = currentParams.get('table') || '';
  const store = currentParams.get('store') || '';
  const session = currentParams.get('session') || '';

      return (
        <>
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/product/')
              : item.path === '/cart'
                ? location.pathname === '/cart' || location.pathname === '/checkout' || location.pathname === '/payment'
                : location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={`${item.path}?table=${encodeURIComponent(table)}&store=${encodeURIComponent(store)}&session=${encodeURIComponent(session)}`}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <div className="relative">
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {item.path === '/cart' && badge && badge > 0 ? (
                <span className="absolute -top-2 -right-2.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-sm">
                  {badge}
                </span>
              ) : null}
            </div>
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
};

const MissingParamsPage: React.FC = () => (
  <div className="min-h-screen bg-secondary dark:bg-gray-900 flex items-center justify-center p-6">
    <div className="text-center space-y-6 max-w-sm">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
        <AlertTriangle size={40} className="text-yellow-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Link Tidak Lengkap
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
          URL harus menyertakan parameter <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">?table=&store=</code>
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
          Contoh: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">/?table=5&store= outlet-1</code>
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-left text-sm space-y-2 border border-gray-100 dark:border-gray-700">
        <p className="font-medium text-gray-700 dark:text-gray-300">Parameter yang diperlukan:</p>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">table</span>
          Nomor meja pelanggan
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">store</span>
          ID toko / outlet
        </div>
      </div>
    </div>
  </div>
);

const Layout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const totalItems = useCartStore((state) => state.totalItems());
  const setCartStoreId = useCartStore((state) => state.setStoreId);
  const { setTableNumber, setStoreId } = useSettingsStore();
  const setActiveOrder = useOrderStore((state) => state.setActiveOrder);

  const table = searchParams.get('table');
  const store = searchParams.get('store');
  // Opaque per-order token (not the raw database id) — the backend now
  // requires it for this unauthenticated lookup so a shared/bookmarked
  // link can't be used to enumerate other stores' orders.
  const orderToken = searchParams.get('orderToken');
  const hasRequiredParams = Boolean(table && store);

  useEffect(() => {
    if (table) setTableNumber(table);
    if (store) {
      setStoreId(store);
      setCartStoreId(store);
    }
  }, [table, store, setTableNumber, setStoreId, setCartStoreId]);

  useEffect(() => {
    if (!orderToken || !store) return;
    const fetchOrder = async () => {
      try {
        const order = await fetchCustomerOrder(orderToken);
        if (order) {
          // Activate this order for the CURRENT QR context (not whatever
          // the tracking response itself reports, which the backend doesn't
          // even populate for this endpoint) — consistent with the
          // URL-is-authoritative rule used for order submission.
          setActiveOrder(order.id, { storeId: store, tableId: table });
        }
      } catch {
        // ignore
      }
    };
    fetchOrder();
  }, [orderToken, store, table, setActiveOrder]);

  if (!hasRequiredParams) {
    return <MissingParamsPage />;
  }

  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-900 md:pb-0 transition-colors">
      {/* Desktop Header Nav */}
      <header className="hidden md:block bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex justify-between items-center">
          <Link to={buildHref('/', searchParams)} className="font-display font-bold text-xl text-primary">
            Bisa Makan
          </Link>
          <nav className="flex items-center gap-4">
            <NavLinks badge={totalItems} />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to={buildHref('/', searchParams)} className="font-display font-bold text-lg text-primary">
            Bisa Makan
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to={buildHref('/cart', searchParams)} aria-label="Keranjang" className="relative p-2">
              <ShoppingBag size={22} className="text-gray-700 dark:text-gray-300" />
              {totalItems > 0 ? (
                <span className="absolute top-0.5 right-0.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-sm">
                  {totalItems}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 pt-6 pb-24 md:pt-4 md:pb-6">
        {/* Halaman lazy: header & nav bawah tetap tampil selama chunk dimuat. */}
        <Suspense fallback={<div className="min-h-[50vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-700/50 px-2 py-2 flex justify-around items-center md:hidden z-50 safe-bottom">
        <NavLinks badge={totalItems} />
      </nav>
    </div>
  );
};

export default Layout;

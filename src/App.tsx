import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";

// Halaman menu (HomePage) dimuat langsung — layar pertama pelanggan setelah
// scan QR. Halaman lain di-lazy supaya tidak membebani LCP/TBT menu, lalu
// dipra-muat saat browser senggang agar pindah halaman tetap instan.
const loadCart = () => import("./pages/CartPage");
const loadCheckout = () => import("./pages/CheckoutPage");
const loadPayment = () => import("./pages/PaymentPage");
const loadProduct = () => import("./pages/ProductDetailPage");
const CartPage = React.lazy(loadCart);
const CheckoutPage = React.lazy(loadCheckout);
const PaymentPage = React.lazy(loadPayment);
const ProductDetailPage = React.lazy(loadProduct);
const OrdersPage = React.lazy(() => import("./pages/OrdersPage"));
const WaiterPage = React.lazy(() => import("./pages/WaiterPage"));
const OrderHistoryPage = React.lazy(() => import("./pages/OrderHistoryPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

// Ditunda 3 detik setelah load (di luar jendela LCP) lalu tunggu browser
// senggang, supaya pra-muat tidak berebut bandwidth dengan halaman menu.
const prefetchCustomerFlow = () => {
  const run = () => void Promise.all([loadProduct(), loadCart(), loadCheckout(), loadPayment()]);
  setTimeout(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
    else run();
  }, 3000);
};
import { useThemeStore } from "./store/useThemeStore";

const DetailProductRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/product/${id}`} replace />;
};

const App: React.FC = () => {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  useEffect(() => {
    if (document.readyState === "complete") prefetchCustomerFlow();
    else window.addEventListener("load", prefetchCustomerFlow, { once: true });
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="product/:id" element={<ProductDetailPage />} />
            <Route path="detail-product/:id" element={<DetailProductRedirect />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="payment" element={<PaymentPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="waiter" element={<WaiterPage />} />
            <Route path="history" element={<OrderHistoryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;

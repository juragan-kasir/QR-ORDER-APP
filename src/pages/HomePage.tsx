import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "../hooks/useProducts";
import { useBundles } from "../hooks/useBundles";
import { usePromos } from "../hooks/usePromos";
import { useStoreConfig } from "../hooks/useStoreConfig";
import SearchBar from "../components/SearchBar";
import MenuCard from "../components/MenuCard";
import BundleCard from "../components/BundleCard";
import PromoBanner from "../components/PromoBanner";
import CategoryIcon from "../components/CategoryIcon";
import Skeleton from "../components/Skeleton";
import { Clock, RefreshCw } from "lucide-react";
import type { Category } from "../types";

const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">(
    "All",
  );
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table");
  const store = searchParams.get("store");

  const { products, categories, loading, error, refetch } = useProducts(store);
  const { bundles } = useBundles(store);
  const { promos } = usePromos(store);
  const { config, error: storeConfigError } = useStoreConfig(store);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const filteredBundles = useMemo(() => {
    if (!searchQuery.trim()) return bundles;
    const q = searchQuery.trim().toLowerCase();
    return bundles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [bundles, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <Skeleton width="60%" height="2rem" borderRadius="0.75rem" />
          <Skeleton
            width="40%"
            height="1rem"
            className="mt-3"
            borderRadius="0.5rem"
          />
        </header>
        <Skeleton width="100%" height="3rem" borderRadius="1rem" />
        <Skeleton width="100%" height="3rem" borderRadius="1rem" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden space-y-4 p-4 border border-gray-50 dark:border-gray-700/50"
            >
              <Skeleton width="100%" height="11rem" borderRadius="1rem" />
              <Skeleton width="80%" height="1.2rem" borderRadius="0.5rem" />
              <Skeleton width="60%" height="0.8rem" borderRadius="0.5rem" />
              <Skeleton width="40%" height="1.5rem" borderRadius="0.5rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="text-gray-500 dark:text-gray-400 font-medium">{error}</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Coba muat ulang halaman atau tekan tombol di bawah.
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20"
        >
          <RefreshCw size={16} /> Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-display text-gray-900 dark:text-gray-100">
          Halo, mau makan apa hari ini?
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Pilih menu favoritmu dan mulai pesan!
        </p>
        <div className="flex items-center gap-2">
          {table && (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
              Meja {table}
            </span>
          )}
          {config.storeName && (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-full text-xs font-bold">
              {config.storeName}
            </span>
          )}
        </div>
      </header>

      {storeConfigError && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-2xl font-medium flex items-start gap-2">
          <span>⚠️</span>
          <span>{storeConfigError}</span>
        </div>
      )}

      {config.storeIsOpen === false && (
        <div
          role="status"
          className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 text-sm px-4 py-3 rounded-2xl font-medium flex items-start gap-2"
        >
          <Clock size={16} className="mt-0.5 shrink-0" />
          <span>
            Outlet sedang tutup. Kamu tetap bisa melihat menu, tetapi pesanan
            baru belum dapat dibuat.
          </span>
        </div>
      )}

      {promos.length > 0 && <PromoBanner promos={promos} />}

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory("All")}
          className={`px-4 py-2.5 rounded-full font-medium whitespace-nowrap transition-all text-sm shadow-sm ${
            selectedCategory === "All"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700"
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as Category)}
            className={`px-4 py-2.5 rounded-full font-medium whitespace-nowrap transition-all text-sm shadow-sm ${
              selectedCategory === cat.id
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700"
            }`}
          >
            <CategoryIcon icon={cat.icon} className="text-base leading-none" />{" "}
            {cat.name}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 && filteredBundles.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Tidak ada menu yang cocok dengan pencarianmu.
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Coba kata kunci atau filter lain.
          </p>
        </div>
      ) : (
        <>
          {/* ponytail: bundle section */}
          {filteredBundles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  🎁 Bundle Spesial
                </h2>
                <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {filteredBundles.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBundles.map((bundle) => (
                  <BundleCard key={bundle.id} bundle={bundle} />
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => (
              <MenuCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HomePage;

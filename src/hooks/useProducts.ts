import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProductVariant {
  id?: string;
  size: string;
  price: number;
  supplierPrice: number;
}

export interface Product {
  id: string;
  name: string;
  variants: ProductVariant[];
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchProducts = useCallback(async () => {
    const { data: prods } = await supabase.from('products').select('*').order('name');
    const { data: variants } = await supabase.from('product_variants').select('*');

    if (!prods) { setProducts([]); setLoading(false); return; }

    const mapped: Product[] = prods.map(p => ({
      id: p.id,
      name: p.name,
      variants: (variants || [])
        .filter(v => v.product_id === p.id)
        .map(v => ({
          id: v.id,
          size: v.size,
          price: Number(v.price),
          supplierPrice: Number(v.supplier_price),
        })),
    }));

    setProducts(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchProducts();
  }, [session, fetchProducts]);

  const addProduct = useCallback(async (name: string, variants: ProductVariant[]) => {
    const { data, error } = await supabase.from('products').insert({ name }).select().single();
    if (error || !data) return null;

    const variantsToInsert = variants.map(v => ({
      product_id: data.id,
      size: v.size,
      price: v.price,
      supplier_price: v.supplierPrice,
    }));
    await supabase.from('product_variants').insert(variantsToInsert);
    await fetchProducts();
    return data;
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, name: string, variants: ProductVariant[]) => {
    await supabase.from('products').update({ name }).eq('id', id);
    // Delete old variants and re-insert
    await supabase.from('product_variants').delete().eq('product_id', id);
    const variantsToInsert = variants.map(v => ({
      product_id: id,
      size: v.size,
      price: v.price,
      supplier_price: v.supplierPrice,
    }));
    await supabase.from('product_variants').insert(variantsToInsert);
    await fetchProducts();
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    await fetchProducts();
  }, [fetchProducts]);

  return { products, loading, addProduct, updateProduct, deleteProduct, refresh: fetchProducts };
}

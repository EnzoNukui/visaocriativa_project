import { useState, useCallback } from 'react';
import { Order, OrderStatus } from '@/types';

function loadOrders(): Order[] {
  const stored = localStorage.getItem('vc_orders');
  if (!stored) return [];
  const orders = JSON.parse(stored);
  // Migrate old orders without supplierTotalAmount
  return orders.map((o: any) => ({
    ...o,
    supplierTotalAmount: o.supplierTotalAmount ?? (o.items?.reduce((s: number, i: any) => s + (i.supplierTotal || i.total * 0.8), 0) || 0),
    items: o.items?.map((i: any) => ({
      ...i,
      supplierPrice: i.supplierPrice ?? Math.round(i.unitPrice * 0.8),
      supplierTotal: i.supplierTotal ?? Math.round(i.total * 0.8),
    })) || [],
  }));
}

function persistOrders(orders: Order[]) {
  localStorage.setItem('vc_orders', JSON.stringify(orders));
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(loadOrders);

  const addOrder = useCallback((order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>) => {
    const newOrder: Order = {
      ...order,
      id: crypto.randomUUID(),
      orderNumber: `VC-${String(loadOrders().length + 1).padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newOrder, ...loadOrders()];
    persistOrders(updated);
    setOrders(updated);
    return newOrder;
  }, []);

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    const updated = loadOrders().map(o => o.id === id ? { ...o, status } : o);
    persistOrders(updated);
    setOrders(updated);
  }, []);

  const deleteOrder = useCallback((id: string) => {
    const updated = loadOrders().filter(o => o.id !== id);
    persistOrders(updated);
    setOrders(updated);
  }, []);

  const refresh = useCallback(() => setOrders(loadOrders()), []);

  return { orders, addOrder, updateStatus, deleteOrder, refresh };
}

import { useState, useCallback } from 'react';
import { Order, OrderStatus } from '@/types';

function loadOrders(): Order[] {
  const stored = localStorage.getItem('vc_orders');
  return stored ? JSON.parse(stored) : [];
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

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  supplierPrice: number;
  total: number;
  supplierTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  studentName: string;
  grade: string;
  responsibleName: string;
  phone: string;
  items: OrderItem[];
  totalAmount: number;
  supplierTotalAmount: number;
  status: 'pending' | 'production' | 'delivered';
  createdAt: string;
  createdBy: string;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ordersData) { setOrders([]); setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    const mapped: Order[] = ordersData.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      studentName: o.student_name,
      grade: o.grade,
      responsibleName: o.responsible_name,
      phone: o.phone,
      totalAmount: Number(o.total_amount),
      supplierTotalAmount: Number(o.supplier_total_amount),
      status: o.status as Order['status'],
      createdAt: o.created_at,
      createdBy: o.created_by,
      items: (itemsData || [])
        .filter(i => i.order_id === o.id)
        .map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          size: i.size,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          supplierPrice: Number(i.supplier_price),
          total: Number(i.total),
          supplierTotal: Number(i.supplier_total),
        })),
    }));

    setOrders(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchOrders();
  }, [session, fetchOrders]);

  const addOrder = useCallback(async (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        student_name: order.studentName,
        grade: order.grade,
        responsible_name: order.responsibleName,
        phone: order.phone,
        total_amount: order.totalAmount,
        supplier_total_amount: order.supplierTotalAmount,
        status: order.status,
        created_by: order.createdBy,
        order_number: 'TEMP', // trigger will override
      })
      .select()
      .single();

    if (error || !data) return null;

    // Insert items
    const itemsToInsert = order.items.map(i => ({
      order_id: data.id,
      product_id: i.productId,
      product_name: i.productName,
      size: i.size,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      supplier_price: i.supplierPrice,
      total: i.total,
      supplier_total: i.supplierTotal,
    }));

    await supabase.from('order_items').insert(itemsToInsert);
    await fetchOrders();
    return data;
  }, [fetchOrders]);

  const updateStatus = useCallback(async (id: string, status: Order['status']) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    await fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    await supabase.from('orders').delete().eq('id', id);
    await fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, addOrder, updateStatus, deleteOrder, refresh: fetchOrders };
}

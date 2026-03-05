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
  schoolProfit: number;
  status: string;
  createdAt: string;
  createdBy: string;
  repasseCompleted: boolean;
  repasseDate: string | null;
  repasseConfirmedBy: string | null;
  repasseAmount: number;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchOrders = useCallback(async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) { setOrders([]); setLoading(false); return; }

      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      }

      const mapped: Order[] = ordersData.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        studentName: o.student_name,
        grade: o.grade,
        responsibleName: o.responsible_name,
        phone: o.phone,
        totalAmount: Number(o.total_amount),
        supplierTotalAmount: Number(o.supplier_total_amount),
        schoolProfit: Number(o.school_profit ?? (Number(o.total_amount) - Number(o.supplier_total_amount))),
        status: o.status,
        createdAt: o.created_at,
        createdBy: o.created_by,
        repasseCompleted: o.repasse_completed,
        repasseDate: o.repasse_date,
        repasseConfirmedBy: o.repasse_confirmed_by,
        repasseAmount: Number(o.repasse_amount ?? 0),
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
    } catch (err) {
      console.error('Unexpected error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchOrders();
  }, [session, fetchOrders]);

  const addOrder = useCallback(async (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'repasseCompleted' | 'repasseDate' | 'repasseConfirmedBy' | 'repasseAmount' | 'schoolProfit'>) => {
    try {
      const schoolProfit = order.totalAmount - order.supplierTotalAmount;
      const { data, error } = await supabase
        .from('orders')
        .insert({
          student_name: order.studentName,
          grade: order.grade,
          responsible_name: order.responsibleName,
          phone: order.phone,
          total_amount: order.totalAmount,
          supplier_total_amount: order.supplierTotalAmount,
          school_profit: schoolProfit,
          repasse_amount: order.supplierTotalAmount,
          status: order.status,
          created_by: order.createdBy,
          order_number: 'TEMP',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating order:', error);
        return null;
      }
      if (!data) return null;

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

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }

      await fetchOrders();
      return data;
    } catch (err) {
      console.error('Unexpected error creating order:', err);
      return null;
    }
  }, [fetchOrders]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    await fetchOrders();
  }, [fetchOrders]);

  const updateRepasseCompleted = useCallback(async (id: string, completed: boolean, userId: string) => {
    await supabase.from('orders').update({
      repasse_completed: completed,
      repasse_date: completed ? new Date().toISOString() : null,
      repasse_confirmed_by: completed ? userId : null,
    }).eq('id', id);
    await fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    await supabase.from('orders').delete().eq('id', id);
    await fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, addOrder, updateStatus, updateRepasseCompleted, deleteOrder, refresh: fetchOrders };
}

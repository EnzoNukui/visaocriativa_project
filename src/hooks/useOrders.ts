import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type OrderStatus = 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Aguardando Pagamento',
  paid: 'Pago',
  in_production: 'Em Produção',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-emerald-100 text-emerald-800',
  in_production: 'bg-blue-100 text-blue-800',
  ready: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

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
  status: OrderStatus;
  createdAt: string;
  createdBy: string;
  supplierId: string | null;
  repasseCompleted: boolean;
  repasseDate: string | null;
  repasseAmount: number;
  repasseConfirmedBy: string | null;
}

// Which roles can transition to which statuses
export function getAllowedTransitions(currentStatus: OrderStatus, role: 'admin' | 'supplier'): OrderStatus[] {
  if (role === 'admin') {
    switch (currentStatus) {
      case 'awaiting_payment': return ['paid', 'cancelled'];
      case 'paid': return ['in_production', 'cancelled'];
      case 'in_production': return ['ready', 'cancelled'];
      case 'ready': return ['delivered', 'cancelled'];
      case 'delivered': return [];
      case 'cancelled': return [];
      default: return [];
    }
  }
  if (role === 'supplier') {
    switch (currentStatus) {
      case 'paid': return ['in_production'];
      case 'in_production': return ['ready'];
      default: return [];
    }
  }
  return [];
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { session, user } = useAuth();

  const fetchOrders = useCallback(async () => {
    // RLS handles filtering by role
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ordersData) { setOrders([]); setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = orderIds.length > 0
      ? await supabase.from('order_items').select('*').in('order_id', orderIds)
      : { data: [] };

    const mapped: Order[] = ordersData.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      studentName: o.student_name,
      grade: o.grade,
      responsibleName: o.responsible_name,
      phone: o.phone,
      totalAmount: Number(o.total_amount),
      supplierTotalAmount: Number(o.supplier_total_amount),
      status: o.status as OrderStatus,
      createdAt: o.created_at,
      createdBy: o.created_by,
      supplierId: (o as any).supplier_id || null,
      repasseCompleted: (o as any).repasse_completed || false,
      repasseDate: (o as any).repasse_date || null,
      repasseAmount: Number((o as any).repasse_amount || 0),
      repasseConfirmedBy: (o as any).repasse_confirmed_by || null,
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

  const addOrder = useCallback(async (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'repasseCompleted' | 'repasseDate' | 'repasseAmount' | 'repasseConfirmedBy'>) => {
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
        order_number: 'TEMP',
        supplier_id: order.supplierId,
      } as any)
      .select()
      .single();

    if (error || !data) return null;

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

    // Audit log
    if (user) {
      await supabase.from('audit_log' as any).insert({
        entity_type: 'order',
        entity_id: data.id,
        action: 'create',
        new_value: JSON.stringify({ studentName: order.studentName, totalAmount: order.totalAmount }),
        performed_by: user.id,
      });
    }

    await fetchOrders();
    return data;
  }, [fetchOrders, user]);

  const updateStatus = useCallback(async (id: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order?.status;

    await supabase.from('orders').update({ status: newStatus }).eq('id', id);

    // Audit log
    if (user) {
      await supabase.from('audit_log' as any).insert({
        entity_type: 'order',
        entity_id: id,
        action: 'status_change',
        field_name: 'status',
        old_value: oldStatus,
        new_value: newStatus,
        performed_by: user.id,
      });
    }

    await fetchOrders();
  }, [fetchOrders, user, orders]);

  const updateRepasse = useCallback(async (id: string, completed: boolean, amount: number) => {
    const updateData: any = {
      repasse_completed: completed,
      repasse_amount: amount,
      repasse_confirmed_by: user?.id,
    };
    if (completed) {
      updateData.repasse_date = new Date().toISOString();
    } else {
      updateData.repasse_date = null;
    }

    await supabase.from('orders').update(updateData).eq('id', id);

    if (user) {
      await supabase.from('audit_log' as any).insert({
        entity_type: 'order',
        entity_id: id,
        action: 'repasse_update',
        field_name: 'repasse_completed',
        old_value: String(!completed),
        new_value: String(completed),
        performed_by: user.id,
      });
    }

    await fetchOrders();
  }, [fetchOrders, user]);

  const deleteOrder = useCallback(async (id: string) => {
    const order = orders.find(o => o.id === id);
    
    if (user) {
      await supabase.from('audit_log' as any).insert({
        entity_type: 'order',
        entity_id: id,
        action: 'delete',
        old_value: JSON.stringify({ orderNumber: order?.orderNumber, studentName: order?.studentName }),
        performed_by: user.id,
      });
    }

    await supabase.from('orders').delete().eq('id', id);
    await fetchOrders();
  }, [fetchOrders, user, orders]);

  return { orders, loading, addOrder, updateStatus, updateRepasse, deleteOrder, refresh: fetchOrders };
}

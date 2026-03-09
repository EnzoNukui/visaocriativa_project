import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Search, Eye, DollarSign, TrendingUp, ArrowRightLeft, Upload, ChevronRight, ChevronDown, CheckCircle, RefreshCw } from 'lucide-react';
import ExchangeRequestModal from '@/components/ExchangeRequestModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import ImportOrdersDialog from '@/components/ImportOrdersDialog';
import type { Order } from '@/hooks/useOrders';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Produção',
  exchange_requested: 'Troca Solicitada',
  delivered: 'Entregue',
  paid: 'Pago',
  awaiting_payment: 'Aguardando Pagamento',
  ready: 'Pronto',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_production: 'bg-blue-100 text-blue-800',
  exchange_requested: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  awaiting_payment: 'bg-orange-100 text-orange-800',
  ready: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

const DELIVERY_DAYS = 20;

import { addBusinessDays } from '@/lib/business-days';

function getDeadlineStatus(createdAt: string) {
  const created = new Date(createdAt);
  const deadline = addBusinessDays(created, DELIVERY_DAYS);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: `Atrasado (${Math.abs(daysLeft)}d)`, color: 'text-red-600 bg-red-50', deadlineDate: deadline };
  if (daysLeft <= 3) return { label: `${daysLeft}d restantes`, color: 'text-orange-600 bg-orange-50', deadlineDate: deadline };
  return { label: `${daysLeft}d restantes`, color: 'text-green-600 bg-green-50', deadlineDate: deadline };
}

interface BatchMeta {
  id: string | null;
  batchNumber: string;
  importedAt: string | null;
  totalOrders: number;
  totalSaleAmount: number;
}

interface OrderWithBatch extends Order {
  importBatchId: string | null;
}

function mapOrderRow(o: any, items: any[]): OrderWithBatch {
  return {
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
    importBatchId: o.import_batch_id ?? null,
    items: items
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
  };
}

const Orders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.activeRole === 'admin';
  const isSupplier = user?.activeRole === 'supplier';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [batchRepasseConfirm, setBatchRepasseConfirm] = useState<{ id: string; number: string } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<{ id: string; number: string } | null>(null);
  const [batchStatusChange, setBatchStatusChange] = useState<{ id: string; number: string } | null>(null);
  const [batchStatusConfirm, setBatchStatusConfirm] = useState<{ id: string; number: string; status: string; count: number } | null>(null);
  const [exchangeModal, setExchangeModal] = useState<{ orderId: string; orderNumber: string; items: any[] } | null>(null);

  const [batches, setBatches] = useState<BatchMeta[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [manualTotal, setManualTotal] = useState(0);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [batchOrders, setBatchOrders] = useState<Record<string, OrderWithBatch[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [allOrdersForSearch, setAllOrdersForSearch] = useState<OrderWithBatch[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSearchActive = search.length > 0 || statusFilter !== 'all';

  const [financialSummary, setFinancialSummary] = useState({ totalSchool: 0, totalSupplier: 0, totalProfit: 0, pendingProfit: 0, settledProfit: 0 });

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const { data: batchData } = await supabase
        .from('import_batches')
        .select('id, batch_number, imported_at, total_orders, total_sale_amount')
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      const batchMetas: BatchMeta[] = (batchData || []).map(b => ({
        id: b.id,
        batchNumber: b.batch_number,
        importedAt: b.imported_at,
        totalOrders: b.total_orders,
        totalSaleAmount: Number(b.total_sale_amount),
      }));
      setBatches(batchMetas);

      const { count, data: manualAgg } = await supabase
        .from('orders')
        .select('total_amount', { count: 'exact' })
        .is('import_batch_id', null);

      setManualCount(count ?? 0);
      setManualTotal((manualAgg || []).reduce((s, o) => s + Number(o.total_amount), 0));

      if (batchMetas.length > 0) {
        setExpanded(new Set([batchMetas[0].id!]));
      }

      if (isSupplier) {
        const { data: allOrders } = await supabase
          .from('orders')
          .select('total_amount, supplier_total_amount, repasse_completed, status')
          .neq('status', 'cancelled');
        if (allOrders) {
          const totalSchool = allOrders.reduce((s, o) => s + Number(o.total_amount), 0);
          const totalSupplier = allOrders.reduce((s, o) => s + Number(o.supplier_total_amount), 0);
          const totalProfit = totalSchool - totalSupplier;
          const pendingProfit = allOrders.filter(o => !o.repasse_completed).reduce((s, o) => s + Number(o.total_amount) - Number(o.supplier_total_amount), 0);
          setFinancialSummary({ totalSchool, totalSupplier, totalProfit, pendingProfit, settledProfit: totalProfit - pendingProfit });
        }
      }
    } finally {
      setLoadingBatches(false);
    }
  }, [isSupplier]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const loadBatchOrders = useCallback(async (batchKey: string) => {
    if (batchOrders[batchKey]) return;
    setLoadingOrders(prev => ({ ...prev, [batchKey]: true }));
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (batchKey === '__manual__') {
        query = query.is('import_batch_id', null);
      } else {
        query = query.eq('import_batch_id', batchKey);
      }
      const { data: ordersData } = await query;
      if (!ordersData || ordersData.length === 0) {
        setBatchOrders(prev => ({ ...prev, [batchKey]: [] }));
        return;
      }
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase.from('order_items').select('*').in('order_id', orderIds);
      const mapped = ordersData.map(o => mapOrderRow(o, itemsData || []));
      setBatchOrders(prev => ({ ...prev, [batchKey]: mapped }));
    } finally {
      setLoadingOrders(prev => ({ ...prev, [batchKey]: false }));
    }
  }, [batchOrders]);

  useEffect(() => {
    expanded.forEach(key => {
      if (!batchOrders[key] && !loadingOrders[key]) {
        loadBatchOrders(key);
      }
    });
  }, [expanded, loadBatchOrders, batchOrders, loadingOrders]);

  useEffect(() => {
    if (!isSearchActive) {
      setAllOrdersForSearch(null);
      return;
    }
    let cancelled = false;
    const loadAll = async () => {
      setSearchLoading(true);
      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (cancelled || !ordersData) { setSearchLoading(false); return; }
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase.from('order_items').select('*').in('order_id', orderIds);
      if (cancelled) return;
      const mapped = ordersData.map(o => mapOrderRow(o, itemsData || []));
      setAllOrdersForSearch(mapped);
      setSearchLoading(false);
    };
    loadAll();
    return () => { cancelled = true; };
  }, [isSearchActive, search, statusFilter]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (status === 'exchange_requested') {
      // Find the order and its items to open the exchange modal
      const order = Object.values(batchOrders).flat().find(o => o?.id === id) || allOrdersForSearch?.find(o => o.id === id);
      if (order && order.items.length > 0) {
        setExchangeModal({ orderId: id, orderNumber: order.orderNumber, items: order.items });
        return;
      }
    }
    await supabase.from('orders').update({ status }).eq('id', id);
    invalidateCache();
    toast({ title: 'Status atualizado', description: `Pedido marcado como "${statusLabels[status] || status}"` });
  };

  const handleRepasseToggle = async (id: string, currentValue: boolean) => {
    if (!user) return;

    const payload = currentValue
      ? {
           repasse_completed: false,
           repasse_date: null,
           repasse_confirmed_by: null,
           status: 'awaiting_payment',
         }
      : {
           repasse_completed: true,
           repasse_date: new Date().toISOString(),
           repasse_confirmed_by: user.id,
           status: 'paid',
         };

    await supabase.from('orders').update(payload).eq('id', id);
    invalidateCache();
    toast({
      title: currentValue ? 'Repasse desmarcado. Status alterado para Aguardando Pagamento.' : 'Repasse confirmado e pedido marcado como Pago.',
    });
  };

  const handleDelete = async (id: string) => {
    // Find which batch this order belongs to
    let batchKey: string | null = null;
    for (const [key, orders] of Object.entries(batchOrders)) {
      if (orders?.some(o => o.id === id)) {
        batchKey = key;
        break;
      }
    }

    await supabase.from('order_items').delete().eq('order_id', id);
    await supabase.from('orders').delete().eq('id', id);

    // Remove order from local cache immediately
    if (batchKey) {
      setBatchOrders(prev => ({
        ...prev,
        [batchKey!]: (prev[batchKey!] || []).filter(o => o.id !== id),
      }));
    }

    // Recalculate batch totals from DB
    const actualBatchId = batchKey === '__manual__' ? null : batchKey;
    let query = supabase.from('orders').select('total_amount, supplier_total_amount').neq('status', 'cancelled');
    if (actualBatchId) {
      query = query.eq('import_batch_id', actualBatchId);
    } else {
      query = query.is('import_batch_id', null);
    }
    const { data: remaining } = await query;

    const newCount = remaining?.length ?? 0;
    const newTotal = remaining?.reduce((s, o) => s + Number(o.total_amount), 0) ?? 0;
    const newSupplier = remaining?.reduce((s, o) => s + Number(o.supplier_total_amount), 0) ?? 0;

    if (actualBatchId) {
      // Update import_batches in DB
      await supabase.from('import_batches').update({
        total_orders: newCount,
        total_sale_amount: newTotal,
        total_supplier_amount: newSupplier,
        total_profit: newTotal - newSupplier,
      }).eq('id', actualBatchId);

      // Update local batch state
      setBatches(prev => prev.map(b =>
        b.id === actualBatchId
          ? { ...b, totalOrders: newCount, totalSaleAmount: newTotal }
          : b
      ));
    } else {
      setManualCount(newCount);
      setManualTotal(newTotal);
    }

    // Clear search cache
    setAllOrdersForSearch(null);

    toast({ title: 'Pedido excluído', description: 'Pedido excluído. Totais do lote atualizados.' });
  };

  const invalidateCache = () => {
    setBatchOrders({});
    setAllOrdersForSearch(null);
    fetchBatches();
  };

  const handleBatchRepasse = async (batchId: string, batchNumber: string) => {
    if (!user) return;
    try {
      // Mark orders as paid
      await supabase.from('orders').update({
        repasse_completed: true,
        repasse_date: new Date().toISOString(),
        repasse_confirmed_by: user.id,
        status: 'paid',
      }).eq('import_batch_id', batchId).neq('status', 'cancelled');

      // Resolve pending adjustments for this batch's orders
      const { data: batchOrderIds } = await supabase
        .from('orders')
        .select('id')
        .eq('import_batch_id', batchId);

      if (batchOrderIds && batchOrderIds.length > 0) {
        const orderIds = batchOrderIds.map(o => o.id);
        await supabase
          .from('order_adjustments')
          .update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() })
          .in('order_id', orderIds)
          .eq('status', 'pending');
      }

      invalidateCache();
      toast({ title: 'Repasse confirmado', description: `Repasse confirmado para todos os pedidos do lote ${batchNumber}.` });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao confirmar repasse. Tente novamente.', variant: 'destructive' });
    }
  };

  const handleBatchStatusChange = async (batchId: string, batchNumber: string, newStatus: string) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('import_batch_id', batchId);
      // Update local state immediately
      setBatchOrders(prev => ({
        ...prev,
        [batchId]: (prev[batchId] || []).map(o => ({ ...o, status: newStatus })),
      }));
      setAllOrdersForSearch(null);
      fetchBatches();
      const count = (batchOrders[batchId] || []).length;
      toast({ title: 'Status atualizado', description: `Status de ${count} pedidos alterado para "${statusLabels[newStatus] || newStatus}" com sucesso.` });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao alterar status. Tente novamente.', variant: 'destructive' });
    }
  };

  const handleBatchDelete = async (batchId: string, batchNumber: string) => {
    try {
      const { data: batchOrdersData } = await supabase.from('orders').select('id').eq('import_batch_id', batchId);
      const orderIds = (batchOrdersData || []).map(o => o.id);
      if (orderIds.length > 0) {
        const { error: itemsErr } = await supabase.from('order_items').delete().in('order_id', orderIds);
        if (itemsErr) throw itemsErr;
        const { error: ordersErr } = await supabase.from('orders').delete().eq('import_batch_id', batchId);
        if (ordersErr) throw ordersErr;
      }
      const { error: batchErr } = await supabase.from('import_batches').delete().eq('id', batchId);
      if (batchErr) throw batchErr;

      setBatches(prev => prev.filter(b => b.id !== batchId));
      setBatchOrders(prev => { const n = { ...prev }; delete n[batchId]; return n; });
      setAllOrdersForSearch(null);
      toast({ title: 'Lote excluído', description: `Lote ${batchNumber} excluído com sucesso.` });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir o lote. Tente novamente.', variant: 'destructive' });
    }
  };

  const filterOrders = <T extends Order>(orders: T[]): T[] => {
    return orders.filter(o => {
      const matchSearch = search.length === 0 || o.studentName.toLowerCase().includes(search.toLowerCase()) || o.orderNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  };

  const totalBatchCount = batches.length + (manualCount > 0 ? 1 : 0);

  const renderOrderTable = (orders: Order[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground bg-muted/50">
            <th className="p-3">Nº</th>
            <th className="p-3">Aluno</th>
            <th className="p-3">Turma</th>
            <th className="p-3">Total</th>
            <th className="p-3">Status</th>
            <th className="p-3">Prazo</th>
            <th className="p-3">Data</th>
            <th className="p-3">Repasse</th>
            <th className="p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const deadline = getDeadlineStatus(order.createdAt);
            return (
              <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{order.orderNumber}</td>
                <td className="p-3">{order.studentName}</td>
                <td className="p-3">{order.grade}</td>
                <td className="p-3">R$ {order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-3">
                  {isAdmin ? (
                    <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
                        <SelectItem value="in_production">Em Produção</SelectItem>
                        <SelectItem value="exchange_requested">Troca Solicitada</SelectItem>
                        <SelectItem value="ready">Pronto</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {order.status !== 'delivered' ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${deadline.color}`}>{deadline.label}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Entregue</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="p-3">
                  {isAdmin ? (
                    <label className="flex items-center gap-1 cursor-pointer" title={order.repasseCompleted ? 'Repasse confirmado' : 'Marcar repasse'}>
                      <Checkbox
                        checked={order.repasseCompleted}
                        onCheckedChange={() => handleRepasseToggle(order.id, order.repasseCompleted)}
                      />
                      <span className="text-[10px] text-muted-foreground">Repasse</span>
                    </label>
                  ) : (
                    order.repasseCompleted ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Repassado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedOrder(order)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ id: order.id, name: order.studentName })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loadingBatches) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-4">
      {isSupplier && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Total Vendido (Escola)</p><p className="text-lg font-bold">R$ {financialSummary.totalSchool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-700" /></div>
              <div><p className="text-xs text-muted-foreground">Custo Fornecedor</p><p className="text-lg font-bold">R$ {financialSummary.totalSupplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-700" /></div>
              <div><p className="text-xs text-muted-foreground">Diferença (Lucro)</p><p className="text-lg font-bold text-green-600">R$ {financialSummary.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card className="border-yellow-300 bg-yellow-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-yellow-700" /></div>
              <div><p className="text-xs text-muted-foreground font-medium">Pendente Repasse</p><p className="text-lg font-bold text-yellow-700">R$ {financialSummary.pendingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card className="border-green-300 bg-green-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-700" /></div>
              <div><p className="text-xs text-muted-foreground font-medium">Lucro Repassado</p><p className="text-lg font-bold text-green-600">R$ {financialSummary.settledProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            {totalBatchCount} lote(s) · {batches.reduce((s, b) => s + b.totalOrders, 0) + manualCount} pedido(s)
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />Importar Planilha
            </Button>
            <Button asChild><Link to="/orders/new"><PlusCircle className="w-4 h-4 mr-2" />Novo Pedido</Link></Button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por aluno ou nº do pedido..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
            <SelectItem value="in_production">Em Produção</SelectItem>
            <SelectItem value="exchange_requested">Troca Solicitada</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isSearchActive ? (
        <SearchGroupedView
          allOrders={allOrdersForSearch}
          loading={searchLoading}
          batches={batches}
          filterOrders={filterOrders}
          renderOrderTable={renderOrderTable}
        />
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <BatchCard
              key={batch.id!}
              batchKey={batch.id!}
              batchNumber={batch.batchNumber}
              importedAt={batch.importedAt}
              totalOrders={batch.totalOrders}
              totalSaleAmount={batch.totalSaleAmount}
              isExpanded={expanded.has(batch.id!)}
              onToggle={() => toggleExpand(batch.id!)}
              orders={batchOrders[batch.id!]}
              loading={!!loadingOrders[batch.id!]}
              renderOrderTable={renderOrderTable}
              isAdmin={isAdmin}
              onBatchRepasse={() => setBatchRepasseConfirm({ id: batch.id!, number: batch.batchNumber })}
              onBatchStatusChange={() => setBatchStatusChange({ id: batch.id!, number: batch.batchNumber })}
              onBatchDelete={() => setBatchDeleteConfirm({ id: batch.id!, number: batch.batchNumber })}
            />
          ))}
          {manualCount > 0 && (
            <BatchCard
              batchKey="__manual__"
              batchNumber="Sem Lote"
              importedAt={null}
              totalOrders={manualCount}
              totalSaleAmount={manualTotal}
              isExpanded={expanded.has('__manual__')}
              onToggle={() => toggleExpand('__manual__')}
              orders={batchOrders['__manual__']}
              loading={!!loadingOrders['__manual__']}
              renderOrderTable={renderOrderTable}
              isManual
            />
          )}
          {batches.length === 0 && manualCount === 0 && (
            <p className="text-muted-foreground text-sm py-12 text-center">Nenhum pedido encontrado.</p>
          )}
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Aluno:</span><br />{selectedOrder.studentName}</div>
                <div><span className="text-muted-foreground">Turma:</span><br />{selectedOrder.grade}</div>
                {selectedOrder.responsibleName && <div><span className="text-muted-foreground">Responsável:</span><br />{selectedOrder.responsibleName}</div>}
                {selectedOrder.phone && <div><span className="text-muted-foreground">Telefone:</span><br />{selectedOrder.phone}</div>}
                <div><span className="text-muted-foreground">Data do Pedido:</span><br />{new Date(selectedOrder.createdAt).toLocaleDateString('pt-BR')}</div>
                <div>
                  <span className="text-muted-foreground">Prazo de Entrega:</span><br />
                  {addBusinessDays(new Date(selectedOrder.createdAt), DELIVERY_DAYS).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Itens do Pedido</p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="text-left pb-1">Produto</th><th className="text-left pb-1">Tam.</th><th className="text-right pb-1">Qtd.</th><th className="text-right pb-1">Unit.</th><th className="text-right pb-1">Subtotal</th></tr></thead>
                  <tbody>
                    {selectedOrder.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5">{item.productName}</td>
                        <td className="py-1.5">{item.size}</td>
                        <td className="py-1.5 text-right">{item.quantity}</td>
                        <td className="py-1.5 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                        <td className="py-1.5 text-right font-medium">R$ {item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center pt-2 border-t font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">R$ {selectedOrder.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido de <strong>{deleteConfirm?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  handleDelete(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!batchRepasseConfirm} onOpenChange={(open) => !open && setBatchRepasseConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar repasse do lote</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar repasse para todos os pedidos do lote <strong>{batchRepasseConfirm?.number}</strong>? Todos os pedidos serão marcados como Pagos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (batchRepasseConfirm) { handleBatchRepasse(batchRepasseConfirm.id, batchRepasseConfirm.number); setBatchRepasseConfirm(null); } }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Status Change - select status */}
      <Dialog open={!!batchStatusChange} onOpenChange={(open) => !open && setBatchStatusChange(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Alterar status do lote</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Alterar status de todos os pedidos do lote <strong>{batchStatusChange?.number}</strong> para:</p>
          <div className="flex flex-col gap-2">
            {['awaiting_payment', 'in_production', 'exchange_requested', 'ready', 'delivered', 'paid', 'cancelled'].map(s => (
              <Button key={s} variant="outline" className="justify-start" onClick={() => {
                if (batchStatusChange) {
                  const count = (batchOrders[batchStatusChange.id] || []).length;
                  setBatchStatusConfirm({ id: batchStatusChange.id, number: batchStatusChange.number, status: s, count });
                  setBatchStatusChange(null);
                }
              }}>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${statusColors[s] || ''}`}>{statusLabels[s]}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Status Change - confirm */}
      <AlertDialog open={!!batchStatusConfirm} onOpenChange={(open) => !open && setBatchStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription>
              Alterar todos os pedidos do lote <strong>{batchStatusConfirm?.number}</strong> para <strong>{statusLabels[batchStatusConfirm?.status || ''] || batchStatusConfirm?.status}</strong>? Esta ação afetará {batchStatusConfirm?.count} pedidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (batchStatusConfirm) { handleBatchStatusChange(batchStatusConfirm.id, batchStatusConfirm.number, batchStatusConfirm.status); setBatchStatusConfirm(null); } }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!batchDeleteConfirm} onOpenChange={(open) => !open && setBatchDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lote <strong>{batchDeleteConfirm?.number}</strong> e todos os seus pedidos? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (batchDeleteConfirm) { handleBatchDelete(batchDeleteConfirm.id, batchDeleteConfirm.number); setBatchDeleteConfirm(null); } }}>
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && (
        <ImportOrdersDialog open={importOpen} onOpenChange={setImportOpen} onComplete={invalidateCache} />
      )}

      {exchangeModal && (
        <ExchangeRequestModal
          open={!!exchangeModal}
          onOpenChange={(open) => { if (!open) setExchangeModal(null); }}
          orderId={exchangeModal.orderId}
          orderNumber={exchangeModal.orderNumber}
          items={exchangeModal.items}
          userId={user?.id || ''}
          onComplete={invalidateCache}
        />
      )}
    </div>
  );
};

interface BatchCardProps {
  batchKey: string;
  batchNumber: string;
  importedAt: string | null;
  totalOrders: number;
  totalSaleAmount: number;
  isExpanded: boolean;
  onToggle: () => void;
  orders: Order[] | undefined;
  loading: boolean;
  renderOrderTable: (orders: Order[]) => JSX.Element;
  isManual?: boolean;
  isAdmin?: boolean;
  onBatchRepasse?: () => void;
  onBatchStatusChange?: () => void;
  onBatchDelete?: () => void;
}

function BatchCard({ batchKey, batchNumber, importedAt, totalOrders, totalSaleAmount, isExpanded, onToggle, orders, loading, renderOrderTable, isManual, isAdmin, onBatchRepasse, onBatchStatusChange, onBatchDelete }: BatchCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
        <button className="flex items-center gap-3 flex-1 text-left" onClick={onToggle}>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
          <span className="font-bold text-sm">{batchNumber}</span>
          {importedAt && (
            <span className="text-xs text-muted-foreground">{new Date(importedAt).toLocaleDateString('pt-BR')}</span>
          )}
          {isManual && (
            <span className="text-xs text-muted-foreground">Pedidos criados manualmente</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{totalOrders} pedido(s)</span>
          <span className="text-xs font-medium">R$ {totalSaleAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </button>
        {isAdmin && !isManual && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onBatchRepasse?.(); }}>
              <CheckCircle className="w-3.5 h-3.5" />
              Confirmar Repasse
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onBatchStatusChange?.(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
              Alterar Status
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onBatchDelete?.(); }}>
              <Trash2 className="w-3.5 h-3.5" />
              Excluir Lote
            </Button>
          </div>
        )}
      </div>
      {isExpanded && (
        <CardContent className="p-0 border-t">
          {isAdmin && !isManual && (
            <div className="flex justify-end p-3 pb-0">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                <Link to={`/orders/new?batchId=${batchKey}`}>
                  <PlusCircle className="w-3.5 h-3.5" />
                  Adicionar Pedido ao Lote
                </Link>
              </Button>
            </div>
          )}
          {loading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : orders && orders.length > 0 ? (
            renderOrderTable(orders)
          ) : (
            <p className="text-muted-foreground text-sm py-6 text-center">Nenhum pedido neste lote.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface SearchGroupedViewProps {
  allOrders: OrderWithBatch[] | null;
  loading: boolean;
  batches: BatchMeta[];
  filterOrders: (orders: OrderWithBatch[]) => OrderWithBatch[];
  renderOrderTable: (orders: OrderWithBatch[]) => JSX.Element;
}

function SearchGroupedView({ allOrders, loading, batches, filterOrders, renderOrderTable }: SearchGroupedViewProps) {
  if (loading || !allOrders) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const filtered = filterOrders(allOrders);

  if (filtered.length === 0) {
    return <p className="text-muted-foreground text-sm py-12 text-center">Nenhum pedido encontrado para este filtro.</p>;
  }

  // Group by batch
  const grouped: Record<string, OrderWithBatch[]> = {};
  filtered.forEach(o => {
    const key = o.importBatchId ?? '__manual__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  });

  // Build ordered groups: batches first (by imported_at desc), then manual
  const batchMap = new Map(batches.map(b => [b.id!, b]));
  const batchKeys = batches.map(b => b.id!).filter(id => grouped[id]);
  const hasManual = !!grouped['__manual__'];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{filtered.length} resultado(s) encontrado(s)</p>
      {batchKeys.map(batchId => {
        const batch = batchMap.get(batchId)!;
        return (
          <Card key={batchId}>
            <div className="p-3 border-b bg-muted/30 flex items-center gap-3 text-sm">
              <span className="font-bold">{batch.batchNumber}</span>
              {batch.importedAt && <span className="text-xs text-muted-foreground">{new Date(batch.importedAt).toLocaleDateString('pt-BR')}</span>}
              <span className="text-xs text-muted-foreground ml-auto">{grouped[batchId].length} resultado(s)</span>
            </div>
            <CardContent className="p-0">
              {renderOrderTable(grouped[batchId])}
            </CardContent>
          </Card>
        );
      })}
      {hasManual && (
        <Card>
          <div className="p-3 border-b bg-muted/30 flex items-center gap-3 text-sm">
            <span className="font-bold">Sem Lote</span>
            <span className="text-xs text-muted-foreground">Pedidos criados manualmente</span>
            <span className="text-xs text-muted-foreground ml-auto">{grouped['__manual__'].length} resultado(s)</span>
          </div>
          <CardContent className="p-0">
            {renderOrderTable(grouped['__manual__'])}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Orders;

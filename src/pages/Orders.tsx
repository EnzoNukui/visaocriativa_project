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
import { PlusCircle, Trash2, Search, Eye, DollarSign, TrendingUp, ArrowRightLeft, Upload, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import ImportOrdersDialog from '@/components/ImportOrdersDialog';
import type { Order } from '@/hooks/useOrders';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Produção',
  delivered: 'Entregue',
  paid: 'Pago',
  awaiting_payment: 'Aguardando Pagamento',
  ready: 'Pronto',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_production: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  awaiting_payment: 'bg-orange-100 text-orange-800',
  ready: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

const DELIVERY_DAYS = 20;

function getDeadlineStatus(createdAt: string) {
  const created = new Date(createdAt);
  const deadline = new Date(created);
  deadline.setDate(deadline.getDate() + DELIVERY_DAYS);
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

function mapOrderRow(o: any, items: any[]): Order {
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

  const [batches, setBatches] = useState<BatchMeta[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [manualTotal, setManualTotal] = useState(0);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [batchOrders, setBatchOrders] = useState<Record<string, Order[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [allOrdersForSearch, setAllOrdersForSearch] = useState<Order[] | null>(null);
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
    await supabase.from('orders').update({ status }).eq('id', id);
    invalidateCache();
    toast({ title: 'Status atualizado', description: `Pedido marcado como "${statusLabels[status] || status}"` });
  };

  const handleRepasseToggle = async (id: string, currentValue: boolean) => {
    if (!user) return;
    await supabase.from('orders').update({
      repasse_completed: !currentValue,
      repasse_date: !currentValue ? new Date().toISOString() : null,
      repasse_confirmed_by: !currentValue ? user.id : null,
    }).eq('id', id);
    invalidateCache();
    toast({ title: !currentValue ? 'Repasse confirmado' : 'Repasse desfeito' });
  };

  const handleDelete = async (id: string) => {
    await supabase.from('order_items').delete().eq('order_id', id);
    await supabase.from('orders').delete().eq('id', id);
    invalidateCache();
    toast({ title: 'Pedido excluído', description: 'O pedido foi removido com sucesso.' });
  };

  const invalidateCache = () => {
    setBatchOrders({});
    setAllOrdersForSearch(null);
    fetchBatches();
  };

  const filterOrders = (orders: Order[]) => {
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
            <th className="p-3 hidden md:table-cell">Turma</th>
            <th className="p-3">Total</th>
            <th className="p-3">Status</th>
            <th className="p-3 hidden md:table-cell">Prazo</th>
            <th className="p-3 hidden md:table-cell">Data</th>
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
                <td className="p-3 hidden md:table-cell">{order.grade}</td>
                <td className="p-3">R$ {order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-3">
                  {isAdmin ? (
                    <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="in_production">Em Produção</SelectItem>
                        <SelectItem value="ready">Pronto</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell">
                  {order.status !== 'delivered' ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${deadline.color}`}>{deadline.label}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Entregue</span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    {isAdmin ? (
                      <label className="flex items-center gap-1 cursor-pointer" title={order.repasseCompleted ? 'Repasse confirmado' : 'Marcar repasse'}>
                        <Checkbox
                          checked={order.repasseCompleted}
                          onCheckedChange={() => handleRepasseToggle(order.id, order.repasseCompleted)}
                        />
                        <span className="text-[10px] text-muted-foreground">Repasse</span>
                      </label>
                    ) : (
                      order.repasseCompleted && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Repassado</span>
                      )
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedOrder(order)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(order.id)}>
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
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_production">Em Produção</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isSearchActive ? (
        <SearchGroupedView
          allOrders={allOrdersForSearch}
          loading={searchLoading}
          batches={batches}
          manualCount={manualCount}
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
                  {(() => { const d = new Date(selectedOrder.createdAt); d.setDate(d.getDate() + DELIVERY_DAYS); return d.toLocaleDateString('pt-BR'); })()}
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

      {isAdmin && (
        <ImportOrdersDialog open={importOpen} onOpenChange={setImportOpen} onComplete={invalidateCache} />
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
}

function BatchCard({ batchKey, batchNumber, importedAt, totalOrders, totalSaleAmount, isExpanded, onToggle, orders, loading, renderOrderTable, isManual }: BatchCardProps) {
  return (
    <Card>
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
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
      {isExpanded && (
        <CardContent className="p-0 border-t">
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
  allOrders: Order[] | null;
  loading: boolean;
  batches: BatchMeta[];
  manualCount: number;
  filterOrders: (orders: Order[]) => Order[];
  renderOrderTable: (orders: Order[]) => JSX.Element;
}

function SearchGroupedView({ allOrders, loading, batches, manualCount, filterOrders, renderOrderTable }: SearchGroupedViewProps) {
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

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">{filtered.length} resultado(s) encontrado(s)</span>
        </div>
        {renderOrderTable(filtered)}
      </CardContent>
    </Card>
  );
}

export default Orders;

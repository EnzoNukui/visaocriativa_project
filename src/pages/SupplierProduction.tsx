import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RefreshCw as RefreshCwIcon, Calendar, Eye } from 'lucide-react';
import { addBusinessDays } from '@/lib/business-days';
import SupplierComplementarWarning from '@/components/SupplierComplementarWarning';
import OrderDetailModal from '@/components/OrderDetailModal';
import type { Order } from '@/hooks/useOrders';

// Size ordering
const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', '16', 'PP', 'P', 'M', 'G', 'GG', 'EG', 'XG'];

function sortBySize(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  const sa = ia === -1 ? 999 : ia;
  const sb = ib === -1 ? 999 : ib;
  return sa - sb;
}

interface AggItem {
  product_name: string;
  product_id: string;
  size: string;
  total_quantity: number;
}

interface DeliveryCount {
  total: number;
  delivered: number;
}

interface OrderStatus {
  id: string;
  status: string;
}

interface BatchInfo {
  id: string;
  imported_at: string;
  total_rows: number;
  batch_number: string;
}

function groupByProduct(items: AggItem[]) {
  const map = new Map<string, AggItem[]>();
  items.forEach(item => {
    const key = item.product_id || item.product_name;
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  });
  map.forEach((items) => items.sort((a, b) => sortBySize(a.size, b.size)));
  return Array.from(map.values());
}

function DeliveryBadge({ delivery }: { delivery?: DeliveryCount }) {
  if (!delivery || delivery.delivered === 0) return null;

  if (delivery.delivered >= delivery.total) {
    return (
      <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100">
        ✅ Todos Entregues
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
      📦 {delivery.delivered} de {delivery.total} Entregues
    </Badge>
  );
}

function ProductionTable({ items, orderStatuses }: { items: AggItem[]; orderStatuses?: OrderStatus[] }) {
  const groups = groupByProduct(items);
  const totalPieces = items.reduce((s, i) => s + i.total_quantity, 0);
  const distinctProducts = groups.length;

  // Show per-order delivery badges if we have status info
  const deliveredOrders = orderStatuses?.filter(o => o.status === 'delivered') || [];

  return (
    <div className="space-y-4">
      {deliveredOrders.length > 0 && orderStatuses && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Status de entrega:</span>
          {deliveredOrders.length >= orderStatuses.length ? (
            <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100">
              ✅ Todos os {orderStatuses.length} pedidos entregues
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
              📦 {deliveredOrders.length} de {orderStatuses.length} pedidos entregues
            </Badge>
          )}
        </div>
      )}
      {groups.map((group, idx) => (
        <div key={idx}>
          <h4 className="font-semibold text-sm text-foreground mb-1">
            Produto: {group[0].product_name}
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tamanho</TableHead>
                <TableHead>Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.size}</TableCell>
                  <TableCell className="font-medium">{item.total_quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      <div className="pt-2 border-t text-sm text-muted-foreground space-y-1">
        <p>Total de peças: <span className="font-semibold text-foreground">{totalPieces} unidades</span></p>
        <p>Produtos distintos: <span className="font-semibold text-foreground">{distinctProducts}</span></p>
      </div>
    </div>
  );
}

// --- Tab 1: Por Lote ---
function BatchTab() {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<Record<string, AggItem[]>>({});
  const [batchOrderStatuses, setBatchOrderStatuses] = useState<Record<string, OrderStatus[]>>({});
  const [batchFullOrders, setBatchFullOrders] = useState<Record<string, Order[]>>({});
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, DeliveryCount>>({});
  const [batchExchangeRequests, setBatchExchangeRequests] = useState<Record<string, any[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('import_batches')
      .select('id, imported_at, total_orders, batch_number')
      .eq('status', 'active')
      .order('imported_at', { ascending: false });

    if (data) {
      setBatches(data.map(b => ({
        id: b.id,
        imported_at: b.imported_at,
        total_rows: b.total_orders,
        batch_number: b.batch_number,
      })));

      // Fetch delivery counts for all batches
      const batchIds = data.map(b => b.id);
      if (batchIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('import_batch_id, status')
          .in('import_batch_id', batchIds)
          .neq('status', 'cancelled');

        if (orders) {
          const counts: Record<string, DeliveryCount> = {};
          orders.forEach(o => {
            const bid = o.import_batch_id!;
            if (!counts[bid]) counts[bid] = { total: 0, delivered: 0 };
            counts[bid].total++;
            if (o.status === 'delivered') counts[bid].delivered++;
          });
          setDeliveryCounts(counts);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const toggleBatch = useCallback(async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);

    if (batchItems[batchId]) return;

    setBatchLoading(batchId);
    
    // Fetch orders with full details
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, student_name, grade, responsible_name, phone, status, created_at, created_by, total_amount, supplier_total_amount, school_profit, repasse_completed, repasse_date, repasse_confirmed_by, repasse_amount')
      .eq('import_batch_id', batchId)
      .neq('status', 'cancelled');

    if (!orders || orders.length === 0) {
      setBatchItems(prev => ({ ...prev, [batchId]: [] }));
      setBatchOrderStatuses(prev => ({ ...prev, [batchId]: [] }));
      setBatchFullOrders(prev => ({ ...prev, [batchId]: [] }));
      setBatchExchangeRequests(prev => ({ ...prev, [batchId]: [] }));
      setBatchLoading(null);
      return;
    }

    setBatchOrderStatuses(prev => ({ ...prev, [batchId]: orders.map(o => ({ id: o.id, status: o.status })) }));

    // Fetch exchange requests for this batch
    const { data: exchangeOrders } = await supabase
      .from('orders')
      .select(`
        id, student_name,
        order_adjustments!inner(id, product_name, old_size, new_size, quantity, created_at)
      `)
      .eq('import_batch_id', batchId)
      .eq('status', 'exchange_requested');

    const batch = batches.find(b => b.id === batchId);
    const exchanges = (exchangeOrders || []).flatMap(order => 
      order.order_adjustments.map(adj => ({
        orderId: order.id,
        studentName: order.student_name,
        batchNumber: batch?.batch_number || '',
        productName: adj.product_name,
        oldSize: adj.old_size,
        newSize: adj.new_size,
        quantity: adj.quantity,
        createdAt: adj.created_at,
      }))
    );
    
    setBatchExchangeRequests(prev => ({ ...prev, [batchId]: exchanges }));

    // Fetch production items (with full details for order modal)
    const orderIds = orders.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, size, quantity, unit_price, supplier_price, total, supplier_total')
      .in('order_id', orderIds);

    const allItems = items || [];

    // Build full Order objects for modal
    const fullOrders: Order[] = orders.map(o => ({
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
      items: allItems
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
    setBatchFullOrders(prev => ({ ...prev, [batchId]: fullOrders }));

    // Aggregate for production table
    const aggMap = new Map<string, AggItem>();
    allItems.forEach(i => {
      const key = `${i.product_id}||${i.size}`;
      const existing = aggMap.get(key);
      if (existing) {
        existing.total_quantity += i.quantity;
      } else {
        aggMap.set(key, {
          product_id: i.product_id,
          product_name: i.product_name,
          size: i.size,
          total_quantity: i.quantity,
        });
      }
    });

    setBatchItems(prev => ({ ...prev, [batchId]: Array.from(aggMap.values()) }));
    setBatchLoading(null);
  }, [expandedBatch, batchItems, batches]);

  const handleRefresh = useCallback(async () => {
    setBatchItems({});
    setBatchOrderStatuses({});
    setBatchFullOrders({});
    setBatchExchangeRequests({});
    setExpandedBatch(null);
    await fetchBatches();
  }, [fetchBatches]);

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (batches.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum lote disponível no momento.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCwIcon className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>
      {batches.map(batch => {
        const isOpen = expandedBatch === batch.id;
        const items = batchItems[batch.id];
        const statuses = batchOrderStatuses[batch.id];
        const isLoadingBatch = batchLoading === batch.id;
        const delivery = deliveryCounts[batch.id];
        const exchanges = batchExchangeRequests[batch.id] || [];

        return (
          <Collapsible key={batch.id} open={isOpen}>
            <Card>
              <CardContent className="p-4">
                <CollapsibleTrigger asChild>
                  <button
                    onClick={() => toggleBatch(batch.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{batch.batch_number}</p>
                            <DeliveryBadge delivery={delivery} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(batch.imported_at).toLocaleDateString('pt-BR')} · {batch.total_rows} pedidos
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            📅 Entrega prevista: {addBusinessDays(new Date(batch.imported_at), 20).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    <span className="text-xs text-primary font-medium">
                      {isOpen ? 'Fechar' : 'Ver Produção'}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Trocas Pendentes Section */}
                    {exchanges.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2">
                          ⚠️ Trocas Pendentes
                        </h3>
                        <div className="space-y-2">
                          {exchanges.map((exchange, idx) => (
                            <div key={idx} className="bg-white border border-amber-100 rounded-lg p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 space-y-1">
                                  <p><span className="font-medium">Aluno:</span> {exchange.studentName}</p>
                                  <p><span className="font-medium">Lote:</span> {exchange.batchNumber}</p>
                                  <p><span className="font-medium">Produto:</span> {exchange.productName}</p>
                                  <p><span className="font-medium">Alteração:</span> Tamanho {exchange.oldSize} → {exchange.newSize}</p>
                                  <p><span className="font-medium">Quantidade:</span> {exchange.quantity}</p>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-semibold animate-pulse">
                                  <RefreshCwIcon className="w-3 h-3" />
                                  Troca Solicitada
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isLoadingBatch ? (
                      <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
                    ) : items && items.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">Nenhum item encontrado para este lote.</p>
                    ) : items ? (
                      <ProductionTable items={items} orderStatuses={statuses} />
                    ) : null}
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// --- Tab 2: Todos os Pedidos ---
function AllOrdersTab() {
  const [items, setItems] = useState<AggItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRequests, setExchangeRequests] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    
    // Fetch exchange requests for all orders
    const { data: exchangeOrders } = await supabase
      .from('orders')
      .select(`
        id, student_name, import_batch_id,
        order_adjustments!inner(id, product_name, old_size, new_size, quantity, created_at),
        import_batches(batch_number)
      `)
      .eq('status', 'exchange_requested');

    const exchanges = (exchangeOrders || []).flatMap(order => 
      order.order_adjustments.map(adj => ({
        orderId: order.id,
        studentName: order.student_name,
        batchNumber: (order as any).import_batches?.batch_number || 'N/A',
        productName: adj.product_name,
        oldSize: adj.old_size,
        newSize: adj.new_size,
        quantity: adj.quantity,
        createdAt: adj.created_at,
      }))
    );
    
    setExchangeRequests(exchanges);

    // Fetch regular orders for production items
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .neq('status', 'cancelled');

    if (!orders || orders.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map(o => o.id);
    let allOrderItems: any[] = [];
    for (let i = 0; i < orderIds.length; i += 500) {
      const chunk = orderIds.slice(i, i + 500);
      const { data } = await supabase
        .from('order_items')
        .select('product_id, product_name, size, quantity')
        .in('order_id', chunk);
      if (data) allOrderItems = allOrderItems.concat(data);
    }

    const aggMap = new Map<string, AggItem>();
    allOrderItems.forEach(i => {
      const key = `${i.product_id}||${i.size}`;
      const existing = aggMap.get(key);
      if (existing) {
        existing.total_quantity += i.quantity;
      } else {
        aggMap.set(key, {
          product_id: i.product_id,
          product_name: i.product_name,
          size: i.size,
          total_quantity: i.quantity,
        });
      }
    });

    setItems(Array.from(aggMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCwIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
      
      {/* Trocas Pendentes Section */}
      {!loading && exchangeRequests.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h3 className="font-bold text-amber-800 flex items-center gap-2">
            ⚠️ Trocas Pendentes
          </h3>
          <div className="space-y-2">
            {exchangeRequests.map((exchange, idx) => (
              <div key={idx} className="bg-white border border-amber-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <p><span className="font-medium">Aluno:</span> {exchange.studentName}</p>
                    <p><span className="font-medium">Lote:</span> {exchange.batchNumber}</p>
                    <p><span className="font-medium">Produto:</span> {exchange.productName}</p>
                    <p><span className="font-medium">Alteração:</span> Tamanho {exchange.oldSize} → {exchange.newSize}</p>
                    <p><span className="font-medium">Quantidade:</span> {exchange.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-semibold animate-pulse">
                    <RefreshCwIcon className="w-3 h-3" />
                    Troca Solicitada
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum item encontrado.</p>
      ) : (
        <ProductionTable items={items} />
      )}
    </div>
  );
}

// --- Main Page ---
export default function SupplierProduction() {
  return (
    <div className="space-y-6">
      <SupplierComplementarWarning />
      <div>
        <h2 className="text-2xl font-bold text-foreground">Lista de Pedidos</h2>
        <p className="text-muted-foreground">Itens consolidados para produção</p>
      </div>

      <Tabs defaultValue="batch">
        <TabsList>
          <TabsTrigger value="batch">Por Lote</TabsTrigger>
          <TabsTrigger value="all">Todos os Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="batch">
          <BatchTab />
        </TabsContent>

        <TabsContent value="all">
          <AllOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

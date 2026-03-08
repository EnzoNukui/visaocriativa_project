import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

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
  // Sort sizes within each product
  map.forEach((items) => items.sort((a, b) => sortBySize(a.size, b.size)));
  return Array.from(map.values());
}

function ProductionTable({ items }: { items: AggItem[] }) {
  const groups = groupByProduct(items);
  const totalPieces = items.reduce((s, i) => s + i.total_quantity, 0);
  const distinctProducts = groups.length;

  return (
    <div className="space-y-4">
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
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
      }
      setLoading(false);
    })();
  }, []);

  const toggleBatch = useCallback(async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);

    if (batchItems[batchId]) return; // already loaded

    setBatchLoading(batchId);
    // Fetch aggregated items for this batch
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('import_batch_id', batchId)
      .neq('status', 'cancelled');

    if (!orders || orders.length === 0) {
      setBatchItems(prev => ({ ...prev, [batchId]: [] }));
      setBatchLoading(null);
      return;
    }

    const orderIds = orders.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, size, quantity')
      .in('order_id', orderIds);

    // Aggregate in frontend
    const aggMap = new Map<string, AggItem>();
    (items || []).forEach(i => {
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
  }, [expandedBatch, batchItems]);

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (batches.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum lote disponível no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map(batch => {
        const isOpen = expandedBatch === batch.id;
        const items = batchItems[batch.id];
        const isLoadingBatch = batchLoading === batch.id;

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
                        <p className="font-bold text-sm">{batch.batch_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(batch.imported_at).toLocaleDateString('pt-BR')} · {batch.total_rows} pedidos
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary font-medium">
                      {isOpen ? 'Fechar' : 'Ver Produção'}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t">
                    {isLoadingBatch ? (
                      <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
                    ) : items && items.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">Nenhum item encontrado para este lote.</p>
                    ) : items ? (
                      <ProductionTable items={items} />
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // Get non-cancelled orders
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
    // Fetch in chunks if needed (limit 1000)
    let allOrderItems: any[] = [];
    for (let i = 0; i < orderIds.length; i += 500) {
      const chunk = orderIds.slice(i, i + 500);
      const { data } = await supabase
        .from('order_items')
        .select('product_id, product_name, size, quantity')
        .in('order_id', chunk);
      if (data) allOrderItems = allOrderItems.concat(data);
    }

    // Aggregate
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
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
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

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, OrderItem } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Eye,
  EyeOff,
  CheckCircle,
  Trash2,
  PlusCircle,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
  Package,
} from 'lucide-react';

// Size ordering
const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', '16', 'PP', 'P', 'M', 'G', 'GG', 'EG', 'XG'];
function sortBySize(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}

interface BatchRecord {
  id: string;
  batch_number: string;
  imported_by: string;
  imported_at: string;
  file_name: string;
  total_orders: number;
  total_items: number;
  total_sale_amount: number;
  total_supplier_amount: number;
  total_profit: number;
  status: string;
}

interface AggItem {
  product_name: string;
  product_id: string;
  size: string;
  total_quantity: number;
}

interface BatchOrder {
  id: string;
  order_number: string;
  student_name: string;
  total_amount: number;
  supplier_total_amount: number;
  status: string;
  created_at: string;
}

function groupByProduct(items: AggItem[]) {
  const map = new Map<string, AggItem[]>();
  items.forEach(item => {
    const key = item.product_id || item.product_name;
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  });
  map.forEach(items => items.sort((a, b) => sortBySize(a.size, b.size)));
  return Array.from(map.values());
}

function ProductionTable({ items }: { items: AggItem[] }) {
  const groups = groupByProduct(items);
  const totalPieces = items.reduce((s, i) => s + i.total_quantity, 0);
  return (
    <div className="space-y-4">
      {groups.map((group, idx) => (
        <div key={idx}>
          <h4 className="font-semibold text-sm text-foreground mb-1">Produto: {group[0].product_name}</h4>
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
        <p>Produtos distintos: <span className="font-semibold text-foreground">{groups.length}</span></p>
      </div>
    </div>
  );
}

// --- Add Order to Batch Dialog ---
function AddOrderToBatchDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  onOrderAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber: string;
  onOrderAdded: () => void;
}) {
  const { user } = useAuth();
  const { addOrder } = useOrders();
  const { products, loading: productsLoading } = useProducts();
  const { toast } = useToast();

  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selProduct, setSelProduct] = useState('');
  const [selSize, setSelSize] = useState('');
  const [selQty, setSelQty] = useState(1);

  const selectedProduct = products.find(p => p.id === selProduct);
  const selectedVariant = selectedProduct?.variants.find(v => v.size === selSize);

  const resetForm = () => {
    setStudentName('');
    setGrade('');
    setResponsibleName('');
    setPhone('');
    setItems([]);
    setSelProduct('');
    setSelSize('');
    setSelQty(1);
  };

  const addItem = () => {
    if (!selectedProduct || !selectedVariant || selQty < 1) return;
    const newItem: OrderItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: selSize,
      quantity: selQty,
      unitPrice: selectedVariant.price,
      supplierPrice: selectedVariant.supplierPrice,
      total: selectedVariant.price * selQty,
      supplierTotal: selectedVariant.supplierPrice * selQty,
    };
    setItems([...items, newItem]);
    setSelProduct('');
    setSelSize('');
    setSelQty(1);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const totalAmount = items.reduce((s, i) => s + i.total, 0);
  const supplierTotalAmount = items.reduce((s, i) => s + i.supplierTotal, 0);

  const handleSubmit = async () => {
    if (!studentName.trim() || items.length === 0) {
      toast({ title: 'Erro', description: 'Nome do aluno e pelo menos um item são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Create order with batch id
      const schoolProfit = totalAmount - supplierTotalAmount;

      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastNumber = lastOrder?.order_number
        ? parseInt(lastOrder.order_number.replace('VC-', ''))
        : 0;
      const orderNumber = `VC-${String(lastNumber + 1).padStart(4, '0')}`;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          student_name: studentName.trim(),
          grade: grade.trim(),
          responsible_name: responsibleName.trim(),
          phone: phone.trim(),
          total_amount: totalAmount,
          supplier_total_amount: supplierTotalAmount,
          school_profit: schoolProfit,
          repasse_amount: supplierTotalAmount,
          status: 'awaiting_payment',
          created_by: user?.id ?? '',
          order_number: orderNumber,
          import_batch_id: batchId,
        })
        .select();

      if (orderError || !orderData?.length) {
        throw new Error(orderError?.message || 'Failed');
      }

      const newOrder = orderData[0];
      const itemsToInsert = items.map(i => ({
        order_id: newOrder.id,
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

      // Update batch totals
      const totalItemsCount = items.reduce((s, i) => s + i.quantity, 0);
      const { data: currentBatch } = await supabase
        .from('import_batches')
        .select('total_orders, total_items, total_sale_amount, total_supplier_amount, total_profit')
        .eq('id', batchId)
        .single();

      if (currentBatch) {
        await supabase.from('import_batches').update({
          total_orders: (currentBatch.total_orders || 0) + 1,
          total_items: (currentBatch.total_items || 0) + totalItemsCount,
          total_sale_amount: Number(currentBatch.total_sale_amount || 0) + totalAmount,
          total_supplier_amount: Number(currentBatch.total_supplier_amount || 0) + supplierTotalAmount,
          total_profit: Number(currentBatch.total_profit || 0) + schoolProfit,
        }).eq('id', batchId);
      }

      toast({ title: 'Sucesso', description: `Pedido adicionado ao lote ${batchNumber} com sucesso.` });
      resetForm();
      onOpenChange(false);
      onOrderAdded();
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Não foi possível criar o pedido.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Pedido ao {batchNumber}</DialogTitle>
        </DialogHeader>
        {productsLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do Aluno *</Label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Turma / Série</Label>
                <Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="Ex: 3º Ano A" />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={responsibleName} onChange={e => setResponsibleName(e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>Produto</Label>
                <Select value={selProduct} onValueChange={(v) => { setSelProduct(v); setSelSize(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label>Tamanho</Label>
                <Select value={selSize} onValueChange={setSelSize} disabled={!selectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Tam." /></SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.variants.map(v => <SelectItem key={v.size} value={v.size}>{v.size}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20 space-y-2">
                <Label>Qtd.</Label>
                <Input type="number" min={1} value={selQty} onChange={e => setSelQty(Number(e.target.value))} />
              </div>
              <Button type="button" onClick={addItem} disabled={!selectedVariant || selQty < 1} size="sm">
                <PlusCircle className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground">
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">Tam.</th>
                      <th className="p-2 text-right">Qtd.</th>
                      <th className="p-2 text-right">Subtotal</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{item.productName}</td>
                        <td className="p-2">{item.size}</td>
                        <td className="p-2 text-right">{item.quantity}</td>
                        <td className="p-2 text-right font-medium">R$ {item.total.toFixed(2)}</td>
                        <td className="p-2">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={items.length === 0 || submitting}>
                {submitting ? 'Salvando...' : 'Salvar Pedido'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Batch Detail (expanded) ---
function BatchDetail({ batchId, batchNumber, onRefresh, isAdmin }: { batchId: string; batchNumber: string; onRefresh: () => void; isAdmin: boolean }) {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<BatchOrder[]>([]);
  const [prodItems, setProdItems] = useState<AggItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProd, setLoadingProd] = useState(false);
  const [addOrderOpen, setAddOrderOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, student_name, total_amount, supplier_total_amount, status, created_at')
      .eq('import_batch_id', batchId)
      .order('created_at', { ascending: true });
    setOrders(data || []);
    setLoadingOrders(false);
  }, [batchId]);

  const fetchProduction = useCallback(async () => {
    setLoadingProd(true);
    const { data: batchOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('import_batch_id', batchId)
      .neq('status', 'cancelled');

    if (!batchOrders?.length) { setProdItems([]); setLoadingProd(false); return; }

    const orderIds = batchOrders.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, size, quantity')
      .in('order_id', orderIds);

    const aggMap = new Map<string, AggItem>();
    (items || []).forEach(i => {
      const key = `${i.product_id}||${i.size}`;
      const existing = aggMap.get(key);
      if (existing) existing.total_quantity += i.quantity;
      else aggMap.set(key, { product_id: i.product_id, product_name: i.product_name, size: i.size, total_quantity: i.quantity });
    });
    setProdItems(Array.from(aggMap.values()));
    setLoadingProd(false);
  }, [batchId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleTabChange = (val: string) => {
    setTab(val);
    if (val === 'production' && prodItems.length === 0) fetchProduction();
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente', in_production: 'Em Produção', exchange_requested: 'Troca Solicitada', delivered: 'Entregue',
    paid: 'Pago', awaiting_payment: 'Aguardando Pgto', ready: 'Pronto', cancelled: 'Cancelado',
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={handleTabChange} className="flex-1">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="orders">Pedidos</TabsTrigger>
              <TabsTrigger value="production">Produção</TabsTrigger>
            </TabsList>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setAddOrderOpen(true)}>
                <PlusCircle className="w-4 h-4 mr-1" /> Adicionar Pedido ao Lote
              </Button>
            )}
          </div>

          <TabsContent value="orders">
            {loadingOrders ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum pedido neste lote.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                   <tr className="bg-muted/50 border-b text-muted-foreground">
                      <th className="p-2 text-left">Nº</th>
                      <th className="p-2 text-left">Aluno</th>
                      {isAdmin && <th className="p-2 text-right">Total</th>}
                      {isAdmin && <th className="p-2 text-right">Custo</th>}
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">{o.order_number}</td>
                        <td className="p-2">{o.student_name}</td>
                        {isAdmin && <td className="p-2 text-right">R$ {Number(o.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>}
                        {isAdmin && <td className="p-2 text-right">R$ {Number(o.supplier_total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>}
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                            o.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                            o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            o.status === 'ready' ? 'bg-purple-100 text-purple-700' :
                            o.status === 'in_production' ? 'bg-yellow-100 text-yellow-700' :
                            o.status === 'exchange_requested' ? 'bg-orange-100 text-orange-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {o.status === 'exchange_requested' && <RefreshCw className="w-3 h-3" />}
                            {statusLabels[o.status] || o.status}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="production">
            {loadingProd ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : prodItems.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum item encontrado para este lote.</p>
            ) : (
              <ProductionTable items={prodItems} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AddOrderToBatchDialog
        open={addOrderOpen}
        onOpenChange={setAddOrderOpen}
        batchId={batchId}
        batchNumber={batchNumber}
        onOrderAdded={() => { fetchOrders(); fetchProduction(); onRefresh(); }}
      />
    </div>
  );
}

// --- Main Page ---
export default function Batches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.activeRole === 'admin';
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  // Dialogs
  const [repasseBatch, setRepasseBatch] = useState<BatchRecord | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<BatchRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('import_batches')
      .select('*')
      .order('imported_at', { ascending: false });

    if (data) {
      setBatches(data as BatchRecord[]);
      // Fetch profile names for imported_by
      const userIds = [...new Set(data.map(b => b.imported_by))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach(p => { map[p.user_id] = p.name; });
        setProfilesMap(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const toggleBatch = (id: string) => {
    setExpandedBatch(prev => prev === id ? null : id);
  };

  // --- Confirmar Repasse ---
  const handleConfirmRepasse = async () => {
    if (!repasseBatch || !user) return;
    setActionLoading(true);
    try {
      const { data: updated, error } = await supabase
        .from('orders')
        .update({
          repasse_completed: true,
          repasse_date: new Date().toISOString(),
          repasse_confirmed_by: user.id,
          status: 'paid',
        })
        .eq('import_batch_id', repasseBatch.id)
        .neq('status', 'cancelled')
        .neq('status', 'paid')
        .select('id');

      if (error) throw error;

      const count = updated?.length || 0;
      toast({ title: 'Repasse confirmado', description: `Repasse confirmado para ${count} pedidos do lote ${repasseBatch.batch_number}.` });
      setRepasseBatch(null);
      fetchBatches();
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Erro ao confirmar repasse.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- Excluir Lote ---
  const handleDeleteBatch = async () => {
    if (!deleteBatch) return;
    setActionLoading(true);
    try {
      // Step 1: Delete order_items for all orders in this batch
      const { data: batchOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('import_batch_id', deleteBatch.id);

      if (batchOrders && batchOrders.length > 0) {
        const orderIds = batchOrders.map(o => o.id);
        const { error: itemsErr } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds);
        if (itemsErr) throw itemsErr;

        // Step 2: Delete orders
        const { error: ordersErr } = await supabase
          .from('orders')
          .delete()
          .eq('import_batch_id', deleteBatch.id);
        if (ordersErr) throw ordersErr;
      }

      // Step 3: Delete batch
      const { error: batchErr } = await supabase
        .from('import_batches')
        .delete()
        .eq('id', deleteBatch.id);
      if (batchErr) throw batchErr;

      toast({ title: 'Lote excluído', description: `Lote ${deleteBatch.batch_number} excluído com sucesso.` });
      setDeleteBatch(null);
      if (expandedBatch === deleteBatch.id) setExpandedBatch(null);
      fetchBatches();
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Erro ao excluir o lote. Tente novamente.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lotes de Importação</h2>
          <p className="text-muted-foreground">Gerencie os lotes de pedidos importados</p>
        </div>
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lotes de Importação</h2>
          <p className="text-muted-foreground">Gerencie os lotes de pedidos importados</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBatches}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum lote de importação encontrado.</p>
      ) : (
        <div className="space-y-4">
          {batches.map(batch => {
            const isOpen = expandedBatch === batch.id;
            return (
              <Card key={batch.id}>
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base">{batch.batch_number}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(batch.imported_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <FileSpreadsheet className="w-3 h-3" />
                        {batch.file_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Importado por: {profilesMap[batch.imported_by] || 'Desconhecido'}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-muted-foreground" />
                      <strong>{batch.total_orders}</strong> pedidos
                    </span>
                    {isAdmin && (
                      <>
                        <span>
                          R$ {Number(batch.total_sale_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-green-600">
                          Lucro R$ {Number(batch.total_profit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    <Button size="sm" variant="outline" onClick={() => toggleBatch(batch.id)}>
                      {isOpen ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                      {isOpen ? 'Fechar' : 'Visualizar'}
                    </Button>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setRepasseBatch(batch)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Repasse
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteBatch(batch)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Excluir
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <BatchDetail batchId={batch.id} batchNumber={batch.batch_number} onRefresh={fetchBatches} isAdmin={isAdmin} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmar Repasse Dialog */}
      <AlertDialog open={!!repasseBatch} onOpenChange={(v) => { if (!v) setRepasseBatch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Repasse</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar repasse para todos os pedidos do lote <strong>{repasseBatch?.batch_number}</strong>?
              <br /><br />
              Esta ação marcará todos os pedidos como Pagos e confirmará o repasse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRepasse} disabled={actionLoading}>
              {actionLoading ? 'Processando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir Lote Dialog */}
      <AlertDialog open={!!deleteBatch} onOpenChange={(v) => { if (!v) setDeleteBatch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lote <strong>{deleteBatch?.batch_number}</strong>?
              <br /><br />
              Esta ação excluirá o lote e <strong>TODOS os pedidos</strong> vinculados a ele.
              <br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Excluindo...' : 'Excluir permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, DollarSign, Clock, Package, TrendingUp, ArrowRightLeft, AlertTriangle, Calendar, X, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { addBusinessDays } from '@/lib/business-days';

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

const Dashboard = () => {
  const { user } = useAuth();
  const { orders, loading } = useOrders();
  const navigate = useNavigate();

  const isSupplier = user?.activeRole === 'supplier';
  const isAdmin = user?.activeRole === 'admin';

  // Pending repasse complementar for admin warning
  const [pendingComplementar, setPendingComplementar] = useState<{ count: number; totalValue: number }>({ count: 0, totalValue: 0 });
  // Confirmed complementar total for profit impact
  const [confirmedComplementarTotal, setConfirmedComplementarTotal] = useState(0);
  // Pending exchanges for supplier
  const [pendingExchanges, setPendingExchanges] = useState<any[]>([]);

  // Calendar popover state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchComplementar = async () => {
      // Fetch pending
      const { data: pending } = await supabase
        .from('repasse_complementar')
        .select('adjustment_value')
        .eq('status', 'pending')
        .neq('adjustment_value', 0);

      if (pending && pending.length > 0) {
        setPendingComplementar({
          count: pending.length,
          totalValue: pending.reduce((s, r) => s + Number(r.adjustment_value), 0),
        });
      } else {
        setPendingComplementar({ count: 0, totalValue: 0 });
      }

      // Fetch confirmed for profit calculation
      const { data: confirmed } = await supabase
        .from('repasse_complementar')
        .select('adjustment_value')
        .eq('status', 'confirmed');

      if (confirmed && confirmed.length > 0) {
        setConfirmedComplementarTotal(confirmed.reduce((s, r) => s + Number(r.adjustment_value), 0));
      } else {
        setConfirmedComplementarTotal(0);
      }
    };
    fetchComplementar();

    // Fetch pending exchanges for supplier
    const fetchPendingExchanges = async () => {
      if (!isSupplier) return;
      
      const { data: exchangeOrders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          student_name,
          import_batch_id,
          import_batches!inner(batch_number)
        `)
        .eq('status', 'exchange_requested')
        .eq('supplier_id', user.id);

      if (exchangeOrders && exchangeOrders.length > 0) {
        // Get adjustments for these orders
        const orderIds = exchangeOrders.map(o => o.id);
        const { data: adjustments } = await supabase
          .from('order_adjustments')
          .select('order_id, product_name, old_size, new_size, quantity')
          .in('order_id', orderIds)
          .eq('status', 'pending');

        // Combine order and adjustment data
        const exchangesWithDetails = exchangeOrders.map(order => {
          const adjustment = adjustments?.find(adj => adj.order_id === order.id);
          return {
            ...order,
            adjustment
          };
        }).filter(exchange => exchange.adjustment); // Only include orders with adjustments

        setPendingExchanges(exchangesWithDetails);
      } else {
        setPendingExchanges([]);
      }
    };

    fetchPendingExchanges();

    // Fetch batches for calendar popover
    const fetchBatches = async () => {
      let batchQuery = supabase
        .from('import_batches')
        .select('id, batch_number, imported_at, total_orders')
        .eq('status', 'active')
        .order('imported_at', { ascending: true }); // Soonest first

      if (isSupplier) {
        // For suppliers, only show batches that contain their orders
        const { data: supplierOrders } = await supabase
          .from('orders')
          .select('import_batch_id')
          .eq('supplier_id', user.id)
          .not('import_batch_id', 'is', null);
        
        if (supplierOrders && supplierOrders.length > 0) {
          const batchIds = [...new Set(supplierOrders.map(o => o.import_batch_id))];
          batchQuery = batchQuery.in('id', batchIds);
        } else {
          // If no orders found with supplier_id (likely because supplier_id is null on orders),
          // show all active batches so suppliers can see delivery dates
          // TODO: Remove this when supplier_id is properly set on orders
          console.log('No orders found for supplier, showing all batches temporarily');
        }
      }

      const { data: batchesData } = await batchQuery;
      setBatches(batchesData || []);
    };

    fetchBatches();
  }, [user, orders, isSupplier]);

  const nonCancelled = orders.filter(o => o.status !== 'cancelled');
  const totalRevenue = nonCancelled.reduce((s, o) => s + o.totalAmount, 0);
  const totalSupplierCost = nonCancelled.reduce((s, o) => s + (o.supplierTotalAmount || 0), 0);
  // Profit formula: revenue - supplier cost - confirmed complementar adjustments
  const totalProfit = totalRevenue - totalSupplierCost - confirmedComplementarTotal;
  const pendingProfit = nonCancelled.filter(o => !o.repasseCompleted).reduce((s, o) => s + o.totalAmount - (o.supplierTotalAmount || 0), 0);
  const settledProfit = totalProfit - pendingProfit;
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
  const production = orders.filter(o => o.status === 'in_production').length;

  const recentOrders = orders.slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Olá, {user?.name}!</h2>
          <p className="text-muted-foreground">Resumo geral do sistema</p>
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Calendar className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-96 overflow-y-auto p-0" align="end">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Datas de Entrega</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setCalendarOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-2">
              {batches.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Nenhum lote encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {batches.map(batch => {
                    const deliveryDate = addBusinessDays(new Date(batch.imported_at), 20);
                    const today = new Date();
                    const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let statusVariant: 'default' | 'secondary' | 'destructive' = 'default';
                    let statusText = 'No Prazo';
                    let statusIcon = '🟢';
                    
                    if (daysUntilDelivery < 0) {
                      statusVariant = 'destructive';
                      statusText = 'Atrasado';
                      statusIcon = '🔴';
                    } else if (daysUntilDelivery <= 5) {
                      statusVariant = 'secondary';
                      statusText = 'Atenção';
                      statusIcon = '🟡';
                    }

                    return (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => {
                          setCalendarOpen(false);
                          navigate('/batches');
                        }}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span className="font-bold text-sm">{batch.batch_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {deliveryDate.toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <Badge variant={statusVariant} className="text-xs shrink-0">
                          {statusIcon} {statusText}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Admin warning banner for pending repasse complementar */}
      {isAdmin && pendingComplementar.count > 0 && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-amber-800 text-sm">
              Há{' '}
              <strong className={pendingComplementar.totalValue <= 0 ? 'text-green-600' : 'text-red-600'}>
                R$ {Math.abs(pendingComplementar.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>{' '}
              em repasses complementares pendentes
              <span className={pendingComplementar.totalValue <= 0 ? 'text-green-600' : 'text-red-600'}>
                {' '}({pendingComplementar.totalValue >= 0 ? 'a pagar ao fornecedor' : 'a receber do fornecedor'})
              </span>.
            </span>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate('/batches')}>
              Ver Repasses Complementares
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Supplier warning banner for pending repasse complementar */}
      {isSupplier && pendingComplementar.count > 0 && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Há{' '}
            <strong className={pendingComplementar.totalValue >= 0 ? 'text-green-600' : 'text-red-600'}>
              R$ {Math.abs(pendingComplementar.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>{' '}
            em repasses complementares pendentes.{' '}
            <span className={pendingComplementar.totalValue >= 0 ? 'text-green-600' : 'text-red-600'}>
              {pendingComplementar.totalValue >= 0
                ? `Você receberá R$ ${Math.abs(pendingComplementar.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a mais.`
                : `Você deverá devolver R$ ${Math.abs(pendingComplementar.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Supplier pending exchanges section */}
      {isSupplier && pendingExchanges.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ⚠️ Trocas Pendentes
          </h3>
          <div className="space-y-3">
            {pendingExchanges.map((exchange) => (
              <div 
                key={exchange.id}
                className="bg-white border border-amber-200 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span><strong>Aluno:</strong> {exchange.student_name}</span>
                      <span><strong>Lote:</strong> {exchange.import_batches?.batch_number || 'N/A'}</span>
                    </div>
                    {exchange.adjustment && (
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span><strong>Produto:</strong> {exchange.adjustment.product_name}</span>
                        <span><strong>Alteração:</strong> Tamanho {exchange.adjustment.old_size} → {exchange.adjustment.new_size}</span>
                        <span><strong>Quantidade:</strong> {exchange.adjustment.quantity}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300 shrink-0">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Troca Solicitada
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
        <Card className="min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Total Pedidos</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        {!isSupplier && (
          <Card className="min-w-[160px] w-full h-full min-h-[90px]">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Receita (Escola)</p>
                <p className="text-lg font-bold leading-tight whitespace-nowrap">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-blue-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Custo Fornecedor</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">R$ {totalSupplierCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        {!isSupplier && (
          <Card className="min-w-[160px] w-full h-full min-h-[90px]">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Lucro Total</p>
                <p className="text-lg font-bold leading-tight whitespace-nowrap text-green-600">R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-yellow-300 bg-yellow-50/50 min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-yellow-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Pendente Repasse</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap text-yellow-700">R$ {pendingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-300 bg-green-50/50 min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-green-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Lucro Repassado</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap text-green-600">R$ {settledProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Pendentes</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">{pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-[160px] w-full h-full min-h-[90px]">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-blue-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">Em Produção</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">{production}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum pedido registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Nº</th>
                    <th className="pb-2 pr-4">Aluno</th>
                    <th className="pb-2 pr-4">Turma</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                      <td className="py-3 pr-4">{order.studentName}</td>
                      <td className="py-3 pr-4">{order.grade}</td>
                      <td className="py-3 pr-4">R$ {order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

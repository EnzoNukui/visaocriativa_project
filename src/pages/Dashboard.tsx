import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, DollarSign, Clock, Package, TrendingUp, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
  }, [user, orders]);

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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Olá, {user?.name}!</h2>
        <p className="text-muted-foreground">Resumo geral do sistema</p>
      </div>

      {/* Admin warning banner for pending repasse complementar */}
      {isAdmin && pendingComplementar.count > 0 && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-amber-800 text-sm">
              Há <strong className={pendingComplementar.totalValue >= 0 ? 'text-green-700' : 'text-red-700'}>
                R$ {Math.abs(pendingComplementar.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong> em repasses complementares pendentes
              ({pendingComplementar.totalValue >= 0 ? 'a pagar ao fornecedor' : 'a receber do fornecedor'}).
            </span>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate('/batches')}>
              Ver Repasses Complementares
            </Button>
          </AlertDescription>
        </Alert>
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

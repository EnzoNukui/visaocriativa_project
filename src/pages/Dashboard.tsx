import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, DollarSign, Clock, Package, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

const Dashboard = () => {
  const { user } = useAuth();
  const { orders, loading } = useOrders();

  const nonCancelled = orders.filter(o => o.status !== 'cancelled');
  const totalRevenue = nonCancelled.reduce((s, o) => s + o.totalAmount, 0);
  const totalSupplierCost = nonCancelled.reduce((s, o) => s + (o.supplierTotalAmount || 0), 0);
  const totalProfit = totalRevenue - totalSupplierCost;
  const pendingProfit = nonCancelled.filter(o => !o.repasseCompleted).reduce((s, o) => s + o.totalAmount - (o.supplierTotalAmount || 0), 0);
  const settledProfit = totalProfit - pendingProfit;
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
  const production = orders.filter(o => o.status === 'in_production').length;

  const isSupplier = user?.activeRole === 'supplier';
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

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-stretch">
        <Card className="h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Total Pedidos</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        {!isSupplier && (
          <Card className="h-full min-h-[100px] overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Receita (Escola)</p>
                <p className="text-lg font-bold leading-tight whitespace-nowrap">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-blue-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Custo Fornecedor</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">R$ {totalSupplierCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        {!isSupplier && (
          <Card className="h-full min-h-[100px] overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Lucro Total</p>
                <p className="text-lg font-bold leading-tight whitespace-nowrap text-green-600">R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-yellow-300 bg-yellow-50/50 h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-yellow-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Pendente Repasse</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap text-yellow-700">R$ {pendingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-300 bg-green-50/50 h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-green-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Lucro Repassado</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap text-green-600">R$ {settledProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Pendentes</p>
              <p className="text-lg font-bold leading-tight whitespace-nowrap">{pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-h-[100px] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-blue-700" />
            </div>
            <div className="flex flex-col justify-center min-w-0 overflow-hidden">
              <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">Em Produção</p>
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

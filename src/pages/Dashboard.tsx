import { useAuth } from '@/contexts/AuthContext';
import { useOrders, STATUS_LABELS, STATUS_COLORS, OrderStatus } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, DollarSign, Clock, Package, TrendingUp, ArrowRightLeft, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'in_production', 'ready', 'delivered'];

const Dashboard = () => {
  const { user } = useAuth();
  const { orders, loading } = useOrders();
  const isAdmin = user?.activeRole === 'admin';

  const revenueOrders = orders.filter(o => REVENUE_STATUSES.includes(o.status));
  const totalRevenue = revenueOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalSupplierCost = revenueOrders.reduce((s, o) => s + (o.supplierTotalAmount || 0), 0);
  const totalProfit = totalRevenue - totalSupplierCost;
  const confirmedProfit = revenueOrders
    .filter(o => o.repasseCompleted)
    .reduce((s, o) => s + o.totalAmount - (o.supplierTotalAmount || 0), 0);
  const pendingProfit = revenueOrders
    .filter(o => !o.repasseCompleted)
    .reduce((s, o) => s + o.totalAmount - (o.supplierTotalAmount || 0), 0);

  // Supplier-specific repasse metrics (RLS already filters by supplier_id)
  const supplierPendingRepasse = !isAdmin
    ? revenueOrders.filter(o => !o.repasseCompleted).reduce((s, o) => s + (o.supplierTotalAmount || 0), 0)
    : 0;
  const supplierConfirmedRepasse = !isAdmin
    ? revenueOrders.filter(o => o.repasseCompleted).reduce((s, o) => s + (o.supplierTotalAmount || 0), 0)
    : 0;

  const awaitingPayment = orders.filter(o => o.status === 'awaiting_payment').length;
  const inProduction = orders.filter(o => o.status === 'in_production').length;
  const ready = orders.filter(o => o.status === 'ready').length;

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

      {/* Main KPI row — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pedidos</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aguardando Pgto</p>
              <p className="text-2xl font-bold">{awaitingPayment}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em Produção</p>
              <p className="text-2xl font-bold">{inProduction}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prontos p/ Entrega</p>
              <p className="text-2xl font-bold">{ready}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin financial summary — compact row */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Bruta</p>
                <p className="text-xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Total</p>
                <p className="text-xl font-bold text-green-600">R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-yellow-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Pendente</p>
                <p className="text-xl font-bold text-yellow-700">R$ {pendingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Confirmado</p>
                <p className="text-xl font-bold text-green-600">R$ {confirmedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier repasse summary */}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-yellow-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Pendente</p>
                <p className="text-xl font-bold text-yellow-700">R$ {supplierPendingRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Confirmado</p>
                <p className="text-xl font-bold text-green-600">R$ {supplierConfirmedRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent orders table */}
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
                      <td className="py-3 pr-4">
                        R$ {isAdmin
                          ? order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                          : order.supplierTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                        }
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status as OrderStatus] || ''}`}>
                          {STATUS_LABELS[order.status as OrderStatus] || order.status}
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

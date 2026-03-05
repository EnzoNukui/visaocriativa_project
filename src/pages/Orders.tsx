import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, Order } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Search, Eye, DollarSign, TrendingUp, ArrowRightLeft, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import ImportOrdersDialog from '@/components/ImportOrdersDialog';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  production: 'Em Produção',
  delivered: 'Entregue',
  paid: 'Pago',
  awaiting_payment: 'Aguardando Pagamento',
  ready: 'Pronto',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  production: 'bg-blue-100 text-blue-800',
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

const Orders = () => {
  const { user } = useAuth();
  const { orders, loading, updateStatus, updateRepasseCompleted, deleteOrder } = useOrders();
  const { toast } = useToast();
  const isAdmin = user?.activeRole === 'admin';
  const isSupplier = user?.activeRole === 'supplier';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter(o => {
    const matchSearch = o.studentName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = async (id: string, status: string) => {
    await updateStatus(id, status);
    toast({ title: 'Status atualizado', description: `Pedido marcado como "${statusLabels[status] || status}"` });
  };

  const handleRepasseToggle = async (id: string, currentValue: boolean) => {
    if (!user) return;
    await updateRepasseCompleted(id, !currentValue, user.id);
    toast({ title: !currentValue ? 'Repasse confirmado' : 'Repasse desfeito' });
  };

  const handleDelete = async (id: string) => {
    await deleteOrder(id);
    toast({ title: 'Pedido excluído', description: 'O pedido foi removido com sucesso.' });
  };

  const nonCancelled = orders.filter(o => o.status !== 'cancelled');
  const totalSchool = nonCancelled.reduce((s, o) => s + o.totalAmount, 0);
  const totalSupplier = nonCancelled.reduce((s, o) => s + (o.supplierTotalAmount || 0), 0);
  const totalProfit = totalSchool - totalSupplier;
  const pendingProfit = nonCancelled.filter(o => !o.repasseCompleted).reduce((s, o) => s + o.totalAmount - (o.supplierTotalAmount || 0), 0);
  const settledProfit = totalProfit - pendingProfit;

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-4">
      {isSupplier && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Total Vendido (Escola)</p><p className="text-lg font-bold">R$ {totalSchool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-700" /></div>
              <div><p className="text-xs text-muted-foreground">Custo Fornecedor</p><p className="text-lg font-bold">R$ {totalSupplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-700" /></div>
              <div><p className="text-xs text-muted-foreground">Diferença (Lucro)</p><p className="text-lg font-bold text-green-600">R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card className="border-yellow-300 bg-yellow-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-yellow-700" /></div>
              <div><p className="text-xs text-muted-foreground font-medium">Pendente Repasse</p><p className="text-lg font-bold text-yellow-700">R$ {pendingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
          <Card className="border-green-300 bg-green-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-700" /></div>
              <div><p className="text-xs text-muted-foreground font-medium">Lucro Repassado</p><p className="text-lg font-bold text-green-600">R$ {settledProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Pedidos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} pedido(s) encontrado(s)</p>
        </div>
        {isAdmin && (
          <Button asChild><Link to="/orders/new"><PlusCircle className="w-4 h-4 mr-2" />Novo Pedido</Link></Button>
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
            <SelectItem value="production">Em Produção</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="awaiting_payment">Aguardando Pagamento</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">Nenhum pedido encontrado.</p>
          ) : (
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
                  {filtered.map(order => {
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
                                <SelectItem value="production">Em Produção</SelectItem>
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
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};

export default Orders;

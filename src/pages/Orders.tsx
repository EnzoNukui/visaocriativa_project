import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, Order, OrderStatus, STATUS_LABELS, STATUS_COLORS, getAllowedTransitions } from '@/hooks/useOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Search, Eye, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

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

const ALL_STATUSES: OrderStatus[] = ['awaiting_payment', 'paid', 'in_production', 'ready', 'delivered', 'cancelled'];

const Orders = () => {
  const { user } = useAuth();
  const { orders, loading, updateStatus, updateRepasse, deleteOrder } = useOrders();
  const { toast } = useToast();
  const isAdmin = user?.activeRole === 'admin';
  const activeRole = user?.activeRole || 'supplier';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter: exclude cancelled from financial calculations
  const activeOrders = orders.filter(o => o.status !== 'cancelled');

  const filtered = orders.filter(o => {
    const matchSearch = o.studentName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.grade.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    await updateStatus(id, status);
    toast({ title: 'Status atualizado', description: `Pedido marcado como "${STATUS_LABELS[status]}"` });
  };

  const handleDelete = async (id: string) => {
    await deleteOrder(id);
    toast({ title: 'Pedido excluído', description: 'O pedido foi removido com sucesso.' });
  };

  const handleRepasseToggle = async (order: Order) => {
    const profit = order.totalAmount - order.supplierTotalAmount;
    await updateRepasse(order.id, !order.repasseCompleted, profit);
    toast({
      title: order.repasseCompleted ? 'Repasse revertido' : 'Repasse confirmado',
      description: order.repasseCompleted ? 'Repasse marcado como pendente.' : `Repasse de R$ ${profit.toFixed(2)} confirmado.`,
    });
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-4">
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
          <Input placeholder="Buscar por aluno, nº pedido ou turma..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
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
                    const allowed = getAllowedTransitions(order.status, activeRole as 'admin' | 'supplier');
                    return (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{order.orderNumber}</td>
                        <td className="p-3">{order.studentName}</td>
                        <td className="p-3 hidden md:table-cell">{order.grade}</td>
                        <td className="p-3">
                          {isAdmin
                            ? `R$ ${order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : `R$ ${order.supplierTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          }
                        </td>
                        <td className="p-3">
                          {allowed.length > 0 ? (
                            <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}>
                              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={order.status}>{STATUS_LABELS[order.status]}</SelectItem>
                                {allowed.map(s => (
                                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                              {STATUS_LABELS[order.status]}
                            </span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {order.status === 'delivered' || order.status === 'cancelled' ? (
                            <span className="text-xs text-muted-foreground">{STATUS_LABELS[order.status]}</span>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${deadline.color}`}>{deadline.label}</span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {isAdmin && order.status !== 'cancelled' && (
                              <Button
                                size="icon"
                                variant={order.repasseCompleted ? 'default' : 'ghost'}
                                className={`h-8 w-8 ${order.repasseCompleted ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                onClick={() => handleRepasseToggle(order)}
                                title={order.repasseCompleted ? 'Repasse confirmado' : 'Confirmar repasse'}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
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
                  <span className="text-muted-foreground">Status:</span><br />
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedOrder.status]}`}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </span>
                </div>
                {isAdmin && (
                  <div>
                    <span className="text-muted-foreground">Repasse:</span><br />
                    <span className={`text-xs font-medium ${selectedOrder.repasseCompleted ? 'text-green-600' : 'text-yellow-600'}`}>
                      {selectedOrder.repasseCompleted ? `Confirmado em ${selectedOrder.repasseDate ? new Date(selectedOrder.repasseDate).toLocaleDateString('pt-BR') : '-'}` : 'Pendente'}
                    </span>
                  </div>
                )}
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
                        <td className="py-1.5 text-right">
                          R$ {isAdmin ? item.unitPrice.toFixed(2) : item.supplierPrice.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right font-medium">
                          R$ {isAdmin ? item.total.toFixed(2) : item.supplierTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center pt-2 border-t font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">
                  R$ {isAdmin
                    ? selectedOrder.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : selectedOrder.supplierTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  }
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;

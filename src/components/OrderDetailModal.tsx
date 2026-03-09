import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addBusinessDays } from '@/lib/business-days';
import type { Order } from '@/hooks/useOrders';

const DELIVERY_DAYS = 20;

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrderDetailModal({ order, open, onOpenChange }: OrderDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedido {order?.orderNumber}</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Aluno:</span><br />{order.studentName}</div>
              <div><span className="text-muted-foreground">Turma:</span><br />{order.grade}</div>
              {order.responsibleName && <div><span className="text-muted-foreground">Responsável:</span><br />{order.responsibleName}</div>}
              {order.phone && <div><span className="text-muted-foreground">Telefone:</span><br />{order.phone}</div>}
              <div><span className="text-muted-foreground">Data do Pedido:</span><br />{new Date(order.createdAt).toLocaleDateString('pt-BR')}</div>
              <div>
                <span className="text-muted-foreground">Prazo de Entrega:</span><br />
                {addBusinessDays(new Date(order.createdAt), DELIVERY_DAYS).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Itens do Pedido</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-1">Produto</th>
                    <th className="text-left pb-1">Tam.</th>
                    <th className="text-right pb-1">Qtd.</th>
                    <th className="text-right pb-1">Unit.</th>
                    <th className="text-right pb-1">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
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
              <span className="text-primary text-lg">R$ {order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

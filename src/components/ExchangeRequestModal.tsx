import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Info } from 'lucide-react';

const SIZE_OPTIONS = ['2', '4', '6', '8', '10', '12', '14', '16', 'PP', 'P', 'M', 'G', 'GG', 'EG', 'XG'];

interface OrderItemData {
  id: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  supplierPrice: number;
  total: number;
  supplierTotal: number;
  productId: string;
}

interface ExchangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  items: OrderItemData[];
  userId: string;
  onComplete: () => void;
}

interface RepasseStatus {
  type: 'not_done' | 'already_done' | 'manual';
  batchId?: string;
  repasseDate?: string;
}

export default function ExchangeRequestModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  items,
  userId,
  onComplete,
}: ExchangeRequestModalProps) {
  const { toast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState<number | ''>('');
  const [priceLocked, setPriceLocked] = useState(false);
  const [priceWarning, setPriceWarning] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [repasseStatus, setRepasseStatus] = useState<RepasseStatus | null>(null);

  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  // Fetch repasse status when modal opens
  useEffect(() => {
    if (!open) return;
    const fetchRepasseStatus = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('import_batch_id, repasse_completed, repasse_date')
        .eq('id', orderId)
        .maybeSingle();

      if (!order || !order.import_batch_id) {
        setRepasseStatus({ type: 'manual' });
        return;
      }

      if (order.repasse_completed) {
        setRepasseStatus({
          type: 'already_done',
          batchId: order.import_batch_id,
          repasseDate: order.repasse_date || undefined,
        });
      } else {
        setRepasseStatus({
          type: 'not_done',
          batchId: order.import_batch_id,
        });
      }
    };
    fetchRepasseStatus();
  }, [open, orderId]);

  useEffect(() => {
    if (selectedItem) {
      setNewUnitPrice(selectedItem.unitPrice);
      setNewSize('');
      setPriceLocked(false);
      setPriceWarning('');
    }
  }, [selectedItem]);

  // Auto-lookup price when new size is selected
  useEffect(() => {
    if (!selectedItem || !newSize) return;
    const lookupPrice = async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('price')
        .eq('product_id', selectedItem.productId)
        .eq('size', newSize)
        .maybeSingle();

      if (data) {
        setNewUnitPrice(Number(data.price));
        setPriceLocked(true);
        setPriceWarning('');
      } else {
        setNewUnitPrice('');
        setPriceLocked(false);
        setPriceWarning('Preço não encontrado para este tamanho. Insira manualmente.');
      }
    };
    lookupPrice();
  }, [selectedItem, newSize]);

  useEffect(() => {
    if (!open) {
      setSelectedItemId('');
      setNewSize('');
      setNewUnitPrice('');
      setPriceLocked(false);
      setPriceWarning('');
      setNotes('');
      setRepasseStatus(null);
    }
  }, [open]);

  const adjustmentValue = useMemo(() => {
    if (!selectedItem || newUnitPrice === '') return 0;
    return (Number(newUnitPrice) - selectedItem.unitPrice) * selectedItem.quantity;
  }, [selectedItem, newUnitPrice]);

  const canSubmit = selectedItemId && newSize && newSize !== selectedItem?.size && newUnitPrice !== '';

  const handleConfirm = async () => {
    if (!selectedItem || !canSubmit) return;
    setSubmitting(true);
    try {
      const newPrice = Number(newUnitPrice);
      const newTotal = newPrice * selectedItem.quantity;

      // 1. Update order status
      await supabase.from('orders').update({ status: 'exchange_requested' }).eq('id', orderId);

      // 2. Update order item
      await supabase.from('order_items').update({
        size: newSize,
        unit_price: newPrice,
        total: newTotal,
      }).eq('id', selectedItem.id);

      // 3. Recalculate order total
      const { data: allItems } = await supabase
        .from('order_items')
        .select('total, supplier_total')
        .eq('order_id', orderId);

      if (allItems) {
        const totalAmount = allItems.reduce((s, i) => s + Number(i.total), 0);
        const supplierTotal = allItems.reduce((s, i) => s + Number(i.supplier_total), 0);
        await supabase.from('orders').update({
          total_amount: totalAmount,
          supplier_total_amount: supplierTotal,
          school_profit: totalAmount - supplierTotal,
        }).eq('id', orderId);
      }

      // 4. Insert adjustment record
      const { data: adjData } = await supabase.from('order_adjustments').insert({
        order_id: orderId,
        product_name: selectedItem.productName,
        old_size: selectedItem.size,
        new_size: newSize,
        old_unit_price: selectedItem.unitPrice,
        new_unit_price: newPrice,
        quantity: selectedItem.quantity,
        adjustment_value: adjustmentValue,
        notes: notes.trim() || null,
        created_by: userId,
      }).select('id').single();

      // 5. Handle repasse logic
      if (repasseStatus?.type === 'already_done' && repasseStatus.batchId && adjData) {
        // Create repasse_complementar
        await supabase.from('repasse_complementar' as any).insert({
          batch_id: repasseStatus.batchId,
          order_id: orderId,
          adjustment_id: adjData.id,
          adjustment_value: adjustmentValue,
          status: 'pending',
        });
        toast({ title: 'Troca solicitada. Um Repasse Complementar foi criado automaticamente.' });
      } else if (repasseStatus?.type === 'not_done') {
        toast({ title: 'Troca solicitada. A diferença será incluída no repasse do lote.' });
      } else {
        toast({ title: 'Troca solicitada. Ajuste registrado. Trate a diferença manualmente.' });
      }

      onOpenChange(false);
      onComplete();
    } catch (err) {
      console.error('Error creating exchange request:', err);
      toast({ title: 'Erro', description: 'Não foi possível registrar a troca.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const repasseBanner = useMemo(() => {
    if (!repasseStatus) return null;
    if (repasseStatus.type === 'not_done') {
      return (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 text-sm">
            🟡 Repasse ainda não realizado. A diferença será incluída automaticamente no valor do repasse do lote.
          </AlertDescription>
        </Alert>
      );
    }
    if (repasseStatus.type === 'already_done') {
      const dateStr = repasseStatus.repasseDate
        ? new Date(repasseStatus.repasseDate).toLocaleDateString('pt-BR')
        : '—';
      return (
        <Alert className="border-red-200 bg-red-50">
          <Info className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 text-sm">
            🔴 Repasse já realizado em {dateStr}. Um Repasse Complementar será criado automaticamente com o valor da diferença.
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert className="border-muted bg-muted/50">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground text-sm">
          ⚪ Pedido manual sem lote vinculado. O ajuste deverá ser tratado manualmente.
        </AlertDescription>
      </Alert>
    );
  }, [repasseStatus]);

  return (
    <Dialog open={open} onOpenChange={() => {/* prevent close on outside click */}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-600" />
            Solicitar Troca — {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {repasseBanner}

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.productName} — Tam. {item.size} (Qtd: {item.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tamanho Atual</Label>
                  <Input value={selectedItem.size} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Tamanho Novo</Label>
                  <Select value={newSize} onValueChange={setNewSize}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.filter(s => s !== selectedItem.size).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Preço Unitário Atual</Label>
                  <Input value={`R$ ${selectedItem.unitPrice.toFixed(2)}`} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Preço Unitário Novo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={newUnitPrice}
                    onChange={e => setNewUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={priceLocked}
                  />
                  {priceWarning && (
                    <p className="text-xs text-orange-600">{priceWarning}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input value={selectedItem.quantity} disabled />
              </div>

              <div className={`rounded-lg p-3 text-sm font-medium ${
                adjustmentValue > 0 ? 'bg-green-50 text-green-700 border border-green-200' :
                adjustmentValue < 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-muted text-muted-foreground border'
              }`}>
                {adjustmentValue > 0
                  ? `Fornecedor receberá R$ ${adjustmentValue.toFixed(2)} a mais`
                  : adjustmentValue < 0
                  ? `Fornecedor devolverá R$ ${Math.abs(adjustmentValue).toFixed(2)}`
                  : 'Sem diferença financeira'}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motivo da troca..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting}>
            {submitting ? 'Salvando...' : 'Confirmar Troca'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

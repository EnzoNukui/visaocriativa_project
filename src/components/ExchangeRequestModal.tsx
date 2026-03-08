import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

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

  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

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
      const newSupplierTotal = selectedItem.supplierPrice * selectedItem.quantity;

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
        // The item we just updated will have the new total already
        const totalAmount = allItems.reduce((s, i) => s + Number(i.total), 0);
        const supplierTotal = allItems.reduce((s, i) => s + Number(i.supplier_total), 0);
        await supabase.from('orders').update({
          total_amount: totalAmount,
          supplier_total_amount: supplierTotal,
          school_profit: totalAmount - supplierTotal,
        }).eq('id', orderId);
      }

      // 4. Insert adjustment record
      await supabase.from('order_adjustments').insert({
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
      });

      toast({ title: 'Troca solicitada. Ajuste financeiro registrado.' });
      onOpenChange(false);
      onComplete();
    } catch (err) {
      console.error('Error creating exchange request:', err);
      toast({ title: 'Erro', description: 'Não foi possível registrar a troca.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

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

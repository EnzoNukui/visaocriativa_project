import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { getProducts } from '@/data/products';
import { OrderItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ShoppingCart } from 'lucide-react';

const NewOrder = () => {
  const { user } = useAuth();
  const { addOrder } = useOrders();
  const navigate = useNavigate();
  const { toast } = useToast();
  const products = getProducts();

  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);

  // Temp state for adding item
  const [selProduct, setSelProduct] = useState('');
  const [selSize, setSelSize] = useState('');
  const [selQty, setSelQty] = useState(1);

  const selectedProduct = products.find(p => p.id === selProduct);
  const selectedVariant = selectedProduct?.variants.find(v => v.size === selSize);

  const addItem = () => {
    if (!selectedProduct || !selectedVariant || selQty < 1) return;
    const newItem: OrderItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: selSize,
      quantity: selQty,
      unitPrice: selectedVariant.price,
      total: selectedVariant.price * selQty,
    };
    setItems([...items, newItem]);
    setSelProduct('');
    setSelSize('');
    setSelQty(1);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: 'Erro', description: 'Adicione pelo menos um item ao pedido.', variant: 'destructive' });
      return;
    }
    addOrder({
      studentName,
      grade,
      responsibleName,
      phone,
      items,
      totalAmount,
      status: 'pending',
      createdBy: user?.id || '',
    });
    toast({ title: 'Pedido criado!', description: 'O pedido foi registrado com sucesso.' });
    navigate('/orders');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Novo Pedido</h2>
        <p className="text-sm text-muted-foreground">Preencha os dados do aluno e selecione os itens</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Aluno</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Aluno</Label>
              <Input value={studentName} onChange={e => setStudentName(e.target.value)} required placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Turma / Série</Label>
              <Input value={grade} onChange={e => setGrade(e.target.value)} required placeholder="Ex: 3º Ano A" />
            </div>
            <div className="space-y-2">
              <Label>Nome do Responsável</Label>
              <Input value={responsibleName} onChange={e => setResponsibleName(e.target.value)} required placeholder="Nome do responsável" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="(00) 00000-0000" />
            </div>
          </CardContent>
        </Card>

        {/* Add items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>Produto</Label>
                <Select value={selProduct} onValueChange={(v) => { setSelProduct(v); setSelSize(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label>Tamanho</Label>
                <Select value={selSize} onValueChange={setSelSize} disabled={!selectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tam." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.variants.map(v => (
                      <SelectItem key={v.size} value={v.size}>{v.size}</SelectItem>
                    ))}
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

            {selectedVariant && (
              <p className="text-xs text-muted-foreground">
                Preço unitário: R$ {selectedVariant.price.toFixed(2)} | Subtotal: R$ {(selectedVariant.price * selQty).toFixed(2)}
              </p>
            )}

            {items.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground">
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">Tam.</th>
                      <th className="p-2 text-right">Qtd.</th>
                      <th className="p-2 text-right">Unitário</th>
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
                        <td className="p-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
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
              <span className="font-semibold">Total do Pedido</span>
              <span className="text-xl font-bold text-primary">
                R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={items.length === 0}>
          <ShoppingCart className="w-4 h-4 mr-2" />
          Finalizar Pedido
        </Button>
      </form>
    </div>
  );
};

export default NewOrder;

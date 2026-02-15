import { useState } from 'react';
import { getProducts, saveProducts } from '@/data/products';
import { Product, ProductVariant } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, PlusCircle, Trash2, Plus, X, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const VariantForm = ({
  variants,
  onUpdate,
  onAdd,
  onRemove,
  showDifference = false,
}: {
  variants: ProductVariant[];
  onUpdate: (index: number, field: keyof ProductVariant, value: string | number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  showDifference?: boolean;
}) => (
  <div>
    <Label>Tamanhos e Preços</Label>
    <div className="space-y-2 mt-2">
      {variants.map((v, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input placeholder="Tam." value={v.size} onChange={e => onUpdate(i, 'size', e.target.value)} className="w-20" />
          <Input type="number" placeholder="Escola" min={0} value={v.price || ''} onChange={e => onUpdate(i, 'price', Number(e.target.value))} />
          <Input type="number" placeholder="Fornec." min={0} value={v.supplierPrice || ''} onChange={e => onUpdate(i, 'supplierPrice', Number(e.target.value))} />
          {showDifference && (
            <span className="text-xs font-medium text-green-600 whitespace-nowrap w-20 text-right">
              R$ {(v.price - v.supplierPrice).toFixed(2)}
            </span>
          )}
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onRemove(i)} disabled={variants.length <= 1}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
    <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onAdd}>
      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Tamanho
    </Button>
  </div>
);

const Products = () => {
  const [products, setProducts] = useState<Product[]>(getProducts);
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [newName, setNewName] = useState('');
  const [newVariants, setNewVariants] = useState<ProductVariant[]>([{ size: '', price: 0, supplierPrice: 0 }]);

  const [editName, setEditName] = useState('');
  const [editVariants, setEditVariants] = useState<ProductVariant[]>([]);

  const handleSave = () => {
    saveProducts(products);
    toast({ title: 'Salvo!', description: 'A tabela de preços foi atualizada.' });
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleAddProduct = () => {
    if (!newName.trim() || newVariants.some(v => !v.size.trim())) {
      toast({ title: 'Erro', description: 'Preencha o nome e todos os tamanhos.', variant: 'destructive' });
      return;
    }
    const newProduct: Product = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      variants: newVariants,
    };
    setProducts(prev => [...prev, newProduct]);
    setNewName('');
    setNewVariants([{ size: '', price: 0, supplierPrice: 0 }]);
    setShowAddDialog(false);
    toast({ title: 'Produto adicionado!', description: `${newProduct.name} foi adicionado ao catálogo.` });
  };

  const updateNewVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    setNewVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditVariants(product.variants.map(v => ({ ...v })));
  };

  const updateEditVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    setEditVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const handleSaveEdit = () => {
    if (!editingProduct || !editName.trim() || editVariants.some(v => !v.size.trim())) {
      toast({ title: 'Erro', description: 'Preencha o nome e todos os tamanhos.', variant: 'destructive' });
      return;
    }
    setProducts(prev =>
      prev.map(p => p.id === editingProduct.id ? { ...p, name: editName.trim(), variants: editVariants } : p)
    );
    setEditingProduct(null);
    toast({ title: 'Produto atualizado!', description: `${editName} foi atualizado.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Catálogo de Produtos</h2>
          <p className="text-sm text-muted-foreground">Gerencie produtos, preços e margens</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddDialog(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map(product => (
          <Card key={product.id}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{product.name}</CardTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(product)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                <span>Tam.</span>
                <span>Escola (R$)</span>
                <span>Fornec. (R$)</span>
                <span>Margem</span>
              </div>
              {product.variants.map(variant => (
                <div key={variant.size} className="grid grid-cols-4 gap-2 items-center mb-2">
                  <span className="text-sm font-medium bg-muted rounded px-2 py-1 text-center">{variant.size}</span>
                  <span className="text-sm text-center">R$ {variant.price.toFixed(2)}</span>
                  <span className="text-sm text-center">R$ {variant.supplierPrice.toFixed(2)}</span>
                  <span className="text-sm font-medium text-center text-green-600">
                    R$ {(variant.price - variant.supplierPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add product dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Produto</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Bermuda Masculina" />
            </div>
            <VariantForm
              variants={newVariants}
              onUpdate={updateNewVariant}
              onAdd={() => setNewVariants(prev => [...prev, { size: '', price: 0, supplierPrice: 0 }])}
              onRemove={(i) => { if (newVariants.length > 1) setNewVariants(prev => prev.filter((_, idx) => idx !== i)); }}
            />
            <Button onClick={handleAddProduct} className="w-full">Adicionar Produto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit product dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Produto</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <VariantForm
              variants={editVariants}
              onUpdate={updateEditVariant}
              onAdd={() => setEditVariants(prev => [...prev, { size: '', price: 0, supplierPrice: 0 }])}
              onRemove={(i) => { if (editVariants.length > 1) setEditVariants(prev => prev.filter((_, idx) => idx !== i)); }}
              showDifference
            />
            <Button onClick={handleSaveEdit} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

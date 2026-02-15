import { useState } from 'react';
import { getProducts, saveProducts } from '@/data/products';
import { Product } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

const Products = () => {
  const [products, setProducts] = useState<Product[]>(getProducts);
  const { toast } = useToast();

  const updatePrice = (productId: string, size: string, newPrice: number) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, variants: p.variants.map(v => v.size === size ? { ...v, price: newPrice } : v) }
          : p
      )
    );
  };

  const handleSave = () => {
    saveProducts(products);
    toast({ title: 'Salvo!', description: 'A tabela de preços foi atualizada.' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Catálogo de Produtos</h2>
          <p className="text-sm text-muted-foreground">Edite os preços dos uniformes</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Alterações
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map(product => (
          <Card key={product.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{product.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                <span>Tamanho</span>
                <span className="col-span-2">Preço (R$)</span>
              </div>
              {product.variants.map(variant => (
                <div key={variant.size} className="grid grid-cols-3 gap-2 items-center mb-2">
                  <span className="text-sm font-medium bg-muted rounded px-2 py-1 text-center">{variant.size}</span>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={variant.price}
                      onChange={e => updatePrice(product.id, variant.size, Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Products;

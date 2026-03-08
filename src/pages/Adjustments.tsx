import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle } from 'lucide-react';

interface Adjustment {
  id: string;
  order_id: string;
  product_name: string;
  old_size: string;
  new_size: string;
  old_unit_price: number;
  new_unit_price: number;
  quantity: number;
  adjustment_value: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  order_number?: string;
  student_name?: string;
}

export default function Adjustments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('order_adjustments')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const orderIds = [...new Set(data.map(a => a.order_id))];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, student_name')
        .in('id', orderIds);

      const orderMap = new Map((orders || []).map(o => [o.id, o]));
      setAdjustments(data.map(a => ({
        ...a,
        order_number: orderMap.get(a.order_id)?.order_number || '—',
        student_name: orderMap.get(a.order_id)?.student_name || '—',
      })));
    } else {
      setAdjustments([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  const handleResolve = async (id: string) => {
    if (!user) return;
    await supabase.from('order_adjustments').update({
      status: 'resolved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: 'Ajuste marcado como resolvido.' });
    fetchAdjustments();
  };

  const pending = adjustments.filter(a => a.status === 'pending');
  const resolved = adjustments.filter(a => a.status === 'resolved');

  const renderTable = (items: Adjustment[], showAction: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground bg-muted/50">
            <th className="p-3">Pedido</th>
            <th className="p-3">Aluno</th>
            <th className="p-3">Produto</th>
            <th className="p-3">Tam. Antigo</th>
            <th className="p-3">Tam. Novo</th>
            <th className="p-3">Qtd</th>
            <th className="p-3">Diferença</th>
            <th className="p-3">Data</th>
            <th className="p-3">Observação</th>
            {showAction && <th className="p-3">Ação</th>}
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 font-medium">{a.order_number}</td>
              <td className="p-3">{a.student_name}</td>
              <td className="p-3">{a.product_name}</td>
              <td className="p-3">{a.old_size}</td>
              <td className="p-3">{a.new_size}</td>
              <td className="p-3">{a.quantity}</td>
              <td className={`p-3 font-medium ${
                a.adjustment_value > 0 ? 'text-green-600' :
                a.adjustment_value < 0 ? 'text-red-600' :
                'text-muted-foreground'
              }`}>
                {a.adjustment_value > 0 ? '+' : ''}R$ {a.adjustment_value.toFixed(2)}
              </td>
              <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</td>
              <td className="p-3 text-muted-foreground max-w-[200px] truncate">{a.notes || '—'}</td>
              {showAction && (
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => handleResolve(a.id)}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Resolver
                  </Button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={showAction ? 10 : 9} className="p-8 text-center text-muted-foreground">Nenhum ajuste encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Ajustes de Troca</h2>
          <p className="text-muted-foreground">Gerencie os ajustes financeiros de trocas de tamanho</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAdjustments}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidos ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              {renderTable(pending, true)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="resolved">
          <Card>
            <CardContent className="p-0">
              {renderTable(resolved, false)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

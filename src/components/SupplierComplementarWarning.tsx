import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface ComplementarByBatch {
  batchNumber: string;
  totalValue: number;
}

export default function SupplierComplementarWarning() {
  const [items, setItems] = useState<ComplementarByBatch[]>([]);

  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from('repasse_complementar')
        .select('batch_id, adjustment_value')
        .eq('status', 'pending')
        .neq('adjustment_value', 0);

      if (!data || data.length === 0) { setItems([]); return; }

      // Group by batch_id
      const byBatch = new Map<string, number>();
      data.forEach(r => {
        byBatch.set(r.batch_id, (byBatch.get(r.batch_id) || 0) + Number(r.adjustment_value));
      });

      // Fetch batch numbers
      const batchIds = [...byBatch.keys()];
      const { data: batches } = await supabase
        .from('import_batches')
        .select('id, batch_number')
        .in('id', batchIds);

      const batchMap = new Map<string, string>();
      (batches || []).forEach(b => batchMap.set(b.id, b.batch_number));

      const result: ComplementarByBatch[] = [];
      byBatch.forEach((val, batchId) => {
        result.push({
          batchNumber: batchMap.get(batchId) || batchId,
          totalValue: val,
        });
      });

      setItems(result);
    };
    fetchPending();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Alert key={item.batchNumber} className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            ⚠️ Repasse complementar pendente — Lote {item.batchNumber}:{' '}
            <strong className={item.totalValue >= 0 ? 'text-green-700' : 'text-red-700'}>
              {item.totalValue >= 0 ? '+' : '-'} R$ {Math.abs(item.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {item.totalValue >= 0 ? ' a receber' : ' a devolver'}
            </strong>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

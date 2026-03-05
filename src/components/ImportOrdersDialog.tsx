import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportRow {
  studentName: string;
  productName: string;
  quantity: number;
  rowIndex: number;
}

interface ValidationError {
  row: number;
  reason: string;
}

interface ResolvedItem {
  studentName: string;
  normalizedName: string;
  productName: string;
  productId: string;
  size: string;
  quantity: number;
  unitPrice: number;
  supplierPrice: number;
  itemSaleTotal: number;
  itemSupplierTotal: number;
  itemProfit: number;
}

interface GroupedOrder {
  studentName: string;
  items: ResolvedItem[];
  totalSale: number;
  totalSupplier: number;
  totalProfit: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export default function ImportOrdersDialog({ open, onOpenChange, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [resultSummary, setResultSummary] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setErrors([]);
    setGroupedOrders([]);
    setTotalRows(0);
    setValidRows(0);
    setDuplicateWarning('');
    setResultSummary(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'csv') {
      toast({ title: 'Formato inválido', description: 'Formato de arquivo inválido. Envie um arquivo .xlsx ou .csv.', variant: 'destructive' });
      return;
    }

    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (json.length > 1000) {
        toast({ title: 'Limite excedido', description: 'O arquivo excede o máximo de 1000 linhas permitidas.', variant: 'destructive' });
        return;
      }

      setTotalRows(json.length);
      await processRows(json, file.name);
    } catch {
      toast({ title: 'Erro ao ler arquivo', description: 'Não foi possível processar o arquivo.', variant: 'destructive' });
    }
  };

  const findColumn = (row: Record<string, unknown>, candidates: string[]): string => {
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase().trim();
      if (candidates.some(c => lower.includes(c))) return key;
    }
    return '';
  };

  const processRows = async (json: Record<string, unknown>[], fName: string) => {
    // Fetch products
    const { data: products } = await supabase.from('products').select('id, name');
    const { data: variants } = await supabase.from('product_variants').select('*');
    if (!products || !variants) {
      toast({ title: 'Erro', description: 'Não foi possível carregar os produtos.', variant: 'destructive' });
      return;
    }

    const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]));

    const validationErrors: ValidationError[] = [];
    const resolvedItems: ResolvedItem[] = [];

    // Detect columns from first row
    const firstRow = json[0] || {};
    const studentCol = findColumn(firstRow, ['aluno', 'student', 'nome do aluno', 'nome']);
    const productCol = findColumn(firstRow, ['produto', 'product', 'nome do produto']);
    const qtyCol = findColumn(firstRow, ['quantidade', 'quantity', 'qtd', 'qty']);

    if (!studentCol || !productCol || !qtyCol) {
      toast({
        title: 'Colunas não encontradas',
        description: 'O arquivo deve conter colunas: Aluno (ou Student Name), Produto (ou Product Name), Quantidade (ou Quantity).',
        variant: 'destructive'
      });
      return;
    }

    json.forEach((row, idx) => {
      const rowNum = idx + 2; // +2 for header + 0-index
      const rawStudent = String(row[studentCol] || '').trim();
      const rawProduct = String(row[productCol] || '').trim();
      const rawQty = row[qtyCol];

      if (!rawStudent) { validationErrors.push({ row: rowNum, reason: 'Nome do aluno vazio' }); return; }
      if (!rawProduct) { validationErrors.push({ row: rowNum, reason: 'Nome do produto vazio' }); return; }

      const qty = Number(rawQty);
      if (!qty || qty <= 0 || !Number.isFinite(qty)) {
        validationErrors.push({ row: rowNum, reason: `Quantidade inválida: "${rawQty}"` });
        return;
      }

      const product = productMap.get(rawProduct.toLowerCase());
      if (!product) {
        validationErrors.push({ row: rowNum, reason: `Produto não encontrado: "${rawProduct}"` });
        return;
      }

      // Get first variant for pricing
      const productVariants = variants.filter(v => v.product_id === product.id);
      if (productVariants.length === 0) {
        validationErrors.push({ row: rowNum, reason: `Produto sem variantes/preço: "${rawProduct}"` });
        return;
      }

      const variant = productVariants[0];
      const unitPrice = Number(variant.price);
      const supplierPrice = Number(variant.supplier_price);

      const normalized = normalizeName(rawStudent);
      resolvedItems.push({
        studentName: rawStudent,
        normalizedName: normalized.toLowerCase(),
        productName: product.name,
        productId: product.id,
        size: variant.size,
        quantity: Math.floor(qty),
        unitPrice,
        supplierPrice,
        itemSaleTotal: unitPrice * Math.floor(qty),
        itemSupplierTotal: supplierPrice * Math.floor(qty),
        itemProfit: (unitPrice - supplierPrice) * Math.floor(qty),
      });
    });

    // Merge duplicates (same student + same product)
    const mergedMap = new Map<string, ResolvedItem>();
    resolvedItems.forEach(item => {
      const key = `${item.normalizedName}||${item.productId}`;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.itemSaleTotal = existing.unitPrice * existing.quantity;
        existing.itemSupplierTotal = existing.supplierPrice * existing.quantity;
        existing.itemProfit = (existing.unitPrice - existing.supplierPrice) * existing.quantity;
      } else {
        mergedMap.set(key, { ...item });
      }
    });

    // Group by student
    const studentGroups = new Map<string, ResolvedItem[]>();
    mergedMap.forEach(item => {
      const group = studentGroups.get(item.normalizedName) || [];
      group.push(item);
      studentGroups.set(item.normalizedName, group);
    });

    const grouped: GroupedOrder[] = [];
    studentGroups.forEach((items, _key) => {
      const totalSale = items.reduce((s, i) => s + i.itemSaleTotal, 0);
      const totalSupplier = items.reduce((s, i) => s + i.itemSupplierTotal, 0);
      grouped.push({
        studentName: items[0].studentName,
        items,
        totalSale,
        totalSupplier,
        totalProfit: totalSale - totalSupplier,
      });
    });

    // Duplicate detection
    const today = new Date().toISOString().split('T')[0];
    const { data: existingLogs } = await supabase
      .from('import_logs')
      .select('*')
      .eq('file_name', fName)
      .eq('total_rows', json.length)
      .gte('imported_at', today + 'T00:00:00')
      .lte('imported_at', today + 'T23:59:59');

    if (existingLogs && existingLogs.length > 0) {
      setDuplicateWarning(`⚠️ Este arquivo pode já ter sido importado hoje (${new Date().toLocaleDateString('pt-BR')}). Verifique antes de prosseguir.`);
    } else {
      setDuplicateWarning('');
    }

    setErrors(validationErrors);
    setGroupedOrders(grouped);
    setValidRows(resolvedItems.length);
    setStep('preview');
  };

  const handleConfirm = async () => {
    if (!user) return;
    setStep('processing');

    let successCount = 0;
    let failCount = 0;
    const failErrors: string[] = [];

    for (const group of groupedOrders) {
      try {
        // Create order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            student_name: normalizeName(group.studentName),
            grade: '-',
            responsible_name: '-',
            phone: '-',
            total_amount: group.totalSale,
            supplier_total_amount: group.totalSupplier,
            school_profit: group.totalProfit,
            repasse_amount: group.totalSupplier,
            status: 'awaiting_payment',
            created_by: user.id,
            order_number: 'TEMP',
          })
          .select()
          .single();

        if (orderError || !orderData) {
          failCount += group.items.reduce((s, i) => s + 1, 0);
          failErrors.push(`Erro ao criar pedido para ${group.studentName}: ${orderError?.message || 'desconhecido'}`);
          continue;
        }

        // Insert items
        const itemsToInsert = group.items.map(item => ({
          order_id: orderData.id,
          product_id: item.productId,
          product_name: item.productName,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          supplier_price: item.supplierPrice,
          total: item.itemSaleTotal,
          supplier_total: item.itemSupplierTotal,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsError) {
          failErrors.push(`Erro nos itens de ${group.studentName}: ${itemsError.message}`);
          failCount += group.items.length;
        } else {
          successCount += group.items.length;
        }
      } catch (err: any) {
        failCount += group.items.length;
        failErrors.push(`Erro inesperado para ${group.studentName}: ${err?.message || 'desconhecido'}`);
      }
    }

    // Log import
    await supabase.from('import_logs').insert({
      imported_by: user.id,
      file_name: fileName,
      total_rows: totalRows,
      total_success: successCount,
      total_errors: errors.length + failCount,
    });

    setResultSummary({ success: successCount, failed: errors.length + failCount, errors: failErrors });
    setStep('done');
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Pedidos via Planilha
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo .xlsx ou .csv com as colunas: <strong>Aluno</strong>, <strong>Produto</strong>, <strong>Quantidade</strong>.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Selecionar Arquivo
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{totalRows}</p>
                <p className="text-xs text-muted-foreground">Linhas no arquivo</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{validRows}</p>
                <p className="text-xs text-muted-foreground">Linhas válidas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{errors.length}</p>
                <p className="text-xs text-muted-foreground">Linhas com erro</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{groupedOrders.length}</p>
                <p className="text-xs text-muted-foreground">Pedidos a criar</p>
              </div>
            </div>

            {groupedOrders.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left text-muted-foreground">
                      <th className="p-2">Aluno</th>
                      <th className="p-2">Itens</th>
                      <th className="p-2 text-right">Venda</th>
                      <th className="p-2 text-right">Custo</th>
                      <th className="p-2 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedOrders.map((g, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{normalizeName(g.studentName)}</td>
                        <td className="p-2">{g.items.map(it => `${it.productName} x${it.quantity}`).join(', ')}</td>
                        <td className="p-2 text-right">R$ {g.totalSale.toFixed(2)}</td>
                        <td className="p-2 text-right">R$ {g.totalSupplier.toFixed(2)}</td>
                        <td className="p-2 text-right text-green-600">R$ {g.totalProfit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Erros encontrados:
                </p>
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">Linha {err.row}: {err.reason}</p>
                ))}
              </div>
            )}

            {duplicateWarning && (
              <div className="border border-yellow-300 rounded-lg p-3 bg-yellow-50 text-sm text-yellow-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/50 text-xs text-orange-700">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Certifique-se de que este arquivo não foi importado antes. Esta ação não pode ser desfeita.
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={groupedOrders.length === 0}>
                Confirmar Importação ({groupedOrders.length} pedidos)
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Importando pedidos...</p>
          </div>
        )}

        {step === 'done' && resultSummary && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="font-semibold text-lg">Importação Concluída</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
              <p><strong>{resultSummary.success}</strong> itens processados com sucesso.</p>
              {resultSummary.failed > 0 && (
                <p className="text-red-600"><strong>{resultSummary.failed}</strong> itens falharam — veja a lista de erros abaixo.</p>
              )}
            </div>
            {resultSummary.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 max-h-40 overflow-y-auto">
                {resultSummary.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

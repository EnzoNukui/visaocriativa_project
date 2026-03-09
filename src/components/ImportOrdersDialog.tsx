import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Constants ---

const ignoredProducts = ['regata', 'bermuda ciclista', 'blusa canguru'];

const productAliases: Record<string, string> = {
  'barmuda masculina': 'bermuda masculina',
  'mermuda masculina': 'bermuda masculina',
  'barmuda': 'bermuda masculina',
  'mermuda': 'bermuda masculina',
  'calça moetom': 'calça moletom',
  'blisa college': 'blusa college',
  'manga longa': 'camiseta manga longa',
  'camiseta manga longa': 'camiseta manga longa',
  'bermuda dry fit': 'bermuda dry fit',
  'camiseta dry fit': 'camiseta dry fit',
  'saia shorts': 'saia shorts',
  'calça bailarina': 'calça bailarina',
  'blusa moletom': 'blusa moletom',
  'blusa college': 'blusa college',
  'baby look': 'baby look',
  'bermuda masculina': 'bermuda masculina',
  'calça moletom': 'calça moletom',
  'camiseta': 'camiseta',
};

const skipKeywords = [
  'obs:', 'descontar', 'repasse', 'pago para', 'recebemos',
  'encomendado', 'falta r$', 'foi pedido', 'estava pendente',
  'pagamento', 'porém', 'deverá', 'conforme', 'desconto',
];

const validSizes = ['4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG', 'PP', 'EG'];

// --- Types ---

interface ValidationError {
  row: number;
  student: string;
  reason: string;
}

interface Warning {
  student: string;
  message: string;
}

interface ResolvedItem {
  studentKey: string;
  studentName: string;
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
  studentKey: string;
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

// --- Helpers ---

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeSize(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (/^\d+\.0$/.test(str)) return str.replace('.0', '');
  return str.toUpperCase().trim();
}

function isStudentHeader(cellA: string): string | null {
  const trimmed = cellA.trim();
  if (trimmed.toLowerCase().startsWith('pedido ')) {
    return trimmed.substring(7).trim();
  }
  return null;
}

function shouldSkipRow(colA: string): boolean {
  if (!colA) return true;
  if (colA.length > 60) return true;
  const lower = colA.toLowerCase().trim();
  if (lower === 'modelo') return true;
  return skipKeywords.some(kw => lower.includes(kw));
}

function getFallbackPrice(product: { id: string; name: string; variants: { size: string; price: number; supplier_price: number }[] }, size: string) {
  const exactVariant = product.variants.find(
    (v) => v.size.trim().toUpperCase() === size.trim().toUpperCase()
  );
  if (exactVariant) return { variant: exactVariant, fallback: false };

  const numericSize = parseInt(size);
  if (!isNaN(numericSize)) {
    const numericVariants = product.variants
      .filter((v) => !isNaN(parseInt(v.size)))
      .sort((a, b) =>
        Math.abs(parseInt(a.size) - numericSize) -
        Math.abs(parseInt(b.size) - numericSize)
      );
    if (numericVariants.length > 0) return { variant: numericVariants[0], fallback: true };
  }

  if (product.variants.length > 0) return { variant: product.variants[0], fallback: true };
  return null;
}

async function generateBatchNumber(): Promise<string> {
  const { data } = await supabase
    .from('import_batches')
    .select('batch_number')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = data?.batch_number
    ? parseInt(data.batch_number.replace('LOTE-', ''))
    : 0;

  return `LOTE-${String(lastNum + 1).padStart(4, '0')}`;
}

// --- Component ---

export default function ImportOrdersDialog({ open, onOpenChange, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalSheets, setTotalSheets] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [resultSummary, setResultSummary] = useState<{ success: number; failed: number; errors: string[]; batchNumber?: string } | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setErrors([]);
    setWarnings([]);
    setGroupedOrders([]);
    setTotalRows(0);
    setTotalSheets(0);
    setTotalSkipped(0);
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
      toast({ title: 'Formato inválido', description: 'Formato inválido. Use .xlsx ou .csv', variant: 'destructive' });
      return;
    }

    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      await processWorkbook(workbook, file.name);
    } catch {
      toast({ title: 'Erro ao ler arquivo', description: 'Não foi possível processar o arquivo.', variant: 'destructive' });
    }
  };

  const processWorkbook = async (workbook: XLSX.WorkBook, fName: string) => {
    const targetSheets = workbook.SheetNames.filter(name =>
      name.trim().toLowerCase().includes('por nome')
    );

    if (targetSheets.length === 0) {
      toast({ title: 'Erro', description: "Nenhuma aba 'Pedido por nome' encontrada no arquivo.", variant: 'destructive' });
      return;
    }

    const { data: products } = await supabase.from('products').select('id, name');
    const { data: variants } = await supabase.from('product_variants').select('*');
    if (!products || !variants) {
      toast({ title: 'Erro', description: 'Não foi possível carregar os produtos.', variant: 'destructive' });
      return;
    }

    const productsWithVariants = products.map(p => ({
      ...p,
      variants: variants.filter(v => v.product_id === p.id),
    }));

    const allErrors: ValidationError[] = [];
    const allWarnings: Warning[] = [];
    const allItems: ResolvedItem[] = [];
    let rowCount = 0;
    let skippedCount = 0;

    for (const sheetName of targetSheets) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

      let currentStudent: string | null = null;
      const sheetTag = sheetName.trim();

      for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
        const row = rawRows[rowIdx] as any[];
        if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
          currentStudent = null;
          continue;
        }

        const colA = row[0] != null ? String(row[0]).trim() : '';
        const colB = row[1];
        const colC = row[2];

        const studentName = isStudentHeader(colA);
        if (studentName) {
          currentStudent = normalizeName(studentName);
          continue;
        }

        if (!currentStudent) continue;

        if ((colB === null || colB === undefined || String(colB).trim() === '') &&
            (colC === null || colC === undefined || String(colC).trim() === '')) {
          continue;
        }

        rowCount++;

        if (shouldSkipRow(colA)) {
          skippedCount++;
          continue;
        }

        if (!colA) {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: 'Nome do produto vazio' });
          continue;
        }

        const size = normalizeSize(colB);

        const rawQty = colC;
        if (rawQty === null || rawQty === undefined || String(rawQty).trim() === '') {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: 'Quantidade inválida' });
          continue;
        }
        const parsedQty = Number(String(rawQty).trim());
        if (isNaN(parsedQty) || !isFinite(parsedQty)) {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: `Quantidade inválida: ${rawQty}` });
          continue;
        }
        if (parsedQty <= 0) {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: 'Quantidade deve ser maior que zero' });
          continue;
        }
        const qty = Math.floor(parsedQty);

        let productNameNorm = colA.toLowerCase().trim();

        if (ignoredProducts.includes(productNameNorm)) {
          skippedCount++;
          continue;
        }

        if (productAliases[productNameNorm]) {
          productNameNorm = productAliases[productNameNorm];
        }

        let matchedProduct = productsWithVariants.find(p => p.name.toLowerCase() === productNameNorm);

        if (!matchedProduct) {
          matchedProduct = productsWithVariants.find(p =>
            productNameNorm.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(productNameNorm)
          );
        }

        if (!matchedProduct) {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: `Produto não encontrado: ${colA}` });
          continue;
        }

        const result = getFallbackPrice(matchedProduct, size);
        if (!result) {
          allErrors.push({ row: rowIdx + 1, student: currentStudent, reason: `Produto sem variantes/preço: ${colA}` });
          continue;
        }

        if (result.fallback) {
          allWarnings.push({
            student: currentStudent,
            message: `⚠️ ${matchedProduct.name} tamanho ${size} não cadastrado — usando tamanho ${result.variant.size} como referência de preço. Verifique o valor após importar.`,
          });
        }

        const unitPrice = Number(result.variant.price);
        const supplierPrice = Number(result.variant.supplier_price);
        const studentKey = `${currentStudent.toLowerCase()}||${sheetTag}`;

        allItems.push({
          studentKey,
          studentName: currentStudent,
          productName: matchedProduct.name,
          productId: matchedProduct.id,
          size: size || result.variant.size,
          quantity: qty,
          unitPrice,
          supplierPrice,
          itemSaleTotal: unitPrice * qty,
          itemSupplierTotal: supplierPrice * qty,
          itemProfit: (unitPrice - supplierPrice) * qty,
        });
      }
    }

    if (rowCount > 1000) {
      toast({ title: 'Limite excedido', description: 'Arquivo excede o limite de 1000 linhas.', variant: 'destructive' });
      return;
    }

    const mergedMap = new Map<string, ResolvedItem>();
    allItems.forEach(item => {
      const key = `${item.studentKey}||${item.productId}||${item.size}`;
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

    const studentGroups = new Map<string, ResolvedItem[]>();
    mergedMap.forEach(item => {
      const group = studentGroups.get(item.studentKey) || [];
      group.push(item);
      studentGroups.set(item.studentKey, group);
    });

    const grouped: GroupedOrder[] = [];
    studentGroups.forEach((items) => {
      const totalSale = items.reduce((s, i) => s + i.itemSaleTotal, 0);
      const totalSupplier = items.reduce((s, i) => s + i.itemSupplierTotal, 0);
      grouped.push({
        studentName: items[0].studentName,
        studentKey: items[0].studentKey,
        items,
        totalSale,
        totalSupplier,
        totalProfit: totalSale - totalSupplier,
      });
    });

    const today = new Date().toISOString().split('T')[0];
    const { data: existingLogs } = await supabase
      .from('import_logs')
      .select('*')
      .eq('file_name', fName)
      .eq('total_rows', rowCount)
      .gte('imported_at', today + 'T00:00:00')
      .lte('imported_at', today + 'T23:59:59');

    if (existingLogs && existingLogs.length > 0) {
      setDuplicateWarning(`⚠️ Este arquivo pode já ter sido importado hoje (${new Date().toLocaleDateString('pt-BR')}). Verifique antes de prosseguir.`);
    } else {
      setDuplicateWarning('');
    }

    setErrors(allErrors);
    setWarnings(allWarnings);
    setGroupedOrders(grouped);
    setTotalRows(rowCount);
    setTotalSheets(targetSheets.length);
    setTotalSkipped(skippedCount);
    setStep('preview');
  };

  const handleConfirm = async () => {
    if (!user) return;
    setStep('processing');

    let successCount = 0;
    let failCount = 0;
    const failErrors: string[] = [];

    // STEP 1 – Generate batch number with retry
    let batchNumber = '';
    let batchId: string | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        batchNumber = await generateBatchNumber();
        const { data: batchData, error: batchError } = await supabase
          .from('import_batches')
          .insert({
            batch_number: batchNumber,
            imported_by: user.id,
            file_name: fileName,
            total_rows_read: totalRows,
            total_errors: errors.length,
            status: 'active',
          })
          .select('id')
          .single();

        if (batchError) {
          // Check for unique violation (23505)
          if (batchError.code === '23505') {
            continue; // retry
          }
          throw batchError;
        }
        batchId = batchData?.id ?? null;
        break;
      } catch (err: any) {
        if (attempt === 9) {
          toast({ title: 'Erro', description: 'Erro ao gerar número do lote. Tente novamente.', variant: 'destructive' });
          setStep('preview');
          return;
        }
      }
    }

    if (!batchId) {
      toast({ title: 'Erro', description: 'Erro ao gerar número do lote. Tente novamente.', variant: 'destructive' });
      setStep('preview');
      return;
    }

    // Also create legacy import_log
    let importLogId: string | null = null;
    try {
      const { data: logData } = await supabase.from('import_logs').insert({
        imported_by: user.id,
        file_name: fileName,
        total_rows: totalRows,
        total_success: 0,
        total_errors: 0,
      }).select('id').single();
      importLogId = logData?.id ?? null;
    } catch {
      console.error('Failed to create import log');
    }

    // Get default supplier id
    const { data: supplierIdResult } = await supabase.rpc('get_default_supplier_id');
    const supplierId = supplierIdResult as string | null;

    let totalItemsCount = 0;
    let totalSaleSum = 0;
    let totalSupplierSum = 0;
    let totalProfitSum = 0;

    for (const group of groupedOrders) {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            student_name: normalizeName(group.studentName),
            grade: '',
            responsible_name: '',
            phone: '',
            total_amount: group.totalSale,
            supplier_total_amount: group.totalSupplier,
            school_profit: group.totalProfit,
            repasse_amount: group.totalSupplier,
            status: 'awaiting_payment',
            created_by: user.id,
            import_batch_id: batchId,
            supplier_id: supplierId,
          } as any)
          .select();

        if (orderError || !orderData || orderData.length === 0) {
          failErrors.push(`Erro ao criar pedido para ${group.studentName}: ${orderError?.message || 'desconhecido'}`);
          continue;
        }

        const newOrder = orderData[0];

        const itemsToInsert = group.items.map(item => ({
          order_id: newOrder.id,
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
          failCount++;
        } else {
          successCount++;
          totalItemsCount += group.items.reduce((s, i) => s + i.quantity, 0);
          totalSaleSum += group.totalSale;
          totalSupplierSum += group.totalSupplier;
          totalProfitSum += group.totalProfit;
        }
      } catch (err: any) {
        failCount++;
        failErrors.push(`Erro inesperado para ${group.studentName}: ${err?.message || 'desconhecido'}`);
      }
    }

    // STEP 4 – Update batch totals
    if (batchId) {
      try {
        await supabase.from('import_batches').update({
          total_orders: successCount,
          total_items: totalItemsCount,
          total_sale_amount: totalSaleSum,
          total_supplier_amount: totalSupplierSum,
          total_profit: totalProfitSum,
          total_errors: errors.length + failCount,
          status: successCount === 0 ? 'failed' : 'active',
        }).eq('id', batchId);
      } catch {
        console.error('Failed to update batch totals');
      }
    }

    // Update legacy import log
    if (importLogId) {
      try {
        await supabase.from('import_logs').update({
          total_success: successCount,
          total_errors: errors.length + failCount,
        }).eq('id', importLogId);
      } catch {
        console.error('Failed to update import log');
      }
    }

    // STEP 5 – If no orders created, mark batch as failed
    if (successCount === 0 && batchId) {
      toast({ title: 'Erro', description: 'Lote criado mas nenhum pedido foi importado. Tente novamente.', variant: 'destructive' });
    }

    setResultSummary({ success: successCount, failed: failCount, errors: failErrors, batchNumber });
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
              Selecione um arquivo .xlsx ou .csv com abas contendo "por nome" no título.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Selecionar Arquivo</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{totalRows}</p>
                <p className="text-xs text-muted-foreground">Linhas lidas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{totalSheets}</p>
                <p className="text-xs text-muted-foreground">Abas processadas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{groupedOrders.length}</p>
                <p className="text-xs text-muted-foreground">Pedidos a criar</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{errors.length}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {totalSkipped > 0 && (
              <p className="text-xs text-muted-foreground">🔇 {totalSkipped} linhas ignoradas silenciosamente (produtos não aplicáveis ou linhas de observação).</p>
            )}

            {groupedOrders.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left text-muted-foreground sticky top-0">
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
                        <td className="p-2">{g.studentName}</td>
                        <td className="p-2">{g.items.map(it => `${it.productName} (${it.size}) x${it.quantity}`).join(', ')}</td>
                        <td className="p-2 text-right">R$ {g.totalSale.toFixed(2)}</td>
                        <td className="p-2 text-right">R$ {g.totalSupplier.toFixed(2)}</td>
                        <td className="p-2 text-right text-green-600">R$ {g.totalProfit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50/50 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-yellow-700 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Avisos ({warnings.length}):
                </p>
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700">{w.student}: {w.message}</p>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Erros encontrados:
                </p>
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">[{err.student}] Linha {err.row}: {err.reason}</p>
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
              Verifique se esta planilha já não foi importada antes. Esta ação não pode ser desfeita.
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
              {resultSummary.batchNumber && (
                <p>Lote <strong>{resultSummary.batchNumber}</strong> criado com <strong>{resultSummary.success}</strong> pedidos importados com sucesso.</p>
              )}
              {!resultSummary.batchNumber && (
                <p><strong>{resultSummary.success}</strong> pedidos criados com sucesso.</p>
              )}
              {resultSummary.failed > 0 && (
                <p className="text-red-600"><strong>{resultSummary.failed}</strong> alunos com erro — veja a lista abaixo.</p>
              )}
            </div>
            {resultSummary.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 max-h-40 overflow-y-auto">
                {resultSummary.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
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

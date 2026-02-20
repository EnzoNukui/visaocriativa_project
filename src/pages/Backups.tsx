import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Database, FileSpreadsheet, Clock, HardDrive, Loader2 } from 'lucide-react';

interface BackupEntry {
  id: string;
  backup_type: string;
  file_path: string;
  created_at: string;
  created_by: string | null;
  file_size: number | null;
  month_ref: string | null;
}

const Backups = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('backup_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleBackup = async () => {
    setGenerating('backup');
    try {
      const { data, error } = await supabase.functions.invoke('database-backup');
      if (error) throw error;
      toast({ title: 'Backup criado!', description: `Arquivo: ${data.file}` });
      await fetchHistory();
    } catch (err: any) {
      toast({ title: 'Erro ao criar backup', description: err.message, variant: 'destructive' });
    }
    setGenerating(null);
  };

  const handleReport = async () => {
    setGenerating('report');
    try {
      const { data, error } = await supabase.functions.invoke('financial-report', {
        body: null,
        headers: {},
      });
      
      // Use query params approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/financial-report?month=${selectedMonth}&year=${selectedYear}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed');
      }
      
      const result = await response.json();
      toast({ title: 'Relatório gerado!', description: `${result.orders} pedidos exportados.` });
      await fetchHistory();
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    }
    setGenerating(null);
  };

  const handleDownload = async (entry: BackupEntry) => {
    const bucket = entry.backup_type === 'full_backup' ? 'backups' : 'reports';
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(entry.file_path, 60);
    if (error || !data) {
      toast({ title: 'Erro ao baixar', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const months = [
    { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HardDrive className="w-5 h-5" /> Backups & Relatórios
        </h2>
        <p className="text-sm text-muted-foreground">Gerencie backups do banco de dados e relatórios financeiros.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Backup Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Backup Completo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Exporta todos os dados: usuários, produtos, pedidos e financeiro em formato JSON.
            </p>
            <Button onClick={handleBackup} disabled={generating === 'backup'} className="w-full">
              {generating === 'backup' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Gerar Backup Agora</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Backups automáticos diários • Retenção de 30 dias</p>
          </CardContent>
        </Card>

        {/* Report Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Relatório Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gera planilha Excel com detalhamento de pedidos, custos e lucros do mês.
            </p>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleReport} disabled={generating === 'report'} className="w-full">
              {generating === 'report' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4 mr-2" /> Gerar Relatório</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Relatórios automáticos no 1º dia de cada mês</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum backup ou relatório gerado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant={entry.backup_type === 'full_backup' ? 'default' : 'secondary'}>
                        {entry.backup_type === 'full_backup' ? 'Backup' : 'Relatório'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.file_path}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">{formatSize(entry.file_size)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.created_by === 'system' ? 'Automático' : 'Manual'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleDownload(entry)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Backups;

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Users as UsersIcon, Shield, ShieldCheck } from 'lucide-react';

interface UserWithRole {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'supplier' | null;
}

const Users = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role as 'admin' | 'supplier']));

    setUsers(
      (profiles || []).map(p => ({
        userId: p.user_id,
        name: p.name,
        email: p.email,
        role: roleMap.get(p.user_id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(userId);
    try {
      if (newRole === 'none') {
        await supabase.from('user_roles').delete().eq('user_id', userId);
      } else {
        const typedRole = newRole as 'admin' | 'supplier';
        const existing = users.find(u => u.userId === userId);
        if (existing?.role) {
          await supabase.from('user_roles').update({ role: typedRole }).eq('user_id', userId);
        } else {
          await supabase.from('user_roles').insert([{ user_id: userId, role: typedRole }]);
        }
      }
      await fetchUsers();
      toast({ title: 'Papel atualizado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao atualizar papel', variant: 'destructive' });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UsersIcon className="w-5 h-5" /> Gerenciar Usuários
        </h2>
        <p className="text-sm text-muted-foreground">Atribua papéis aos usuários cadastrados</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{users.length} usuário(s) cadastrado(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel Atual</TableHead>
                <TableHead className="w-48">Alterar Papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.role === 'admin' && (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="w-3 h-3" /> Administrador
                      </Badge>
                    )}
                    {user.role === 'supplier' && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="w-3 h-3" /> Fornecedor
                      </Badge>
                    )}
                    {!user.role && (
                      <Badge variant="outline">Sem papel</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role || 'none'}
                      onValueChange={(val) => handleRoleChange(user.userId, val)}
                      disabled={saving === user.userId}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem papel</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="supplier">Fornecedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;

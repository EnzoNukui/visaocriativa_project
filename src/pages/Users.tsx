import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Users as UsersIcon, Shield, ShieldCheck } from 'lucide-react';

interface UserWithRoles {
  userId: string;
  name: string;
  email: string;
  roles: ('admin' | 'supplier')[];
}

const Users = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
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

    const roleMap = new Map<string, ('admin' | 'supplier')[]>();
    (roles || []).forEach(r => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role as 'admin' | 'supplier');
      roleMap.set(r.user_id, existing);
    });

    setUsers(
      (profiles || []).map(p => ({
        userId: p.user_id,
        name: p.name,
        email: p.email,
        roles: roleMap.get(p.user_id) || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleRole = async (userId: string, role: 'admin' | 'supplier', checked: boolean) => {
    setSaving(userId);
    try {
      if (checked) {
        await supabase.from('user_roles').insert([{ user_id: userId, role }]);
      } else {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
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
        <p className="text-sm text-muted-foreground">Atribua papéis aos usuários cadastrados (múltiplos papéis permitidos)</p>
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
                <TableHead>Papéis Atuais</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Fornecedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.includes('admin') && (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </Badge>
                      )}
                      {user.roles.includes('supplier') && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" /> Fornecedor
                        </Badge>
                      )}
                      {user.roles.length === 0 && <Badge variant="outline">Sem papel</Badge>}
                      {user.roles.length === 2 && (
                        <Badge variant="outline" className="ml-1 text-[10px]">Master</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={user.roles.includes('admin')}
                      onCheckedChange={(checked) => handleToggleRole(user.userId, 'admin', !!checked)}
                      disabled={saving === user.userId}
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={user.roles.includes('supplier')}
                      onCheckedChange={(checked) => handleToggleRole(user.userId, 'supplier', !!checked)}
                      disabled={saving === user.userId}
                    />
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

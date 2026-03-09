import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users as UsersIcon, Shield, ShieldCheck, Clock, CheckCircle, XCircle, Ban } from 'lucide-react';

interface UserWithRoles {
  userId: string;
  name: string;
  email: string;
  roles: ('admin' | 'supplier')[];
  status: string;
  requestedRole: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  rejected: 'destructive',
  suspended: 'secondary',
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const isMaster = currentUser?.isMaster;

  useEffect(() => {
    if (currentUser && !currentUser.isMaster) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);


  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, status, requested_role, created_at, approved_by, approved_at')
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
        status: p.status || 'pending',
        requestedRole: p.requested_role,
        createdAt: p.created_at,
        approvedBy: p.approved_by,
        approvedAt: p.approved_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleRole = async (userId: string, role: 'admin' | 'supplier', checked: boolean) => {
    if (!isMaster) {
      toast({ title: 'Apenas o Master Admin pode alterar papéis', variant: 'destructive' });
      return;
    }
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

  const handleApprove = async (userId: string, requestedRole: string | null) => {
    if (!isMaster) return;
    setSaving(userId);
    try {
      // Update status
      await supabase.from('profiles').update({
        status: 'active',
        approved_by: currentUser!.id,
        approved_at: new Date().toISOString(),
      }).eq('user_id', userId);

      // Assign the requested role
      const role = (requestedRole === 'admin' ? 'admin' : 'supplier') as 'admin' | 'supplier';
      await supabase.from('user_roles').insert([{ user_id: userId, role }]);

      await fetchUsers();
      toast({ title: 'Usuário aprovado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao aprovar usuário', variant: 'destructive' });
    }
    setSaving(null);
  };

  const handleReject = async (userId: string) => {
    if (!isMaster) return;
    setSaving(userId);
    try {
      await supabase.from('profiles').update({
        status: 'rejected',
        approved_by: currentUser!.id,
        approved_at: new Date().toISOString(),
      }).eq('user_id', userId);
      await fetchUsers();
      toast({ title: 'Usuário rejeitado.' });
    } catch {
      toast({ title: 'Erro ao rejeitar usuário', variant: 'destructive' });
    }
    setSaving(null);
  };

  const handleSuspend = async (userId: string) => {
    if (!isMaster) return;
    setSaving(userId);
    try {
      await supabase.from('profiles').update({
        status: 'suspended',
        approved_by: currentUser!.id,
        approved_at: new Date().toISOString(),
      }).eq('user_id', userId);
      await fetchUsers();
      toast({ title: 'Usuário suspenso.' });
    } catch {
      toast({ title: 'Erro ao suspender', variant: 'destructive' });
    }
    setSaving(null);
  };

  const handleReactivate = async (userId: string) => {
    if (!isMaster) return;
    setSaving(userId);
    try {
      await supabase.from('profiles').update({
        status: 'active',
        approved_by: currentUser!.id,
        approved_at: new Date().toISOString(),
      }).eq('user_id', userId);
      await fetchUsers();
      toast({ title: 'Usuário reativado!' });
    } catch {
      toast({ title: 'Erro ao reativar', variant: 'destructive' });
    }
    setSaving(null);
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');
  const otherUsers = users.filter(u => u.status === 'rejected' || u.status === 'suspended');

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
        <p className="text-sm text-muted-foreground">
          {isMaster
            ? 'Aprove, rejeite e gerencie papéis dos usuários (acesso Master).'
            : 'Visualize os usuários cadastrados.'}
        </p>
      </div>

      <Tabs defaultValue={pendingUsers.length > 0 ? 'pending' : 'active'}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3.5 h-3.5" /> Pendentes
            {pendingUsers.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Ativos ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-1">
            <Ban className="w-3.5 h-3.5" /> Inativos ({otherUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* PENDING TAB */}
        <TabsContent value="pending">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aprovações Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum usuário pendente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Função Solicitada</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map(user => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.requestedRole === 'admin' ? 'Administrador' : 'Fornecedor'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {isMaster ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(user.userId, user.requestedRole)}
                                disabled={saving === user.userId}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(user.userId)}
                                disabled={saving === user.userId}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Apenas Master Admin</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVE TAB */}
        <TabsContent value="active">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{activeUsers.length} usuário(s) ativo(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papéis</TableHead>
                    {isMaster && <TableHead>Admin</TableHead>}
                    {isMaster && <TableHead>Fornecedor</TableHead>}
                    {isMaster && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map(user => (
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
                      {isMaster && (
                        <TableCell>
                          <Checkbox
                            checked={user.roles.includes('admin')}
                            onCheckedChange={(checked) => handleToggleRole(user.userId, 'admin', !!checked)}
                            disabled={saving === user.userId}
                          />
                        </TableCell>
                      )}
                      {isMaster && (
                        <TableCell>
                          <Checkbox
                            checked={user.roles.includes('supplier')}
                            onCheckedChange={(checked) => handleToggleRole(user.userId, 'supplier', !!checked)}
                            disabled={saving === user.userId}
                          />
                        </TableCell>
                      )}
                      {isMaster && (
                        <TableCell>
                          {user.userId !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuspend(user.userId)}
                              disabled={saving === user.userId}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" /> Suspender
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INACTIVE TAB */}
        <TabsContent value="other">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Usuários Inativos</CardTitle>
            </CardHeader>
            <CardContent>
              {otherUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum usuário inativo.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Status</TableHead>
                      {isMaster && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherUsers.map(user => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[user.status]}>
                            {statusLabels[user.status]}
                          </Badge>
                        </TableCell>
                        {isMaster && (
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleReactivate(user.userId)}
                              disabled={saving === user.userId}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reativar
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Users;

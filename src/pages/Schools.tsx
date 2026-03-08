import { useState } from 'react';
import { useSchools, School } from '@/hooks/useSchools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Pencil, School as SchoolIcon, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const emptyForm = { name: '', address: '', phone: '', email: '', contactName: '', notes: '' };

const Schools = () => {
  const { schools, loading, addSchool, updateSchool, deleteSchool } = useSchools();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (school: School) => {
    setEditing(school);
    setForm({
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      contactName: school.contactName,
      notes: school.notes,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Nome da escola é obrigatório.', variant: 'destructive' });
      return;
    }
    if (editing) {
      await updateSchool(editing.id, form);
      toast({ title: 'Escola atualizada!' });
    } else {
      await addSchool(form);
      toast({ title: 'Escola adicionada!' });
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    await deleteSchool(id);
    toast({ title: 'Escola removida!' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Escolas</h2>
          <p className="text-sm text-muted-foreground">{schools.length} escola(s) cadastrada(s)</p>
        </div>
        <Button variant="outline" onClick={openAdd}>
          <PlusCircle className="w-4 h-4 mr-2" />Nova Escola
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar escola..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma escola encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(school => (
            <Card key={school.id}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <SchoolIcon className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{school.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(school)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(school.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {school.contactName && <p><span className="text-muted-foreground">Contato:</span> {school.contactName}</p>}
                {school.phone && <p><span className="text-muted-foreground">Telefone:</span> {school.phone}</p>}
                {school.email && <p><span className="text-muted-foreground">Email:</span> {school.email}</p>}
                {school.address && <p><span className="text-muted-foreground">Endereço:</span> {school.address}</p>}
                {school.notes && <p className="text-muted-foreground text-xs mt-2">{school.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Escola' : 'Nova Escola'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Escola *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Colégio São José" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@escola.com" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais" rows={3} />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editing ? 'Salvar Alterações' : 'Adicionar Escola'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schools;

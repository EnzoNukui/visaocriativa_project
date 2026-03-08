import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  notes: string;
  createdAt: string;
}

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchSchools = useCallback(async () => {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching schools:', error);
      setLoading(false);
      return;
    }

    setSchools(
      (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        contactName: s.contact_name || '',
        notes: s.notes || '',
        createdAt: s.created_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchSchools();
  }, [session, fetchSchools]);

  const addSchool = useCallback(async (school: Omit<School, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('schools')
      .insert({
        name: school.name,
        address: school.address || null,
        phone: school.phone || null,
        email: school.email || null,
        contact_name: school.contactName || null,
        notes: school.notes || null,
      })
      .select();

    if (error) {
      console.error('Error adding school:', error);
      return null;
    }
    await fetchSchools();
    return data?.[0] || null;
  }, [fetchSchools]);

  const updateSchool = useCallback(async (id: string, school: Partial<Omit<School, 'id' | 'createdAt'>>) => {
    const updateData: any = {};
    if (school.name !== undefined) updateData.name = school.name;
    if (school.address !== undefined) updateData.address = school.address || null;
    if (school.phone !== undefined) updateData.phone = school.phone || null;
    if (school.email !== undefined) updateData.email = school.email || null;
    if (school.contactName !== undefined) updateData.contact_name = school.contactName || null;
    if (school.notes !== undefined) updateData.notes = school.notes || null;

    await supabase.from('schools').update(updateData).eq('id', id);
    await fetchSchools();
  }, [fetchSchools]);

  const deleteSchool = useCallback(async (id: string) => {
    await supabase.from('schools').delete().eq('id', id);
    await fetchSchools();
  }, [fetchSchools]);

  return { schools, loading, addSchool, updateSchool, deleteSchool, refresh: fetchSchools };
}

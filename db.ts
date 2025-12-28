import { supabase } from './supabaseClient';
import type { Delivery, Family, Member, UserProfile, Visit } from './types';

export type DbState = {
  families: Family[];
  members: Member[];
  visits: Visit[];
  deliveries: Delivery[];
};

function initialsFromName(name: string) {
  return (
    name
      .split(' ')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'V'
  );
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Usuário não autenticado.');
  return data.user.id;
}

export function getUserProfile(): UserProfile {
  return { name: 'Vicentino', conference: 'Conferência SSVP', initials: 'V' };
}

export async function saveUserProfile(profile: UserProfile) {
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: profile.name,
      conference: profile.conference,
      initials: profile.initials || initialsFromName(profile.name),
    },
  });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUpWithPassword(params: { email: string; password: string; fullName?: string; conference?: string }) {
  const { email, password, fullName, conference } = params;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || 'Vicentino',
        conference: conference || 'Conferência SSVP',
      },
    },
  });
  if (error) throw error;
  return data.session;
}

export async function fetchDb(): Promise<DbState> {
  const userId = await requireUserId();

  const [familiesRes, membersRes, visitsRes, deliveriesRes] = await Promise.all([
    supabase.from('families').select('*').eq('user_id', userId).order('ficha', { ascending: true }),
    supabase.from('members').select('*').eq('user_id', userId),
    supabase.from('visits').select('*').eq('user_id', userId).order('data', { ascending: false }),
    supabase.from('deliveries').select('*').eq('user_id', userId).order('data', { ascending: false }),
  ]);

  if (familiesRes.error) throw familiesRes.error;
  if (membersRes.error) throw membersRes.error;
  if (visitsRes.error) throw visitsRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;

  // Normalizar valores null para string vazia em campos de texto opcionais
  const normalizeMembers = (members: any[]): Member[] => {
    return members.map(m => {
      // O campo no banco está como "familyId" (com aspas), então pode vir assim do Supabase
      const familyId = m.familyId || m["familyId"] || m["FamilyId"] || m.FamilyId || '';
      
      return {
      ...m,
        // Garantir que familyId está sempre como camelCase
        familyId: String(familyId).trim(),
      ocupacao: m.ocupacao ?? '',
      observacaoOcupacao: m.observacaoOcupacao ?? '',
      renda: m.renda ?? '',
      comorbidade: m.comorbidade ?? '',
      escolaridade: m.escolaridade ?? '',
      trabalho: m.trabalho ?? '',
      };
    });
  };

  return {
    families: (familiesRes.data ?? []) as Family[],
    members: normalizeMembers(membersRes.data ?? []),
    visits: (visitsRes.data ?? []) as Visit[],
    deliveries: (deliveriesRes.data ?? []) as Delivery[],
  };
}

export async function upsertFamilyWithMembers(family: Family, members: Member[]) {
  const userId = await requireUserId();

  const familyRow = { ...family, user_id: userId };
  const { error: famErr } = await supabase.from('families').upsert(familyRow);
  if (famErr) throw famErr;

  // Estratégia simples e consistente: substituir todos os membros daquela família.
  const { error: delErr } = await supabase.from('members').delete().eq('user_id', userId).eq('familyId', family.id);
  if (delErr) throw delErr;

  if (members.length > 0) {
    const rows = members.map((m) => ({ ...m, user_id: userId }));
    const { error: insErr } = await supabase.from('members').insert(rows);
    if (insErr) throw insErr;
  }
}

export async function deleteFamily(familyId: string) {
  const userId = await requireUserId();
  // Deletar membros primeiro (mesmo com cascade, é mais seguro fazer explicitamente)
  const { error: memErr } = await supabase.from('members').delete().eq('user_id', userId).eq('familyId', familyId);
  if (memErr) throw memErr;
  // Deletar a família
  const { error } = await supabase.from('families').delete().eq('user_id', userId).eq('id', familyId);
  if (error) throw error;
}

export async function addMemberToFamily(params: { family: Family; member: Member }) {
  const userId = await requireUserId();

  const { family, member } = params;
  const nextFamily: Family = {
    ...family,
    moradoresCount: Math.max(1, (family.moradoresCount || 1) + 1),
    filhosCount: Math.max(0, (family.filhosCount || 0) + (member.parentesco === 'Filho(a)' ? 1 : 0)),
    filhos: (family.filhosCount || 0) + (member.parentesco === 'Filho(a)' ? 1 : 0) > 0,
  };

  const { error: famErr } = await supabase.from('families').update({ ...nextFamily, user_id: userId }).eq('user_id', userId).eq('id', family.id);
  if (famErr) throw famErr;

  const { error: memErr } = await supabase.from('members').insert({ ...member, user_id: userId });
  if (memErr) throw memErr;
}

export async function removeMemberFromFamily(params: { family: Family; member: Member }) {
  const userId = await requireUserId();
  const { family, member } = params;

  const nextFamily: Family = {
    ...family,
    moradoresCount: Math.max(1, (family.moradoresCount || 1) - 1),
    filhosCount: Math.max(0, (family.filhosCount || 0) - (member.parentesco === 'Filho(a)' ? 1 : 0)),
    filhos: Math.max(0, (family.filhosCount || 0) - (member.parentesco === 'Filho(a)' ? 1 : 0)) > 0,
  };

  const { error: memErr } = await supabase.from('members').delete().eq('user_id', userId).eq('id', member.id);
  if (memErr) throw memErr;

  const { error: famErr } = await supabase.from('families').update({ ...nextFamily, user_id: userId }).eq('user_id', userId).eq('id', family.id);
  if (famErr) throw famErr;
}

export async function updateFamily(family: Family) {
  const userId = await requireUserId();
  const { error } = await supabase.from('families').update({ ...family, user_id: userId }).eq('user_id', userId).eq('id', family.id);
  if (error) throw error;
}

export async function addVisit(visit: Visit) {
  const userId = await requireUserId();
  const { error } = await supabase.from('visits').insert({ ...visit, user_id: userId });
  if (error) throw error;
}

export async function updateVisit(visit: Visit) {
  const userId = await requireUserId();
  const { error } = await supabase.from('visits').update({ ...visit, user_id: userId }).eq('user_id', userId).eq('id', visit.id);
  if (error) throw error;
}

export async function deleteVisit(visitId: string) {
  const userId = await requireUserId();
  const { error } = await supabase.from('visits').delete().eq('user_id', userId).eq('id', visitId);
  if (error) throw error;
}

export async function addDelivery(delivery: Delivery) {
  const userId = await requireUserId();
  const { error } = await supabase.from('deliveries').insert({ ...delivery, user_id: userId });
  if (error) throw error;
}

export async function deleteDeliveryByFamilyAndDate(familyId: string, date: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('user_id', userId)
    .eq('familyId', familyId)
    .eq('data', date);
  if (error) throw error;
}



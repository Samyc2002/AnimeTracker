import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '@/lib/supabase';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

let resolvedEmailSets: { excluded: Set<string>; admin: Set<string> } | null = null;

function parseEmailList(envVar: string): string[] {
  return (process.env[envVar] || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getEmailSets(supabase?: ReturnType<typeof getServiceSupabase>) {
  if (resolvedEmailSets) return resolvedEmailSets;

  const supa = supabase ?? getServiceSupabase();
  const testEmails = parseEmailList('TEST_ACCOUNTS');
  const adminEmails = parseEmailList('ADMIN_EMAILS');
  const allEmails = new Set([...testEmails, ...adminEmails]);

  if (allEmails.size === 0) {
    resolvedEmailSets = { excluded: new Set(), admin: new Set() };
    return resolvedEmailSets;
  }

  const { data } = await supa.auth.admin.listUsers({ perPage: 1000 });
  const users = data?.users || [];

  const excluded = new Set(
    users.filter(u => u.email && testEmails.includes(u.email.toLowerCase())).map(u => u.id)
  );
  const admin = new Set(
    users.filter(u => u.email && adminEmails.includes(u.email.toLowerCase())).map(u => u.id)
  );

  resolvedEmailSets = { excluded, admin };
  return resolvedEmailSets;
}

export async function getCallerUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookieList) => { cookieList.forEach(c => response.cookies.set(c.name, c.value, c.options)); },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCallerUserIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const { admin } = await getEmailSets();
  if (admin.size === 0) return false;
  const callerId = await getCallerUserIdFromCookies();
  if (!callerId) return false;
  return admin.has(callerId);
}

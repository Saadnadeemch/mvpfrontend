import { Session } from '@supabase/supabase-js';

interface TokenMetadata {
  is_paid?: boolean;
  plan_type?: 'basic' | 'advanced';
  membership_type?: 'monthly' | 'yearly';
  trial_end?: string;
}

/**
 * Decodes JWT once and returns user_metadata.
 */
function decodeTokenMetadata(session: Session | null): TokenMetadata | null {
  if (!session) return null;

  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    return payload.user_metadata ?? null;
  } catch {
    return null;
  }
}

export function getIsPaid(session: Session | null): boolean {
  const data = decodeTokenMetadata(session);
  return data?.is_paid ?? false;
}

export function getPlanType(session: Session | null): 'basic' | 'advanced' | null {
  const data = decodeTokenMetadata(session);
  return data?.plan_type ?? null;
}

export function getMembershipType(session: Session | null): 'monthly' | 'yearly' | null {
  const data = decodeTokenMetadata(session);
  return data?.membership_type ?? null;
}

export function getIsTrialActive(session: Session | null): boolean {
  const data = decodeTokenMetadata(session);
  if (!data?.trial_end) return false;
  return new Date(data.trial_end) > new Date();
}
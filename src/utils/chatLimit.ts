import { supabase } from '@/lib/supabase';

const FREE_CHAT_LIMIT = 5;

/**
 * Returns true when the user is allowed to start a NEW chat
 * (either because they're subscribed, or because they haven't reached the 5-chat limit yet).
 *
 * A "chat" counts only when the free user has SENT at least one message to that partner.
 * Receiving a message without replying does NOT count.
 */
export async function canStartNewChat(
  userId: string,
  targetPartnerId?: string
): Promise<boolean> {
  // --- 1. Subscription check (profiles table) ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_end')
    .eq('id', userId)
    .single();

  const isPro =
    profile?.subscription_plan &&
    profile.subscription_plan !== 'free' &&
    profile.subscription_end &&
    new Date(profile.subscription_end) > new Date();

  if (isPro) return true;

  // --- 2. Count distinct partners this user has SENT at least one message to ---
  const { data: sent } = await supabase
    .from('messages')
    .select('receiver_id')
    .eq('sender_id', userId);

  const sentToPartners = new Set((sent || []).map(m => m.receiver_id));

  // If a specific partner is provided, allow if they already have an existing chat with them
  if (targetPartnerId && sentToPartners.has(targetPartnerId)) return true;

  return sentToPartners.size < FREE_CHAT_LIMIT;
}

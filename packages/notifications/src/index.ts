import 'server-only';
import { createServiceClient } from '@bayele/database/server';

/** The ONLY notification types. Centralized so copy + routing stay consistent (tech-stack §5). */
export type NotificationType =
  | 'profile_approved'
  | 'profile_rejected'
  | 'campaign_invite'
  | 'proof_submitted'
  | 'proof_verified'
  | 'proof_rejected'
  | 'escrow_paid_out'
  | 'retainer_funded';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Single write path for notifications (SKILL.md §7). Never insert into
 * `notifications` from a component. Realtime pushes the row to the bell.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) throw new Error(`notify() failed: ${error.message}`);
}

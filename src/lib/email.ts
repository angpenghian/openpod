import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'OpenPod <notifications@openpod.work>';

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Check user's notification preferences before sending.
 * Returns true if the user wants this type of notification.
 */
async function checkPreference(
  userId: string,
  type: 'email_on_application' | 'email_on_completion' | 'email_on_approval'
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('notification_preferences')
    .select('email_on_application, email_on_completion, email_on_approval')
    .eq('user_id', userId)
    .maybeSingle();

  // Default to true if no preferences set
  if (!data) return true;
  return (data as Record<string, boolean>)[type] ?? true;
}

/**
 * Get user's email from auth.users (via admin client).
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

/**
 * Send email when an agent applies to a project position.
 * Notifies the project owner.
 */
export async function notifyApplicationReceived(
  projectOwnerId: string,
  agentName: string,
  positionTitle: string,
  projectTitle: string,
  projectId: string,
) {
  if (!resend) return;
  if (!(await checkPreference(projectOwnerId, 'email_on_application'))) return;

  const email = await getUserEmail(projectOwnerId);
  if (!email) return;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `New application: ${agentName} applied to ${positionTitle}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="color: #6366f1;">New Application</h2>
        <p><strong>${escapeHtml(agentName)}</strong> applied to the <strong>${escapeHtml(positionTitle)}</strong> position on your project <strong>${escapeHtml(projectTitle)}</strong>.</p>
        <p><a href="https://openpod.work/projects/${projectId}" style="color: #6366f1;">Review applications &rarr;</a></p>
        <hr style="border: none; border-top: 1px solid #1e2030; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">You're receiving this because you own this project on OpenPod. <a href="https://openpod.work/projects/${projectId}/settings" style="color: #6b7280;">Manage notifications</a></p>
      </div>
    `,
  }).catch(() => {});
}

/**
 * Send email when a ticket is completed (moved to done/in_review).
 * Notifies the project owner.
 */
export async function notifyTicketCompleted(
  projectOwnerId: string,
  ticketTitle: string,
  ticketNumber: number,
  agentName: string,
  projectTitle: string,
  projectId: string,
) {
  if (!resend) return;
  if (!(await checkPreference(projectOwnerId, 'email_on_completion'))) return;

  const email = await getUserEmail(projectOwnerId);
  if (!email) return;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Ticket #${ticketNumber} ready for review: ${ticketTitle}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="color: #14b8a6;">Ticket Ready for Review</h2>
        <p><strong>${escapeHtml(agentName)}</strong> completed ticket <strong>#${ticketNumber}: ${escapeHtml(ticketTitle)}</strong> on <strong>${escapeHtml(projectTitle)}</strong>.</p>
        <p>Review the deliverables and approve or request revisions.</p>
        <p><a href="https://openpod.work/projects/${projectId}" style="color: #6366f1;">Review ticket &rarr;</a></p>
        <hr style="border: none; border-top: 1px solid #1e2030; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">You're receiving this because you own this project on OpenPod. <a href="https://openpod.work/projects/${projectId}/settings" style="color: #6b7280;">Manage notifications</a></p>
      </div>
    `,
  }).catch(() => {});
}

/**
 * Send email when a deliverable is approved.
 * Notifies the agent operator (via the agent key owner's email).
 */
export async function notifyDeliverableApproved(
  agentOwnerId: string,
  agentName: string,
  ticketTitle: string,
  ticketNumber: number,
  payoutCents: number,
  projectTitle: string,
) {
  if (!resend) return;
  if (!(await checkPreference(agentOwnerId, 'email_on_approval'))) return;

  const email = await getUserEmail(agentOwnerId);
  if (!email) return;

  const payoutStr = `$${(payoutCents / 100).toFixed(2)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Deliverable approved: ${ticketTitle} (${payoutStr})`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="color: #22c55e;">Deliverable Approved</h2>
        <p>Your agent <strong>${escapeHtml(agentName)}</strong>'s work on <strong>#${ticketNumber}: ${escapeHtml(ticketTitle)}</strong> in <strong>${escapeHtml(projectTitle)}</strong> has been approved.</p>
        <p style="font-size: 24px; font-weight: bold; color: #22c55e;">${payoutStr}</p>
        <p style="color: #6b7280; font-size: 12px;">If the project is funded via Stripe, this payout settles automatically to your connected account. Otherwise, it's recorded as a ledger credit.</p>
        <hr style="border: none; border-top: 1px solid #1e2030; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">You're receiving this because you operate an agent on OpenPod. <a href="https://openpod.work/profile" style="color: #6b7280;">Manage notifications</a></p>
      </div>
    `,
  }).catch(() => {});
}

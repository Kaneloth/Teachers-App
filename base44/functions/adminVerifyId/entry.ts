import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { target_user_id, action } = await req.json();
    // action: 'verify' | 'reject'

    if (!target_user_id || !action) {
      return Response.json({ error: 'target_user_id and action are required' }, { status: 400 });
    }

    const status = action === 'verify' ? 'verified' : 'failed';
    const verified = action === 'verify';

    await base44.asServiceRole.entities.User.update(target_user_id, {
      id_verified: verified,
      id_verification_status: status,
    });

    return Response.json({ success: true, status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
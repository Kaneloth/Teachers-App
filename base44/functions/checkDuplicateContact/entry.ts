import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, email } = await req.json();

    if (phone) {
      const normalised = phone.trim();
      const existing = await base44.asServiceRole.entities.User.filter({ phone: normalised });
      const duplicates = existing.filter(u => u.id !== user.id);
      if (duplicates.length > 0) {
        return Response.json({ available: false, field: 'phone', message: 'This phone number is already linked to another account.' });
      }
    }

    if (email) {
      const normalised = email.trim().toLowerCase();
      const existing = await base44.asServiceRole.entities.User.filter({ email: normalised });
      const duplicates = existing.filter(u => u.id !== user.id);
      if (duplicates.length > 0) {
        return Response.json({ available: false, field: 'email', message: 'This email address is already linked to another account.' });
      }
    }

    return Response.json({ available: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
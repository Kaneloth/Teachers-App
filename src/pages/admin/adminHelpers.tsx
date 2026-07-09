const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
];

export function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function statusBadge(status: string, emailConfirmed = true, profileType?: string | null) {
  if (!emailConfirmed) return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">pending</span>;
  if (!profileType) return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">incomplete</span>;
  const s = (status || 'active').toLowerCase();
  if (s === 'suspended') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">suspended</span>;
  if (s === 'banned') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">banned</span>;
  return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">active</span>;
}

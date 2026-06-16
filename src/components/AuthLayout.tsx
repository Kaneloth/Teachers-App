import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex flex-col items-center justify-center px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <img src="/icons/icon-512.png" alt="Crosssa" className="w-9 h-9 rounded-xl" />
        <span className="text-2xl font-bold text-foreground tracking-tight">Crosssa</span>
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}

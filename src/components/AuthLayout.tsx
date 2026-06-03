import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] flex flex-col items-center justify-center px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <GraduationCap className="w-8 h-8 text-primary" />
        <span className="text-2xl font-bold text-foreground tracking-tight">Crosssa</span>
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}

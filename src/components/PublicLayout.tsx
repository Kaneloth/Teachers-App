// src/components/PublicLayout.tsx
import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
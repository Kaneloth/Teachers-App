import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <AppHeader />
      </div>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
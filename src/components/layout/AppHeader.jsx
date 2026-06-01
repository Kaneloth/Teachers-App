import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, GraduationCap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';

export default function AppHeader() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-7 h-7 text-primary" />
        <span className="text-xl font-bold text-foreground tracking-tight">EduCross</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
            <User className="w-4 h-4 text-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="w-4 h-4 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="w-4 h-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => base44.auth.logout()}
          >
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
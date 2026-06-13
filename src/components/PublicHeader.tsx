// src/components/PublicHeader.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublicHeader() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-foreground">Crosssa</span>
          </div>
        </div>
        {/* Optional: you can add a "Sign In" button here if needed */}
        {/* <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button> */}
      </div>
    </div>
  );
}
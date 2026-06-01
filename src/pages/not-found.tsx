import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <GraduationCap className="w-12 h-12 text-primary mb-4" />
      <h1 className="text-4xl font-black text-foreground mb-2">404</h1>
      <p className="text-lg font-semibold text-foreground mb-1">Page not found</p>
      <p className="text-sm text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
      <Link to="/"><Button className="rounded-xl">Go Home</Button></Link>
    </div>
  );
}

import { GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <GraduationCap className="w-9 h-9 text-primary" />
            <span className="text-2xl font-bold text-foreground tracking-tight">EduCross</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}

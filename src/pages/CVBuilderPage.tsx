import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import CVPreview from '@/components/cv/CVPreview';

export default function CVBuilderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cvRef = useRef<HTMLDivElement>(null);
  const { canBuildCV, cvBuildsRemaining, isSubscribed } = useSubscription();
  const [downloading, setDownloading] = useState(false);

  const { data: educator } = useQuery({
    queryKey: ['my-educator-cv'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('educators').select('*').eq('user_id', user.id).single();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['my-profile-cv'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
  });

  const downloadCV = async () => {
    if (!canBuildCV) {
      toast.error('You have used your CV builds for this month. Upgrade to Pro for unlimited builds.');
      return;
    }

    setDownloading(true);
    try {
      const { exportElementAsPDF } = await import('@/utils/cvExport');
      const blob = await exportElementAsPDF(cvRef.current, `${educator?.full_name || 'CV'}_EduCross.pdf`);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${educator?.full_name || 'CV'}_EduCross.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const { data: p } = await supabase.from('profiles').select('cv_builds_this_month, cv_builds_month_key').eq('id', user.id).single();
        const isNewMonth = p?.cv_builds_month_key !== monthKey;
        await supabase.from('profiles').update({
          cv_builds_this_month: isNewMonth ? 1 : ((p?.cv_builds_this_month || 0) + 1),
          cv_builds_month_key: monthKey,
        }).eq('id', user.id);
        qc.invalidateQueries({ queryKey: ['current-user-sub'] });
      }

      toast.success('CV downloaded!');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate('/home')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">CV Builder</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Generate a professional educator CV from your profile.
        {!isSubscribed && (
          <span className="ml-1 text-accent font-medium">
            {cvBuildsRemaining === 0 ? 'No builds left this month.' : `${cvBuildsRemaining} free build${cvBuildsRemaining !== 1 ? 's' : ''} remaining.`}
          </span>
        )}
      </p>

      {!isSubscribed && !canBuildCV ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center mb-5">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-accent" />
          <h2 className="font-semibold text-foreground mb-2">Upgrade to Pro</h2>
          <p className="text-sm text-muted-foreground mb-4">You've used your free CV build this month. Upgrade to Pro for unlimited CV downloads.</p>
          <Button onClick={() => navigate('/settings', { state: { tab: 'subscription' } })} className="rounded-xl px-8 font-semibold">View Plans</Button>
        </div>
      ) : null}

      <div className="mb-4">
        <Button onClick={downloadCV} disabled={downloading || !canBuildCV} className="w-full h-12 rounded-xl font-semibold">
          {downloading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating PDF...</> : <><Download className="w-4 h-4 mr-2" />Download PDF</>}
        </Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Preview</span>
          {!isSubscribed && (
            <span className="text-xs text-muted-foreground">Free plan includes watermark</span>
          )}
        </div>
        <div ref={cvRef} className="relative">
          {educator ? <CVPreview educator={educator} watermark={!isSubscribed} /> : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading your profile…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

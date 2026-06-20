/**
 * SubscriptionModal — repurposed as a "Buy Credits" upsell modal.
 *
 * Previously showed subscription plans. Now explains the credits-only
 * funding model and directs users to the credits page to purchase.
 * Shown when users try to access R79+ gated features (advanced search,
 * matches page, guide downloads).
 *
 * Kept as SubscriptionModal so all existing import/usage sites work
 * without renaming.
 */

import { createPortal } from 'react-dom';
import { X, Zap, Search, Users, BookOpen, ShieldCheck, MessageCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PACKAGES = [
  { id: 'single',   label: 'Single CV',            price: 19,  credits: 10,  note: '1 CV + 1 letter',      highlight: false },
  { id: 'standard', label: 'Standard Pack',         price: 49,  credits: 30,  note: '3 CVs + 3 letters',    highlight: false },
  { id: 'pro_pack', label: 'Pro Pack',               price: 79,  credits: 60,  note: '+ Unlocks advanced features', highlight: true  },
  { id: 'business', label: 'Business Pack',          price: 199, credits: 200, note: 'Best value',           highlight: false },
];

const UNLOCKS = [
  { icon: Users,         label: 'Transfer Matches',     desc: 'See your strongest educator matches ranked by compatibility' },
  { icon: Search,        label: 'Advanced Search',      desc: 'Radius search, distance filters & more' },
  { icon: BookOpen,      label: 'Transfer Guides',      desc: 'Download all step-by-step transfer templates' },
  { icon: ShieldCheck,   label: 'ID Verification',      desc: 'Verify your identity & earn a verified badge' },
];

const COSTS = [
  { action: 'CV download',       cost: '9 credits' },
  { action: 'Cover letter',      cost: '2 credits' },
  { action: 'Start new chat',    cost: '5 credits' },
  { action: 'Guide download',    cost: '3 credits' },
  { action: 'ID verification',   cost: '30 credits' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleBuyCredits = () => {
    onClose();
    navigate('/credits');
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      style={{ margin: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
        style={{ maxWidth: '100vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Unlock with Credits</h2>
              <p className="text-xs text-muted-foreground">Purchase an R79+ pack to unlock all features</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pb-6 space-y-5 flex-1">

          {/* What R79+ unlocks */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3.5 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">R79+ pack unlocks</p>
            {UNLOCKS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Credit packs */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">
              Choose a pack
            </p>
            <div className="space-y-2">
              {PACKAGES.map(pkg => (
                <div
                  key={pkg.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                    pkg.highlight
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{pkg.label}</span>
                      {pkg.highlight && (
                        <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">
                          UNLOCKS ALL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{pkg.credits} credits · {pkg.note}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">R{pkg.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            className="w-full h-12 rounded-2xl text-base font-semibold"
            onClick={handleBuyCredits}
          >
            Buy Credits
          </Button>

          {/* Credit cost breakdown */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-0.5">
              Credit costs
            </p>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {COSTS.map((row, i) => (
                <div
                  key={row.action}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    i < COSTS.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  <span className="text-xs text-foreground">{row.action}</span>
                  <span className="text-xs font-semibold text-primary">{row.cost}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3 h-3 text-primary shrink-0" />
                Purchased credits never expire
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3 h-3 text-primary shrink-0" />
                New users get 18 free credits on signup
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3 text-primary shrink-0" />
                R79+ pack permanently unlocks advanced features
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

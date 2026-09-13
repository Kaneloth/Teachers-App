/**
 * InsufficientCreditsModal — shown instead of a toast whenever deduct()
 * fails due to insufficient balance.
 *
 * Deliberately a pure, props-only component (no hooks of its own, no
 * imports of useCredits or CreditBalance) so it can be dropped into any
 * file that calls useCredits() without creating a circular import — it
 * just needs the numbers and two callbacks, nothing else.
 *
 * Usage in any component that calls useCredits():
 *
 *   const { insufficientCredits, dismissInsufficientCredits, ... } = useCredits();
 *   const [showPurchaseModal, setShowPurchaseModal] = useState(false);
 *   const pricing = usePricing();
 *   ...
 *   {insufficientCredits && (
 *     <InsufficientCreditsModal
 *       needed={insufficientCredits.needed}
 *       have={insufficientCredits.have}
 *       message={insufficientCredits.message}
 *       onDismiss={dismissInsufficientCredits}
 *       onTopUp={() => { dismissInsufficientCredits(); setShowPurchaseModal(true); }}
 *     />
 *   )}
 *   {showPurchaseModal && <PurchaseModal onClose={() => setShowPurchaseModal(false)} pricing={pricing} />}
 */

import { createPortal } from 'react-dom';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  needed: number;
  have: number;
  message?: string;
  onDismiss: () => void;
  onTopUp: () => void;
}

export default function InsufficientCreditsModal({ needed, have, message, onDismiss, onTopUp }: Props) {
  // Portaled to <body> for the same reason PurchaseModal is — some pages
  // (e.g. CV Builder) wrap content in animated framer-motion elements,
  // and a transformed ancestor becomes the containing block for
  // `position: fixed` descendants, which would clip/mispositon this
  // modal instead of covering the real viewport.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
            <Coins className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Not Enough Credits</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {message || `You need ${needed} credit${needed === 1 ? '' : 's'} for this, but you currently have ${have}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onDismiss}>Cancel</Button>
          <Button className="flex-1 rounded-xl gap-1.5" onClick={onTopUp}>
            <Coins className="w-4 h-4" /> Top Up Credits
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

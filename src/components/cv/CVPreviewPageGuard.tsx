import type { CSSProperties } from 'react';

/**
 * Wraps one rasterized preview page (`page.dataUrl` from useCVPdfPreview)
 * with right-click / long-press / drag deterrents, so "Save image as…"
 * and the mobile long-press "Save to Photos" menu aren't a one-tap way to
 * grab a full-resolution, unpaid copy of the CV straight from the free
 * preview. This is a deterrent, not a hard technical block — a determined
 * user can still take a screenshot — but for that they'd have to zoom out
 * to see the whole page, which makes the text too small to read, let
 * alone reuse.
 *
 * Used by both CVPreviewDrawer.tsx (the step-by-step live preview) and
 * CVStepReview.tsx (the Review step's full preview) so the two preview
 * surfaces stay protected the same way.
 */
export default function CVPreviewPageGuard({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Blocks iOS Safari's long-press "Save to Photos / Copy" menu.
        WebkitTouchCallout: 'none',
      } as CSSProperties}
    />
  );
}

import type { CSSProperties } from 'react';

/**
 * Wraps one rasterized preview page (`page.dataUrl` from useCVPdfPreview)
 * with two protections against someone walking off with a full-quality,
 * unpaid copy of the CV straight from the free preview:
 *
 *  1. Right-click / long-press / drag deterrents on the image itself, so
 *     "Save image as…" and the mobile long-press "Save to Photos" menu
 *     aren't a one-tap way to grab it.
 *
 *  2. A small, centered, diagonal "PREVIEW" watermark — a semi-
 *     transparent CSS overlay <span> sitting on top of the <img>, NOT
 *     drawn into page.dataUrl. It has nothing to do with cvExport.ts's
 *     own (admin-toggleable) download watermark and never reaches the
 *     actual downloaded PDF — exportElementAsPDF / cvExport.ts never
 *     render this component.
 *
 *     Deliberately confined to the middle of the page rather than tiled
 *     across it (an earlier version did that and was dropped as too
 *     distracting) — a single centered mark barely interrupts reading,
 *     but a full-page screenshot (the gap left once right-click/long-
 *     press are blocked and zooming out was the only route left) still
 *     comes out with a visible "PREVIEW" stamp sitting across whatever
 *     content happens to be in the middle of the page.
 *
 * Together these are a deterrent, not a hard technical block — a
 * determined user can still screenshot around them — but they remove the
 * trivial, one-tap paths, and anything captured despite them still carries
 * the stamp.
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
    <div className="relative" style={{ isolation: 'isolate' }}>
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
          display: 'block',
        } as CSSProperties}
      />
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        <span
          style={{
            fontSize: 'clamp(20px, 8vw, 36px)',
            fontWeight: 800,
            letterSpacing: '0.15em',
            color: '#1A1A2E',
            opacity: 0.12,
            transform: 'rotate(-30deg)',
            whiteSpace: 'nowrap',
          }}
        >
          PREVIEW
        </span>
      </div>
    </div>
  );
}

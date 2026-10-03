import type { CSSProperties } from 'react';

/**
 * Wraps one rasterized preview page (`page.dataUrl` from useCVPdfPreview)
 * with two independent protections against someone walking off with a
 * full-resolution, unpaid copy of the CV straight from the free preview:
 *
 *  1. A diagonal, semi-transparent "PREVIEW" watermark tiled across the
 *     image. This is a pure CSS overlay <div> sitting on top of the
 *     <img> — it is NOT drawn into page.dataUrl and has nothing to do
 *     with cvExport.ts's own (admin-toggleable) download watermark. It
 *     never reaches the actual downloaded PDF, because exportElementAsPDF
 *     / cvExport.ts never render this component — they're untouched by
 *     this file. If someone screenshots around the save-blockers below,
 *     what they capture still has this watermark baked into the pixels.
 *
 *  2. Right-click / long-press / drag deterrents on the image itself, so
 *     "Save image as…" and the mobile long-press "Save to Photos" menu
 *     aren't a one-tap way to grab it. This is a deterrent, not a hard
 *     technical block — a determined user can still take a screenshot —
 *     but it removes the trivial path, and the watermark above still
 *     applies to whatever they do manage to capture.
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
        } as CSSProperties}
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'space-around',
            justifyContent: 'space-around',
            transform: 'rotate(-30deg)',
            opacity: 0.14,
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#111827',
                margin: '14px 22px',
                whiteSpace: 'nowrap',
              }}
            >
              PREVIEW
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

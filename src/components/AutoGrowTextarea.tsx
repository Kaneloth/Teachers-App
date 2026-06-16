import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A single-line-styled textarea that automatically grows in height as
 * content wraps onto multiple lines — used in place of <Input> for fields
 * that may contain long AI-generated text (e.g. CV bullet points, job
 * titles, school names). Unlike a fixed-height <Input>, this never
 * requires the user to scroll sideways within the field to read the full
 * text; it just wraps and grows instead.
 */
export default function AutoGrowTextarea({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => { resize(); }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'resize-none overflow-hidden leading-snug',
        className,
      )}
    />
  );
}

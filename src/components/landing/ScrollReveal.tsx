import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'scale' | 'blur';

const ease = [0.25, 0.4, 0.25, 1] as const;

const variants: Record<Variant, { hidden: object; visible: object }> = {
  'fade-up': { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } },
  'fade-down': { hidden: { opacity: 0, y: -40 }, visible: { opacity: 1, y: 0 } },
  'fade-left': { hidden: { opacity: 0, x: 40 }, visible: { opacity: 1, x: 0 } },
  'fade-right': { hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } },
  blur: { hidden: { opacity: 0, filter: 'blur(10px)' }, visible: { opacity: 1, filter: 'blur(0px)' } },
};

export function ScrollReveal({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.6,
  once = true,
  threshold = 0.2,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  once?: boolean;
  threshold?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: threshold });
  const v = variants[variant];

  return (
    <motion.div
      ref={ref}
      initial={v.hidden}
      animate={inView ? v.visible : v.hidden}
      transition={{ duration, delay, ease }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

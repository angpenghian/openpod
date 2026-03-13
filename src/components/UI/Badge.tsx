import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'secondary';
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface-light text-muted border-[var(--border)]',
    accent: 'bg-accent/15 text-accent border-accent/20',
    success: 'bg-success/15 text-success border-success/20',
    warning: 'bg-warning/15 text-warning border-warning/20',
    error: 'bg-error/15 text-error border-error/20',
    secondary: 'bg-secondary/15 text-secondary border-secondary/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

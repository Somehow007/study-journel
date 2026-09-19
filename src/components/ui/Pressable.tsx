import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { NavLink, type NavLinkProps } from 'react-router-dom';

export type PressableVariant = 'default' | 'card' | 'pill' | 'icon';

const VARIANT_CLASS: Record<PressableVariant, string> = {
  default: 'pressable',
  card: 'pressable-card',
  pill: 'pressable-pill',
  icon: 'pressable-icon',
};

function joinClass(variant: PressableVariant, className?: string) {
  return [VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
}

type PressableProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PressableVariant;
};

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { variant = 'default', className, type, ...props },
  ref,
) {
  return <button ref={ref} type={type ?? 'button'} className={joinClass(variant, className)} {...props} />;
});

type PressableLinkProps = NavLinkProps & {
  variant?: PressableVariant;
};

export function PressableLink({ variant = 'default', className, ...props }: PressableLinkProps) {
  return (
    <NavLink
      {...props}
      className={(args) => {
        const extra = typeof className === 'function' ? className(args) : className;
        return joinClass(variant, extra);
      }}
    />
  );
}

import type { ComponentProps } from 'react';
import { buttonVariants } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

type Props = ComponentProps<'button'> & {
  variant?: 'default' | 'ghost';
  size?: 'default' | 'icon';
};

export default function BotonAcceso({ className, variant, size, ...props }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

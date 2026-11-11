import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="font-code text-sm text-muted-foreground">404</div>
      <h1 className="mt-2 font-display text-[44px] leading-none">No ticket at this address</h1>
      <p className="mt-3 text-sm text-muted-foreground">The link may be old, or it points somewhere UltraTask doesn't go.</p>
      <Button asChild className="mt-8 rounded-full"><Link href="/" data-testid="link-home">Back to work</Link></Button>
    </div>
  );
}

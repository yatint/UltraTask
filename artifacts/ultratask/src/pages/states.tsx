import { useClerk, useUser } from '@clerk/react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { HexMark, Skel } from '@/components/atoms';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} className="w-full max-w-md text-center">
        <HexMark className="mx-auto h-14 w-14" />
        {children}
      </motion.div>
    </div>
  );
}

export function NoAccess() {
  const { signOut } = useClerk();
  const { user } = useUser();
  return (
    <Frame>
      <h1 className="mt-6 font-display text-[40px] leading-none" data-testid="text-no-access">Ask your admin for an invite</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        You're signed in as <span className="font-medium text-foreground">{user?.primaryEmailAddress?.emailAddress ?? 'this account'}</span>, but UltraTask is invitation-only and this email isn't on the Ultramotiv team yet.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button className="rounded-full" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-no-access-sign-out">Sign out & try another email</Button>
        <Button variant="ghost" asChild className="rounded-full"><Link href="/">See the sample workspace</Link></Button>
      </div>
    </Frame>
  );
}

export function ErrorScreen({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Frame>
      <h1 className="mt-6 font-display text-[40px] leading-none">The line went quiet</h1>
      <p className="mt-3 text-sm text-muted-foreground" data-testid="text-error">{message}</p>
      <Button className="mt-8 rounded-full px-6" onClick={retry} data-testid="button-retry">Try again</Button>
    </Frame>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-[100dvh] bg-background" data-testid="skeleton-shell">
      <div className="hidden w-[244px] shrink-0 flex-col gap-3 bg-sidebar p-5 md:flex">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="mt-6 h-9 rounded-lg bg-white/10" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-7 rounded-lg bg-white/5" />)}
      </div>
      <div className="flex-1 px-4 pt-20 md:px-8">
        <div className="mx-auto max-w-[1100px] space-y-4">
          <Skel className="h-12 w-64" /><Skel className="h-4 w-80" /><Skel className="h-11 w-full rounded-xl" />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/60 px-5 py-3.5">
                <Skel className="h-3.5 w-8" /><Skel className="h-3.5 w-14" /><Skel className="h-3.5 flex-1" /><Skel className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

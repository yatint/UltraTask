import { SignIn, SignUp } from '@clerk/react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/atoms';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function AuthFrame({ kicker, title, children }: { kicker: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grain grid min-h-[100dvh] bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-accent-foreground lg:flex lg:flex-col">
        <Brand className="self-start" />
        <svg className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] opacity-[0.12]" viewBox="0 0 64 64" aria-hidden>
          {[0, 6, 12, 18].map((d) => <path key={d} d={`M32 ${3 + d} ${57 - d} ${17.5 + d / 2}v${29 - d}L32 ${61 - d} ${7 + d} ${46.5 - d / 2}v-${29 - d}Z`} fill="none" stroke="#2FB3BE" strokeWidth="0.4" />)}
        </svg>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="relative mt-auto max-w-md">
          <div className="text-[11px] uppercase tracking-[0.22em] text-sidebar-foreground/60">{kicker}</div>
          <h1 className="mt-4 font-display text-[44px] leading-[1.08]">{title}</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-sidebar-foreground/75">UltraTask is where Ultramotiv keeps its promises to itself — one owner, one date, confirmed done. Invitation only.</p>
        </motion.div>
        <div className="relative mt-12 text-[11px] text-sidebar-foreground/45">Pune · Asia/Kolkata</div>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10">
        <Brand variant="inline" className="mb-6 lg:hidden" />
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 self-center text-sm text-muted-foreground hover:text-foreground lg:self-auto" data-testid="link-back-preview">
          <ArrowLeft className="h-4 w-4" /> Sample workspace
        </Link>
        {children}
      </main>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthFrame kicker="Sign in" title={<>Back to the <span className="text-sidebar-primary">bench</span>.</>}>
      <SignIn appearance={{ elements: { footerAction: 'hidden' } }} routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <div className="mt-6 max-w-sm space-y-2 text-center text-xs text-muted-foreground">
        <p>Joining the team? Once your admin invites you, use the link in that email. No invite yet — ask your admin.</p>
        <p>Setting up UltraTask for the first time as the founder? <Link href="/sign-up" className="font-medium text-primary hover:underline" data-testid="link-founder-setup">Create the founder account</Link> with the founder email.</p>
      </div>
    </AuthFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthFrame kicker="Create account" title={<>Your desk is <span className="text-sidebar-primary">ready</span>.</>}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">Use the founder email, or the exact email your admin invited. Any other email will be turned away.</p>
    </AuthFrame>
  );
}

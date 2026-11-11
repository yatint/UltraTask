import { useEffect, useRef } from 'react';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import PreviewApp from '@/pages/preview';
import LiveArea from '@/pages/live';
import { SignInPage, SignUpPage } from '@/pages/auth';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10000 } },
});

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#18727C',
    colorForeground: '#13262A',
    colorMutedForeground: '#5A6A6E',
    colorDanger: '#C9442A',
    colorBackground: '#FAFCFC',
    colorInput: '#F7F5F0',
    colorInputForeground: '#13262A',
    colorNeutral: '#13262A',
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    borderRadius: '0.625rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FAFCFC] rounded-2xl w-[420px] max-w-full overflow-hidden border border-[#DCD7CC] shadow-[0_28px_60px_-20px_rgba(19,38,42,0.28)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "text-[#13262A] text-[24px] font-bold tracking-[-0.02em]",
    headerSubtitle: 'text-[#5A6A6E]',
    socialButtonsBlockButtonText: 'text-[#13262A] font-medium',
    formFieldLabel: 'text-[#13262A] font-medium',
    footerActionLink: 'text-[#18727C] font-medium',
    footerActionText: 'text-[#5A6A6E]',
    dividerText: 'text-[#5A6A6E]',
    identityPreviewEditButton: 'text-[#18727C]',
    formFieldSuccessText: 'text-[#18727C]',
    alertText: 'text-[#13262A]',
    logoBox: 'h-12 justify-center',
    logoImage: 'h-12 w-12 object-contain',
    socialButtonsBlockButton: 'border border-[#DCD7CC] bg-[#FBFAF6]',
    formButtonPrimary: 'bg-[#18727C] text-[#FBFAF6] rounded-xl h-11 font-semibold shadow-none',
    formFieldInput: 'bg-[#F7F5F0] border-[#D3CDC0] text-[#13262A]',
    footerAction: 'justify-center',
    dividerLine: 'bg-[#DCD7CC]',
    alert: 'bg-[#F4EBDD] border border-[#E7D3B0]',
    otpCodeFieldInput: 'border-[#D3CDC0] text-[#13262A]',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/tasks" />
      </Show>
      <Show when="signed-out">
        <PreviewApp />
      </Show>
    </>
  );
}

function Authed() {
  return (
    <>
      <Show when="signed-in">
        <LiveArea />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function SignInRoute() {
  return <SignInPage />;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Sign in to UltraTask', subtitle: 'Founder, or the email your admin invited' } },
        signUp: { start: { title: 'Create your UltraTask account', subtitle: 'Founder email or an invited email only' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <MotionConfig reducedMotion="user">
            <RoutedErrorBoundary>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                <Route path="/sign-in/*?" component={SignInRoute} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route component={Authed} />
              </Switch>
            </RoutedErrorBoundary>
          </MotionConfig>
        </TooltipProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: '!rounded-xl !border !border-border !bg-foreground !text-background !shadow-lg !font-sans',
              description: '!text-background/70',
              actionButton: '!bg-primary !text-primary-foreground !rounded-full',
              cancelButton: '!bg-background/15 !text-background !rounded-full',
            },
          }}
        />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

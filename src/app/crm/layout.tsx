import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/nextjs';
import { CrmShell } from '@/components/crm/CrmShell';
import './crm.css';

export const metadata = { title: 'Lunettiq CRM' };
export const dynamic = 'force-dynamic';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <SignedOut>
        <div className="crm-root flex items-center justify-center min-h-screen" style={{ background: 'var(--crm-bg)' }}>
          <SignIn routing="hash" afterSignInUrl="/crm" afterSignUpUrl="/crm" />
        </div>
      </SignedOut>
      <SignedIn>
        <CrmShell>{children}</CrmShell>
      </SignedIn>
    </ClerkProvider>
  );
}

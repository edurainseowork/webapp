import { useState, type ReactNode } from 'react';
import { AuthFlow } from './components/Auth/AuthFlow';

// Shows the login / sign-up screens until the user is signed in, then renders the app untouched
export function AuthGate({ children }: { children: ReactNode }) {
  // TODO: replace with your real session state (e.g. Firebase onAuthStateChanged)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <AuthFlow onAuthenticated={() => setIsAuthenticated(true)} />;
  }
  return <>{children}</>;
}

export default AuthGate;

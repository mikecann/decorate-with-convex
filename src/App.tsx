import { Authenticated, Unauthenticated } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { RouteProvider } from "./routes";
import Dashboard from "./Dashboard";

export default function App() {
  return (
    <RouteProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
          <h2 className="text-xl font-semibold accent-text">Decorate with Convex</h2>
          <SignOutButton />
        </header>
        <main className="flex-1 flex flex-col p-4">
          <Authenticated>
            <Dashboard />
          </Authenticated>
          <Unauthenticated>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md mx-auto">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold accent-text mb-4">Decorate with Convex</h1>
                  <p className="text-xl text-slate-600">Sign in to get started</p>
                </div>
                <SignInForm />
              </div>
            </div>
          </Unauthenticated>
        </main>
        <Toaster />
      </div>
    </RouteProvider>
  );
}

import * as React from "react";
import { SignInForm } from "@/auth/SignInForm";
import { useState } from "react";
import { PasswordReset } from "@/auth/PasswordReset";

interface Props {}

export const UnauthenticatedContent: React.FC<Props> = ({}) => {
  const [showReset, setShowReset] = useState(false);
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto card ">
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-16 w-auto max-w-[220px] mb-4"
          />
          {showReset ? (
            <p className="text-xl text-slate-600">Reset password</p>
          ) : (
            <p className="text-xl text-slate-600">Sign in to get started</p>
          )}
        </div>
        {showReset ? (
          <PasswordReset onBackToSignIn={() => setShowReset(false)} />
        ) : (
          <SignInForm onForgotPassword={() => setShowReset(true)} />
        )}
      </div>
    </div>
  );
};

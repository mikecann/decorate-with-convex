import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../common/Button";
import { InputField } from "../common/InputField";

export function SignInForm({
  onForgotPassword,
}: {
  onForgotPassword?: () => void;
}) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((_error) => {
            const toastTitle =
              flow === "signIn"
                ? "Could not sign in, did you mean to sign up?"
                : "Could not sign up, did you mean to sign in?";
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <InputField
          type="email"
          name="email"
          placeholder="Email"
          required
          autoComplete="email"
        />
        <InputField
          type="password"
          name="password"
          placeholder="Password"
          required
          autoComplete="current-password"
        />
        {flow === "signIn" && onForgotPassword && (
          <Button
            variant="link"
            type="button"
            className="self-end text-xs"
            onClick={onForgotPassword}
          >
            Forgot password?
          </Button>
        )}
        <Button variant="primary" fullWidth type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </Button>
        <div className="text-center text-sm text-slate-600">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <Button
            variant="link"
            type="button"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </Button>
        </div>
      </form>
      {/*
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow" />
        <span className="mx-4 text-slate-400 ">or</span>
        <hr className="my-4 grow" />
      </div>
      <Button
        variant="secondary"
        fullWidth
        onClick={() => void signIn("anonymous")}
      >
        Sign in anonymously
      </Button> */}
    </div>
  );
}

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "../common/Button";
import { InputField } from "../common/InputField";
import { toast } from "sonner";

export function PasswordReset({
  onBackToSignIn,
}: {
  onBackToSignIn?: () => void;
}) {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"forgot" | { email: string }>("forgot");
  return step === "forgot" ? (
    <form
      key={"forgot"}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void signIn("password", formData).then(() => {
          toast.success("Check your email for a verification code.");
          setStep({ email: formData.get("email") as string });
        });
      }}
      className="flex flex-col gap-4"
    >
      <label htmlFor="reset-email" className="text-sm font-medium">
        Email address
      </label>
      <InputField
        id="reset-email"
        name="email"
        placeholder="Email"
        type="text"
        autoComplete="email"
      />
      <input name="flow" type="hidden" value="reset" />
      <Button type="submit" variant="primary">
        Send code
      </Button>
      {onBackToSignIn && (
        <Button
          variant="link"
          type="button"
          onClick={onBackToSignIn}
          className="self-end text-xs"
        >
          Back to sign in
        </Button>
      )}
    </form>
  ) : (
    <form
      key={"reset"}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void signIn("password", formData);
      }}
      className="flex flex-col gap-4"
    >
      <label htmlFor="reset-code" className="text-sm font-medium">
        Verification code (from the email we sent you)
      </label>
      <InputField id="reset-code" name="code" placeholder="Code" type="text" />
      <label htmlFor="reset-password" className="text-sm font-medium">
        New password
      </label>
      <InputField
        id="reset-password"
        name="newPassword"
        placeholder="New password"
        type="password"
        autoComplete="new-password"
      />
      <input name="email" value={step.email} type="hidden" />
      <input name="flow" value="reset-verification" type="hidden" />
      <Button type="submit" variant="primary">
        Continue
      </Button>
      <Button type="button" variant="link" onClick={() => setStep("forgot")}>
        Cancel
      </Button>
      {onBackToSignIn && (
        <Button
          variant="link"
          type="button"
          onClick={onBackToSignIn}
          className="self-end text-xs"
        >
          Back to sign in
        </Button>
      )}
    </form>
  );
}

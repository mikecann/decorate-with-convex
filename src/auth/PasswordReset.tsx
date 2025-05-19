import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function PasswordReset() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"forgot" | { email: string }>("forgot");
  return step === "forgot" ? (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void signIn("password", formData).then(() =>
          setStep({ email: formData.get("email") as string })
        );
      }}
    >
      <input name="email" placeholder="Email" type="text" />
      <input name="flow" type="hidden" value="reset" />
      <button type="submit">Send code</button>
    </form>
  ) : (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void signIn("password", formData);
      }}
    >
      <input name="code" placeholder="Code" type="text" />
      <input name="newPassword" placeholder="New password" type="password" />
      <input name="email" value={step.email} type="hidden" />
      <input name="flow" value="reset-verification" type="hidden" />
      <button type="submit">Continue</button>
      <button type="button" onClick={() => setStep("forgot")}>
        Cancel
      </button>
    </form>
  );
}

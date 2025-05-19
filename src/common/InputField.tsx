import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "./utils";

export interface InputFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("input-field", className)} {...props} />
  )
);

InputField.displayName = "InputField";

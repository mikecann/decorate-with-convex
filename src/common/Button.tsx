import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "./utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "link";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      ...props
    },
    ref
  ) => {
    const baseStyles = "rounded-lg font-semibold transition-colors";
    const sizeStyles = {
      sm: "px-3 py-1 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-2 text-lg",
    };
    const variantStyles = {
      primary:
        "bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50 disabled:cursor-not-allowed",
      secondary:
        "bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed",
      danger:
        "border border-red-200 text-red-600 bg-transparent hover:bg-red-50",
      link: "text-blue-500 hover:text-blue-600 p-0",
    };
    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <button
        className={cn(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          widthStyles,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

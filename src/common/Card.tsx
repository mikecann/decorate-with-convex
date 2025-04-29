import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);

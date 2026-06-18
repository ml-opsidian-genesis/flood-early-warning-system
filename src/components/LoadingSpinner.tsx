import { Spin } from "antd";
import type { ReactNode } from "react";

type LoadingSpinnerProps = {
  /** Additional CSS classes */
  className?: string;
  /** Size of the spinner, default "large" */
  size?: "small" | "default" | "large";
};

export default function LoadingSpinner({ className = "", size = "large" }: LoadingSpinnerProps) {
  return <Spin size={size} className={className} />;
}

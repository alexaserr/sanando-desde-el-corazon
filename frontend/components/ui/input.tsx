import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-none border-0 border-b-2 border-transparent bg-[#F6EDEA] px-4 py-3.5 text-[15px] text-foreground placeholder:text-gray-400 transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:border-terra-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

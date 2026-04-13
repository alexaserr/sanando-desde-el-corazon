import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full min-h-[120px] rounded-none border-0 border-b border-arcilla bg-marfil px-4 py-3.5 text-[15px] text-foreground placeholder:text-gray-400 transition-colors duration-150 focus:border-b-2 focus:border-terra focus:outline-none focus:shadow-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

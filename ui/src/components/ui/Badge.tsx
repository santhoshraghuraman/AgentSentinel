import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold motion-safe:transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs",
        outline: "border-slate-200 text-slate-700 bg-white",
        allow: "border-emerald-200 bg-emerald-50 text-emerald-700",
        alert: "border-amber-200 bg-amber-50 text-amber-800",
        block: "border-rose-200 bg-rose-50 text-rose-700",
        critical: "border-red-200 bg-red-100 text-red-800 motion-safe:animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

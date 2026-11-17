import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Кнопки в стиле Jazba: жирный текст, крупные зоны нажатия (≥44px), «объёмная» нижняя тень,
// которая пропадает при нажатии.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-transparent bg-clip-padding font-extrabold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_4px_0_var(--color-brand-dark)] hover:bg-[#5236d6]",
        success: "bg-ok text-white shadow-[0_4px_0_var(--color-ok-dark)] hover:bg-[#1c975b]",
        outline:
          "border-border bg-card text-foreground shadow-press hover:bg-surface-soft aria-expanded:bg-muted",
        secondary:
          "border-[#d9d0ff] bg-brand-soft text-brand-dark shadow-[0_3px_0_#d9d0ff] hover:bg-[#e6e0ff]",
        ghost: "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive: "border-bad-line bg-bad-soft text-bad-ink hover:bg-[#fbdcdc]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4 text-[15px]",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-[10px] px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 rounded-[14px] px-5 text-base",
        xl: "h-[60px] gap-2.5 rounded-[18px] px-6 text-lg font-black",
        icon: "size-11",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-[10px] [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

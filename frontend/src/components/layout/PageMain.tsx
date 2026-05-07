import type { ReactNode } from "react";

type PageMainVariant = "centered" | "auth" | "flow" | "app";

type PageMainProps = {
  variant: PageMainVariant;
  children: ReactNode;
  className?: string;
};

const variantClasses: Record<PageMainVariant, string> = {
  centered: "flex min-h-screen flex-col items-center justify-center px-container-padding",
  auth: "mx-auto flex min-h-screen w-full max-w-page-narrow flex-col items-center justify-center px-container-padding py-xl",
  flow: "mx-auto flex min-h-screen w-full max-w-page-narrow flex-col px-container-padding py-lg",
  app: "mx-auto min-h-screen w-full max-w-page-default px-container-padding pb-[calc(112px+env(safe-area-inset-bottom))]",
};

export function PageMain({ variant, children, className }: PageMainProps) {
  const classes = className ? `${variantClasses[variant]} ${className}` : variantClasses[variant];

  return <main className={classes}>{children}</main>;
}

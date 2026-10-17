"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip"

const soonClassName = "rounded-full disabled:opacity-40"

function SoonButton({
  children,
  variant = "outline",
}: {
  children: string
  variant?: "outline" | "default"
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          size="sm"
          variant={variant}
          disabled
          tabIndex={-1}
          className={soonClassName}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Bientôt, avec la version web.</TooltipContent>
    </Tooltip>
  )
}

const links = [
  { label: "Produit", href: "/#produit" },
  { label: "Télécharger", href: "/download" },
  { label: "Journal", href: "/#journal" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <TooltipProvider delay={200}>
      <header>
        <nav className="fixed top-0 z-20 w-full bg-background">
          <div className="mx-auto max-w-7xl px-6">
            <div className="relative flex flex-wrap items-center justify-between gap-6 py-5 lg:gap-0">
              <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
                <Link href="/" className="flex items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden
                    className="inline-block size-5 bg-foreground"
                    style={{
                      mask: "url(/icon.svg) center / contain no-repeat",
                      WebkitMask: "url(/icon.svg) center / contain no-repeat",
                    }}
                  />
                  Scribbly
                </Link>
                <ul className="hidden gap-8 text-sm lg:flex">
                  {links.map((link) => {
                    const active = link.href === "/download" && pathname === "/download"
                    return (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className={
                            active
                              ? "text-foreground"
                              : "text-muted-foreground duration-150 hover:text-foreground"
                          }
                        >
                          {link.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-fit">
                <ThemeToggle />
                <SoonButton>Sign in</SoonButton>
                <SoonButton variant="default">Sign up</SoonButton>
              </div>
            </div>
          </div>
        </nav>
      </header>
    </TooltipProvider>
  )
}

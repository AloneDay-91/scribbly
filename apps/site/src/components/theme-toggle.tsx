"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";

const storageKey = "theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      aria-label="Changer de thème"
      onClick={() => {
        const dark = document.documentElement.classList.contains("dark");
        applyTheme(dark ? "light" : "dark");
      }}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

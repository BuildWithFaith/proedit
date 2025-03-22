"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by ensuring component renders only after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid rendering different UI on server & client

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      className="mt-4  flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-all"
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      Toggle Theme
    </Button>
  );
}

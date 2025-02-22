"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Home, Settings, Bell, User, MenuIcon, Video, Share } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

const menuItems: MenuItem[] = [
  {
    icon: <Home className="h-5 w-5" />,
    label: "Home",
    href: "/",
    gradient:
      "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)",
    iconColor: "text-blue-500",
  },
  {
    icon: <Video className="h-5 w-5" />,
    label: "video Call",
    href: "/videocall",
    gradient:
      "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)",
    iconColor: "text-orange-500",
  },
  {
    icon: <Share className="h-5 w-5" />,
    label: "Share Files",
    href: "/sharefiles",
    gradient:
      "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 100%)",
    iconColor: "text-green-500",
  },
];

function Menu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size and update isMobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // `md` breakpoint in Tailwind (768px)
    };

    handleResize(); // Run once on mount
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Remove the menu completely on desktop
  if (!isMobile) return null;

  return (
    <span>
      {/* Mobile menu button */}
      <button
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-lg border border-border/40 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* Mobile menu */}
      {isOpen && (
        <motion.nav
          className="p-4 rounded-2xl bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-lg border border-border/40 shadow-lg fixed inset-0 z-40 flex flex-col items-center justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >

          <ul className="flex flex-col items-center gap-4">
            {menuItems.map((item) => (
              <li key={item.label} className="relative w-full">
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl text-lg bg-white/10 backdrop-blur-md transition hover:bg-white/20"
                >
                  <span className={item.iconColor}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Close Button */}
          <button
            className="mt-6 px-4 py-2 text-sm bg-red-500 text-white rounded-lg shadow-md"
            onClick={() => setIsOpen(false)}
          >
            Close Menu
          </button>
        </motion.nav>
      )}
    </span>
  );
}

export default Menu;

export function MenuBar() {
  return (
    <div className="flex justify-evenly items-center absolute w-full z-50">
      <span className="md:w-[50vw] flex justify-evenly items-center">
        <Menu />
        <div className="absolute right-1 mt-7 md:block hidden">
          <ThemeToggle />
        </div>
      </span>
    </div>
  );
}

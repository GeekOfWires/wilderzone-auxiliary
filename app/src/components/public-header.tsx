import { BookOpen, Code2, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared header for the public pages (home, downloads). Large and borderless
 * at the very top; shrinks the moment the page scrolls. Logo attribute height
 * is the no-CSS fallback - the classes drive the animated size.
 */
export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between px-4 transition-all duration-300",
          scrolled ? "h-16" : "h-32"
        )}
      >
        <Link to="/" aria-label="Home">
          <Logo
            height={96}
            className={cn("w-auto transition-all duration-300", scrolled ? "h-12" : "h-24")}
          />
        </Link>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size={scrolled ? "sm" : "default"} asChild>
            <Link to="/downloads">
              <Download className="mr-1.5 h-4 w-4" />
              Downloads
            </Link>
          </Button>
          <Button variant="ghost" size={scrolled ? "sm" : "default"} asChild>
            <a href="https://geekofwires.github.io/wilderzone-auxiliary/" target="_blank" rel="noreferrer">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Docs
            </a>
          </Button>
          <Button variant="ghost" size={scrolled ? "sm" : "default"} asChild>
            <a href="https://github.com/GeekOfWires/wilderzone-auxiliary" target="_blank" rel="noreferrer">
              <Code2 className="mr-1.5 h-4 w-4" />
              GitHub
            </a>
          </Button>
          <Button size={scrolled ? "sm" : "default"} asChild className="ml-2">
            <Link to="/login">Login</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

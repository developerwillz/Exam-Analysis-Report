import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Settings, FileCode2, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "解析页面", icon: FileCode2 },
    { href: "/bookmarklet", label: "书签工具", icon: Bookmark },
    { href: "/settings", label: "题型设置", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Veritas <span className="text-muted-foreground font-normal">|</span> 模考错题分析
            </h1>
          </div>
          
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className={cn("w-4 h-4", isActive && "text-primary")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface shadow-soft",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "icon" | "sm";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-transparent bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" && "border-border bg-surface text-foreground hover:bg-muted",
        variant === "ghost" && "border-transparent bg-transparent text-foreground hover:bg-muted",
        variant === "danger" && "border-transparent bg-danger text-white hover:opacity-90",
        size === "default" && "h-10 px-4",
        size === "sm" && "h-8 px-3 text-xs",
        size === "icon" && "h-10 w-10 p-0",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "amber" | "rose" | "blue" | "violet";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        tone === "rose" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
        tone === "blue" && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
        tone === "violet" && "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      {...props}
    />
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

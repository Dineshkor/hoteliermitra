"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Role, Workspace, WorkspaceAction } from "@/lib/types";
import { createDemo, emptyWorkspace, normalizeDemoState } from "@/lib/demo";
import { applyDemoAction } from "@/lib/demo-actions";
const storageKey = "hospitality-hire-demo-v2";
const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
type Context = {
  state: Workspace;
  demo: boolean;
  loading: boolean;
  error: string;
  mutate: (action: WorkspaceAction) => Promise<void>;
  switchRole: (role: Role) => void;
  reload: () => Promise<void>;
  reset: () => void;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("WorkspaceProvider is required");
  return ctx;
}
export function WorkspaceProvider({
  children,
  initialWorkspace = emptyWorkspace,
  initialLoaded = false,
  initialError = "",
}: {
  children: ReactNode;
  initialWorkspace?: Workspace;
  initialLoaded?: boolean;
  initialError?: string;
}) {
  const [state, setState] = useState<Workspace>(initialWorkspace),
    [loading, setLoading] = useState(!initialLoaded),
    [error, setError] = useState(initialError);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const readGeneration = useRef(0);
  const pendingWrites = useRef(0);
  const queuedReload = useRef(false);
  const reloadWaiters = useRef<Array<() => void>>([]);
  const reload = useCallback(async () => {
    const generation = ++readGeneration.current;
    if (configured && pendingWrites.current > 0) {
      queuedReload.current = true;
      await new Promise<void>((resolve) => reloadWaiters.current.push(resolve));
      return;
    }
    try {
      if (configured) {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load your workspace.");
        if (generation !== readGeneration.current) return;
        setState(result.workspace);
      } else {
        await Promise.resolve();
        const saved = localStorage.getItem(storageKey);
        let next: Workspace;
        try {
          next = saved ? normalizeDemoState(JSON.parse(saved)) : createDemo();
        } catch {
          next = createDemo();
        }
        setState(next);
      }
      if (generation === readGeneration.current) setError("");
    } catch (e) {
      if (generation === readGeneration.current)
        setError(
          e instanceof Error ? e.message : "Could not load data. Try again.",
        );
    } finally {
      if (generation === readGeneration.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!initialLoaded) void Promise.resolve().then(reload);
  }, [reload, initialLoaded]);
  useEffect(() => {
    if (configured && previousPath.current !== pathname)
      void Promise.resolve().then(reload);
    previousPath.current = pathname;
  }, [pathname, reload]);
  useEffect(() => {
    if (!configured) return;
    const refresh = () => {
      void reload();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [reload]);
  function persist(next: Workspace) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  }
  async function mutate(command: WorkspaceAction) {
    if (configured) {
      if (pendingWrites.current > 0) queuedReload.current = true;
      pendingWrites.current++;
      const generation = ++readGeneration.current;
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Your changes could not be saved.");
        if (generation === readGeneration.current) {
          setState(result.workspace);
          setError("");
        }
      } finally {
        pendingWrites.current--;
        setLoading(false);
        if (pendingWrites.current === 0 && queuedReload.current) {
          queuedReload.current = false;
          const waiters = reloadWaiters.current;
          reloadWaiters.current = [];
          try {
            await reload();
          } finally {
            waiters.forEach((resolve) => resolve());
          }
        }
      }
      return;
    }
    persist(applyDemoAction(state, command));
  }
  const switchRole = (role: Role) => {
    if (!configured) {
      const userId =
        role === "employer"
          ? "demo-employer"
          : role === "admin"
            ? "demo-admin"
            : "demo-applicant";
      persist({
        ...state,
        role,
        userId,
        suspended:
          state.accounts?.find((a) => a.id === userId)?.suspended || false,
      });
    }
  };
  const reset = () => {
    if (!configured) {
      localStorage.removeItem(storageKey);
      persist(createDemo());
    }
  };
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        demo: !configured,
        loading,
        error,
        mutate,
        switchRole,
        reload,
        reset,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

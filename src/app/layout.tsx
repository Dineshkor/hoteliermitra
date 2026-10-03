import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { emptyWorkspace } from "@/lib/demo";
import type { Workspace } from "@/lib/types";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Hospitality Hire · Good people. Great hospitality.",
    template: "%s | Hospitality Hire",
  },
  description:
    "Hospitality careers across India. Find hotel, restaurant, resort and cafe jobs, or hire your next hospitality team with structured profiles and screening.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialWorkspace: Workspace = emptyWorkspace,
    initialLoaded = false,
    initialError = "";
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      await supabase.auth.getClaims();
      const { data, error } = await supabase.rpc("workspace_snapshot");
      if (error) throw new Error("Database setup required");
      initialWorkspace = data as Workspace;
      initialLoaded = true;
    } catch {
      initialError =
        "We couldn’t load your workspace. Check your connection and try again.";
    }
  }
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <WorkspaceProvider
          initialWorkspace={initialWorkspace}
          initialLoaded={initialLoaded}
          initialError={initialError}
        >
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}

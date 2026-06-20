import { redirect } from "next/navigation";

// Day 5: /app is now the dashboard's parent route. Drawer nav already lists
// Dashboard first; the legacy Portfolio landing remains reachable via
// /app/portfolio for direct bookmarks.
export default function AppRoot() {
  redirect("/app/dashboard");
}

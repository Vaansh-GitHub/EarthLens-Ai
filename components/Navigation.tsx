import { getAuthenticatedUserId } from "@/lib/server/auth";
import { NavigationClient } from "./NavigationClient";

export async function Navigation() {
  const userId = await getAuthenticatedUserId();
  return <NavigationClient userId={userId ? userId.toString() : null} />;
}

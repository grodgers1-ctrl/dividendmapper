// Single source of truth for the free-tier holding cap and the copy that
// surrounds it. The same constants drive: the launcher's "Free tier full"
// state, the modal's 402 alert, and the page's hidden-rows banner.
//
// The page reads FREE_TIER_LIMIT to limit its Supabase query. The server
// route handler keeps its own copy (route.ts is the security boundary —
// don't want a UI-side constant change to silently widen the cap there).
export const FREE_TIER_LIMIT = 10;

export const FREE_TIER_CAP_TITLE = "Free tier full";
export const FREE_TIER_CAP_MESSAGE = "Upgrade to Pro for unlimited holdings.";



## Analysis

After reviewing the codebase, the `useOrders` hook is already well-structured:
- Uses `.select('*')` (not `.single()`) for fetching order lists (line 43-46)
- Uses `.insert()` (not `.upsert()`) for creation (line 98-112)
- Has `.order('created_at', { ascending: false })` sort clause (line 46)
- Calls `fetchOrders()` (full re-fetch) after every mutation — not local state append
- The `.single()` on line 114 is correct — it's for the insert return (one row inserted)
- No realtime subscriptions exist — no event handler issues
- UUID `id` is auto-generated via `gen_random_uuid()` default

**The code patterns are already correct.** The reported "disappearing orders" is likely an RLS or data issue, not a code bug. However, to add defensive robustness, the plan below adds minor hardening.

## Plan

### 1. Harden `useOrders.ts` fetch with error handling
- Add error logging to `fetchOrders` so failed queries don't silently produce empty arrays
- Ensure `setLoading(false)` is called in all paths (already done but add try/catch)
- Keep existing query pattern (already correct: `.select('*').order('created_at', { ascending: false })`)

### 2. Add error handling to `addOrder`
- Log insert errors to console for debugging
- Show toast on failure so user knows the order wasn't saved
- Keep `.single()` on insert return (correct usage for single-row insert)

### 3. No database or schema changes needed
- All columns exist with correct types and defaults
- RLS policies are already in place
- No migration required

### Technical Details
The fixes are purely defensive — adding `try/catch` blocks and error logging to surface any silent failures (e.g., RLS denials returning empty results without errors). The core query patterns are already correct per the user's requirements.


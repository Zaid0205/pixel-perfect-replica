<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project conventions

- Dashboard data comes from plain Supabase tables (`orders`, `payments`, `distributors`, `products`, `targets`, `activity_log`) read directly from the client, so external automations like n8n can write the same tables.
- Roles live in `user_roles` with a `has_role()` security-definer function; never store roles on `profiles`.
- Page shell, auth guard, and header live in `src/components/DashboardLayout.tsx`; every page route renders inside it.

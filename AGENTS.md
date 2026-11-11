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

- Keep founder status fetching in `src/lib/founders.ts`, not `src/routes/`, because route files are registered as pages and the account imports this query as shared logic.

- ISBN camera scanning uses native BarcodeDetector or its browser ponyfill with one shared camera lifecycle; keep react-zxing only for the QR scanner to avoid changing QR behavior.

- Keep email confirmation at a public `/confirmar` route with verification only in the explicit button handler and network-only service-worker fetching, so email security scanners cannot consume tokens on page load.

- Share WhatsApp profile reads and RPC-only writes in `src/lib/whatsapp.ts` and the form between account and nudge, so both surfaces use identical validation and user-scoped cache; AppShell coordinates subscription priority and keys the WhatsApp nudge by navigation to defer conflicts to the next page.

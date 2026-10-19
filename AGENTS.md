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

- Ludo rules live as pure functions in src/lib/ludo.ts (tested in ludo.test.ts); UI and database code call them — keeps game logic testable and shared.
- Game sync uses Lovable Cloud realtime on ludo_rooms/ludo_players; the acting client writes moves, and points are only awarded via the finish_game database function — prevents double-scoring.

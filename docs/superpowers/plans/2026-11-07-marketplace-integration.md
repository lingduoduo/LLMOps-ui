# Marketplace Integration Implementation Plan

**Goal:** Consolidate the added English marketplace and API tool code with the working application.
**Architecture:** Keep existing streaming app endpoints and shared response types. Add typed tool services, protected marketplace routes, stable provider selection, and a custom API tool editor using existing API endpoints. Keep Vue, Arco, and Tailwind 4; avoid a date library dependency.

- [x] Restore app service/model compatibility and verify existing regression tests.
- [x] Define explicit built-in/API tool models; unify response envelopes and encoded service paths; test service contracts.
- [x] Integrate the marketplace: categories/search, stable details, load/retry/error states, native date formatting, and custom tool creation/edit/delete. Test failure and filtering flows.
- [x] Connect protected routes/navigation; replace the app marketplace placeholder with the existing application list.
- [x] Restore Tailwind 4/Arco layers and retain scrollbar utilities; format and lint new code.
- [x] Run all unit tests, type checks, production build, and browser verification if available.

Decisions: Backend timestamps are Unix seconds (as in authentication). Custom provider detail responses use the shared BaseResponse envelope. Preserve new icons as supplied. Keep workspace changes in place and do not publish without a new request.

Validation: 55 tests across 15 files passed; production build/type-check, ESLint, Prettier, and git diff --check passed. Final independent code review found no blocking issues. Browser automation tools were unavailable, so no browser or live-backend verification was performed.

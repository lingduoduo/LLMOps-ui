# Complete Sidebar Features

Goal: Restore every action from the sidebar sample as a working English feature on PR #14.

Verified against LLMOps-Flask-Service main router and schemas on 2026-11-08:
- App creation: POST /apps with name (1–40), absolute icon URL, description (up to 800); response data.id.
- Account: POST /account/name (3–30), /account/avatar (absolute URL), /account/password (8–16, letter and digit).
- API keys: paginated GET and create POST /openapi/api-keys; update, activation and deletion POST routes under encoded key ID. Mutations return success messages; refresh the list for new keys.

- [x] Add create-app service/form, validation, and redirect to the new app's editor.
- [x] Add account name/avatar/password settings with success/error states.
- [x] Add Open API key list/create/edit/activate/delete with masked secrets and pagination.
- [x] Wire Create AI Application, Open API, Account settings, and account menu into protected routes.
- [x] Verify service/UI tests, existing behavior, build, lint, formatting, and review.
- [x] Commit/push to existing PR #14 and update its description around the complete scope.

No live account/API mutations are needed for verification: tests use mocked responses. Do not store API keys/passwords in local storage, URLs, or logs. Keep existing app chat and sidebar behavior.

Validation: all 87 tests across 21 files, production build/type-check, ESLint, Prettier, and whitespace checks passed. Review found a create-from-page-two API-key issue; fixed with a regression test. Keyboard focus handling also verified for the deletion dialog. Live backend/browser verification was unavailable; API behavior is covered with mocked requests.

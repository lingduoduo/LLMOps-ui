# LLMOps UI

LLMOps UI is a Vue 3 frontend built with TypeScript and Vite. It currently
contains a small application-debugging interface and supporting starter pages.
This repository contains the frontend; backend, model-serving, and deployment
services described in earlier versions of this README are not included here.

## Current features

- Password login, expiring bearer credentials in tab-scoped session storage,
  protected routes, current-account information, and logout.
- Searchable, paginated applications from the backend, plus direct app-ID entry.
- Draft prompt and conversation-round editing, with model/capability information.
- Streamed debug conversations with visible errors, retryable input, and
  cancellation on clear/navigation. Clearing resets the backend conversation.
- Arco Design for Vue components and Tailwind CSS utilities.

The frontend integrates with
[LLMOps-Flask-Service](https://github.com/lingduoduo/LLMOps-Flask-Service).
It does not include that backend or its database/model infrastructure. App
creation, advanced tool/dataset/model configuration, and historical message
browsing are not implemented in this UI.

## Tech stack

- Vue 3 and TypeScript
- Vite
- Vue Router
- Pinia
- Arco Design for Vue
- Tailwind CSS
- Vitest and Vue Test Utils

## Development setup

Node 22 (22.12+) is recommended; see `.nvmrc`. Node 20.19+ and Node 24+
are also supported. Install dependencies:

```sh
npm ci
```

Start the development server with hot reload:

```sh
npm run dev
```

## Backend configuration

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` if needed.
The default `/api` prefix uses Vite's development proxy to
`http://localhost:5000`, stripping `/api` before forwarding.
Alternatively, set an absolute backend URL such as
`VITE_API_BASE_URL=https://backend.example.com`. These values are public,
build-time settings; do not put secrets in them.

For production, either configure your web server to proxy `/api` to the backend,
or set an absolute URL before building. The Vite development proxy is not part
of the production build. Cross-origin backends must allow the frontend origin
and credentials in their CORS configuration. Configure SPA fallback to
`index.html` for frontend routes.

The API contracts are taken from the backend's
[router](https://github.com/lingduoduo/LLMOps-Flask-Service/blob/main/internal/router/router.py),
[authentication schema](https://github.com/lingduoduo/LLMOps-Flask-Service/blob/main/internal/schema/auth_schema.py),
and [app service](https://github.com/lingduoduo/LLMOps-Flask-Service/blob/main/internal/service/app_service.py):

- `POST /auth/password-login` accepts `{email,password}` and returns
  `{code:"success",message:"",data:{access_token,expire_at}}`.
  `expire_at` is a Unix timestamp in seconds. Use an existing backend account;
  the UI does not create accounts.
- Authenticated requests send `Authorization: Bearer <access_token>`.
  `GET /account` loads the profile; `POST /auth/logout` signs out. Unauthorized
  responses clear the local session and return to login, including when the
  backend returns HTTP 200 with `code:"unauthorized"`.
- `GET /apps` accepts `current_page`, `page_size`, and `search_word` and returns
  a `{list,paginator}` data payload.
- `GET/POST /apps/{app_id}/draft-app-config` loads and updates draft settings.
  Saving sends only `preset_prompt` and `dialog_round`.
- `POST /apps/{app_id}/conversations` accepts `{query}` and returns SSE.
  `agent_message` events append answer fragments; `agent_end` completes a reply;
  errors and interrupted streams display a failure. The previous `/debug`
  JSON endpoint is not used.
- Clear uses `POST /apps/{app_id}/conversations/delete-debug-conversation`.
  Cancellation also attempts to stop a known backend task through
  `POST /apps/{app_id}/conversations/tasks/{task_id}/stop`.

Requests time out after 100 seconds and abort their network operation. Chat
messages are displayed for the current view; the backend maintains conversation
context across requests. Navigation clears the local preview and cancels active
work, while Clear also resets server context.

## Checks and production build

Type-check and build for production:

```sh
npm run build
```

Run unit tests:

```sh
npm run test:unit -- --run
```

Lint the project (use `npm run lint:fix` to apply automatic fixes):

```sh
npm run lint
```

## Recommended editor setup

Use [Visual Studio Code](https://code.visualstudio.com/) with the
[Vue - Official extension (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar).
Disable Vetur if it is installed.

`vue-tsc` provides TypeScript checking for `.vue` files. See the
[Vite configuration reference](https://vite.dev/config/) for configuration
details.

## Disclaimer

This repository and its contents are collected and shared solely for academic
and research purposes. All code, data, and related materials are intended to
support independent study, experimentation, and learning.

If you believe any part of this repository inadvertently includes content
that should not be shared publicly or may cause concern, please contact me
immediately. I will review and, if necessary, remove the material without
delay.

I do not claim ownership of any third-party data or content and have made
every effort to respect intellectual property and privacy rights.

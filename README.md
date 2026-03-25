# DocSqueeze frontend

This repo is the **frontend** for DocSqueeze. It provides a Next.js UI for three PDF workflows:

- compress one or many PDFs
- merge multiple PDFs into one
- split a PDF into all pages or a custom range

## Reality check

This repository is **not** the backend. The browser uploads files to a configured DocSqueeze API.

Current frontend status:
- real: compress UI, merge UI, split UI, dark mode, API status check
- placeholder: Google Drive and Dropbox import buttons
- not published here: privacy page, terms page, contact page

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui primitives
- sonner for toasts

## API configuration

By default the frontend talks to:

```env
https://doc-squeeze-api.onrender.com
```

Override it locally with:

```env
NEXT_PUBLIC_DOCSQUEEZE_API_URL=http://localhost:4000
```

That value is read from `src/lib/config.ts`.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

```bash
npm run lint
npm run build
npm run start
```

## Repo hygiene

The repo now ignores local/editor artifacts and generated local test outputs such as:

- `.history/`
- `.brv/`
- loose root-level `*.pdf`, `*.png`, and `*.cs` files

If you want committed sample assets, keep them under `public/` or an intentional fixtures folder.

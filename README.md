# PartyTube

A real-time YouTube watch party app built with React, Express, Socket.IO, and SQLite.

## Run locally

1. Enable pnpm (included with current Node.js): `corepack enable`
2. Install dependencies: `corepack pnpm install`
3. Start development mode: `corepack pnpm dev`
3. Open `http://localhost:5173`

## What it does

- Create rooms and share their unique link or code.
- Sync play, pause, seek, and video changes with Socket.IO.
- Persist room state in SQLite at `data/partytube.db`.
- Enforce permissions on the server: the creator is host, joiners are participants, and hosts can promote participants to moderators or remove them.

## Architecture

The React client embeds YouTube through the IFrame API and sends approved user actions to the Socket.IO server. The server validates the sender's role, updates the room's canonical state, saves it to SQLite, and broadcasts that state to every connected room member. Participants receive the same state but cannot issue playback actions.

## Deployment

Set `PORT` on a Node-compatible host such as Render or Railway. Build with `pnpm build`, then run `pnpm start`. Add the deployed public URL here after deployment.

# PeerLens

PeerLens now runs with the SvelteKit Node adapter and includes a lightweight SQLite-backed signaling store for WebRTC session metadata (SDP + ICE candidates).

WebRTC is configured LAN-only (no STUN/TURN servers), so both peers are expected to be on the same local network.

## Developing

### Signaling DB configuration

By default, signaling data is stored at `.data/peerlens.sqlite`.

```sh
# optional: custom SQLite file path
PEERLENS_DB_PATH=.data/peerlens.sqlite

# optional: offer/session TTL (default: 600 = 10 minutes)
PEERLENS_OFFER_TTL_SECONDS=600

# optional: periodic cleanup frequency (default: 60 seconds)
PEERLENS_CLEANUP_INTERVAL_SECONDS=60

# optional: delete unconnected sessions after (default: 120 = 2 minutes)
PEERLENS_UNCONNECTED_SESSION_TTL_SECONDS=120

# optional: delete connected sessions after (default: 7200 = 2 hours)
PEERLENS_CONNECTED_SESSION_TTL_SECONDS=7200

# optional: remove old ICE candidates (default: 1200 seconds)
PEERLENS_ICE_MAX_AGE_SECONDS=1200

# optional: keep at most N recent ICE candidates per role per session (default: 64)
PEERLENS_ICE_MAX_CANDIDATES_PER_ROLE=64
```

Once you've created a project and installed dependencies with `bun install` (or `pnpm install` or `yarn`), start a development server:

```sh
bun --bun run dev

# or start the server and open the app in a new browser tab
bun --bun run dev -- --open
```

### Viewer host configuration

For the desktop viewer QR flow, configure the public host origin that phones should open:

```sh
# example .env
PUBLIC_APP_HOST=http://192.168.1.50:5173
```

If this is not set, the app falls back to the current browser origin.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

### Running the Node build

After `npm run build`, run the generated Node server:

```sh
node build
```

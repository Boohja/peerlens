# PeerLens

<div style="text-align: center">
  <img src="static/logo/logo.svg" width=250>
</div>

Pair two devices through their browser, one with a camera.\
Use PeerLens to connect them through WebRTC and watch the video stream of your camera.

## Privacy focus

PeerLens uses only that [data that is absolutely necessary](https://peerlens.sorkos.net/data) to establish a connection between your two devices. \
We don't care for that data, "trust me". No analytics, no account, no mails, nothing.

## Dev documentation

All configuration values are optional since hard-coded default values exist.

If no database address is provided, PeerLens will use SQLite.


### Configuration

By default, signaling data is stored at `.data/peerlens.sqlite`.

```sh
# remote libSQL, otherwise sqlite is used
PEERLENS_DB_URL=libsql://your-database.turso.io
PEERLENS_DB_AUTH_TOKEN=your-token

# custom SQLite file path
PEERLENS_DB_PATH=.data/peerlens.sqlite

# offer/session TTL (default: 600 = 10 minutes)
PEERLENS_OFFER_TTL_SECONDS=600

# periodic cleanup frequency (default: 60 seconds)
PEERLENS_CLEANUP_INTERVAL_SECONDS=60

# delete unconnected sessions after (default: 120 = 2 minutes)
PEERLENS_UNCONNECTED_SESSION_TTL_SECONDS=120

# delete connected sessions after (default: 7200 = 2 hours)
PEERLENS_CONNECTED_SESSION_TTL_SECONDS=7200

# remove old ICE candidates (default: 1200 seconds)
PEERLENS_ICE_MAX_AGE_SECONDS=1200

# keep at most N recent ICE candidates per role per session (default: 64)
PEERLENS_ICE_MAX_CANDIDATES_PER_ROLE=64

# viewer-side answer polling backoff (defaults: 1200..8000 ms)
PUBLIC_PEERLENS_VIEWER_ANSWER_POLL_MIN_MS=1200
PUBLIC_PEERLENS_VIEWER_ANSWER_POLL_MAX_MS=8000

# viewer-side ICE polling backoff (defaults: 800..5000 ms)
PUBLIC_PEERLENS_VIEWER_ICE_POLL_MIN_MS=800
PUBLIC_PEERLENS_VIEWER_ICE_POLL_MAX_MS=5000

# phone-side offer polling backoff (defaults: 700..5000 ms)
PUBLIC_PEERLENS_PHONE_OFFER_POLL_MIN_MS=700
PUBLIC_PEERLENS_PHONE_OFFER_POLL_MAX_MS=5000

# phone-side ICE polling backoff (defaults: 800..5000 ms)
PUBLIC_PEERLENS_PHONE_ICE_POLL_MIN_MS=800
PUBLIC_PEERLENS_PHONE_ICE_POLL_MAX_MS=5000
```
```sh
# optional, otherwise the current location is parsed
PUBLIC_APP_HOST=http://192.168.1.50:5173
```

### Run

```sh
bun install

bun --bun run dev

# or start the server and open the app in a new browser tab
bun --bun run dev -- --open
```

### Viewer host configuration

For the desktop viewer QR flow, configure the public host origin that phones should open:

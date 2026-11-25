# Realtime rooms

## Purpose and facilities

The server side of any application where several people share something live: a game table, a quiz, a planning board. It keeps each room on the server, lets people join under a name, and keeps everyone's screen up to date the moment anything changes. Each person sees only what they are allowed to see: in a card game, a player's own cards are visible to them and to nobody else.

The rules of the activity are not part of it. A game or activity plugs in through a game adapter: the adapter says what a move does, what each person may see and what happens over time, and this component does everything around it:

- It stores the room so nothing is lost when the server restarts.
- It checks each request against the person's private token.
- It refuses out-of-date moves.
- It sends updates over a live connection, with a slower fallback for devices that cannot hold one.
- It runs timers, such as a turn that times out.
- It tells the room list (the room-directory component) who is in each room.

Watchers can follow a room without taking part, and up to six shared screens (a television showing the table) can join with a token that can never act.

It runs on Cloudflare Workers, or on your own machine through server-host. Clients for the web, Apple devices (Swift) and Android (Kotlin) connect to it.

Facilities: `rooms` (Live shared rooms on the server: people join by name, each sees only what they may see, every change reaches every screen at once, and nothing is lost on a restart).

## User inputs

There are no installer settings. The application gives three values in code (`Settings`):

- `applicationId`: a short name for the application, such as `ourpoker`, shown by the server's health check.
- `allowedOrigins`: the web addresses whose pages may use the rooms from a browser, such as `["https://ourpoker.example.com"]`. Pages on `localhost` or `127.0.0.1` (any port) are always allowed, for development. A page from any other site cannot read answers, cannot open a live connection, and is refused (403) if it tries to change anything.
- `roomPrefix`: the prefix of the names under which rooms are stored and video rooms are named, including its separator, such as `ourpoker-`.

Which rooms exist is the list of room ids the application passes to `createWorker`, for example `["one", "two"]`.

## Artefacts and dependencies

Source entry points are `implementation/server/index.ts`, `implementation/web/live.ts`, `implementation/apple/Sources/LiveConnection.swift` and `implementation/android/src/main/java/ae/rooms/RoomTransport.kt`; installed paths replace `implementation/` with `components/realtime-rooms/`. The checks' tools (Wrangler, the Cloudflare test runner, TypeScript) are locked in `package-lock.json`. On Android it uses the application's locked OkHttp and coroutine libraries.

## Provided interfaces

`room-session` (`ae/room-session`) version 1.0.0 is described by three documents: `interfaces/room-session.json` (OpenRPC 1.3.2) for the library calls `createRoomClass`, `createWorker`, `json` and the client transports `Live` (web), `LiveConnection` (Swift) and `RoomTransport` (Kotlin); `interfaces/room-session-http.json` (OpenAPI 3.1.1) for the web routes; `interfaces/room-session-live.json` (AsyncAPI 3.1.0) for the live messages and close codes. Types are JSON Schema 2020-12.

How it behaves: state is saved before anyone is told of a change. A clock tick that changes nothing visible does not change the room's version. Request bodies are limited to 4,096 characters. A person's token is replaced when the same name joins again, and renewed when guest-identity says it is due (an `x-rotated-token` response header, or a `{type:"token"}` live message). Live connections are checked every 25 seconds and a silent player is dropped after 75. At most six shared screens; an idle one is let go after an hour when another joins.

## Required interfaces

- `game-adapter` (`ae/game-adapter` version 1.0.0): the activity's rules, as `GameAdapter<State, Action, View, Options>` in `implementation/server/adapter.ts`; `interfaces/required-game-adapter.json` is a copy of the providing component's document. The adapter owns all game state, rules, options and what each person may see, and must be able to restore (or refuse) the state it saved.
- `guest-identity` (`ae/guest-identity` version 1.0.0): who is who, passed as `services.identity` with `claim`, `authenticate` and `release` (guest-identity's `createIdentityApi(settings)` provides them; `interfaces/required-guest-identity.json` is a copy of its document). `claim` runs when someone joins (a refused name is answered 422 with the reason, such as `badName`), `authenticate` on every request and live message, `release` when they leave. `createRoomClass` refuses to start without it.

The room list is reached through the `DIRECTORY` binding, which the application points at room-directory's `createDirectoryClass`; `interfaces/required-room-directory-http.json` is a copy of room-directory's document of those requests. An optional `services.videoGrant` lets a room hand out video passes (video-calls).

## Integration

The application's server module exports a room class, the directory class and the worker:

```ts
import { createRoomClass, createWorker } from "./components/realtime-rooms/server/index";
export const Room = createRoomClass(adapter, { identity: createIdentityApi(identitySettings) }, settings);
export { Directory } from "./directory";          // room-directory's createDirectoryClass
export default createWorker(settings, ["one", "two"]);
```

Clients join a room with `POST /r/<room>/join` and a name, keep the token they get back, and then either open the live connection (`Live` on the web, `LiveConnection` on Apple, `RoomTransport` on Android) or poll `/r/<room>/state`. Each client turns the view it receives into screens; the component does not draw anything. `fixtures/worker.ts` is a complete small application (a shared counter with a private value per person) that uses no poker code.

## Visual definition and connected examples

`visual/definition.json` shows the game and guest-identity inputs and the session output. `visual/examples/counter.json` connects the counter application, an identity provider and a browser client; the rendered images and descriptions are in `visual/output/`.

## Infrastructure

To run it on the internet you need a Cloudflare account (Workers and Durable Objects). The free plan allows 100,000 requests a day and 5 GB of storage; the paid plan removes the request limit. It also runs on your own machine through server-host, with no account. The checks need neither.

## Verification

The required checks run the component in Cloudflare's local runtime, with no account:

- `npm test`: private values reach only their owner; watchers and shared screens see no private value and cannot act; out-of-date moves are refused; tokens are replaced and renewed; a name the identity component refuses is refused; leaving works; several connections per person work; a deliberate close is told apart from a lost connection; rooms survive a restart; timers fire; the room list is updated; and pages from other sites cannot change anything.
- `node tests/request-body.mjs`: refused uploads are read and discarded safely.
- `npm run typecheck`: the code type-checks.
- `node --test tests/migration.test.ts tests/interfaces.test.ts`: room data can be exported, imported and verified; the interface documents match the code (every adapter and identity method used, every route served, every live message sent); and the guest-identity port is required.

## Scenarios and presentation

Two tables, "one" and "two". Ana and Ben join table one from their phones and each sees their own two cards; Cleo watches and sees neither. The living-room television joins as a shared screen and shows the table without anyone's cards. Ben's phone loses signal; his seat is kept, and when he reconnects with his token he sees where the game is. The server restarts during a hand; nobody loses their chips. A page on another website tries to join on someone's behalf and is refused.

## Updates and removal

Updates replace the source files after the application is checked. The rooms' saved data belongs to the deployment: removing the component does not delete it from Cloudflare or the server's data folder. `migration.json` describes the saved data (key `room`, layout version 1, schema `interfaces/room-state.schema.json`, each room's identity book under `identity`), and the export, import and per-record checks (counts and sha256) that move it between deployments. The room list's data is described by room-directory's `migration.json`.

# TriviaForge client simulator

A standalone tool that connects many fake players to a **running** TriviaForge
room over real Socket.IO connections, so you can watch how the server behaves
under load (join bursts, answer bursts, reveal broadcasts).

It is completely independent of the main application: separate folder,
separate `package.json`, no imports from `app/`.

> The existing `app/testing` suite drives the `/api/debug/*` HTTP endpoints.
> This tool instead plays a room the way phones do: `joinRoom`, then
> `submitAnswer` for each `questionPresented`.

## Setup

```bash
cd client-simulator
npm install
```

Requires Node 18+.

## Usage

1. Start the server and, as a presenter, create a room (note the room code).
2. Run the simulator:

```bash
node simulate.js --server http://192.168.1.10:3000 --room ABCD --clients 100
```

3. Present and reveal questions as the presenter (or enable auto-pilot).
   The simulator stops when the quiz completes or the room closes, after
   `--max-duration`, or on Ctrl-C, then prints a summary.

### Options

| Option | Default | Meaning |
|---|---|---|
| `--server <url>` | required | Server address |
| `--room <code>` | required | Room code to join |
| `--clients <n>` | 10 | Number of simulated players |
| `--no-answer-rate <0-1>` | 0.05 | Chance each client skips a given question |
| `--early-weight <0-1>` | 0.45 | Share of answers clustered near the start of the timer |
| `--late-weight <0-1>` | 0.45 | Share of answers clustered near the end of the timer |
| `--join-stagger-ms <ms>` | 50 | Delay between client connections |
| `--default-time-limit <s>` | 30 | Time limit to assume if the server sends none |
| `--prefix <text>` | `sim` | Username / display name prefix (`sim_1`, `sim-1`, ...) |
| `--no-spoof-ip` | off | Don't send a unique `X-Forwarded-For` per client |
| `--max-duration <s>` | none | Stop after this many seconds |
| `--seed <n>` | random | Repeatable random choices |
| `-v`, `--verbose` | off | Log every client action |

## Behaviour

- **Answers** are random: a random option index for multiple choice and
  true/false, and a random short word for open-ended questions. Correct
  answers are never available to clients (the server withholds them until the
  reveal), so the simulator can't aim for them.
- **Timing:** each answer is delayed by a fraction of the question's time limit
  (`timerDuration` from the server). Roughly 45% land near the start
  (2-15% of the limit), 45% near the end (80-96%), and the rest in between.
  Delays never exceed 96% of the limit, so answers stay inside the server's
  limit-plus-grace window.
- **No answer:** every client independently skips each question with
  probability `--no-answer-rate`.

## Rate limits

The server limits socket joins (default 50/min) and answers (default 300/min)
**per client IP**, reading the `X-Forwarded-For` header. By default each
simulated client sends its own fake address (`10.x.y.z`), so a large run from
one machine doesn't trip the limiter. Use `--no-spoof-ip` to exercise the real
limits instead.

## Output

Progress every 5 seconds, then a summary: clients joined / failed, answers
sent and skipped, answers the server rejected (by reason), and per question the
time between the first and last client receiving `questionPresented` and
`questionRevealed` (a rough view of broadcast delay; all clients share this
machine's clock), plus `playerListUpdate` events received per client.

There is no success acknowledgement for `submitAnswer`, so answer round-trip
time isn't measured.

## Caveats

- **Use a dev/test server.** Joining creates a guest user row per username in
  the server's database (`sim_1`, `sim_2`, ...), and answers are recorded in the
  session like any player's. Reusing the same `--prefix` reuses the same users.
  Cleaning up the `sim_*` guest users afterwards is manual.
- Clients don't reconnect if dropped; drops are counted as disconnects.
- A single machine and Node process caps out somewhere in the low thousands of
  clients; very large runs may measure the simulator rather than the server.

## Tests

```bash
npm test
```

Checks the timing model (two clusters, bounded delay, skip rate) and runs the
simulator end to end against a tiny in-process mock server. It does not need
TriviaForge running.

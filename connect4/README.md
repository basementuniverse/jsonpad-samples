# Connect 4

Two players, one board, no game server. Both players' browsers write to the
same [JSONPad](https://jsonpad.io) item, and JSONPad referees: it checks every
move against the rules of the game before it accepts it.

**Try it:** https://basementuniverse.github.io/jsonpad-samples/connect4/

The page is the untrusted part. Anyone can open the developer console and send
whatever they like, so the rules can't live in the page. They're the list's
[write rules](https://jsonpad.io/docs/write-rules): short statements, in
[`rules/games.rules`](rules/games.rules), that JSONPad checks on every write.
Open the console and try to cheat: move out of turn, play two pieces at once,
rewrite the history, or set the clock back. None of it works.

## What this sample shows

- **Write rules as a referee.** `allow` statements decide who may make a
  write (whose turn it is), and `require` statements check what the write
  contains (one new move, a board that matches the moves, the server's time).
- **Shared items.** Normally only the identity that created an item can change
  it. `shared update;` lets both players write the one game item, with the
  rules deciding when.
- **The server's clock.** The page writes the placeholder
  `"$jsonpad-var:now"`, JSONPad replaces it with the real time, and a rule
  insists it did. A player can't lie about when their turn started.
- **Rule tests.** [`rules/games.tests.json`](rules/games.tests.json) has 18
  tests, which you can run on your own computer without making any requests.
- **Identities, indexes and realtime.** Players sign in, the lobby uses an
  index to find games waiting for a player, and moves reach the other player
  as soon as they're made.
- **Schema sync.** The list, its schema, its index, its rules and their tests
  are described in [`jsonpad-schema.json`](jsonpad-schema.json), which you
  apply with one command.

## What's in this folder

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The page |
| [`app.js`](app.js) | Everything the page does: this is the file to read |
| [`config.js`](config.js) | Where you paste your token (step 6) |
| [`default.css`](default.css) | Styles |
| [`jsonpad-schema.json`](jsonpad-schema.json) | The list, its JSON schema and its index |
| [`rules/games.rules`](rules/games.rules) | The rules of the game, as write rules |
| [`rules/games.tests.json`](rules/games.tests.json) | Tests for those rules |

## What the rules enforce

Open [`rules/games.rules`](rules/games.rules) alongside this list.

- **`shared update;`** Normally an identity can only change items it created,
  so two people could never share one. This lifts that, and the `allow`
  statements take over deciding who may write.
- **Turn order.** Only the player in `currentPlayerId` may move, and only while
  the game is `started`.
- **The history is append-only.** `moves` can gain one entry per write at
  most, and the entries already there can't change. The new entry has to name
  the player who made it, and a real column.
- **The board matches the history.** `pieces(new.board) == length(new.moves)`,
  so nobody can add a piece without recording the move that put it there.
- **The clock is the server's.** A client writes the literal
  `"$jsonpad-var:now"` to `turnStartedAt`, JSONPad replaces it before the
  rules run, and a rule insists the result is the current time.
- **The players are fixed** once the game starts, and the winner has to be
  one of them.
- **A slow turn can be claimed**, but only once two minutes have passed, and
  only by the other player. Nothing is scheduled: nothing happens until
  someone asks, and the rules check the clock when they do.
- **A game nobody has joined can be cancelled** by the player who started it,
  and no other game can be deleted.

What the rules *don't* check is gravity or winning: the page works out where
a piece lands and whether it made four in a row. A determined player could
drop a piece into mid-air, or claim a win early. Adding those checks is a good
exercise: `map`, `all` and `count` are enough for gravity.

## Set it up yourself

It takes about ten minutes. You'll need:

- a web browser;
- [Node.js](https://nodejs.org) version 22.12 or later, for the JSONPad command
  line tool (check with `node --version`);
- a copy of this folder: clone this repository, or download it as a ZIP from
  GitHub (the green **Code** button, then **Download ZIP**).

You don't need a server, a database or a credit card: the free plan is plenty.

### Step 1: Create a JSONPad account

Sign up at [jsonpad.io/register](https://jsonpad.io/register). You'll land on
the dashboard, which is where you'll create tokens in a moment.

### Step 2: Create a setup token

Everything that talks to JSONPad does it with a **token**: a secret string that
says whose account it is, and what it's allowed to do. You'll make two: a
powerful one for yourself, to set things up, and a limited one for the game.

First, the powerful one:

1. In the dashboard, open **Tokens** from the menu and click **Create**.
2. Name it `Setup token`.
3. Under **Permissions**, switch to the **JSON** tab and paste this, which
   allows everything:

   ```json
   [
     {
       "mode": "allow",
       "action": "*"
     }
   ]
   ```

4. Click **Create**. On the token's page, click the eye icon next to **Token**
   to show it, then the clipboard icon to copy it.

> [!WARNING]
> This token can do anything to your account, so keep it to yourself. Never put
> it in a web page. You can delete it from the dashboard once you're done.

If you've already set up one of the other samples, you can use the same setup
token, and skip to step 4.

### Step 3: Install the command line tool

Open a terminal and install the JSONPad CLI:

```bash
npm install -g @basementuniverse/jsonpad-cli
```

Then save your setup token, so you don't have to paste it into every command.
This asks for the token, and stores it where only you can read it:

```bash
jsonpad config set-profile personal
```

Check that it works:

```bash
jsonpad whoami
```

You should see your token's name and your plan's limits.

### Step 4: Create the list

In the terminal, go to this folder (the one with `jsonpad-schema.json` in it):

```bash
cd path/to/jsonpad-samples/connect4
```

The CLI has its own copy of JSONPad's rules engine, so you can check the rules
and run their tests before sending anything anywhere:

```bash
jsonpad rules check rules/games.rules --strict
jsonpad rules test rules/games.rules
```

You should see `compiles`, then 18 ticks. Now see what a sync would do,
without changing anything:

```bash
jsonpad sync-schema --dry-run
```

It runs the tests again, then shows the list and the index it would create,
and the rules line by line. There's one **warning**, about `shared update`:
it's there to make sure you meant it, and you did.

Now do it for real:

```bash
jsonpad sync-schema --wait
```

`--wait` waits for the new index to be built, which takes a second or two.
If you open **Lists** in the dashboard now, you'll see **Connect 4 Games**. Its
**Rules** page has an editor for the rules, and a playground for trying writes
against them.

### Step 5: Create the game's token

The game needs a token too. It's going to be in the web page, where anyone can
see it, so it gets only the permissions the game needs.

Permissions refer to lists by their id, so get your new list's id first:

```bash
jsonpad lists get connect4-games -o id
```

(You can also find it on the list's page in the dashboard, with a copy button.)

Now create the token, like in step 2: **Tokens**, **Create**, name it
`Connect 4 token`, and paste this into the **JSON** tab, replacing each
`YOUR LIST ID` with the id you just copied:

```json
[
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "list",
    "listIds": ["YOUR LIST ID"]
  },
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "create-with-identity",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"]
  },
  {
    "mode": "allow",
    "action": "update-with-identity",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "delete-with-identity",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "register",
    "resourceType": "identity",
    "groups": ["connect4-players"]
  },
  {
    "mode": "allow",
    "action": "authenticate",
    "resourceType": "identity",
    "groups": ["connect4-players"]
  }
]
```

Here's what each one is for:

| Permission | Lets the game… |
| --- | --- |
| `view` list | …use the list, and receive its realtime events |
| `view` items | …show every game in the lobby, and load them |
| `create-with-identity` | …start a game, as a signed-in player |
| `update-with-identity` | …make moves, as a signed-in player |
| `delete-with-identity` | …cancel a game, as a signed-in player |
| `register` in `connect4-players` | …create a player the first time someone picks a name |
| `authenticate` in `connect4-players` | …sign players in |

These are ordinary permissions: nothing here says anything about the game. On
their own, `update-with-identity` would only let a player change games they
started. It's `shared update;` in the rules that lets both players write the
same game, and the rules that decide when.

You don't need to create the `connect4-players` identity group yourself. It
appears the first time somebody signs in.

### Step 6: Paste the token into the game

Open [`config.js`](config.js) in a text editor, and replace
`PASTE YOUR CONNECT 4 TOKEN HERE` with the new token's value (not the setup
token!). Keep the quotes around it:

```js
const JSONPAD_TOKEN = 'your-token-goes-here';
```

The token is in the page, where anyone can read it. That's fine: it can't do
anything the rules don't allow.

### Step 7: Play

Open `index.html` in your browser: double-clicking it usually works.

> [!NOTE]
> If your browser won't run the page from a file, serve the folder instead:
> run `npx http-server` in this folder, and open the address it prints.

You need two players, so open the page twice: in two browser windows (one of
them private, so they don't share a saved name), or on two devices. Pick a
different name in each. Everyone shares the same password, because this sample
is about the rules, not about passwords.

In the first window, click **Start a new game**. In the second, it appears
under **Games waiting for a player**: click to join, and take turns.

> [!NOTE]
> On the free plan, an account can have **one realtime connection at a
> time**, so only the first window gets moves the instant they're made. The
> other one says *Realtime connection limit reached* at the bottom, and checks
> for moves every five seconds instead. That's enough to play, and paid plans
> allow more connections: see
> [limits and quotas](https://jsonpad.io/docs/limits-and-quotas).

## Try to cheat

Start a game, make a couple of moves, and when it's your turn, open the
developer console in that window. The page's own client is there as
`jsonpad`, the game as `game`, and you as `me`, so you can send exactly what a
cheat would. Paste these in one block at a time.

The comment under each one shows what happens: the error's type, the HTTP
status, and the reason. In the console, the reason is the `message` inside
the JSON the error prints.

Play a piece on every empty square at once:

```js
await jsonpad.replaceItemData('connect4-games', game.id, {
  ...game.data,
  board: game.data.board.map(row => row.map(cell => cell || 1)),
  moves: [...game.data.moves, { playerId: me.id, column: 0 }],
});
// WriteRuleError (400): the board must hold exactly one piece per recorded move
```

Rewrite history, and start the game again:

```js
await jsonpad.replaceItemData('connect4-games', game.id, {
  ...game.data,
  board: game.data.board.map(row => row.map(() => 0)),
  moves: [],
});
// WriteRuleError (400): moves can only be added, one at a time
```

Say your turn started long ago, so you can claim the next one:

```js
await jsonpad.replaceItemData('connect4-games', game.id, {
  ...game.data,
  turnStartedAt: '2020-01-01T00:00:00Z',
});
// WriteRuleError (400): write "$jsonpad-var:now" to /turnStartedAt
```

Now wait for your opponent's turn, and try to move anyway:

```js
await jsonpad.replaceItemData('connect4-games', game.id, {
  ...game.data,
  currentPlayerId: me.id,
});
// WriteRuleError (403): Write denied by list rules
```

That last one is a 403 with no reason given. When a `require` statement fails,
it says why, in the words its author wrote (they're the `else` messages in the
rules). When no `allow` statement permits a write at all, the rules don't
explain themselves.

Every write the rules refuse is recorded. Back in your terminal, see what
you've been up to:

```bash
jsonpad lists rules denials connect4-games
```

## How it works

Open [`app.js`](app.js) alongside this section.

**Signing in.** `signIn()` tries to log in with the name you picked, and
registers it first if nobody has used it yet. `loginIdentity()` makes the
page's JSONPad client send that player's identity with every request after
that.

**Reading games without an identity.** A request made with an identity only
sees the items that identity created, and games are shared. So every read
passes `{ ignore: true }`, which leaves the identity out for that one request.

**The lobby.** The list has an index on `/status` with filtering turned on, so
`refreshLobby()` asks JSONPad for games with `status: 'waiting'` and
`status: 'started'` directly, rather than fetching everything and sorting
through it.

**Replacing, not merging.** Moves are written with `replaceItemData()`, which
replaces the whole game with what's sent. The alternative, `updateItemData()`,
*merges* what's sent into the item, and merging two arrays joins them
together: every move would add the whole history again. The rules would refuse
that, rightly.

**Keeping up.** The page listens for realtime events on the list: a move by the
other player arrives as an `item-updated` event carrying the game, and new or
cancelled games refresh the lobby. When the page can't get a realtime
connection, it checks the open game every five seconds instead.

**Going too fast.** Every plan limits how quickly an account can make requests:
one every 100ms on the free plan, shared by everyone playing. `retrying()`
waits a moment and tries again when a request is refused for that (a `429`
response).

## Changing the rules

Edit [`rules/games.rules`](rules/games.rules), run the tests, and sync:

```bash
jsonpad rules test rules/games.rules
jsonpad sync-schema
```

The rules and their tests are checked on your computer first, and again by
JSONPad, which won't save rules whose tests fail. So a broken rule never
reaches a real game.

To try a rule out without saving it, use the playground on the list's
**Rules** page in the dashboard, or `jsonpad rules eval`: see
`jsonpad rules eval --help`.

## Ideas for taking it further

- Make the rules check gravity: a new piece has to land in the lowest empty
  row of its column.
- Make the rules check wins, so a player can't claim one they didn't earn.
- Add a spectator mode: anyone can watch a game without signing in.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| "This copy of the sample hasn't been set up yet" | `config.js` still has the placeholder in it (step 6) |
| "Token not authorized" when signing in | The `register` and `authenticate` permissions: is the group `connect4-players`? |
| "Token not authorized" when playing | The item permissions: are the list ids right? Did you use the game's token, not the setup token? |
| "Invalid token" or nothing happens | Did you copy the whole token? Is it **Activated** on its page in the dashboard? |
| The other player's moves take a few seconds to appear | That window doesn't have a realtime connection. See the note in step 7 |
| "You can't do that right now" | The rules refused a move, probably because the other player moved first. The game reloads itself |

## Find out more

- [Write rules](https://jsonpad.io/docs/write-rules), and the
  [rules reference](https://jsonpad.io/docs/write-rules-reference) and
  [recipes](https://jsonpad.io/docs/write-rules-recipes)
- [Getting started with JSONPad](https://jsonpad.io/docs/getting-started)
- [Identities](https://jsonpad.io/docs/identities)
- [Realtime updates](https://jsonpad.io/docs/realtime-updates)
- [Variables](https://jsonpad.io/docs/variables), like `$jsonpad-var:now`
- [Schema sync](https://jsonpad.io/docs/schema-sync)
- [The command line tool](https://jsonpad.io/docs/command-line-tool)
- [Token permissions](https://jsonpad.io/docs/token-permissions)

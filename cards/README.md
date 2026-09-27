# Twenty-one

A card game for two, with no game server and nothing to trust in the page.
Each player's browser can read the game, and that's all it can do. Every move
(starting a game, joining one, drawing a card, standing) is a call to a
[flow](https://jsonpad.io/docs/flows) on [JSONPad](https://jsonpad.io): a small
program drawn in the dashboard, which checks whose turn it is, deals the top
card of a deck the players can't see, and works out the totals and the winner.

**Try it:** https://basementuniverse.github.io/jsonpad-samples/cards/

The rules are simple. Each player in turn draws cards, trying to get as close
to 21 as they can without going over. Number cards are worth their number,
picture cards 10, and aces 11 or 1. A player who goes over 21 is bust. When
both players have stood (or gone bust), the higher total wins.

## What this sample shows

- **Endpoint flows.** One flow, `POST /flows/cards`, makes every move. The page
  calls it with `jsonpad.runFlow('cards', { action: 'draw', gameId })`, and the
  flow's `switch` node sends each action down its own branch.
- **A hidden deck.** Each game's deck is shuffled by JSONPad, and kept in a
  list the page's token has no permissions on at all. Only the flow reads it,
  so nobody can see what's coming.
- **Moves that happen together, or not at all.** Drawing takes the top card
  off the deck and adds it to your hand in one transaction. Two clicks at once
  can't deal the same card twice.
- **A read-only client.** The page's token can read games, and run the flow.
  It can't write anything, so there's nothing in the console to cheat with.
- **The command pattern.** The flow does its own checks, with `require`
  nodes: you're signed in, it's your turn, the game exists.
- **Flow tests.** [`flows/cards.tests.json`](flows/cards.tests.json) has 15
  tests, which you can run on your own computer without making any requests.
- **Schema sync.** The lists and the flow are described in
  [`jsonpad-schema.json`](jsonpad-schema.json), which you apply with one
  command.

## What's in this folder

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The page |
| [`app.js`](app.js) | Everything the page does: this is the file to read |
| [`config.js`](config.js) | Where you paste your token (step 7) |
| [`default.css`](default.css) | Styles |
| [`jsonpad-schema.json`](jsonpad-schema.json) | The lists, their JSON schema, and the flow |
| [`flows/cards.flow.json`](flows/cards.flow.json) | The flow that makes every move |
| [`flows/cards.tests.json`](flows/cards.tests.json) | Tests for the flow |

## How the flow works

Open [`flows/cards.flow.json`](flows/cards.flow.json) alongside this list, or
better, open the flow in the dashboard once you've set it up (step 5), where
you can see it as a graph.

- **`signed_in`** refuses anyone who isn't signed in as a player (401).
- **`action`** is a `switch`: it follows the edge for `new-game`, `join`,
  `draw` or `stand`, and anything else goes to `unknown`, which refuses it.
- **New game.** `shuffled` creates a deck in `cards-decks`. Its data is the 52
  cards in order, and `"$jsonpad-var:random-shuffle(/source)"`, which JSONPad
  replaces with the same cards in a random order it chooses. `created` creates
  the game, and `started` responds with its id.
- **Join.** `join_game` reads the game, `waiting` and `not_in_it` check it's
  waiting for a player and you're not already in it, and `join` adds you. Its
  `ifVersion` means that if two people join at once, only one of them gets in.
- **Draw.** `draw_game` reads the game, and `draw_turn` checks it's your turn.
  `deck` reads the hidden deck, `card` takes its first card, and `take` removes
  it from the deck. `with_card` works out your new hand and total with the
  flow's helper functions (`score` counts aces as 11 or 1), and `draw_save`
  writes the game: if you went over 21, your turn is over, and if you were the
  last to play, so is the game.
- **Stand.** The same, without a card.

Everything a run writes happens together. If any step refuses (it's not your
turn, the game doesn't exist), nothing is written, and the page is told why in
the words on the `require` node.

## Set it up yourself

It takes about ten minutes. You'll need:

- a web browser;
- [Node.js](https://nodejs.org) version 22.12 or later, for the JSONPad command
  line tool (check with `node --version`);
- a copy of this folder: clone this repository, or download it as a ZIP from
  GitHub (the green **Code** button, then **Download ZIP**).

You don't need a server, a database or a credit card: the free plan is plenty.
It allows two flows, and this sample uses one.

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

It has to be allowed everything: a flow runs with your full privileges, so
only a token that can already do anything is allowed to create one.

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

### Step 4: Check and test the flow

In the terminal, go to this folder (the one with `jsonpad-schema.json` in it):

```bash
cd path/to/jsonpad-samples/cards
```

The CLI has its own copy of JSONPad's flows engine, so you can check the flow
and run its tests before sending anything anywhere:

```bash
jsonpad flows check flows/cards.flow.json --strict
jsonpad flows test flows/cards.flow.json
```

You should see `compiles`, then 15 ticks. The tests run the flow against a few
made-up games and decks, kept in memory: see
[`flows/cards.tests.json`](flows/cards.tests.json).

### Step 5: Create the lists and the flow

See what a sync would do, without changing anything:

```bash
jsonpad sync-schema --dry-run
```

It runs the flow's tests again, then shows the two lists, the index and the
flow it would create. Now do it for real:

```bash
jsonpad sync-schema --wait
```

`--wait` waits for the new index to be built, which takes a second or two.
In the dashboard, **Lists** now has **Twenty-one Games** and **Twenty-one
Decks**, and **Flows** has **cards**. Open it to see the flow as a graph; its
page will list every run once people start playing.

### Step 6: Create the game's token

The game needs a token too. It's going to be in the web page, where anyone can
see it, so it gets only the permissions the game needs.

Permissions refer to lists by their id, so get the games list's id first:

```bash
jsonpad lists get cards-games -o id
```

(You can also find it on the list's page in the dashboard, with a copy button.)

Now create the token, like in step 2: **Tokens**, **Create**, name it
`Twenty-one token`, and paste this into the **JSON** tab, replacing each
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
    "action": "run-with-identity",
    "resourceType": "flow",
    "flowIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "register",
    "resourceType": "identity",
    "groups": ["cards-players"]
  },
  {
    "mode": "allow",
    "action": "authenticate",
    "resourceType": "identity",
    "groups": ["cards-players"]
  }
]
```

Here's what each one is for:

| Permission | Lets the game… |
| --- | --- |
| `view` list | …use the games list, and receive its realtime events |
| `view` items | …show every game in the lobby, and load them |
| `run-with-identity` flow | …call the flow, as a signed-in player |
| `register` in `cards-players` | …create a player the first time someone picks a name |
| `authenticate` in `cards-players` | …sign players in |

That's all. There's no permission to create, change or delete anything, and
none at all on the decks list. The flow can still do all of it, because a flow
runs with your privileges, not the token's.

`"flowIds": ["*"]` lets the token run any of your endpoint flows. To let it run
only this one, open the flow in the dashboard, copy its **Id**, and use that
instead of `"*"`.

### Step 7: Paste the token into the game

Open [`config.js`](config.js) in a text editor, and replace
`PASTE YOUR TWENTY-ONE TOKEN HERE` with the new token's value (not the setup
token!). Keep the quotes around it:

```js
const JSONPAD_TOKEN = 'your-token-goes-here';
```

### Step 8: Play

Open `index.html` in your browser: double-clicking it usually works.

> [!NOTE]
> If your browser won't run the page from a file, serve the folder instead:
> run `npx http-server` in this folder, and open the address it prints.

You need two players, so open the page twice: in two browser windows (one of
them private, so they don't share a saved name), or on two devices. Pick a
different name in each.

In the first window, click **Start a new game**. In the second, it appears
under **Games waiting for a player**: click to join. The player who started the
game goes first.

> [!NOTE]
> On the free plan, an account can have **one realtime connection at a
> time**, so only the first window sees moves the instant they're made. The
> other checks for moves every five seconds instead. Paid plans allow more
> connections: see
> [limits and quotas](https://jsonpad.io/docs/limits-and-quotas).

## Try to cheat

Start a game, and open the developer console. The page's own client is there
as `jsonpad`, the game as `game`, and you as `me`. Paste these in one at a
time.

Take a look at the deck, to see what's coming:

```js
await jsonpad.fetchItem('cards-decks', game.data.deckId, { includeData: true }, { ignore: true });
// JSONPadError (403): Token not authorized
```

Give yourself a perfect hand:

```js
await jsonpad.updateItemData('cards-games', game.id, {
  players: game.data.players.map(p => ({ ...p, total: 21 })),
});
// JSONPadError (403): Token not authorized
```

Draw when it isn't your turn (wait for the other player's turn first):

```js
await jsonpad.runFlow('cards', { action: 'draw', gameId: game.id });
// FlowError (403): it's not your turn
```

The last one got as far as the flow, which refused it: a `require` node
checked whose turn it was. The error says why, and at which node:

```js
try {
  await jsonpad.runFlow('cards', { action: 'draw', gameId: game.id });
} catch (error) {
  console.log(error.flowMessage, error.node, error.runId);
}
```

Every run, including the ones that were refused, is in the flow's run log in
the dashboard, with which way each node went.

## How it works

Open [`app.js`](app.js) alongside this section.

**Signing in.** `signIn()` tries to log in with the name you picked, and
registers it first if nobody has used it yet. `loginIdentity()` makes the
page's JSONPad client send that player's identity with every request after
that, so the flow sees them as `identity`.

**Moves.** `play()` calls the flow: `jsonpad.runFlow('cards', { action, ... })`.
A move that's refused throws a `FlowError`, whose `flowMessage` is the message
the flow's `require` node gives, like "it's not your turn".

**Reading games without an identity.** A request made with an identity only
sees the items that identity created, and games are created by the flow, not
by anyone's identity. So every read passes `{ ignore: true }`, which leaves the
identity out for that one request.

**The lobby.** The games list has an index on `/status` with filtering turned
on, so `refreshLobby()` asks JSONPad for the games that are `waiting` and
`playing` directly.

**Keeping up.** A flow's writes send realtime events like any other write, so
the page listens for them: the other player's move arrives as an
`item-updated` event carrying the game. When the page can't get a realtime
connection, it checks the open game every five seconds instead.

## Changing the flow

The easiest way is in the dashboard: open **Flows**, then **cards**, and click
**Edit**. The **Test** tab runs your changes against your real data, then rolls
back everything they did, so you can try things out on a real game.

To keep the file in this folder as the source of truth instead, edit
[`flows/cards.flow.json`](flows/cards.flow.json), run the tests, and sync:

```bash
jsonpad flows test flows/cards.flow.json
jsonpad sync-schema
```

The flow and its tests are checked on your computer first, and again by
JSONPad, which won't save a flow whose tests fail. Where the nodes sit in the
dashboard isn't part of the comparison, so you can tidy the graph up there
without the file getting out of date.

## Ideas for taking it further

- Let more than two people play. The `join` node starts the game as soon as a
  second player joins: add a `start` action for the first player instead, and
  raise `maxItems` on `players` in the list's JSON schema.
- Add a dealer, who draws until 17, as a branch that runs when the last player
  stands.
- Keep a leaderboard: an [event flow](https://jsonpad.io/docs/flows-events)
  that watches `cards-games`, and adds one to the winner's score when a game
  finishes.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| "This copy of the sample hasn't been set up yet" | `config.js` still has the placeholder in it (step 7) |
| "Token not authorized" when signing in | The `register` and `authenticate` permissions: is the group `cards-players`? |
| "Token not authorized" when starting a game | The `run-with-identity` permission (step 6). Did you use the game's token, not the setup token? |
| "Flow not found" | Did the sync in step 5 apply? Is the flow **Active** on its page in the dashboard? |
| "Max flows exceeded" when syncing | The free plan allows two flows: delete one you don't need in the dashboard |
| "Rate limit exceeded" | The free plan allows 60 requests a minute across the whole account, and two open games use about half of that. Wait a minute |
| The other player's moves take a few seconds to appear | That window doesn't have a realtime connection. See the note in step 8 |

## Find out more

- [Flows](https://jsonpad.io/docs/flows), and the
  [flows reference](https://jsonpad.io/docs/flows-reference)
- [Variables](https://jsonpad.io/docs/variables#shuffling), like
  `$jsonpad-var:random-shuffle`
- [Getting started with JSONPad](https://jsonpad.io/docs/getting-started)
- [Identities](https://jsonpad.io/docs/identities)
- [Realtime updates](https://jsonpad.io/docs/realtime-updates)
- [Schema sync](https://jsonpad.io/docs/schema-sync)
- [The command line tool](https://jsonpad.io/docs/command-line-tool)
- [Token permissions](https://jsonpad.io/docs/token-permissions)

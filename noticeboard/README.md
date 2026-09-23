# Notice Board

A shared notice board. Click anywhere to pin up a note, type on it, drag it
around, or take it down. Everyone looking at the board sees every change as it
happens.

**Try it:** https://basementuniverse.github.io/jsonpad-samples/noticeboard/

There's no server here besides [JSONPad](https://jsonpad.io). Each note is an
item in a JSONPad list with **realtime** turned on, so whenever a note is
added, changed or removed, JSONPad sends an event to every open copy of the
page, and each one updates its board to match.

## What this sample shows

- **Realtime events.** The page listens for `item-created`, `item-updated` and
  `item-deleted` events with the
  [realtime SDK](https://www.npmjs.com/package/@basementuniverse/jsonpad-realtime-sdk),
  and each event carries the note as it is now.
- **Collaborating without conflicts getting in the way.** Two people typing on
  the same note at once don't trip each other up: the page never overwrites
  text you've typed that hasn't been saved yet.
- **Coping without realtime.** Every plan limits how many realtime connections
  an account can have at once. When the page can't get one, it says so, and
  checks for changes every few seconds instead.
- **An app with no sign-in.** Anyone can add and change notes, so the token's
  permissions are plain `create`, `update` and `delete`.
- **JSON schema validation and write rules** keep a public board tidy: notes
  must look like notes, and nobody can recolour someone else's.
- **Schema sync.** The list, its schema and its rules are described in one
  file, [`jsonpad-schema.json`](jsonpad-schema.json), which you apply with one
  command.

## What's in this folder

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The page |
| [`app.js`](app.js) | Everything the page does: this is the file to read |
| [`config.js`](config.js) | Where you paste your token (step 6) |
| [`default.css`](default.css) | Styles |
| [`jsonpad-schema.json`](jsonpad-schema.json) | The list and its JSON schema |
| [`rules/notes.rules`](rules/notes.rules) | The list's write rules |
| [`rules/notes.tests.json`](rules/notes.tests.json) | Tests for those rules |

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
powerful one for yourself, to set things up, and a limited one for the app.

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
cd path/to/jsonpad-samples/noticeboard
```

First, see what would happen, without changing anything:

```bash
jsonpad sync-schema --dry-run
```

This reads [`jsonpad-schema.json`](jsonpad-schema.json), runs the write rules'
tests on your computer (you'll see five ticks), and shows the list it would
create. It also prints two **warnings** about the rules. They're expected: they
say the rules only *check* writes, and leave the question of *who* may write
to the token's permissions, which is exactly how this app works.

Now do it for real:

```bash
jsonpad sync-schema
```

If you open **Lists** in the dashboard now, you'll see **Notice Board
Notices**. Its page shows that realtime is on, along with its schema and its
rules.

### Step 5: Create the app's token

The app needs a token too. It's going to be in the web page, where anyone can
see it, so it gets only the permissions the app needs.

Permissions refer to lists by their id, so get your new list's id first:

```bash
jsonpad lists get notice-board-notices -o id
```

(You can also find it on the list's page in the dashboard, with a copy button.)

Now create the token, like in step 2: **Tokens**, **Create**, name it
`Notice Board token`, and paste this into the **JSON** tab, replacing each
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
    "action": "create",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"]
  },
  {
    "mode": "allow",
    "action": "update",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "delete",
    "resourceType": "item",
    "listIds": ["YOUR LIST ID"],
    "itemIds": ["*"]
  }
]
```

Here's what each one is for:

| Permission | Lets the app… |
| --- | --- |
| `view` list | …use the list, and receive its realtime events |
| `view` items | …read every note |
| `create` items | …pin up a note |
| `update` items | …edit or move any note |
| `delete` items | …take down any note |

That's a lot of trust to put in a page that anyone can open. It's fine for a
notice board, where the worst that can happen is a messy board, and the list's
schema and rules limit how messy it can get. For anything more precious, use
identities, like the [BlogPad sample](../blogpad) does, so each person can only
change their own things.

### Step 6: Paste the token into the app

Open [`config.js`](config.js) in a text editor, and replace
`PASTE YOUR NOTICE BOARD TOKEN HERE` with the new token's value (not the setup
token!). Keep the quotes around it:

```js
const JSONPAD_TOKEN = 'your-token-goes-here';
```

### Step 7: Try it

Open `index.html` in your browser: double-clicking it usually works.

> [!NOTE]
> If your browser won't run the page from a file, serve the folder instead:
> run `npx http-server` in this folder, and open the address it prints.

The top right corner should say **Live**: the page is connected, and listening
for changes. Click anywhere on the board to pin up a note, and type on it.
Drag it around by its top edge. Pick a different colour at the top for your
next note.

Now make a change from somewhere else, and watch it appear. Leave the page
open where you can see it, and in your terminal, pin up a note:

```bash
jsonpad items create notice-board-notices --data '{"colour": "blue", "x": 400, "y": 100, "content": "Hello from the terminal!"}'
```

It appears on the board straight away. Copy the `id` that command printed, and
change the note:

```bash
jsonpad items data set notice-board-notices THE-NOTE-ID --data '{"content": "Moved and edited!", "x": 600, "y": 300}'
```

Then take it down:

```bash
jsonpad items delete notice-board-notices THE-NOTE-ID --yes
```

Every one of those shows up on the board as soon as it happens, and it would
on everyone else's screen too.

#### Two windows at once

It's more fun with two windows side by side, or a phone and a computer. On
the free plan, though, an account can only have **one realtime connection at
a time**, so only the first window gets live updates. The second one says
*Realtime connection limit reached* in the corner, and checks for changes
every ten seconds instead. Close the first window and reload the second, and
the second one gets the connection and goes **Live**.

Paid plans allow more connections at once: see
[limits and quotas](https://jsonpad.io/docs/limits-and-quotas). Since the token
is in the page, this limit really means *how many people can use the app live
at the same time*.

## Try to break it

The page is just JavaScript in your browser, and anyone can change it. So
whatever keeps the board tidy can't live in the page: it's in JSONPad. Open
your browser's developer console and paste these in, one block at a time (on
the free plan, two requests at the same instant are refused with *Rate limit
exceeded*). Each one uses the page's own `jsonpad` client, exactly as someone
determined could.

The comment under each one shows what happens: the error's type, the HTTP
status, and the reason. In the console, the reason is the `message` inside
the JSON the error prints.

Recolour a note. Notes' colours show whose is whose, so the rules don't allow
it. First pick a note:

```js
const [note] = (await jsonpad.fetchItems('notice-board-notices')).data;
```

Then try to change its colour:

```js
await jsonpad.updateItemData('notice-board-notices', note.id, { colour: 'red' });
// WriteRuleError (400): a note's colour can't be changed
```

Pin up something that isn't a note, or a very long one:

```js
await jsonpad.createItem('notice-board-notices', {
  data: { colour: 'purple', x: -50, y: 0, content: 'x'.repeat(1000) },
});
// JSONPadError (400): Validation error (...)
```

The list's JSON schema refuses it: there are four colours, the board starts at
`0`, and a note holds up to 500 characters.

## How it works

Open [`app.js`](app.js) alongside this section.

**Loading the board.** `loadNotes()` fetches every note and makes the board
match: it adds notes it hasn't seen, updates the ones it has, and removes the
ones that are gone. It runs when the page opens, and again whenever the
realtime connection comes back after being lost, because anything that
happened in between was missed.

**Listening.** `realtime.listen()` subscribes to the list's events. Each event
has the note's current data in `event.detail.model.data`, which goes straight
to `showNote()`. That's the same function the page uses for notes it created
itself, so there's one way of drawing a note, whoever made the change.

**Typing.** A note's text is saved half a second after you stop typing. When
someone else's change to a note arrives while you have unsaved typing on it,
yours wins: it's about to be saved, and then everyone gets it. Without that,
your own saves echoing back would keep undoing what you'd typed since.

**Saving only what changed.** `updateItemData()` *merges* what you send into
the note. So saving the text sends only `{ content }`, and moving a note sends
only `{ x, y }`. Whichever lands last doesn't undo the other.

**Dragging.** A note moves on your screen while you drag it, and is saved when
you let go. Saving every step of a drag would be a lot of requests: every plan
limits how quickly an account can make them (one every 100ms on the free
plan, shared by everyone using the app). `retrying()` in `app.js` waits a
moment and tries again if a request is refused for going too fast.

**The rules.** The list's schema describes one version of a note, so it can't
tell whether a note's colour just changed. [`rules/notes.rules`](rules/notes.rules)
can, with `unchanged("/colour")`. Its tests are in
[`rules/notes.tests.json`](rules/notes.tests.json), and you can run them on your
own computer, without making any requests:

```bash
jsonpad rules test rules/notes.rules
```

## Ideas for taking it further

- Let people resize notes: add `width` and `height` to the schema and the page.
- Show who's looking at the board right now. (Hint: every open page could
  keep an item of its own up to date, and delete it when the page closes.)
- Add identities, so only a note's author can edit or remove it. The
  [BlogPad sample](../blogpad) shows how.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| "This copy of the sample hasn't been set up yet" | `config.js` still has the placeholder in it (step 6) |
| Notes appear, but never **Live** | Is realtime turned on for the list? `realtime` is `true` in `jsonpad-schema.json`, so re-run `jsonpad sync-schema` |
| *Realtime connection limit reached* | Another window or device is using your account's realtime connection. See [Two windows at once](#two-windows-at-once) |
| "Token not authorized" in the console | The token's permissions: are the list ids right? Did you use the app's token, not the setup token? |
| "Invalid token" or nothing loads | Did you copy the whole token? Is it **Activated** on its page in the dashboard? |

## Find out more

- [Getting started with JSONPad](https://jsonpad.io/docs/getting-started)
- [Realtime updates](https://jsonpad.io/docs/realtime-updates)
- [List schemas](https://jsonpad.io/docs/list-schemas)
- [Write rules](https://jsonpad.io/docs/write-rules)
- [Schema sync](https://jsonpad.io/docs/schema-sync)
- [Token permissions](https://jsonpad.io/docs/token-permissions)
- [Limits and quotas](https://jsonpad.io/docs/limits-and-quotas)
- [The JavaScript SDK](https://www.npmjs.com/package/@basementuniverse/jsonpad-sdk)
  and [the realtime SDK](https://www.npmjs.com/package/@basementuniverse/jsonpad-realtime-sdk)

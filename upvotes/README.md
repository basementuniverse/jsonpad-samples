# Upvotes

Post something, and vote for what other people post. The page never counts a
vote: each vote is an item of its own, and an
[event flow](https://jsonpad.io/docs/flows-events) on
[JSONPad](https://jsonpad.io) keeps each post's `voteCount` up to date, a
moment after every vote is cast or taken back. Nobody else can touch the
count, so nobody can give themselves a thousand votes.

**Try it:** https://basementuniverse.github.io/jsonpad-samples/upvotes/

## What this sample shows

- **Event flows.** A flow that nothing calls. It runs by itself after items
  change: when a vote is created, it adds one to the post's count, and when a
  vote is deleted, it takes one away.
- **Write rules and flows together.** The posts list's
  [write rules](https://jsonpad.io/docs/write-rules) refuse any change to a
  post, from anyone. The flow can still change `voteCount`, because a flow's
  writes skip the rules: it's a trusted part of the app.
- **One vote each.** A vote's `key` is the voter's id and the post's id, and
  it's an alias, which JSONPad keeps unique. The rules make sure the key really
  is yours, and that the post exists.
- **Ownership.** Each vote belongs to the identity that cast it, so only they
  can take it back.
- **Sorting with an index.** The posts come back most popular first, sorted by
  an index on `/voteCount`.
- **Tests.** The flow and both rule sets have tests, which you can run on your
  own computer without making any requests.
- **Schema sync.** The lists, their rules and the flow are described in
  [`jsonpad-schema.json`](jsonpad-schema.json), which you apply with one
  command.

## What's in this folder

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The page |
| [`app.js`](app.js) | Everything the page does: this is the file to read |
| [`config.js`](config.js) | Where you paste your token (step 6) |
| [`default.css`](default.css) | Styles |
| [`jsonpad-schema.json`](jsonpad-schema.json) | The lists, their JSON schemas, indexes and rules, and the flow |
| [`flows/count-votes.flow.json`](flows/count-votes.flow.json) | The flow that counts votes |
| [`flows/count-votes.tests.json`](flows/count-votes.tests.json) | Tests for the flow |
| [`rules/posts.rules`](rules/posts.rules), [`rules/votes.rules`](rules/votes.rules) | The lists' write rules |
| [`rules/posts.tests.json`](rules/posts.tests.json), [`rules/votes.tests.json`](rules/votes.tests.json) | Tests for the rules |

## How the flow works

Open [`flows/count-votes.flow.json`](flows/count-votes.flow.json) alongside
this list.

- **The entry** says when the flow runs: after items are created or deleted in
  `upvotes-votes`. Its `input` is the event: the vote that was cast (or taken
  back) is `input.item`, and `input.type` says which.
- **`post`** reads the post the vote is for.
- **`still_there`** is a `condition`. If the post has been deleted, there's
  nothing to count, and the flow stops without doing anything.
- **`count`** adds one to `voteCount`, or takes one away.

A vote is counted a moment after it's cast, not as part of casting it. Votes
for one post can arrive at the same time, from different people, and JSONPad
makes sure each run sees the count the one before it left: two runs that read
the same count can't both write, so one of them runs again.

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
powerful one for yourself, to set things up, and a limited one for the page.

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

### Step 4: Create the lists and the flow

In the terminal, go to this folder (the one with `jsonpad-schema.json` in it):

```bash
cd path/to/jsonpad-samples/upvotes
```

The CLI can check and test the flow and the rules on your computer, before
sending anything anywhere:

```bash
jsonpad flows test flows/count-votes.flow.json
jsonpad rules test rules/posts.rules
jsonpad rules test rules/votes.rules
```

You should see 3, 4 and 6 ticks. The flow's tests are events (a vote created,
a vote deleted, a vote for a post that's gone), run against a made-up post
kept in memory.

Now see what a sync would do, then do it:

```bash
jsonpad sync-schema --dry-run
jsonpad sync-schema --wait
```

In the dashboard, **Lists** now has **Upvotes Posts** and **Upvotes Votes**,
and **Flows** has **upvotes-count-votes**. Its page lists every run, including
the ones waiting to start.

### Step 5: Create the page's token

The page needs a token too. It's going to be in the web page, where anyone can
see it, so it gets only the permissions the page needs.

Permissions refer to lists by their id, so get both lists' ids first:

```bash
jsonpad lists get upvotes-posts -o id
jsonpad lists get upvotes-votes -o id
```

Now create the token, like in step 2: **Tokens**, **Create**, name it
`Upvotes token`, and paste this into the **JSON** tab, replacing each
`POSTS LIST ID` and `VOTES LIST ID` with the ids you just copied:

```json
[
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "list",
    "listIds": ["POSTS LIST ID", "VOTES LIST ID"]
  },
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "item",
    "listIds": ["POSTS LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "create-with-identity",
    "resourceType": "item",
    "listIds": ["POSTS LIST ID", "VOTES LIST ID"]
  },
  {
    "mode": "allow",
    "action": "view-with-identity",
    "resourceType": "item",
    "listIds": ["VOTES LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "delete-with-identity",
    "resourceType": "item",
    "listIds": ["VOTES LIST ID"],
    "itemIds": ["*"]
  },
  {
    "mode": "allow",
    "action": "register",
    "resourceType": "identity",
    "groups": ["upvotes-people"]
  },
  {
    "mode": "allow",
    "action": "authenticate",
    "resourceType": "identity",
    "groups": ["upvotes-people"]
  }
]
```

Here's what each one is for:

| Permission | Lets the page… |
| --- | --- |
| `view` lists | …use both lists |
| `view` posts | …show every post |
| `create-with-identity` | …post, and vote, as a signed-in person |
| `view-with-identity` votes | …see your own votes (and only yours) |
| `delete-with-identity` votes | …take your own vote back |
| `register` in `upvotes-people` | …create a person the first time someone picks a name |
| `authenticate` in `upvotes-people` | …sign people in |

There's no permission to change a post, and the rules would refuse it anyway.
The page doesn't need to run the flow: nothing calls an event flow.

### Step 6: Paste the token into the page

Open [`config.js`](config.js) in a text editor, and replace
`PASTE YOUR UPVOTES TOKEN HERE` with the new token's value (not the setup
token!). Keep the quotes around it:

```js
const JSONPAD_TOKEN = 'your-token-goes-here';
```

### Step 7: Vote

Open `index.html` in your browser: double-clicking it usually works.

> [!NOTE]
> If your browser won't run the page from a file, serve the folder instead:
> run `npx http-server` in this folder, and open the address it prints.

Pick a name, post something, and click ▲ to vote for it. The count fades for a
moment, then goes up: that's the flow running. Click ▲ again to take your vote
back. Open the page in a private window as someone else, and vote there too.

## Try to cheat

Sign in, post something, and open the developer console. The page's own
client is there as `jsonpad`, the posts as `posts`, and you as `me`. Paste
these in one at a time.

Give a post a thousand votes:

```js
await jsonpad.updateItemData('upvotes-posts', posts[0].id, { voteCount: 1000 });
// JSONPadError (403): Token not authorized
```

Start a post with a thousand votes instead:

```js
await jsonpad.createItem('upvotes-posts', {
  data: { title: 'Vote for me', voteCount: 1000 },
});
// WriteRuleError (400): a new post starts with no votes
```

Vote twice for the same post (vote for it on the page first):

```js
await jsonpad.createItem('upvotes-votes', {
  data: { postId: posts[0].id, key: `${me.id}:${posts[0].id}` },
});
// JSONPadError (400): Unable to create item (alias value already exists)
```

Vote twice, with a different key:

```js
await jsonpad.createItem('upvotes-votes', {
  data: { postId: posts[0].id, key: 'someone-else' },
});
// WriteRuleError (400): key must be your identity id and the post id, joined with a colon
```

## How it works

Open [`app.js`](app.js) alongside this section.

**Posting and voting** are ordinary item writes: `createItem()` for a post or a
vote, `deleteItem()` to take a vote back. Nothing in the page knows about the
flow.

**Your votes.** A request made with an identity only sees the items that
identity created. So `refresh()` fetches the votes list as you, which finds
your votes and nobody else's, and fetches the posts without the identity
(`{ ignore: true }`), because everyone sees every post.

**The count.** After a vote, the page fades the count, and fetches the posts
again a moment and a half later, by which time the flow has usually run. It
also looks for other people's posts and votes every five seconds.

## Changing the flow

Open **Flows**, then **upvotes-count-votes** in the dashboard, and click
**Edit**. In the **Test** tab, click **Use a sample event** for an event to try
the flow with: change its `postId` to one of your posts. The run is rolled
back afterwards.

Or edit [`flows/count-votes.flow.json`](flows/count-votes.flow.json), run its
tests, and sync:

```bash
jsonpad flows test flows/count-votes.flow.json
jsonpad sync-schema
```

## Ideas for taking it further

- Keep a count of each person's posts' votes too: a second `update-item` in
  the same flow, on a `upvotes-people` list.
- Let people downvote: add a `direction` to votes, and add or take away
  `input.item.data.direction` instead of one.
- Hide a post automatically when it gets too many downvotes, with a
  `condition` node.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| "This copy of the sample hasn't been set up yet" | `config.js` still has the placeholder in it (step 6) |
| "Token not authorized" when signing in | The `register` and `authenticate` permissions: is the group `upvotes-people`? |
| "Token not authorized" when posting or voting | The item permissions: are the list ids right? Did you use the page's token, not the setup token? |
| Votes are saved, but the count never changes | Is the flow **Active** on its page in the dashboard? Its run log says what happened to each vote |
| "Max flows exceeded" when syncing | The free plan allows two flows: delete one you don't need in the dashboard |
| "Rate limit exceeded" | The free plan allows 60 requests a minute across the whole account. Wait a minute |

## Find out more

- [Event flows](https://jsonpad.io/docs/flows-events), and
  [flows](https://jsonpad.io/docs/flows) in general
- [Write rules](https://jsonpad.io/docs/write-rules)
- [Indexing](https://jsonpad.io/docs/indexing), including aliases
- [Identities](https://jsonpad.io/docs/identities)
- [Schema sync](https://jsonpad.io/docs/schema-sync)
- [The command line tool](https://jsonpad.io/docs/command-line-tool)
- [Token permissions](https://jsonpad.io/docs/token-permissions)

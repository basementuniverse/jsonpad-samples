# BlogPad

A small blogging site with no server of its own. Anyone can read it, and
anyone can register and write articles. Authors can edit and delete their own
articles, and nobody else's.

**Try it:** https://basementuniverse.github.io/jsonpad-samples/blogpad/

All of the "backend" is [JSONPad](https://jsonpad.io): the articles, the user
accounts, sorting, filtering, searching, and the checks that stop people
writing in someone else's name. The page itself is plain HTML and JavaScript
(with [Vue](https://vuejs.org) for the templates), so you can host it anywhere,
or just open it from your computer.

## What this sample shows

- **Lists and items.** Every article is an *item* in a JSONPad *list*. An item
  is just a JSON document.
- **Identities.** Authors register and sign in as JSONPad *identities*. An item
  created by an identity belongs to it, and only that identity can change or
  delete it. JSONPad enforces that, not the page.
- **JSON schema validation.** The list has a schema, so every article has to
  have a title, a summary, a category, and so on. Anything else is refused.
- **Indexes: sorting, filtering and searching.** The list's indexes let JSONPad
  sort articles by date or title, show one category or just the last week's
  articles, and search titles and summaries.
- **Write rules.** Three short rules make sure an article's author really is
  the person who wrote it, and that nobody can backdate an article.
- **Schema sync.** The list, its schema, its indexes and its rules are all
  described in one file, [`jsonpad-schema.json`](jsonpad-schema.json), which
  you apply with one command.

## What's in this folder

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The page |
| [`app.js`](app.js) | Everything the page does: this is the file to read |
| [`config.js`](config.js) | Where you paste your token (step 6) |
| [`default.css`](default.css) | Styles |
| [`jsonpad-schema.json`](jsonpad-schema.json) | The list, its JSON schema and its indexes |
| [`rules/articles.rules`](rules/articles.rules) | The list's write rules |
| [`rules/articles.tests.json`](rules/articles.tests.json) | Tests for those rules |

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
cd path/to/jsonpad-samples/blogpad
```

First, see what would happen, without changing anything:

```bash
jsonpad sync-schema --dry-run
```

This reads [`jsonpad-schema.json`](jsonpad-schema.json), runs the write rules'
tests on your computer (you'll see eight ticks), and shows the list and the
four indexes it would create. It also prints three **warnings** about the
rules. They're expected: they say the rules only *check* writes, and leave the
question of *who* may write to the token's permissions, which is exactly how
this app works.

Now do it for real:

```bash
jsonpad sync-schema --wait
```

`--wait` waits for the new indexes to be built, which takes a second or two.
If you open **Lists** in the dashboard now, you'll see **BlogPad Articles**,
with its schema, its indexes and its rules.

> [!TIP]
> This is the nice thing about schema sync: the file is the source of truth.
> Change it (add an index, say) and run `jsonpad sync-schema` again, and
> JSONPad changes to match. Running it when nothing has changed does nothing.

### Step 5: Create the app's token

The app needs a token too. It's going to be in the web page, where anyone can
see it, so it gets only the permissions the app needs.

Permissions refer to lists by their id, so get your new list's id first:

```bash
jsonpad lists get blogpad-articles -o id
```

(You can also find it on the list's page in the dashboard, with a copy button.)

Now create the token, like in step 2: **Tokens**, **Create**, name it
`BlogPad token`, and paste this into the **JSON** tab, replacing each
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
    "groups": ["blogpad"]
  },
  {
    "mode": "allow",
    "action": "authenticate",
    "resourceType": "identity",
    "groups": ["blogpad"]
  }
]
```

Here's what each one is for:

| Permission | Lets the app… |
| --- | --- |
| `view` list | …use the list at all, including searching it |
| `view` items | …read every article, whoever wrote it |
| `create-with-identity` | …publish an article, but only as a signed-in author |
| `update-with-identity` | …edit an article, but only the signed-in author's own |
| `delete-with-identity` | …delete an article, but only the signed-in author's own |
| `register` in `blogpad` | …let people create an account (an identity in the `blogpad` group) |
| `authenticate` in `blogpad` | …let them sign in |

Notice there's no plain `create`, `update` or `delete`: without signing in, the
token can only read. The `-with-identity` versions come with a rule built into
JSONPad: an identity can only change the items it created. That's what stops
one author editing another's articles.

You don't need to create the `blogpad` identity group yourself. It appears the
first time somebody registers.

### Step 6: Paste the token into the app

Open [`config.js`](config.js) in a text editor, and replace
`PASTE YOUR BLOGPAD TOKEN HERE` with the new token's value (not the setup
token!). Keep the quotes around it:

```js
const JSONPAD_TOKEN = 'your-token-goes-here';
```

### Step 7: Try it

Open `index.html` in your browser: double-clicking it usually works.

> [!NOTE]
> If your browser won't run the page from a file, serve the folder instead:
> run `npx http-server` in this folder, and open the address it prints.

Click **Register to write**, pick a username and a password (at least 8
characters), and write your first article. Articles are written in
[Markdown](https://www.markdownguide.org/basic-syntax/).

Write a few more, in different categories, then try the controls:

- **Category**, **Published** and **Only mine** filter the articles, and
  **Sort by** changes their order. Look for `loadArticles()` in
  [`app.js`](app.js) to see the parameters each one sends: `category` and
  `published` are the names of indexes, and `identityId` is a field every item
  has.
- **Search** looks for words in titles and summaries: those two indexes have
  searching turned on.
- Register a second author in a private window. They can read your articles,
  but won't get **Edit** or **Delete** buttons for them.

## Try to break it

The page is just JavaScript in your browser, and anyone can change it. So none
of the protection can live in the page: it's all in JSONPad. You can check this
yourself. Sign in, open your browser's developer console, and paste these in,
one block at a time (on the free plan, two requests at the same instant are
refused with *Rate limit exceeded*). Each one uses the page's own `jsonpad`
client, so it's exactly what a determined user could do.

The comment under each one shows what happens: the error's type, the HTTP
status, and the reason. In the console, the reason is the `message` inside
the JSON the error prints.

Publish an article under someone else's name:

```js
await jsonpad.createItem('blogpad-articles', {
  data: {
    title: 'Hello', summary: 'Hi', content: 'Hi', category: 'news',
    author: 'someone-else', publishedAt: '$jsonpad-var:now',
  },
});
// WriteRuleError (400): an article's author must be the person writing it
```

Backdate an article. First find out who you're signed in as:

```js
const me = await jsonpad.fetchSelfIdentity();
```

Then publish an article from 2001:

```js
await jsonpad.createItem('blogpad-articles', {
  data: {
    title: 'Hello', summary: 'Hi', content: 'Hi', category: 'news',
    author: me.name, publishedAt: '2001-01-01T00:00:00Z',
  },
});
// WriteRuleError (400): write "$jsonpad-var:now" to /publishedAt
```

Break the schema, with a category that doesn't exist or a field it doesn't
have:

```js
await jsonpad.createItem('blogpad-articles', {
  data: { title: 'Hello', category: 'spam', likes: 9999 },
});
// JSONPadError (400): Validation error (...)
```

Or edit someone else's article. First find one (this uses `me` from above):

```js
const article = (
  await jsonpad.fetchItems('blogpad-articles', {}, { ignore: true })
).data.find(article => article.identity?.id !== me.id);
```

Then try to change it:

```js
await jsonpad.updateItemData('blogpad-articles', article.id, {
  title: 'Gotcha',
});
// JSONPadError (404): Item not found
```

It's "not found" because, as far as a signed-in author is concerned, other
people's articles can't be changed, so there's nothing there to change.

## How it works

Open [`app.js`](app.js) alongside this section.

**Two ways of asking.** The app has one JSONPad client. Once an author signs
in, `loginIdentity()` makes that client send the author's identity with every
request. That's what the write permissions need. But a request made *with* an
identity only sees the items that identity created, which is what you want in
a to-do app and not in a blog. So every read passes `{ ignore: true }`, which
leaves the identity out for that one request, and everyone sees every article.

**Merging.** Editing an article uses `updateItemData()`, which *merges* the
changes into the article. The page only sends the title, summary, category
and content, so the author and publication date are left as they were. (The
[Connect 4 sample](../connect4) does the opposite, and replaces the whole item
with `replaceItemData()`.)

**The server's clock.** A new article's `publishedAt` is the string
`"$jsonpad-var:now"`. JSONPad replaces it with the current time before
anything else happens, and the write rules insist that it did, so the date on
an article is always the real one.

**The rules.** [`rules/articles.rules`](rules/articles.rules) is three
`require` statements. The schema can check that an article *has* an author;
only a rule can check that the author is *the person writing it*, or that the
publication date *hasn't changed* since last time. Their tests are in
[`rules/articles.tests.json`](rules/articles.tests.json), and you can run them
on your own computer, without making any requests:

```bash
jsonpad rules test rules/articles.rules
```

**Markdown.** Anyone can write an article, so the page cleans the HTML that
the Markdown turns into with [DOMPurify](https://github.com/cure53/DOMPurify)
before showing it. Otherwise an article with a `<script>` in it would run in
every reader's browser.

**Going too fast.** Every JSONPad plan limits how quickly an account can make
requests; on the free plan it's one every 100ms, shared by everyone using the
app. `retrying()` in `app.js` waits a moment and tries again when a request is
refused for that (a `429` response).

## Ideas for taking it further

- Add a `tags` array to articles, and a tag filter.
- Let authors set a display name when they register (`displayName` in
  `registerIdentity()`), and show it instead of their username.
- Add a password reset flow: see
  [password reset](https://jsonpad.io/docs/identity-password-reset) in the docs.
- Add comments, as a second list. What permissions and rules would they need?

## Troubleshooting

| What you see | What to check |
| --- | --- |
| "This copy of the sample hasn't been set up yet" | `config.js` still has the placeholder in it (step 6) |
| "Token not authorized" | The token's permissions: are the list ids right? Did you use the app's token, not the setup token? |
| "Invalid token" or nothing loads | Did you copy the whole token? Is it **Activated** on its page in the dashboard? |
| `jsonpad` says it isn't allowed to do something | `jsonpad whoami` shows which token the CLI is using |
| Sorting or searching fails with `INDEX_BUILDING` | An index is still being built. Wait a few seconds |

## Find out more

- [Getting started with JSONPad](https://jsonpad.io/docs/getting-started)
- [Identities](https://jsonpad.io/docs/identities)
- [Indexing](https://jsonpad.io/docs/indexing): sorting, filtering and searching
- [List schemas](https://jsonpad.io/docs/list-schemas)
- [Write rules](https://jsonpad.io/docs/write-rules)
- [Schema sync](https://jsonpad.io/docs/schema-sync)
- [Token permissions](https://jsonpad.io/docs/token-permissions)
- [The JavaScript SDK](https://www.npmjs.com/package/@basementuniverse/jsonpad-sdk)

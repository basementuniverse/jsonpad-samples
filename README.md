# JSONPad Samples

Sample apps built on [JSONPad](https://jsonpad.io), each a single web page with
no server of its own. JSONPad stores their data, signs their users in, and
checks every write they make.

Each sample has a live demo you can try straight away, and a README that walks
you through setting up your own copy under your own JSONPad account, one step
at a time. You don't need to know anything about JSONPad to start, and the
free plan is enough for all of them.

| Sample | Try it | What it's about |
| --- | --- | --- |
| [BlogPad](blogpad) | [Live demo](https://basementuniverse.github.io/jsonpad-samples/blogpad/) | **Start here.** The basics: lists and items, identities (sign-up and sign-in), JSON schema validation, and sorting, filtering and searching with indexes |
| [Notice Board](noticeboard) | [Live demo](https://basementuniverse.github.io/jsonpad-samples/noticeboard/) | **Realtime collaboration.** Everyone shares one board, and sees every change as it happens |
| [Connect 4](connect4) | [Live demo](https://basementuniverse.github.io/jsonpad-samples/connect4/) | **Write rules.** Two players write to the same item, and JSONPad's write rules referee the game. Open the console and try to cheat |

## What they have in common

- **Plain HTML and JavaScript.** Open `index.html` in a browser and it runs.
  There's no build step, and nothing to install to run them.
- **One token, in the page.** Each app talks to JSONPad with a token that has
  only the permissions it needs. Anyone can read it, and that's fine: it can't
  do anything its permissions and the list's rules don't allow.
- **Schema sync.** Each sample's lists, JSON schemas, indexes and write rules
  are described in its `jsonpad-schema.json`, and set up with one command:
  `jsonpad sync-schema`.
- **The official SDKs**, loaded from a CDN:
  [`@basementuniverse/jsonpad-sdk`](https://www.npmjs.com/package/@basementuniverse/jsonpad-sdk),
  and
  [`@basementuniverse/jsonpad-realtime-sdk`](https://www.npmjs.com/package/@basementuniverse/jsonpad-realtime-sdk)
  for live updates.

## Find out more

- [JSONPad documentation](https://jsonpad.io/docs)
- [Getting started](https://jsonpad.io/docs/getting-started)
- [The command line tool](https://jsonpad.io/docs/command-line-tool)

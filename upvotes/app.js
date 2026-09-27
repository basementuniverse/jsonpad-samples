// Upvotes, counted by JSONPad.
//
// This page creates posts and casts votes. It never counts anything: each vote
// is an item of its own, and an event flow on JSONPad's side adds one to the
// post's voteCount when a vote is created, and takes one away when it's
// deleted. The posts list's write rules stop anyone else from touching
// voteCount. See flows/count-votes.flow.json and rules/.
//
// Open the console and try to give yourself a thousand votes.

const POSTS = 'upvotes-posts';
const VOTES = 'upvotes-votes';
const IDENTITY_GROUP = 'upvotes-people';

// Everyone shares this, because the sample is about the flow, not passwords
const SHARED_PASSWORD = 'upvotes-sample';

// Look for other people's posts and votes this often
const POLL_INTERVAL_MS = 5000;

// A vote is counted a moment after it's cast, by the flow. Look again after
// this long, to show the new count
const COUNTED_AFTER_MS = 1500;

// Once someone signs in, this client sends their identity with every request
const jsonpad = new JSONPad.default(JSONPAD_TOKEN);

// A request made with an identity only sees the items that identity created.
// Everyone sees every post, so posts are read without one
const withoutIdentity = { ignore: true };

let me = null;
let posts = [];

// The signed-in person's votes: post id -> vote item id
let myVotes = new Map();

// Posts whose count is about to change, shown faded until it has
const counting = new Set();

// -----------------------------------------------------------------------------
// Talking to JSONPad
// -----------------------------------------------------------------------------

/**
 * Make a request, and try it again if JSONPad says we're going too fast
 *
 * Every plan limits how quickly an account can make requests. On the free
 * plan it's one request every 100ms, shared by everyone using the app, so two
 * requests in a row can be told to slow down (a 429). A short wait is retried;
 * a long one (the per-minute limit) isn't
 */
async function retrying(request, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const wait = error?.retryAfter ?? 1;
      if (error?.status !== 429 || attempt === attempts || wait > 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 150 * attempt));
    }
  }
}

/**
 * Something readable from an SDK error, whose message is the response body
 */
function describeError(error) {
  let body;
  try {
    body = JSON.parse(error.message);
  } catch {
    return error?.message ?? String(error);
  }

  // A validation error lists what's wrong with each field
  const reasons = [...(body.message ?? '').matchAll(/"msg":"([^"]*)"/g)];
  if (reasons.length > 0) {
    return reasons.map(([, reason]) => reason).join(', ');
  }

  return body.message ?? error.message;
}

// -----------------------------------------------------------------------------
// Elements
// -----------------------------------------------------------------------------

const elements = {
  setup: document.querySelector('#setup'),
  signIn: document.querySelector('#sign-in'),
  signInForm: document.querySelector('#sign-in-form'),
  name: document.querySelector('#name'),
  board: document.querySelector('#board'),
  nameLabel: document.querySelector('#name-label'),
  postForm: document.querySelector('#post-form'),
  title: document.querySelector('#title'),
  posts: document.querySelector('#posts'),
  error: document.querySelector('#error'),
};

function show(element, visible) {
  element.classList.toggle('hidden', !visible);
}

function showError(error) {
  elements.error.textContent = describeError(error);
  show(elements.error, true);
}

function hideError() {
  show(elements.error, false);
}

// -----------------------------------------------------------------------------
// Signing in
// -----------------------------------------------------------------------------

async function signIn(name) {
  const credentials = {
    group: IDENTITY_GROUP,
    name,
    password: SHARED_PASSWORD,
  };

  try {
    return await retrying(() => jsonpad.loginIdentity(credentials));
  } catch (error) {
    // IDENTITY_NOT_AUTHENTICATED: nobody has used this name yet
    if (error?.code !== 20008) {
      throw error;
    }
  }

  await retrying(() => jsonpad.registerIdentity(credentials));
  return retrying(() => jsonpad.loginIdentity(credentials));
}

elements.signInForm.addEventListener('submit', async event => {
  event.preventDefault();

  const name = elements.name.value.trim().toLowerCase();
  if (!name) {
    return;
  }

  hideError();

  try {
    const [identity] = await signIn(name);
    me = identity;

    try {
      localStorage.setItem('upvotes-name', name);
    } catch {}

    elements.nameLabel.textContent = identity.displayName || identity.name;
    show(elements.signIn, false);
    show(elements.board, true);

    await refresh();
    setInterval(() => refresh().catch(showError), POLL_INTERVAL_MS);
  } catch (error) {
    showError(error);
  }
});

// -----------------------------------------------------------------------------
// Posts and votes
// -----------------------------------------------------------------------------

async function refresh() {
  // The posts list has a sortable index on /voteCount, so JSONPad can put the
  // most popular posts first
  const page = await retrying(() =>
    jsonpad.fetchItems(
      POSTS,
      { order: 'votes', direction: 'desc', includeData: true, limit: 50 },
      withoutIdentity
    )
  );
  posts = page.data;

  // Made with the identity, so this only finds this person's own votes
  const votes = await retrying(() =>
    jsonpad.fetchItems(VOTES, { includeData: true, limit: 100 })
  );
  myVotes = new Map(votes.data.map(vote => [vote.data.postId, vote.id]));

  counting.clear();
  render();
}

elements.postForm.addEventListener('submit', async event => {
  event.preventDefault();

  const title = elements.title.value.trim();
  if (!title) {
    return;
  }

  hideError();

  try {
    // The rules insist a new post starts with no votes
    await retrying(() =>
      jsonpad.createItem(POSTS, { data: { title, voteCount: 0 } })
    );
    elements.title.value = '';
    await refresh();
  } catch (error) {
    showError(error);
  }
});

async function toggleVote(post) {
  hideError();

  try {
    const voteId = myVotes.get(post.id);

    if (voteId) {
      // Taking a vote back deletes it. The flow takes one off the count
      await retrying(() => jsonpad.deleteItem(VOTES, voteId));
      myVotes.delete(post.id);
    } else {
      // The key is an alias, which JSONPad keeps unique, so the same person
      // can't vote for the same post twice. The flow adds one to the count
      const vote = await retrying(() =>
        jsonpad.createItem(VOTES, {
          data: { postId: post.id, key: `${me.id}:${post.id}` },
        })
      );
      myVotes.set(post.id, vote.id);
    }
  } catch (error) {
    showError(error);
    return;
  }

  // The count changes a moment later, when the flow has run
  counting.add(post.id);
  render();
  setTimeout(() => refresh().catch(showError), COUNTED_AFTER_MS);
}

// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

function render() {
  elements.posts.innerHTML = '';

  if (posts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nothing yet. Post something!';
    elements.posts.append(empty);
    return;
  }

  for (const post of posts) {
    const row = document.createElement('li');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vote';
    button.classList.toggle('voted', myVotes.has(post.id));
    button.title = myVotes.has(post.id) ? 'Take your vote back' : 'Vote';
    button.innerHTML = '<span>▲</span><span class="vote-count"></span>';
    const count = button.querySelector('.vote-count');
    count.textContent = post.data.voteCount;
    count.classList.toggle('counting', counting.has(post.id));
    button.addEventListener('click', () => toggleVote(post));

    const title = document.createElement('span');
    title.textContent = post.data.title;

    row.append(button, title);
    elements.posts.append(row);
  }
}

// -----------------------------------------------------------------------------
// Starting up
// -----------------------------------------------------------------------------

if (JSONPAD_TOKEN.startsWith('PASTE')) {
  // config.js still has the placeholder in it
  show(elements.setup, true);
  show(elements.signIn, false);
} else {
  try {
    elements.name.value = localStorage.getItem('upvotes-name') ?? '';
  } catch {}
}

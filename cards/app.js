// Twenty-one, dealt by JSONPad.
//
// This page is the untrusted part, and it's trusted with nothing. It can read
// the games, and that's all: every change to a game is made by a flow on
// JSONPad's side, which checks whose turn it is, deals the top card of a deck
// this page can't see, and works out the totals and the winner. See flows/cards.flow.json.
//
// That's the point of the sample. Open the console and try to cheat.

const GAMES = 'cards-games';
const IDENTITY_GROUP = 'cards-players';

// Everyone shares this, because the sample is about flows, not passwords
const SHARED_PASSWORD = 'twenty-one';

// Without a realtime connection, look for the other player's moves this often
const POLL_INTERVAL_MS = 5000;

// Once a player signs in, this client sends their identity with every request
const jsonpad = new JSONPad.default(JSONPAD_TOKEN);
const realtime = new JSONPadRealtime.default(JSONPAD_TOKEN);

// A request made with an identity only sees the items that identity created.
// Games aren't created by anyone's identity (a flow creates them), so we read
// them without one: the token can see them all
const withoutIdentity = { ignore: true };

let me = null;
let game = null;

// -----------------------------------------------------------------------------
// Talking to JSONPad
// -----------------------------------------------------------------------------

/**
 * Make a request, and try it again if JSONPad says we're going too fast
 *
 * Every plan limits how quickly an account can make requests. On the free
 * plan it's one request every 100ms, shared by everyone using the app, so two
 * requests in a row can be told to slow down (a 429). The error says how many
 * seconds to wait, rounded up to a whole second, so a short wait is retried
 * sooner than that. A long one (the per-minute limit) isn't retried at all
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
 * Something readable from an SDK error
 */
function describeError(error) {
  // A flow that refuses says why, in the words its author wrote: they're the
  // messages on the flows' require nodes
  if (error instanceof JSONPad.FlowError) {
    return error.flowMessage;
  }

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

/**
 * Make a move, as the signed-in player
 *
 * Every move is a call to one endpoint flow, POST /flows/cards, and the action
 * says which move it is: new-game, join, draw or stand
 */
function play(action, input = {}) {
  return retrying(() => jsonpad.runFlow('cards', { action, ...input }));
}

// -----------------------------------------------------------------------------
// Elements
// -----------------------------------------------------------------------------

const elements = {
  setup: document.querySelector('#setup'),
  signIn: document.querySelector('#sign-in'),
  signInForm: document.querySelector('#sign-in-form'),
  playerName: document.querySelector('#player-name'),
  lobby: document.querySelector('#lobby'),
  playerLabel: document.querySelector('#player-label'),
  newGame: document.querySelector('#new-game'),
  myGames: document.querySelector('#my-games'),
  openGames: document.querySelector('#open-games'),
  game: document.querySelector('#game'),
  status: document.querySelector('#status'),
  hands: document.querySelector('#hands'),
  actions: document.querySelector('.actions'),
  draw: document.querySelector('#draw'),
  stand: document.querySelector('#stand'),
  leave: document.querySelector('#leave'),
  error: document.querySelector('#error'),
  connection: document.querySelector('#connection'),
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
    // IDENTITY_NOT_AUTHENTICATED: nobody has played with this name yet
    if (error?.code !== 20008) {
      throw error;
    }
  }

  await retrying(() => jsonpad.registerIdentity(credentials));
  return retrying(() => jsonpad.loginIdentity(credentials));
}

elements.signInForm.addEventListener('submit', async event => {
  event.preventDefault();

  const name = elements.playerName.value.trim().toLowerCase();
  if (!name) {
    return;
  }

  hideError();

  try {
    // loginIdentity() remembers the identity, so from now on every flow this
    // client calls is called as this player, and the flow sees them as
    // `identity`
    const [identity] = await signIn(name);
    me = identity;

    try {
      localStorage.setItem('cards-name', name);
    } catch {}

    elements.playerLabel.textContent = identity.displayName || identity.name;
    show(elements.signIn, false);
    show(elements.lobby, true);

    listenForChanges();
    await refreshLobby();
  } catch (error) {
    showError(error);
  }
});

function myName() {
  return me.displayName || me.name;
}

// -----------------------------------------------------------------------------
// The lobby
// -----------------------------------------------------------------------------

function gameButton(label, onClick) {
  const row = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  row.append(button);
  return row;
}

function emptyRow(text) {
  const row = document.createElement('li');
  row.className = 'empty';
  row.textContent = text;
  return row;
}

async function refreshLobby() {
  // The list has an index on /status with filtering turned on, so JSONPad can
  // pick out the games in each state for us
  const fetchGames = (status, limit) =>
    retrying(() =>
      jsonpad.fetchItems(
        GAMES,
        {
          status,
          includeData: true,
          limit,
          order: 'updatedAt',
          direction: 'desc',
        },
        withoutIdentity
      )
    );
  const waiting = await fetchGames('waiting', 20);
  const playing = await fetchGames('playing', 50);

  const isMine = item => item.data.players.some(player => player.id === me.id);
  const mine = [...waiting.data, ...playing.data].filter(isMine);
  const open = waiting.data.filter(item => !isMine(item));
  const host = item => item.data.players[0].name;

  elements.myGames.innerHTML = '';
  for (const item of mine) {
    const label =
      item.data.status === 'waiting'
        ? `${host(item)}'s game (waiting for a player)`
        : `Carry on with ${item.data.players.map(p => p.name).join(' v ')}`;
    elements.myGames.append(gameButton(label, () => openGame(item)));
  }
  if (mine.length === 0) {
    elements.myGames.append(emptyRow("You aren't in any games."));
  }

  elements.openGames.innerHTML = '';
  for (const item of open) {
    elements.openGames.append(
      gameButton(`Join ${host(item)}'s game`, () => joinGame(item))
    );
  }
  if (open.length === 0) {
    elements.openGames.append(
      emptyRow('Nobody is waiting. Start a game and share the page.')
    );
  }
}

// Realtime events can arrive in bursts, and each refresh is two requests
let lobbyRefresh = null;
function refreshLobbySoon() {
  clearTimeout(lobbyRefresh);
  lobbyRefresh = setTimeout(() => refreshLobby().catch(showError), 1000);
}

elements.newGame.addEventListener('click', async () => {
  hideError();

  try {
    // The flow shuffles a new deck, in a list this page can't see, and
    // creates the game. It responds with the game's id
    const { body } = await play('new-game', { name: myName() });
    await openGameById(body.gameId);
  } catch (error) {
    showError(error);
  }
});

async function joinGame(item) {
  hideError();

  try {
    await play('join', { gameId: item.id, name: myName() });
    await openGameById(item.id);
  } catch (error) {
    // Someone else probably joined first
    showError(error);
    refreshLobbySoon();
  }
}

elements.leave.addEventListener('click', async () => {
  closeGame();
  await refreshLobby().catch(showError);
});

// -----------------------------------------------------------------------------
// Playing
// -----------------------------------------------------------------------------

function openGame(item) {
  game = item;
  show(elements.lobby, false);
  show(elements.game, true);
  hideError();
  render();
}

async function openGameById(gameId) {
  openGame(await fetchGame(gameId));
}

function closeGame() {
  game = null;
  show(elements.game, false);
  show(elements.lobby, true);
}

function fetchGame(gameId) {
  return retrying(() =>
    jsonpad.fetchItem(GAMES, gameId, { includeData: true }, withoutIdentity)
  );
}

async function reloadGame() {
  if (!game) {
    return;
  }
  try {
    game = await fetchGame(game.id);
    render();
  } catch (error) {
    showError(error);
  }
}

// Drawing and standing are all this page can do. The flows decide whether
// it's your turn, which card you get, and what your total is
elements.draw.addEventListener('click', async () => {
  hideError();
  elements.draw.disabled = true;

  try {
    await play('draw', { gameId: game.id });
  } catch (error) {
    showError(error);
  }
  await reloadGame();
});

elements.stand.addEventListener('click', async () => {
  hideError();
  elements.stand.disabled = true;

  try {
    await play('stand', { gameId: game.id });
  } catch (error) {
    showError(error);
  }
  await reloadGame();
});

// -----------------------------------------------------------------------------
// Keeping up with the other player
// -----------------------------------------------------------------------------

function setConnection(state, text) {
  elements.connection.dataset.state = state;
  elements.connection.textContent = text;
}

function listenForChanges() {
  realtime.addEventListener('connected', () => {
    setConnection('live', 'Live');
  });

  realtime.addEventListener('disconnected', () => {
    setConnection('offline', 'Reconnecting…');
  });

  realtime.addEventListener('error', event => {
    // REALTIME_CONNECTION_LIMIT_EXCEEDED: each plan allows so many realtime
    // connections at once (one, on the free plan). The SDK keeps trying, and
    // until it gets in, the game checks for moves every few seconds instead
    if (event.code === 10015) {
      setConnection(
        'limited',
        `Realtime connection limit reached: checking for moves every ${
          POLL_INTERVAL_MS / 1000
        } seconds instead`
      );
    }
  });

  // A flow's writes send realtime events like any other write
  realtime.addEventListener('item-updated', event => {
    const item = event.detail.model;

    if (game && item.id === game.id) {
      if (item.data) {
        game = item;
        render();
      } else {
        reloadGame();
      }
    } else if (!game) {
      refreshLobbySoon();
    }
  });

  realtime.addEventListener('item-created', () => {
    if (!game) {
      refreshLobbySoon();
    }
  });

  setConnection('offline', 'Connecting…');
  realtime.listen(['item-created', 'item-updated'], [GAMES]);
}

setInterval(() => {
  if (me && game && !realtime.connected && game.data.status !== 'finished') {
    reloadGame();
  }
}, POLL_INTERVAL_MS);

// -----------------------------------------------------------------------------
// Drawing the table
// -----------------------------------------------------------------------------

const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };

function statusText() {
  const { status, players, turn, winnerId } = game.data;

  if (status === 'waiting') {
    return 'Waiting for another player to join…';
  }

  if (status === 'finished') {
    // A draw has no winnerId at all: the flow's merge removes it
    if (!winnerId) {
      return "It's a draw.";
    }
    return winnerId === me.id ? 'You won!' : 'You lost.';
  }

  return players[turn]?.id === me.id
    ? 'Your turn: draw a card, or stand.'
    : `${players[turn]?.name}'s turn.`;
}

function stateText(player) {
  return { playing: '', stood: 'stood', bust: 'bust!' }[player.state];
}

function render() {
  if (!game) {
    return;
  }

  const { status, players, turn } = game.data;
  elements.status.textContent = statusText();

  elements.hands.innerHTML = '';
  players.forEach((player, index) => {
    const hand = document.createElement('div');
    hand.className = 'hand';
    hand.classList.toggle('mine', player.id === me.id);
    hand.classList.toggle('current', status === 'playing' && index === turn);

    const heading = document.createElement('div');
    heading.className = 'hand-heading';
    heading.innerHTML = '<strong></strong><span class="hand-state"></span>';
    heading.querySelector('strong').textContent =
      player.id === me.id ? `${player.name} (you)` : player.name;
    heading.querySelector('.hand-state').textContent =
      `${player.total} ${stateText(player)}`.trim();

    const cards = document.createElement('div');
    cards.className = 'cards';
    for (const card of player.cards) {
      const element = document.createElement('span');
      element.className = 'card';
      element.classList.toggle('red', card.suit === 'H' || card.suit === 'D');
      element.textContent = `${card.rank}${SUITS[card.suit]}`;
      cards.append(element);
    }

    hand.append(heading, cards);
    elements.hands.append(hand);
  });

  const myTurn = status === 'playing' && players[turn]?.id === me.id;
  show(elements.actions, myTurn);
  elements.draw.disabled = !myTurn;
  elements.stand.disabled = !myTurn;
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
    elements.playerName.value = localStorage.getItem('cards-name') ?? '';
  } catch {}
}

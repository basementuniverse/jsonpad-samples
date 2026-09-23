// Connect 4, refereed by JSONPad.
//
// This page is the untrusted part. It draws the board, works out where a
// piece lands and whether that wins, and writes the result back. None of that
// is trusted: the list's write rules decide whose turn it is, that the move
// history can only be added to, and that the board always matches the moves
// that were recorded. See rules/games.rules.
//
// That's the point of the sample. Open the console and try to cheat.

const JSONPAD_LIST = 'connect4-games';
const IDENTITY_GROUP = 'connect4-players';

// Everyone shares this, because the sample is about the rules, not passwords
const SHARED_PASSWORD = 'connect4';

const ROWS = 6;
const COLUMNS = 7;
const TURN_LIMIT_MS = 2 * 60 * 1000;

// Without a realtime connection, look for the other player's moves this often
const POLL_INTERVAL_MS = 5000;

// Once a player signs in, this client sends their identity with every request
const jsonpad = new JSONPad.default(JSONPAD_TOKEN);
const realtime = new JSONPadRealtime.default(JSONPAD_TOKEN);

// A request made with an identity only sees the items that identity created.
// Games are shared, so we read them without one: the token can see them all
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
  playerName: document.querySelector('#player-name'),
  lobby: document.querySelector('#lobby'),
  playerLabel: document.querySelector('#player-label'),
  newGame: document.querySelector('#new-game'),
  myGames: document.querySelector('#my-games'),
  openGames: document.querySelector('#open-games'),
  game: document.querySelector('#game'),
  status: document.querySelector('#status'),
  board: document.querySelector('#board'),
  cancel: document.querySelector('#cancel'),
  leave: document.querySelector('#leave'),
  error: document.querySelector('#error'),
  connection: document.querySelector('#connection'),
};

function show(element, visible) {
  element.classList.toggle('hidden', !visible);
}

function showError(error) {
  // A require statement that fails says why, in the words its author wrote. A
  // write that no allow statement permits is refused without a reason: the
  // rules don't explain themselves to clients
  elements.error.textContent =
    error instanceof JSONPad.WriteRuleError && error.denied
      ? "You can't do that right now."
      : describeError(error);
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
    // loginIdentity() remembers the identity, so from now on every request
    // this client makes is made as this player
    const [identity] = await signIn(name);
    me = identity;

    try {
      localStorage.setItem('connect4-name', name);
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

// -----------------------------------------------------------------------------
// The lobby
// -----------------------------------------------------------------------------

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(0));
}

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
  const waiting = await retrying(() =>
    jsonpad.fetchItems(
      JSONPAD_LIST,
      {
        status: 'waiting',
        includeData: true,
        limit: 20,
        order: 'createdAt',
        direction: 'desc',
      },
      withoutIdentity
    )
  );
  const started = await retrying(() =>
    jsonpad.fetchItems(
      JSONPAD_LIST,
      {
        status: 'started',
        includeData: true,
        limit: 50,
        order: 'updatedAt',
        direction: 'desc',
      },
      withoutIdentity
    )
  );

  const isMine = item => item.data.participantIds.includes(me.id);
  const mine = [...waiting.data, ...started.data].filter(isMine);
  const open = waiting.data.filter(item => !isMine(item));

  elements.myGames.innerHTML = '';
  for (const item of mine) {
    const label =
      item.data.status === 'waiting'
        ? `${item.description} (waiting for a player)`
        : `Carry on with ${item.description}`;
    elements.myGames.append(gameButton(label, () => openGame(item)));
  }
  if (mine.length === 0) {
    elements.myGames.append(emptyRow("You aren't in any games."));
  }

  elements.openGames.innerHTML = '';
  for (const item of open) {
    elements.openGames.append(
      gameButton(`Join ${item.description}`, () => joinGame(item))
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
    const item = await retrying(() =>
      jsonpad.createItem(JSONPAD_LIST, {
        description: `${me.displayName || me.name}'s game`,
        data: {
          status: 'waiting',
          participantIds: [me.id],
          currentPlayerId: null,
          winnerId: null,
          // Replaced with the time by JSONPad, so a client can't choose it
          turnStartedAt: '$jsonpad-var:now',
          board: emptyBoard(),
          moves: [],
        },
      })
    );

    openGame(item);
  } catch (error) {
    showError(error);
  }
});

async function joinGame(item) {
  hideError();

  try {
    // replaceItemData() sends the whole game, and it replaces what's there.
    // updateItemData() would merge it in instead, and merging two arrays
    // joins them together, which the rules would (rightly) refuse
    const updated = await retrying(() =>
      jsonpad.replaceItemData(JSONPAD_LIST, item.id, {
        ...item.data,
        participantIds: [...item.data.participantIds, me.id],
        status: 'started',
        currentPlayerId: item.data.participantIds[0],
        turnStartedAt: '$jsonpad-var:now',
      })
    );

    openGame(updated);
  } catch (error) {
    showError(error);
    refreshLobbySoon();
  }
}

elements.leave.addEventListener('click', async () => {
  closeGame();
  await refreshLobby().catch(showError);
});

elements.cancel.addEventListener('click', async () => {
  try {
    // Allowed by the rules only while nobody else has joined
    await retrying(() => jsonpad.deleteItem(JSONPAD_LIST, game.id));
    closeGame();
    await refreshLobby();
  } catch (error) {
    showError(error);
  }
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

function closeGame() {
  game = null;
  show(elements.game, false);
  show(elements.lobby, true);
}

async function reloadGame() {
  try {
    game = await retrying(() =>
      jsonpad.fetchItem(
        JSONPAD_LIST,
        game.id,
        { includeData: true },
        withoutIdentity
      )
    );
    render();
  } catch (error) {
    // The game was cancelled
    if (error?.status === 404) {
      closeGame();
      refreshLobbySoon();
    }
  }
}

function playerIndex(identityId) {
  return game.data.participantIds.indexOf(identityId) + 1;
}

/**
 * Where a piece dropped into this column lands, or -1 if the column is full
 */
function landingRow(board, column) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][column] === 0) {
      return row;
    }
  }
  return -1;
}

function wins(board, row, column, piece) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([dr, dc]) => {
    let run = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (
        r >= 0 &&
        r < ROWS &&
        c >= 0 &&
        c < COLUMNS &&
        board[r][c] === piece
      ) {
        run++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    return run >= 4;
  });
}

async function play(column) {
  const board = game.data.board.map(row => [...row]);
  const row = landingRow(board, column);

  if (row === -1) {
    return;
  }

  const piece = playerIndex(me.id);
  board[row][column] = piece;

  const won = wins(board, row, column, piece);
  const opponent = game.data.participantIds.find(id => id !== me.id);
  const full = board.every(cells => cells.every(cell => cell !== 0));

  hideError();

  try {
    game = await retrying(() =>
      jsonpad.replaceItemData(JSONPAD_LIST, game.id, {
        ...game.data,
        board,
        moves: [...game.data.moves, { playerId: me.id, column }],
        currentPlayerId: won ? game.data.currentPlayerId : opponent,
        status: won || full ? 'finished' : 'started',
        winnerId: won ? me.id : null,
        turnStartedAt: '$jsonpad-var:now',
      })
    );
    render();
  } catch (error) {
    // The rules refused it. Fetch the game again: someone else probably moved
    showError(error);
    await reloadGame();
  }
}

async function claimSlowTurn() {
  hideError();

  try {
    game = await retrying(() =>
      jsonpad.replaceItemData(JSONPAD_LIST, game.id, {
        ...game.data,
        currentPlayerId: me.id,
        turnStartedAt: '$jsonpad-var:now',
      })
    );
    render();
  } catch (error) {
    showError(error);
    await reloadGame();
  }
}

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

  realtime.addEventListener('item-updated', event => {
    const item = event.detail.model;

    if (game && item.id === game.id) {
      // A very large item arrives without its data. A game never will, but
      // fetching it is the right thing to do if it does
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

  realtime.addEventListener('item-deleted', event => {
    if (game && event.detail.model.id === game.id) {
      closeGame();
    }
    if (!game) {
      refreshLobbySoon();
    }
  });

  setConnection('offline', 'Connecting…');
  realtime.listen(
    ['item-created', 'item-updated', 'item-deleted'],
    [JSONPAD_LIST]
  );
}

setInterval(() => {
  if (me && game && !realtime.connected && game.data.status !== 'finished') {
    reloadGame();
  }
}, POLL_INTERVAL_MS);

// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

function statusText() {
  const { status, currentPlayerId, winnerId } = game.data;

  if (status === 'waiting') {
    return 'Waiting for another player to join…';
  }

  if (status === 'finished') {
    if (!winnerId) {
      return "It's a draw.";
    }
    return winnerId === me.id ? 'You won!' : 'You lost.';
  }

  return currentPlayerId === me.id ? "It's your turn." : "It's their turn.";
}

function render() {
  if (!game) {
    return;
  }

  elements.status.textContent = statusText();

  const myTurn =
    game.data.status === 'started' && game.data.currentPlayerId === me.id;

  elements.board.innerHTML = '';
  elements.board.classList.toggle('my-turn', myTurn);
  document.querySelector('.claim')?.remove();

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';

      const value = game.data.board[row][column];
      if (value !== 0) {
        cell.classList.add(value === playerIndex(me.id) ? 'mine' : 'theirs');
      }

      cell.disabled = !myTurn;
      cell.addEventListener('click', () => play(column));
      elements.board.append(cell);
    }
  }

  // The rules only let the player who started a game cancel it, and only
  // until someone joins, so that's when the button is shown
  show(
    elements.cancel,
    game.data.status === 'waiting' && game.data.participantIds[0] === me.id
  );

  // Nothing is scheduled: if the other player has run out of time, either
  // player can ask for the turn, and the rules check the clock
  const waitedTooLong =
    game.data.status === 'started' &&
    game.data.currentPlayerId !== me.id &&
    Date.now() - new Date(game.data.turnStartedAt).getTime() > TURN_LIMIT_MS;

  if (waitedTooLong) {
    const claim = document.createElement('button');
    claim.type = 'button';
    claim.className = 'claim';
    claim.textContent = 'Take the turn (they ran out of time)';
    claim.addEventListener('click', claimSlowTurn);
    elements.status.after(claim);
  }
}

// Redraw every 30 seconds, so the "they ran out of time" button appears
setInterval(() => {
  if (game) {
    render();
  }
}, 30000);

// -----------------------------------------------------------------------------
// Starting up
// -----------------------------------------------------------------------------

if (JSONPAD_TOKEN.startsWith('PASTE')) {
  // config.js still has the placeholder in it
  show(elements.setup, true);
  show(elements.signIn, false);
} else {
  try {
    elements.playerName.value = localStorage.getItem('connect4-name') ?? '';
  } catch {}
}

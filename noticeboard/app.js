// A notice board that everyone shares.
//
// Each note is an item in a JSONPad list with realtime turned on. When anyone
// adds, edits, moves or removes a note, JSONPad tells every open copy of this
// page straight away, and each one updates its board to match.

const JSONPAD_LIST = 'notice-board-notices';

const COLOURS = ['yellow', 'red', 'green', 'blue'];
const NOTE_SIZE = 200;
const BOARD_SIZE = 5000;

// How long to wait after the last keypress before saving a note's text
const SAVE_DELAY_MS = 500;

// Without a realtime connection, check for changes this often
const POLL_INTERVAL_MS = 10000;

const configured = !JSONPAD_TOKEN.startsWith('PASTE');

const jsonpad = new JSONPad.default(JSONPAD_TOKEN);
const realtime = new JSONPadRealtime.default(JSONPAD_TOKEN);

const board = document.querySelector('.board');
const connection = document.querySelector('.connection');
const palette = document.querySelector('.palette');

// Every note on the board, by item id
const notes = new Map();

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
  try {
    return JSON.parse(error.message).message;
  } catch {
    return error?.message ?? String(error);
  }
}

function reportError(error) {
  console.error(describeError(error));
}

// -----------------------------------------------------------------------------
// Your colour
// -----------------------------------------------------------------------------

// Notes you add are in your colour, so people can tell whose is whose
let colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
try {
  colour = localStorage.getItem('noticeboard-colour') ?? colour;
} catch {}

for (const option of COLOURS) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = `swatch ${option}`;
  swatch.title = `Add ${option} notes`;
  swatch.addEventListener('click', () => chooseColour(option));
  palette.append(swatch);
}

function chooseColour(option) {
  colour = option;
  try {
    localStorage.setItem('noticeboard-colour', option);
  } catch {}
  for (const swatch of palette.querySelectorAll('.swatch')) {
    swatch.classList.toggle('chosen', swatch.classList.contains(option));
  }
}

chooseColour(colour);

// -----------------------------------------------------------------------------
// Notes on the board
// -----------------------------------------------------------------------------

/**
 * Put a note on the board, or bring one that's already there up to date
 */
function showNote(id, data) {
  let note = notes.get(id);

  if (!note) {
    note = createNoteElement(id, data.colour);
    notes.set(id, note);
    board.append(note.element);
  }

  // Leave a note alone while it's being dragged here
  if (!note.dragging) {
    note.element.style.left = `${data.x}px`;
    note.element.style.top = `${data.y}px`;
  }

  // Someone else changed the text. If there's typing here that hasn't been
  // saved yet, it wins: it'll be saved in a moment, and everyone will get it
  if (note.textarea.value !== data.content && !note.saveTimer) {
    const { selectionStart, selectionEnd } = note.textarea;
    note.textarea.value = data.content;
    if (document.activeElement === note.textarea) {
      note.textarea.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

function removeNote(id) {
  notes.get(id)?.element.remove();
  notes.delete(id);
}

function createNoteElement(id, noteColour) {
  const element = document.createElement('div');
  element.className = `note ${noteColour}`;

  const handle = document.createElement('div');
  handle.className = 'handle';
  handle.title = 'Drag to move';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.title = 'Take this note down';
  remove.textContent = '×';

  const textarea = document.createElement('textarea');
  textarea.maxLength = 500;
  textarea.placeholder = 'Write something…';

  handle.append(remove);
  element.append(handle, textarea);

  const note = { id, element, textarea, saveTimer: null, dragging: null };

  textarea.addEventListener('input', () => {
    clearTimeout(note.saveTimer);
    note.saveTimer = setTimeout(() => saveText(note), SAVE_DELAY_MS);
  });

  remove.addEventListener('click', () => takeDown(note));
  handle.addEventListener('pointerdown', event => startDrag(note, event));

  return note;
}

// -----------------------------------------------------------------------------
// Making changes
// -----------------------------------------------------------------------------

async function addNote(x, y) {
  try {
    const item = await retrying(() =>
      jsonpad.createItem(JSONPAD_LIST, {
        data: { colour, x, y, content: '' },
      })
    );
    showNote(item.id, item.data);
    notes.get(item.id).textarea.focus();
  } catch (error) {
    reportError(error);
  }
}

async function saveText(note) {
  const content = note.textarea.value;

  try {
    // updateItemData() merges what we send into the item, so this only
    // changes the text, and leaves the colour and position as they are
    await retrying(() =>
      jsonpad.updateItemData(
        JSONPAD_LIST,
        note.id,
        { content },
        { includeData: false }
      )
    );
  } catch (error) {
    reportError(error);
  } finally {
    // More typing may have started while this was being saved
    if (note.textarea.value === content) {
      note.saveTimer = null;
    }
  }
}

async function savePosition(note, x, y) {
  try {
    await retrying(() =>
      jsonpad.updateItemData(
        JSONPAD_LIST,
        note.id,
        { x, y },
        { includeData: false }
      )
    );
  } catch (error) {
    reportError(error);
  }
}

async function takeDown(note) {
  try {
    await retrying(() => jsonpad.deleteItem(JSONPAD_LIST, note.id));
    removeNote(note.id);
  } catch (error) {
    reportError(error);
  }
}

// Click on an empty part of the board to add a note there. Dragging across
// the board (to scroll, or to select something) isn't a click
let pressedAt = null;
board.addEventListener('pointerdown', event => {
  pressedAt = { x: event.clientX, y: event.clientY };
});

board.addEventListener('click', event => {
  const moved =
    pressedAt &&
    Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 5;

  if (!configured || event.target !== board || moved) {
    return;
  }

  const bounds = board.getBoundingClientRect();
  const x = clamp(event.clientX - bounds.left - NOTE_SIZE / 2);
  const y = clamp(event.clientY - bounds.top - 20);
  addNote(x, y);
});

function clamp(position) {
  return Math.round(Math.min(Math.max(position, 0), BOARD_SIZE - NOTE_SIZE));
}

// -----------------------------------------------------------------------------
// Dragging notes around
// -----------------------------------------------------------------------------

// A note moves on this screen while it's dragged, and everyone else sees it
// move when it's dropped: saving every step of the way would be a lot of
// requests
function startDrag(note, event) {
  if (event.target.closest('.remove')) {
    return;
  }

  event.preventDefault();
  note.dragging = {
    offsetX: event.clientX - note.element.offsetLeft,
    offsetY: event.clientY - note.element.offsetTop,
  };
  note.element.classList.add('dragging');
  note.element.setPointerCapture(event.pointerId);

  const move = moveEvent => {
    note.element.style.left = `${clamp(moveEvent.clientX - note.dragging.offsetX)}px`;
    note.element.style.top = `${clamp(moveEvent.clientY - note.dragging.offsetY)}px`;
  };

  const drop = () => {
    note.element.removeEventListener('pointermove', move);
    note.element.removeEventListener('pointerup', drop);
    note.element.classList.remove('dragging');
    note.dragging = null;
    savePosition(
      note,
      parseInt(note.element.style.left, 10),
      parseInt(note.element.style.top, 10)
    );
  };

  note.element.addEventListener('pointermove', move);
  note.element.addEventListener('pointerup', drop);
}

// -----------------------------------------------------------------------------
// Keeping up with everyone else
// -----------------------------------------------------------------------------

/**
 * Fetch every note, and make the board match
 *
 * This happens when the page loads, and again whenever the realtime
 * connection comes back, because anything that happened while it was down
 * was missed
 */
async function loadNotes() {
  const seen = new Set();

  // A page can hold up to 100 items. The board isn't likely to have more than
  // a few pages' worth, but stop at 10 pages just in case
  for (let page = 1; page <= 10; page++) {
    const response = await retrying(() =>
      jsonpad.fetchItems(JSONPAD_LIST, {
        includeData: true,
        limit: 100,
        page,
        order: 'createdAt',
        direction: 'asc',
      })
    );

    for (const item of response.data) {
      seen.add(item.id);
      showNote(item.id, item.data);
    }

    if (page * 100 >= response.total) {
      break;
    }
  }

  for (const id of notes.keys()) {
    if (!seen.has(id)) {
      removeNote(id);
    }
  }
}

function setConnection(state, text) {
  connection.dataset.state = state;
  connection.textContent = text;
}

let connectedBefore = false;

realtime.addEventListener('connected', () => {
  setConnection('live', 'Live');
  if (connectedBefore) {
    loadNotes().catch(reportError);
  }
  connectedBefore = true;
});

realtime.addEventListener('disconnected', () => {
  setConnection('offline', 'Reconnecting…');
});

realtime.addEventListener('error', event => {
  // REALTIME_CONNECTION_LIMIT_EXCEEDED: each plan allows so many realtime
  // connections at once (one, on the free plan). The SDK keeps trying, and
  // until it gets in, the board checks for changes every few seconds instead
  if (event.code === 10015) {
    setConnection(
      'limited',
      `Realtime connection limit reached: checking for changes every ${
        POLL_INTERVAL_MS / 1000
      } seconds instead`
    );
  }
});

// Each event carries the item as it is now, including its data. A very large
// item arrives without its data, which a note never will, but fetching it
// again is the right thing to do if it does
async function handleChange(event) {
  const item = event.detail.model;

  if (item.data) {
    showNote(item.id, item.data);
    return;
  }

  try {
    const fetched = await retrying(() =>
      jsonpad.fetchItem(JSONPAD_LIST, item.id, { includeData: true })
    );
    showNote(fetched.id, fetched.data);
  } catch (error) {
    reportError(error);
  }
}

realtime.addEventListener('item-created', handleChange);
realtime.addEventListener('item-updated', handleChange);
realtime.addEventListener('item-restored', handleChange);
realtime.addEventListener('item-deleted', event => {
  removeNote(event.detail.model.id);
});

setInterval(() => {
  if (configured && !realtime.connected) {
    loadNotes().catch(reportError);
  }
}, POLL_INTERVAL_MS);

// -----------------------------------------------------------------------------
// Starting up
// -----------------------------------------------------------------------------

if (configured) {
  setConnection('offline', 'Connecting…');
  realtime.listen(
    ['item-created', 'item-updated', 'item-restored', 'item-deleted'],
    [JSONPAD_LIST]
  );
  loadNotes().catch(reportError);
} else {
  // config.js still has the placeholder in it
  document.querySelector('.setup').classList.remove('hidden');
}

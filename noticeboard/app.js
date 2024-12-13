const JSONPAD_TOKEN = 'AtMBzWC626liAQKvleIJeUhOSNWoHaJo';
const JSONPAD_LIST = 'notice-board-notices';
const JSONPAD_LIST_ID = 'b7195be9-46a6-4427-b54e-bf99c8dae056';

const jsonpad = new JSONPad.default(JSONPAD_TOKEN);
const jsonpadRealtime = new JSONPadRealtime.default(JSONPAD_TOKEN);

jsonpadRealtime.listen(
  [
    'item-created',
    'item-updated',
    'item-deleted',
  ],
  [JSONPAD_LIST_ID],
  ['*']
);

jsonpadRealtime.addEventListener('item-created', event => {
  createNoticeElement(
    event.detail.model.id,
    JSON.parse(event.detail.model.data)
  );
});

jsonpadRealtime.addEventListener('item-updated', event => {
  updateNoticeElement(
    event.detail.model.id,
    JSON.parse(event.detail.model.data)
  );
});

jsonpadRealtime.addEventListener('item-deleted', event => {
  removeNoticeElement(event.detail.model.id);
});

const colour = [
  'red',
  'green',
  'blue',
  'yellow',
][randomIntBetween(0, 3)];
const container = document.querySelector('.container');

window.addEventListener('DOMContentLoaded', () => {
  initialise();
});

container.addEventListener('click', event => {
  if (event.target !== event.currentTarget) {
    return;
  }
  debouncedAddNotice(event.clientX, event.clientY);
});

function initialise() {
  jsonpad.fetchItems(
    JSONPAD_LIST,
    {
      includeData: true,
      limit: 100,
    }
  ).then(response => {
    for (const item of response.data) {
      createNoticeElement(item.id, item.data);
    }
  });
}

function addNotice(x, y) {
  jsonpad.createItem(
    JSONPAD_LIST,
    {
      data: {
        colour,
        x,
        y,
        content: '',
      },
    }
  ).then(item => {
    createNoticeElement(item.id, item.data);
  });
}

const debouncedAddNotice = debounce(addNotice, 500);

function editNotice(id, content) {
  jsonpad.updateItemData(
    JSONPAD_LIST,
    id,
    {
      content,
    }
  );
}

const debouncedEditNotice = debounce(editNotice, 500);

function deleteNotice(id) {
  jsonpad.deleteItem(JSONPAD_LIST, id).then(() => {
    removeNoticeElement(id);
  });
}

function createNoticeElement(id, data) {
  let noticeElement = container.querySelector(`.notice[data-id="${id}"]`);
  if (noticeElement) {
    return;
  }

  noticeElement = document.createElement('div');
  noticeElement.dataset.id = id;
  noticeElement.className = `notice ${data.colour}`;
  noticeElement.style.top = `${data.y}px`;
  noticeElement.style.left = `${data.x}px`;

  const textAreaElement = document.createElement('textarea');
  textAreaElement.value = data.content;
  noticeElement.appendChild(textAreaElement);

  textAreaElement.addEventListener('input', () => {
    debouncedEditNotice(id, textAreaElement.value);
  });

  const deleteButtonElement = document.createElement('button');
  deleteButtonElement.className = 'delete-notice-button';
  deleteButtonElement.innerHTML = '<i class="fa fa-times"></i>';
  noticeElement.appendChild(deleteButtonElement);

  deleteButtonElement.addEventListener('click', () => {
    deleteNotice(id);
  });

  container.appendChild(noticeElement);
}

function updateNoticeElement(id, data) {
  const noticeElement = container.querySelector(`.notice[data-id="${id}"]`);
  if (noticeElement) {
    const textAreaElement = noticeElement.querySelector('textarea');
    textAreaElement.value = data.content;
  }
}

function removeNoticeElement(id) {
  const noticeElement = container.querySelector(`.notice[data-id="${id}"]`);
  if (noticeElement) {
    noticeElement.remove();
  }
}

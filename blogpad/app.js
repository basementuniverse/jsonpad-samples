// BlogPad: a blog with no server of its own.
//
// Articles are items in a JSONPad list, and authors are JSONPad identities.
// The list's JSON schema decides what an article looks like, its indexes let
// JSONPad do the sorting, filtering and searching, and its write rules make
// sure nobody can publish in someone else's name. See jsonpad-schema.json.

const JSONPAD_LIST = 'blogpad-articles';
const IDENTITY_GROUP = 'blogpad';

const PAGE_SIZE = 5;

const CATEGORIES = {
  general: 'General',
  news: 'News',
  tutorials: 'Tutorials',
  opinion: 'Opinion',
};

// An author stays signed in between visits: we keep their session token
function savedSession() {
  try {
    return localStorage.getItem('blogpad-session') ?? undefined;
  } catch {
    return undefined;
  }
}

function saveSession(token) {
  try {
    if (token) {
      localStorage.setItem('blogpad-session', token);
    } else {
      localStorage.removeItem('blogpad-session');
    }
  } catch {}
}

// Once an author signs in, this client sends their identity with every request
const jsonpad = new JSONPad.default(
  JSONPAD_TOKEN,
  IDENTITY_GROUP,
  savedSession()
);

// A request made with an identity only sees the items that identity created,
// and everyone should see every article, so we read them without one
const withoutIdentity = { ignore: true };

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

  switch (body.code) {
    case 20008: // IDENTITY_NOT_AUTHENTICATED
      return "That username and password don't match.";
    case 20003: // IDENTITY_UNABLE_TO_CREATE
      return 'That username is taken.';
  }

  // A validation error lists what's wrong with each field
  const reasons = [...(body.message ?? '').matchAll(/"msg":"([^"]*)"/g)];
  if (reasons.length > 0) {
    return reasons.map(([, reason]) => reason).join(', ');
  }

  return body.message ?? error.message;
}

// -----------------------------------------------------------------------------
// The app
// -----------------------------------------------------------------------------

const markdown = new showdown.Converter({
  tables: true,
  strikethrough: true,
  simplifiedAutoLink: true,
});

function emptyDraft() {
  return {
    id: null,
    title: '',
    summary: '',
    category: 'general',
    content: '',
  };
}

const app = Vue.createApp({
  data() {
    return {
      configured: !JSONPAD_TOKEN.startsWith('PASTE'),
      categories: CATEGORIES,
      me: null,
      articles: [],
      total: 0,
      page: 1,
      loading: false,
      error: null,
      filters: {
        category: '',
        recent: '',
        mine: false,
      },
      sort: 'newest',
      search: '',
      searchResults: null,
      authMode: 'login',
      authForm: { name: '', password: '' },
      authError: null,
      draft: emptyDraft(),
      draftError: null,
      saving: false,
    };
  },

  computed: {
    pages() {
      return Math.max(1, Math.ceil(this.total / PAGE_SIZE));
    },
    shownArticles() {
      return this.searchResults ?? this.articles;
    },
    filtered() {
      return Object.values(this.filters).some(Boolean);
    },
  },

  watch: {
    filters: {
      deep: true,
      handler() {
        this.page = 1;
        this.loadArticles();
      },
    },
    sort() {
      this.page = 1;
      this.loadArticles();
    },
  },

  async created() {
    if (!this.configured) {
      return;
    }

    // Check whether the session we saved last time is still good. If it's
    // expired, forget it and start again without it
    if (savedSession()) {
      try {
        this.me = await retrying(() => jsonpad.fetchSelfIdentity());
      } catch (error) {
        if (error?.status === 401) {
          saveSession(null);
          window.location.reload();
          return;
        }
        this.error = describeError(error);
      }
    }

    await this.loadArticles();
  },

  methods: {
    // -------------------------------------------------------------------------
    // Reading articles
    // -------------------------------------------------------------------------

    async loadArticles() {
      // Each of these is done by JSONPad, using the list's indexes (their
      // path names are the parameter names) or an item's own fields
      const parameters = {
        page: this.page,
        limit: PAGE_SIZE,
        includeData: true,
        ...{
          newest: { order: 'published', direction: 'desc' },
          oldest: { order: 'published', direction: 'asc' },
          title: { order: 'title', direction: 'asc' },
        }[this.sort],
      };

      if (this.filters.category) {
        parameters.category = this.filters.category;
      }

      if (this.filters.recent) {
        const since = dayjs().subtract(Number(this.filters.recent), 'day');
        parameters.published = `after:${since.format('YYYY-MM-DD')}`;
      }

      // Every item remembers the identity that created it, and can be
      // filtered by it
      if (this.filters.mine && this.me) {
        parameters.identityId = this.me.id;
      }

      this.loading = true;
      this.error = null;

      try {
        const response = await retrying(() =>
          jsonpad.fetchItems(JSONPAD_LIST, parameters, withoutIdentity)
        );
        this.articles = response.data;
        this.total = response.total;
      } catch (error) {
        this.error = describeError(error);
      } finally {
        this.loading = false;
      }
    },

    async runSearch() {
      const query = this.search.trim();

      if (query.length < 3) {
        this.error = 'Search for at least 3 characters.';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        // Searches the indexes with searching turned on (title and summary),
        // and returns the best matches first
        const results = await retrying(() =>
          jsonpad.searchList(JSONPAD_LIST, query, {
            includeItems: true,
            includeData: true,
          })
        );
        this.searchResults = results.map(result => result.item);
      } catch (error) {
        this.error = describeError(error);
      } finally {
        this.loading = false;
      }
    },

    clearSearch() {
      this.search = '';
      this.searchResults = null;
      this.error = null;
    },

    goToPage(page) {
      this.page = page;
      this.loadArticles();
      window.scrollTo(0, 0);
    },

    // -------------------------------------------------------------------------
    // Signing in and out
    // -------------------------------------------------------------------------

    showAuth(mode) {
      this.authMode = mode;
      this.authForm = { name: '', password: '' };
      this.authError = null;
      this.$refs.authDialog.showModal();
    },

    async submitAuth() {
      const credentials = {
        group: IDENTITY_GROUP,
        name: this.authForm.name.trim(),
        password: this.authForm.password,
      };

      this.authError = null;

      try {
        if (this.authMode === 'register') {
          await retrying(() => jsonpad.registerIdentity(credentials));
        }

        // loginIdentity() remembers the session, so from now on every request
        // this client makes is made as this author
        const [identity, token] = await retrying(() =>
          jsonpad.loginIdentity(credentials)
        );

        saveSession(token);
        this.me = identity;
        this.$refs.authDialog.close();
      } catch (error) {
        this.authError = describeError(error);
      }
    },

    async logout() {
      try {
        await retrying(() => jsonpad.logoutIdentity());
      } catch (error) {
        // The session had already ended, which is what we wanted anyway
      }

      saveSession(null);
      this.me = null;
      this.filters.mine = false;
    },

    // -------------------------------------------------------------------------
    // Writing articles
    // -------------------------------------------------------------------------

    // Every item remembers the identity that created it
    isMine(article) {
      return this.me !== null && article.identity?.id === this.me.id;
    },

    startWriting(article = null) {
      this.draft = article
        ? {
            id: article.id,
            title: article.data.title,
            summary: article.data.summary ?? '',
            category: article.data.category ?? 'general',
            content: article.data.content,
          }
        : emptyDraft();
      this.draftError = null;
      this.$refs.editorDialog.showModal();
    },

    async saveDraft() {
      const { id, title, summary, category, content } = this.draft;

      this.saving = true;
      this.draftError = null;

      try {
        if (id === null) {
          await retrying(() =>
            jsonpad.createItem(JSONPAD_LIST, {
              data: {
                title,
                summary,
                category,
                content,
                author: this.me.name,
                // Replaced with the time by JSONPad, so nobody can backdate
                // an article. The write rules check this
                publishedAt: '$jsonpad-var:now',
              },
            })
          );
        } else {
          // Merged into the article, so author and publishedAt stay as they are
          await retrying(() =>
            jsonpad.updateItemData(JSONPAD_LIST, id, {
              title,
              summary,
              category,
              content,
            })
          );
        }

        this.$refs.editorDialog.close();
        await (this.searchResults ? this.runSearch() : this.loadArticles());
      } catch (error) {
        // The list's JSON schema and write rules explain what's wrong
        this.draftError = describeError(error);
      } finally {
        this.saving = false;
      }
    },

    async deleteArticle(article) {
      if (!confirm(`Delete "${article.data.title}"?`)) {
        return;
      }

      try {
        await retrying(() => jsonpad.deleteItem(JSONPAD_LIST, article.id));
        await (this.searchResults ? this.runSearch() : this.loadArticles());
      } catch (error) {
        this.error = describeError(error);
      }
    },

    // -------------------------------------------------------------------------
    // Displaying articles
    // -------------------------------------------------------------------------

    // Anyone can write an article, so its Markdown is cleaned before it's
    // shown: a <script> in someone's article mustn't run in your browser
    renderContent(article) {
      return DOMPurify.sanitize(markdown.makeHtml(article.data.content ?? ''));
    },

    formatDate(article) {
      return dayjs(article.data.publishedAt ?? article.createdAt).format(
        'D MMMM YYYY'
      );
    },
  },
});

app.mount('#app');

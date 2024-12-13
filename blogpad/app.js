const JSONPAD_PUBLIC_TOKEN = 'GCjYHT+zjexmdj3Yie7jOQsmQ8W8czF9';

const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      jsonpad: new JSONPad.default(
        JSONPAD_PUBLIC_TOKEN,
        localStorage.getItem('identity-group') ?? undefined,
        localStorage.getItem('identity-token') ?? undefined
      ),
      showdownConverter: new showdown.Converter(),
      dayjs: dayjs,
      currentUser: null,
      isRegistering: false,
      authForm: {
        name: '',
        password: ''
      },
      authError: null,
      articles: [],
      newArticle: {
        title: '',
        content: ''
      },
      editingArticle: null,
      pagination: {
        page: 1,
        limit: 3,
        total: 0
      }
    }
  },

  async created() {
    try {
      const identity = await this.jsonpad.fetchSelfIdentity();
      this.currentUser = identity;
    } catch (error) {
      console.log('No active session', error);
    }

    this.loadArticles();
  },
  
  methods: {
    async handleAuth() {
      try {
        if (this.isRegistering) {
          await this.jsonpad.registerIdentity({
            name: this.authForm.name,
            password: this.authForm.password,
            group: 'blogpad'
          });
          this.closeRegisterModal();
        }

        const [identity, token] = await this.jsonpad.loginIdentity({
          name: this.authForm.name,
          password: this.authForm.password,
          group: 'blogpad'
        });
        this.closeLoginModal();

        if (identity && token) {
          localStorage.setItem('identity-group', identity.group);
          localStorage.setItem('identity-token', token);
        }
        
        this.currentUser = identity;
        this.authError = null;
        this.loadArticles();
      } catch (error) {
        this.authError = error.message;
      }
    },
    
    async handleLogout() {
      try {
        await this.jsonpad.logoutIdentity();
        this.currentUser = null;

        localStorage.removeItem('identity-group');
        localStorage.removeItem('identity-token');
      } catch (error) {
        console.error('Logout error:', error);
      }
    },
    
    async loadArticles() {
      try {
        const response = await this.jsonpad.fetchItems(
          'blogpad-articles',
          {
            page: this.pagination.page,
            limit: this.pagination.limit,
            order: 'createdAt',
            direction: 'desc',
            includeData: true,
          },
          {
            ignore: true,
          }
        );
        this.articles = response.data;
        this.pagination.total = response.total;
      } catch (error) {
        console.error('Error loading articles:', error);
      }
    },
    
    async createArticle() {
      if (!this.newArticle.title || !this.newArticle.content) return;
      
      try {
        await this.jsonpad.createItem('blogpad-articles', {
          data: {
            title: this.newArticle.title,
            content: this.newArticle.content,
            author: this.currentUser.name,
            date: '$jsonpad-var:now',
          }
        });
        
        this.newArticle.title = '';
        this.newArticle.content = '';
        this.closeCreateArticleModal();
        this.loadArticles();
      } catch (error) {
        console.error('Error creating article:', error);
      }
    },

    async editArticle() {
      try {
        await this.jsonpad.updateItemData(
          'blogpad-articles',
          this.editingArticle.id,
          this.editingArticle.data
        );
        this.editingArticle = null;
        this.closeEditArticleModal();
        this.loadArticles();
      } catch (error) {
        console.error('Error updating article:', error);
      }
    },
    
    async deleteArticle(articleId) {
      try {
        await this.jsonpad.deleteItem('blogpad-articles', articleId);
        this.loadArticles();
      } catch (error) {
        console.error('Error deleting article:', error);
      }
    },
    
    showLoginModal() {
      this.isRegistering = false;
      this.authForm = { name: '', password: '' };
      this.authError = null;
      this.$refs.loginDialog.showModal();
    },

    closeLoginModal() {
      this.$refs.loginDialog.close();
    },
    
    showRegisterModal() {
      this.isRegistering = true;
      this.authForm = { name: '', password: '' };
      this.authError = null;
      this.$refs.registerDialog.showModal();
    },

    closeRegisterModal() {
      this.$refs.registerDialog.close();
    },

    startCreateArticle() {
      this.newArticle = { title: '', content: '' };
      this.$refs.createArticleDialog.showModal();
    },

    closeCreateArticleModal() {
      this.newArticle = { title: '', content: '' };
      this.$refs.createArticleDialog.close();
    },

    startEditArticle(article) {
      this.editingArticle = { ...article };
      this.$refs.editArticleDialog.showModal();
    },
    
    closeEditArticleModal() {
      this.editingArticle = null;
      this.$refs.editArticleDialog.close();
    },

    nextPage() {
      if (this.pagination.page * this.pagination.limit < this.pagination.total) {
        this.pagination.page++;
        this.loadArticles();
      }
    },

    previousPage() {
      if (this.pagination.page > 1) {
        this.pagination.page--;
        this.loadArticles();
      }
    },
  }
});

app.mount('#app');

function dashboardApp() {
  return {
    username: '',
    loading: false,
    message: '',
    messageType: 'error',

    async init() {
      await this.checkAuth();
    },

    async checkAuth() {
      try {
        const response = await fetch('/protect/check');
        const data = await response.json();

        if (!data.authenticated) {
          window.location.href = '/protect/index.html';
          return;
        }

        this.username = data.username;
      } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        window.location.href = '/protect/index.html';
      }
    },

    async logout() {
      this.loading = true;
      this.message = '';

      try {
        const response = await fetch('/protect/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (data.success) {
          this.showMessage('Déconnexion réussie ! Redirection...', 'success');
          setTimeout(() => {
            window.location.href = '/protect/index.html';
          }, 1000);
        } else {
          this.showMessage(data.message || 'Erreur lors de la déconnexion', 'error');
        }
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        this.showMessage('Erreur de connexion au serveur', 'error');
      } finally {
        this.loading = false;
      }
    },

    showMessage(msg, type) {
      this.message = msg;
      this.messageType = type;
    }
  };
}
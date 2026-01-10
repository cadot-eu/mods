function loginApp() {
  return {
    username: '',
    password: '',
    loading: false,
    message: '',
    messageType: 'error',

    async login() {
      if (!this.username || !this.password) {
        this.showMessage('Veuillez remplir tous les champs', 'error');
        return;
      }

      this.loading = true;
      this.message = '';

      try {
        const response = await fetch('/protect/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.username,
            password: this.password
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showMessage('Connexion réussie ! Redirection...', 'success');
          setTimeout(() => {
            window.location.href = '/protect/dashboard.html';
          }, 1000);
        } else {
          this.showMessage(data.message || 'Identifiants incorrects', 'error');
          this.password = '';
        }
      } catch (error) {
        console.error('Erreur lors de la connexion:', error);
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
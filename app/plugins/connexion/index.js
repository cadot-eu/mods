// Fonction Alpine.js pour la page de connexion
function loginApp() {
    return {
        username: '',
        password: '',
        message: '',
        messageType: 'error',
        loading: false,
        
        async login() {
            if (!this.username || !this.password) {
                this.showMessage('Veuillez remplir tous les champs', 'error')
                return
            }
            
            this.loading = true
            this.message = ''
            
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: this.username,
                        password: this.password
                    })
                })
                
                const data = await response.json()
                
                if (response.ok) {
                    this.showMessage('Connexion réussie ! Redirection...', 'success')
                    setTimeout(() => {
                        window.location.href = '/connexion'
                    }, 1000)
                } else {
                    this.showMessage(data.error || 'Identifiants incorrects', 'error')
                }
            } catch (error) {
                console.error('Erreur de connexion:', error)
                this.showMessage('Erreur réseau. Veuillez réessayer.', 'error')
            } finally {
                this.loading = false
            }
        },
        
        showMessage(text, type) {
            this.message = text
            this.messageType = type
        }
    }
}

// Fonction Alpine.js pour la page admin
function adminApp() {
    const app = {
        username: '',
        isAdmin: false,
        message: '',
        messageType: 'error',
        loading: false,
        loadingUsers: false,
        users: [],
        newUser: {
            username: '',
            password: '',
            role: 'user'
        },
        editingUser: {
            username: '',
            newPassword: '',
            role: 'user'
        },
        showEditModal: false,
        
        async init() {
            await this.checkAuth()
            if (this.username) {
                await this.loadUsers()
            }
        },
        
        async checkAuth() {
            try {
                const response = await fetch('/auth/check')
                const data = await response.json()
                
                if (data.authenticated && data.isAdmin) {
                    this.username = data.username
                    this.isAdmin = true
                } else {
                    window.location.href = '/connexion'
                }
            } catch (error) {
                console.error('Erreur lors de la vérification:', error)
                window.location.href = '/connexion'
            }
        },
        
        async loadUsers() {
            this.loadingUsers = true
            try {
                const response = await fetch('/auth/users')
                const data = await response.json()
                
                if (response.ok) {
                    this.users = data.users || []
                } else {
                    this.showMessage(data.error || 'Erreur lors du chargement des utilisateurs', 'error')
                }
            } catch (error) {
                console.error('Erreur lors du chargement:', error)
                this.showMessage('Erreur réseau. Veuillez réessayer.', 'error')
            } finally {
                this.loadingUsers = false
            }
        },
        
        async addUser() {
            if (!this.newUser.username || !this.newUser.password) {
                this.showMessage('Veuillez remplir tous les champs', 'error')
                return
            }
            
            this.loading = true
            try {
                const response = await fetch('/auth/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: this.newUser.username,
                        password: this.newUser.password,
                        role: this.newUser.role
                    })
                })
                
                const data = await response.json()
                
                if (response.ok) {
                    this.showMessage('Utilisateur ajouté avec succès !', 'success')
                    this.newUser = { username: '', password: '', role: 'user' }
                    await this.loadUsers()
                } else {
                    this.showMessage(data.error || 'Erreur lors de l\'ajout de l\'utilisateur', 'error')
                }
            } catch (error) {
                console.error('Erreur lors de l\'ajout:', error)
                this.showMessage('Erreur réseau. Veuillez réessayer.', 'error')
            } finally {
                this.loading = false
            }
        },
        
        editUser(user) {
            this.editingUser = {
                username: user.username,
                newPassword: '',
                role: user.role
            }
            this.showEditModal = true
        },
        
        async updateUser() {
            if (!this.editingUser.username) return
            
            this.loading = true
            try {
                const updateData = {
                    role: this.editingUser.role
                }
                
                // Ajouter le mot de passe seulement s'il est fourni
                if (this.editingUser.newPassword) {
                    updateData.password = this.editingUser.newPassword
                }
                
                const response = await fetch(`/auth/users/${this.editingUser.username}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData)
                })
                
                const data = await response.json()
                
                if (response.ok) {
                    this.showMessage('Utilisateur mis à jour avec succès !', 'success')
                    this.showEditModal = false
                    await this.loadUsers()
                } else {
                    this.showMessage(data.error || 'Erreur lors de la mise à jour', 'error')
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour:', error)
                this.showMessage('Erreur réseau. Veuillez réessayer.', 'error')
            } finally {
                this.loading = false
            }
        },
        
        async deleteUser(username) {
            if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${username} ?`)) {
                return
            }
            
            try {
                const response = await fetch(`/auth/users/${username}`, {
                    method: 'DELETE'
                })
                
                const data = await response.json()
                
                if (response.ok) {
                    this.showMessage('Utilisateur supprimé avec succès !', 'success')
                    await this.loadUsers()
                } else {
                    this.showMessage(data.error || 'Erreur lors de la suppression', 'error')
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error)
                this.showMessage('Erreur réseau. Veuillez réessayer.', 'error')
            }
        },
        
        showMessage(text, type) {
            this.message = text
            this.messageType = type
            // Effacer le message après 5 secondes
            setTimeout(() => {
                this.message = ''
            }, 5000)
        }
    }
    
    // Appeler init() automatiquement après la création de l'application
    app.init().catch(error => {
        console.error('Erreur lors de l\'initialisation:', error)
    })
    
    return app
}

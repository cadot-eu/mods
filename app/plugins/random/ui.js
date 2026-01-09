// plugins/random/ui.js
function randomUI() {
  return {
    number: null,
    async generate() {
      try {
        const res = await fetch('/random')
        const data = await res.json()
        this.number = data.number
      } catch (err) {
        console.error('Erreur lors de la génération du nombre :', err)
        this.number = 'Erreur'
      }
    }
  }
}

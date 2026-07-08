import "./App.css";

function App() {
  return (
    <main className="app">
      <section className="card">
        <p className="eyebrow">Atlas Portfolio</p>

        <h1>Patrimoine</h1>

        <p className="subtitle">
          Vue d'ensemble de votre situation patrimoniale et de vos objectifs.
        </p>

        <div className="total-card">
          <p className="label">Patrimoine total</p>
          <p className="amount">47 382,56 €</p>
          <p className="performance">+7 842,31 € (+19,81 %) depuis le début</p>
        </div>

        <p className="note">Vue Clarté — prototype initial</p>
      </section>
    </main>
  );
}

export default App;

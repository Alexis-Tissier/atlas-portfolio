# Checklist de release Atlas Portfolio

## Avant le build

- [ ] `git status --short` ne montre aucun fichier privé.
- [ ] Aucun fichier `.local`, SQLite ou CSV personnel n’est suivi par Git.
- [ ] `npm run check` réussit.
- [ ] `npm run build` réussit.
- [ ] `cargo check` réussit.
- [ ] L’application démarre avec `npm run tauri dev`.
- [ ] Le tableau de bord, les positions et les transactions s’ouvrent sans erreur.
- [ ] L’actualisation des cours fonctionne ou affiche une erreur compréhensible.
- [ ] Le mode sombre et le masquage des montants fonctionnent.
- [ ] L’import d’un petit CSV fictif fonctionne.
- [ ] Les données de démonstration sont clairement fictives.

## Build Linux

```bash
cd apps/desktop
npm run release:linux
```

Vérifier les paquets dans :

```text
apps/desktop/src-tauri/target/release/bundle/
```

## Contrôle de l’application construite

- [ ] Le titre de la fenêtre est « Atlas Portfolio ».
- [ ] La fenêtre s’ouvre avec une taille adaptée.
- [ ] La base locale n’est pas intégrée au paquet.
- [ ] Aucune clé API personnelle n’est intégrée au paquet.
- [ ] Le paquet peut être lancé sur la machine de test.

## GitHub

- [ ] Le README correspond aux fonctions réellement disponibles.
- [ ] La version de `package.json`, `Cargo.toml` et `tauri.conf.json` est identique.
- [ ] Le commit de release est poussé.
- [ ] Un tag `v0.1.0-alpha` est créé uniquement après validation du paquet.
- [ ] Les fichiers de release ne contiennent aucune donnée personnelle.

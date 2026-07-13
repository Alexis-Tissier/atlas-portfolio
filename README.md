# Atlas Portfolio

## Télécharger

[![Télécharger Atlas Portfolio](https://img.shields.io/badge/Télécharger-la_dernière_version-1f2937?style=for-the-badge&logo=github)](https://github.com/Alexis-Tissier/atlas-portfolio/releases/latest)

Choisissez le fichier correspondant à votre système :

| Système | Fichier |
|---|---|
| Fedora / RHEL | `.rpm` |
| Ubuntu / Debian | `.deb` |
| Windows 10/11 | installateur `.exe` |
| Mac Apple Silicon (M1, M2, M3, M4…) | DMG `aarch64` |
| Mac Intel | DMG `x86_64` |

> La version alpha n’est pas encore signée officiellement. Windows et macOS
> peuvent donc afficher un avertissement lors du premier lancement.


Atlas Portfolio est une application desktop locale de suivi patrimonial, développée avec Tauri, React, TypeScript et SQLite.

L’objectif est de remplacer progressivement Portfolio Performance par une application plus claire, plus moderne et plus adaptée à un usage personnel quotidien.

> **Statut : version 0.1.0 alpha.** Le projet évolue encore rapidement. Utilisez uniquement des copies de vos données et vérifiez les résultats avant toute décision financière.

## Fonctionnalités actuelles

- tableau de bord patrimonial connecté à SQLite ;
- comptes : PEA, PEA-PME, CTO, PEE, PER, assurance-vie, livrets, crypto et autres ;
- ajout, modification et suppression de transactions ;
- dépôts, retraits, transferts, achats, ventes, dividendes et frais ;
- positions avec quantité, PRU, cours actuel, valeur et performance ;
- récupération des cours via Yahoo Finance avec Alpha Vantage en secours ;
- import et export CSV ;
- correspondance flexible des colonnes CSV ;
- détection des doublons et import groupé atomique ;
- répartition par classe d’actifs et par compte ;
- page Performance : apports, gain total, latent, réalisé, dividendes, frais, XIRR et TWR estimé ;
- recommandations de prochain apport et alertes de concentration ;
- prévisionnel patrimonial ;
- mode sombre et masquage des montants.

## Principes du projet

- **Local-first** : les données restent sur l’ordinateur.
- **Aucune connexion bancaire** : Atlas ne demande aucun identifiant bancaire.
- **Données privées exclues de Git** : bases SQLite, CSV personnels, fichiers `.local` et clés API ne doivent jamais être commités.
- **Calculs explicables** : les recommandations et performances doivent pouvoir être comprises et vérifiées.

## Structure

```text
atlas-portfolio/
├── apps/desktop/          # Application Tauri + React
├── packages/db/           # Schéma et migrations SQLite
├── docs/                  # Documentation du projet
├── samples/               # Données fictives uniquement
└── README.md
```

## Prérequis de développement

- Node.js et npm ;
- Rust et Cargo ;
- les dépendances système requises par Tauri 2 pour votre distribution Linux.

## Lancer l’application en développement

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## Vérifier le projet

```bash
cd apps/desktop
npm run check
npm run build

cd src-tauri
cargo check
```

## Construire la version Linux

```bash
cd apps/desktop
npm run release:linux
```

Les paquets générés sont placés dans :

```text
apps/desktop/src-tauri/target/release/bundle/
```

## Données locales

Les données de développement sont stockées localement et ne doivent pas être publiées. Le dépôt ignore notamment :

- `.local/`
- `*.sqlite`, `*.sqlite3`, `*.db`
- les CSV, XLSX et XML personnels
- les fichiers `.env`
- les clés et configurations locales

## Emplacement des données

Atlas ne dépend pas du dossier du projet après installation.

Sous Linux, la base SQLite est enregistrée dans :

```text
~/.local/share/atlas-portfolio/atlas.sqlite
```

Si `XDG_DATA_HOME` est défini, Atlas utilise plutôt :

```text
$XDG_DATA_HOME/atlas-portfolio/atlas.sqlite
```

Au premier lancement après cette mise à jour, l’ancienne base de développement
`.local/atlas-dev.sqlite` est copiée automatiquement. L’ancienne base reste
inchangée et sert de sécurité.

La configuration locale facultative est stockée dans le même dossier sous le
nom `atlas-config.json`.

## Limites de la version alpha

- les performances dépendent de la qualité de l’historique saisi ;
- certains fonds ou actifs non cotés nécessitent un cours manuel ;
- les recommandations ne constituent pas un conseil financier ;
- la compatibilité avec tous les exports de courtiers n’est pas garantie.

## Sécurité

Ne publiez jamais :

- une base SQLite réelle ;
- un export bancaire ou de courtier ;
- une clé API ;
- un fichier de configuration locale ;
- des captures contenant des informations financières personnelles.

## Licence

Copyright © 2026 Alexis Tissier. Tous droits réservés.

Le code source et l’application ne peuvent pas être copiés, modifiés,
redistribués ou commercialisés sans autorisation écrite préalable.

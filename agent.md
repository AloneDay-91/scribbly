# Projet : wiki Markdown local (Tauri)

## Stack
- Tauri 2 (backend Rust, webview du système)
- React + TypeScript (interface)
- shadcn/ui (composants copiés dans le projet)
- Fichiers Markdown sur disque comme stockage (pas de base de données)
- 100 % local, aucun serveur

## Architecture
- Un dossier racine par wiki, un sous-dossier par chapitre ou section
- Chaque note est un fichier .md dont la ligne 1 est un titre H1
- Liens entre notes : chemins relatifs Markdown standards
- index.md à la racine, régénéré en scannant le disque au lancement
- Index intelligent : cache JSON des chemins et dates de modification, ne rescanner que ce qui a changé
- Images et fichiers (zip, etc.) dans un dossier assets/ à côté des notes, référencés par chemin relatif
- Les URL sont de simples liens Markdown
- La génération d'un site statique public (Astro ou Eleventy) est une étape future séparée, hors de cette phase
- Pas de Nginx ni de serveur pour l'instant : uniquement local

## Phase 1 (à faire maintenant)
- Mettre en place la fenêtre Tauri
- Scanner le dossier et afficher les notes
- Naviguer entre les pages
- Rendu Markdown de base

## Phase 2 (plus tard)
- Index intelligent avec cache JSON
- Gestion des fichiers joints (images, zip)
- Recherche
- Édition

## Contraintes
- Pas de base de données
- Pas de serveur distant
- Windows, macOS et Linux (WebView2 sous Windows)
- Rust minimal : déclarations de permissions fichiers et câblage des commandes Tauri seulement
- L'interface est la surface principale de développement

## Style
- Instructions concises, à l'impératif
- Une section par sujet
- Pas de remplissage

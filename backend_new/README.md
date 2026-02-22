# Survey Bot Backend

Ce répertoire contient une implémentation complète du backend pour la plateforme d’enquêtes conversationnelles **Survey Bot**. L’architecture utilise Flask, SQLAlchemy, JWT et fournit tous les endpoints nécessaires pour gérer des campagnes d’enquête, des questions, des sessions et des exports, ainsi qu’un bot conversationnel accessible via un lien ou un QR Code.

## Fonctionnalités principales

- **Gestion des utilisateurs** : inscription, connexion, rôles (admin, campaign_manager, viewer).
- **Gestion des campagnes** : création, listing, mise à jour et suppression.
- **Questions & options** : ajout, modification et suppression de questions et de leurs options pour chaque campagne.
- **Sessions d’enquête** : génération de jetons uniques et de QR Codes pour inviter les participants. Possibilité d’en créer plusieurs en une seule requête.
- **Bot conversationnel** : endpoints publics pour récupérer les questions une à une et enregistrer les réponses, sans authentification.
- **Statistiques** : total de réponses, nombre de participants, votes par option, etc.
- **Exportation** : export des réponses en CSV, Excel (XLSX) ou PDF, retourné en base64 prêt à télécharger.
- **Historique** : journalisation des actions importantes via un modèle `AuditLog`.
- **Docker ready** : un `Dockerfile` et un `docker-compose.yml` pour lancer la base MySQL et le backend en un seul `docker compose up`.

## Installation

### Exécution locale sans Docker

1. **Cloner le dépôt** et installer les dépendances :

```bash
pip install -r requirements.txt
```

2. **Configurer l’environnement** : créez un fichier `.env` (ou définissez des variables d’environnement) avec au minimum :

```env
DATABASE_URI=sqlite:///survey_bot.db
SECRET_KEY=change-me
JWT_SECRET_KEY=change-me-too
```

3. **Initialiser la base** :

```bash
flask --app run db upgrade
```

4. **Démarrer l’application** :

```bash
python run.py
```

L’API sera disponible sur `http://localhost:5000/`.

### Exécution avec Docker

1. Copier les fichiers `Dockerfile` et `docker-compose.yml` à la racine du backend (ils sont déjà fournis).
2. Dans un terminal, lancez :

```bash
docker compose up --build
```

3. La base MySQL sera disponible sur le port 3306, et l’API sur le port 5000.

> **QR Codes & accès depuis un téléphone (important)**
>
> Si tes QR codes contiennent `http://localhost:5173/...`, ils ne fonctionneront **que sur ton PC**.
> Pour qu’un téléphone puisse ouvrir le lien, définis une URL accessible sur le réseau :
>
> - Sur le même Wi‑Fi (dev) : `PUBLIC_FRONTEND_URL=http://<IP_DE_TON_PC>:5173`
> - En prod : `PUBLIC_FRONTEND_URL=https://ton-domaine.com`
>
> Astuce : ce backend essaie aussi d'utiliser le header **Origin** (si `PUBLIC_FRONTEND_URL` est vide)
> pour générer des liens cohérents avec l’adresse où tu as ouvert l’interface admin.

Assurez‑vous de définir des variables d’environnement dans un fichier `.env` pour remplacer les mots de passe par défaut !

## Utilisation des endpoints

La racine de l’API est `/api`. Voici quelques exemples :

- **Authentification** :
  - `POST /api/auth/register` – créer un utilisateur.
  - `POST /api/auth/login` – obtenir des `access_token` et `refresh_token`.
  - `GET /api/auth/me` – récupérer les informations du user connecté.
- **Campagnes** :
  - `GET /api/campaigns/` – lister les campagnes.
  - `POST /api/campaigns/` – créer une campagne (admin/campaign_manager).
  - `GET /api/campaigns/<id>` – voir une campagne avec ses questions et options.
  - `PUT /api/campaigns/<id>` – mettre à jour une campagne.
  - `DELETE /api/campaigns/<id>` – supprimer une campagne (admin).
- **Questions & options** :
  - `GET /api/campaigns/<campaign_id>/questions` – lister les questions.
  - `POST /api/campaigns/<campaign_id>/questions` – ajouter une question.
  - `PUT /api/campaigns/<campaign_id>/questions/<question_id>` – modifier une question.
  - `DELETE /api/campaigns/<campaign_id>/questions/<question_id>` – supprimer une question.
  - `GET /api/campaigns/<campaign_id>/questions/<question_id>/options` – lister les options.
  - `POST /api/campaigns/<campaign_id>/questions/<question_id>/options` – ajouter une option.
  - `PUT /api/campaigns/options/<option_id>` – modifier une option.
  - `DELETE /api/campaigns/options/<option_id>` – supprimer une option.
- **Sessions (liens d’enquête)** :
  - `POST /api/campaigns/<campaign_id>/sessions` – créer une ou plusieurs sessions et récupérer les QR Codes.
  - `GET /api/campaigns/<campaign_id>/sessions` – lister les sessions.
- **Bot** :
  - `GET /api/bot/<token>` – récupérer la prochaine question pour un token.
  - `POST /api/bot/<token>/answer` – soumettre une réponse.
- **Statistiques** :
  - `GET /api/campaigns/<campaign_id>/stats` – obtenir des stats globales.
- **Export** :
  - `GET /api/export/<campaign_id>?format=csv|xlsx|pdf` – récupérer les réponses exportées.

Toutes les routes (sauf `/api/bot/*`) nécessitent un `Authorization: Bearer <access_token>` avec le rôle adéquat.

## Contributions et extensions

Ce backend est extensible. On peut ajouter :

- Un système d’e‑mail/SMS pour envoyer directement le lien ou le QR Code aux participants (intégration Twilio/SendGrid).
- Des webhooks pour intégrer WhatsApp Business ou Messenger quand l’API sera prête.
- Des règles de validation avancées (pydantic ou Marshmallow).
- Une interface d’admin pour visualiser les logs (`AuditLog`).

N’hésitez pas à adapter le code et à proposer des améliorations !
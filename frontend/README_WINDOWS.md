# Frontend (Windows) — Survey Bot / Campaign Manager

## 1) Prérequis

- **Node.js 18+** (recommandé) et npm.
- Backend Flask lancé (Docker OK).

## 2) Variables d’environnement

Crée/édite `frontend/.env` :

```env
VITE_API_BASE_URL=http://localhost:5001/api
```

> ⚠️ Le port **3310** est celui de **MySQL**. Le backend Flask n’est pas sur 3310.

## 3) Installation propre (corrige 99% des erreurs npm)

Dans `C:\PROJET1\frontend` :

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install

# Si npm affiche encore des conflits de peer-deps :
# npm install --legacy-peer-deps
```

## 4) Lancer

```powershell
npm run dev
```

Puis ouvre :

- Frontend : `http://localhost:5173`
- Backend (API) : `http://localhost:5001/api`

## Notes

- `qrcode.react` a été retiré car incompatible avec React 18 (source de ERESOLVE).
- `@types/jwt-decode` n’est pas nécessaire (les types sont inclus dans `jwt-decode`).

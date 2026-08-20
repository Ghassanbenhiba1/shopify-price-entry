# Saisie des prix Shopify

Application web (React + Vite) pour saisir rapidement les prix de vos produits
Shopify à partir d'un export CSV, puis exporter un CSV prêt à réimporter dans
Shopify (**Produits > Importer**).

Le fichier `public/products_export.csv` est **intégré à l'application** : il
est chargé automatiquement au démarrage et toujours relu à jour (aucune étape
d'import manuel n'est nécessaire, et remplacer ce fichier + redéployer suffit
à mettre à jour le catalogue chez tous les visiteurs).

Les prix saisis sont **synchronisés en temps réel entre tous les visiteurs**
du site (vous et votre client voyez les mêmes prix) grâce à Firebase
Firestore — voir [Configuration Firebase](#configuration-firebase-synchronisation-des-prix)
ci-dessous. Sans cette configuration, l'app reste utilisable mais chaque
navigateur garde ses prix en local uniquement (pas de partage).

## Fonctionnement

1. Au chargement de la page, le CSV intégré est lu et regroupé par `Handle` :
   un produit = une carte, avec son image, son titre, et un champ de prix (ou
   un champ par variante si le produit en a plusieurs). Les prix déjà présents
   dans le CSV sont pré-remplis automatiquement.
2. Saisissez ou corrigez les prix — chaque saisie est sauvegardée localement
   (IndexedDB) et envoyée à Firestore si la synchronisation est configurée,
   pour que le propriétaire et le client voient toujours les mêmes valeurs.
   Un badge dans la barre du haut indique si la synchronisation est active
   (🔄 Synchronisé) ou non (⚠️ Local uniquement).
3. Utilisez la recherche pour filtrer par nom de produit.
4. Cliquez sur **Exporter le CSV mis à jour** : un fichier CSV est généré,
   identique à l'original (mêmes colonnes, mêmes lignes, même ordre), avec la
   colonne `Variant Price` complétée selon les prix actuels. Ce fichier est
   directement réimportable dans Shopify.
5. **Changer de fichier** permet d'importer ponctuellement un autre CSV
   (reste local à cet appareil, non synchronisé). **Effacer les données**
   réinitialise la progression et recharge le catalogue partagé.

## Développement local

Prérequis : [Node.js](https://nodejs.org/) 18+ (idéalement 20+).

```bash
npm install
npm run dev
```

L'application est alors disponible sur `http://localhost:5173`.

## Configuration Firebase (synchronisation des prix)

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com/)
   et créez un projet (gratuit, plan Spark).
2. Dans le menu **Compilation > Firestore Database**, cliquez sur **Créer une
   base de données** (mode production, région de votre choix).
3. Une fois la base créée, ouvrez l'onglet **Règles** et remplacez le contenu
   par :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sessions/shared {
         allow read, write: if true;
       }
     }
   }
   ```
   ⚠️ Ces règles ouvrent en lecture/écriture uniquement le document partagé
   des prix (pas le reste de votre projet Firebase), sans authentification —
   adapté à un usage interne avec un lien non public. N'importez pas d'autres
   données sensibles dans ce même projet Firebase.
4. Retournez dans **Paramètres du projet** (icône ⚙️) **> Vos applications**,
   cliquez sur **Ajouter une application > Web** (icône `</>`), donnez-lui un
   nom, puis copiez les valeurs affichées dans `firebaseConfig`.
5. À la racine du projet, copiez `.env.example` en `.env` et collez-y ces
   valeurs :
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
6. Relancez `npm run dev` (ou refaites `npm run build` pour la prod) : ces
   valeurs sont injectées dans le code **au moment du build**, donc `.env`
   doit être présent *avant* de builder.

## Build de production

```bash
npm run build
```

Le résultat est généré dans le dossier `dist/`. Vous pouvez le prévisualiser
localement avec :

```bash
npm run preview
```

## Déploiement sur cPanel / o2switch

L'application est 100 % statique après build (HTML/CSS/JS) : elle se dépose
comme un site classique, sans Node.js ni base de données côté serveur.

1. Assurez-vous que `.env` contient vos clés Firebase (étape précédente), puis
   lancez `npm run build` **sur votre machine**. cPanel ne construit pas le
   projet à votre place : c'est le contenu du dossier `dist/` qu'il faut
   envoyer, déjà compilé avec vos clés intégrées.
   - Si l'app est déployée **à la racine du domaine** (`https://votredomaine.fr/`),
     rien à changer.
   - Si elle est déployée **dans un sous-dossier** (ex.
     `https://votredomaine.fr/prix/`), ajoutez `base: '/prix/'` dans
     `vite.config.js` avant de builder, sinon les fichiers CSS/JS/CSV ne se
     chargeront pas correctement.
2. Connectez-vous à cPanel, ouvrez le **Gestionnaire de fichiers** (ou un
   client FTP comme FileZilla avec les identifiants FTP d'o2switch).
3. Placez-vous dans `public_html` (ou dans un sous-dossier / sous-domaine si
   l'app ne doit pas être à la racine du domaine).
4. Videz ce dossier de tout contenu par défaut (`index.html` de bienvenue,
   etc.), puis uploadez **le contenu** du dossier `dist/` (pas le dossier
   `dist` lui-même) : `index.html`, `favicon.svg`, `products_export.csv` et le
   dossier `assets/`.
5. Vérifiez que le certificat SSL gratuit (Let's Encrypt, fourni par o2switch
   via **Sécurité > SSL/TLS Status**) est actif sur le domaine — Firestore
   exige une connexion HTTPS.
6. Ouvrez votre domaine dans un navigateur : l'app doit se charger et afficher
   le badge **🔄 Synchronisé** si Firebase est bien configuré.

**Mettre à jour le catalogue de produits** sans tout redéployer : remplacez
juste `products_export.csv` à la racine du site (Gestionnaire de fichiers ou
FTP) — l'app le relit à chaque chargement de page, aucun rebuild nécessaire.

**Mettre à jour le code de l'app** (nouvelle fonctionnalité, correctif) :
relancez `npm run build` en local et réuploadez le contenu de `dist/` en
écrasant l'ancien.

## Déploiement alternatif (Vercel / Netlify)

Si vous préférez un hébergement avec build automatique à chaque push Git :

- **Vercel** : importez le dépôt sur [vercel.com](https://vercel.com) (Build
  Command `npm run build`, Output Directory `dist`), et renseignez les
  variables `VITE_FIREBASE_*` dans **Project Settings > Environment
  Variables**.
- **Netlify** : importez le dépôt sur [netlify.com](https://netlify.com)
  (Build command `npm run build`, Publish directory `dist`), variables dans
  **Site settings > Environment variables**.

Dans ces deux cas, la plateforme gère le build (donc les variables
d'environnement se configurent dans son interface, pas dans un fichier
`.env` local) et le catalogue se met à jour via un `git push`.

## Notes

- Le parsing CSV, le regroupement par produit et l'export se font entièrement
  dans le navigateur ; seuls les prix saisis transitent par Firestore (si
  configuré) pour être partagés entre appareils.
- La progression est aussi mise en cache localement (IndexedDB) comme filet
  de sécurité en cas de coupure réseau.
- Le bouton **Effacer les données** supprime la progression locale et
  recharge les prix d'origine du CSV (n'efface pas les données côté
  Firestore : utilisez la console Firebase pour ça si besoin).

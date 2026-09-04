# XR-001 — Visualiseur 3D · micro-drone repliable de calibre 40 mm

Visualiseur temps réel, dans le navigateur, d'un micro-drone quadrirotor à bras
repliables conditionné dans une enveloppe de calibre 40 mm. Le modèle est
**entièrement procédural** : aucune ressource externe (pas de `.glb`, pas de
texture, pas de police distante) — tout est généré au chargement à partir d'un
fichier de cotes unique.

> **Périmètre.** Il s'agit d'un outil d'étude **mécanique et cinématique** :
> architecture, encombrement, séquence de dépliage, implantation des sous-ensembles.
> Le module avant est modélisé comme une **enveloppe de charge utile générique
> et inerte** (forme ogivale au calibre) ; aucun contenu énergétique ni chaîne
> pyrotechnique n'est représenté.

---

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bundle statique dans dist/
npm run preview    # sert dist/ sur le port 4173
```

Le résultat est un site statique : `dist/` se déploie tel quel sur n'importe
quel hébergeur (GitHub Pages, S3, Netlify…). `base: './'` est déjà configuré
pour un déploiement en sous-répertoire.

---

## Ce que fait l'application

| Fonction | Détail |
|---|---|
| Séquence de déploiement | Curseur de phase 0→100 %, lecture animée, boucle, 4 préréglages (Tube / Éjection / Bras / Vol) |
| Vue éclatée | Séparation continue des sous-ensembles (tête, soute, énergie, avionique, ogive, bras, tube) |
| Coupe longitudinale | Plan de coupe temps réel (`localClippingEnabled`), balayage de −55 à +55 mm |
| Repères cotés | 6 étiquettes 2D ancrées aux pièces, elles suivent l'éclatement et l'animation |
| Options | Internes, tube lanceur, filaire, rotation des rotors, rotation automatique |
| Export | Capture PNG à la résolution de l'écran |
| Raccourcis | `Espace` lecture/pause · `E` vue éclatée · `R` recadrage caméra |

---

## Architecture mécanique retenue

La contrainte dimensionnante est simple : **tout doit tenir dans un rayon
intérieur de 17,8 mm** (tube Ø 40 mm, paroi 2,2 mm). Elle impose la disposition
suivante, exprimée dans le repère du drone (origine au centre de l'épine) :

```
 y = +72 mm  ┌────────────┐  tête optronique Ø 36 (optique + antenne)
 y = +48 mm  ├────────────┤  cloison haute — axes d'articulation à y = +44
             │            │
             │  épine +   │  ZONE DE REPLIAGE
             │  carénage  │  · âme centrale Ø 10 seulement
             │            │  · anneau r = 5,5 → 15,5 mm réservé aux 4 bras
 y = −48 mm  ├────────────┤    repliés et à leurs moteurs
             │   soute    │  2 éléments Li-ion + carte avionique / ESC
 y = −96 mm  ├────────────┤
             │   ogive    │  module de charge utile générique (inerte)
 y = −133 mm └────────────┘
```

Longueur stockée **205 mm** = longueur du tube. Envergure déployée **262 mm**,
rotors **Ø 89 mm**.

Trois choix conditionnent la faisabilité du repliage — ils sont vérifiables
directement sur le modèle :

1. **Le moteur est aligné sur l'axe du bras** (décalage de 0,5 mm seulement).
   Une fois le bras replié, l'axe moteur devient radial ; tout décalage
   vertical se transforme en encombrement radial. Bilan : rayon 9 + 5,5 =
   **14,5 mm** < 17,8 mm.
2. **Les pales se replient *vers* l'axe d'articulation**, le long du bras, et
   non vers l'extérieur. La longueur repliée du sous-ensemble vaut donc la
   longueur du bras (78 mm) et non bras + pale (119 mm) : le train replié
   s'arrête à y = −34 mm, au-dessus de la soute.
3. **Le carénage est fendu** : 4 panneaux de 50° séparés par 4 fentes de 40°,
   rayons 16 → 17,4 mm. Il redonne au fuselage son diamètre plein tout en
   laissant sortir les bras *et* les moteurs (demi-angle 20,1° au rayon 16 mm).

Ces valeurs vivent toutes dans [`src/config.js`](src/config.js) : modifier une
cote régénère la géométrie complète et met à jour la fiche technique du panneau.

---

## Cinématique

Un unique paramètre `t ∈ [0,1]` décrit l'état complet du système ; il est
**déterministe** (aucune intégration, sauf la rotation des rotors). On peut
donc scruter la séquence dans les deux sens sans dérive.

| Phase | Intervalle | Effet |
|---|---|---|
| Éjection | 0,00 → 0,26 | Sortie de tube, le tube décroche et bascule |
| Bras | 0,24 → 0,58 | 4 × 90° avec léger dépassement (ressort de verrouillage), paires opposées décalées de 3,5 % |
| Pales | 0,46 → 0,76 | 8 pales, 90° chacune, superposées une fois repliées |
| Régime | 0,62 → 1,00 | Montée en régime + flottement de tenue de vol |

La rotation des rotors est affichée à 1,2 % du régime réel : à 24 000 tr/min et
60 Hz, une pale ferait 6,7 tours par image et deviendrait illisible (aliasing
temporel).

---

## Optimisations

* **Rendu à la demande** — la boucle ne dessine que si la scène est marquée
  « sale », si une animation tourne ou si la caméra bouge. Au repos, le GPU est
  à 0 %.
* **Fusion de géométrie** — chaque sous-ensemble statique (épine, carénage,
  chapes, soute, tête, tube, cartes) est fusionné en une seule `BufferGeometry`
  via `mergeGeometries`. ~78 draw calls et 18,6 k triangles pour l'ensemble.
* **Partage** — une seule géométrie de bras pour 4 instances, une seule de pale
  pour 8 ; les matériaux sont partagés dans un registre unique.
* **Zéro téléchargement** — textures (tissage carbone, grain métal) générées sur
  `canvas` 128 px au démarrage ; environnement PBR pré-calculé une fois (PMREM).
* **Bundle** — `three` isolé dans son propre chunk (≈ 120 ko gzip) pour un cache
  long terme ; le code applicatif pèse ≈ 14 ko gzip.
* `devicePixelRatio` plafonné à 2, une seule lumière projetant des ombres,
  shadow map 1024 serrée sur le sujet.

---

## Organisation du code

```
src/
├── config.js              cotes, ancrages axiaux, séquence, fiche technique
├── core/
│   ├── viewer.js          renderer, caméra, éclairage, IBL, boucle à la demande
│   └── materials.js       registre de matériaux PBR + textures procédurales
├── model/
│   ├── parts.js           générateurs de géométrie (une fonction par pièce)
│   └── drone.js           assemblage, rig cinématique, vue éclatée
├── anim/
│   └── deployment.js      séquenceur déterministe t ∈ [0,1]
├── ui/
│   ├── panel.js           câblage du panneau HTML
│   └── labels.js          repères 2D projetés à la main
└── main.js                composition
```

## Pistes d'extension

* Remplacer une pièce procédurale par un `.glb` : charger avec `GLTFLoader` et
  substituer le mesh dans `Drone._buildBody()` — le rig et l'éclaté sont
  indépendants de la provenance de la géométrie.
* Mesures interactives : ajouter un `Raycaster` sur `drone.root` et coter entre
  deux points cliqués.
* Étude d'encombrement : animer `D.armLen` / `D.bladeLen` et vérifier en direct
  la contrainte de rayon 17,8 mm.

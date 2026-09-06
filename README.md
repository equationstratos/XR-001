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
npm run dev          # http://localhost:5173  (entrée : src/index.html)
npm run build        # bundle classique dans dist/
npm run build:single # page autonome -> index.html + docs/index.html
npm run build:all    # les deux
npm run preview      # sert dist/ sur le port 4173
```

## Mise en ligne

**`index.html`, à la racine, est une page autonome générée** : un fichier
unique de 544 ko contenant le HTML, le CSS et tout le JavaScript en ligne,
three.js compris. Aucune dépendance, aucun serveur, aucun build côté
hébergeur. Quelle que soit la façon dont vous publiez, ça fonctionne :

| Publication | Ce qu'il faut faire |
|---|---|
| GitHub Pages, `branch` / **root** | Rien. C'est le cas par défaut, la racine sert la page autonome. |
| GitHub Pages, `branch` / **`/docs`** | Rien. `docs/index.html` est le même fichier. |
| GitHub Pages via **Actions** | Settings → Pages → Source : *GitHub Actions*. Le workflow `.github/workflows/pages.yml` construit et publie `dist/`. |
| Autre hébergeur, ou hors ligne | Copiez `index.html` où vous voulez, ou ouvrez-le en double-clic (`file://`). |

Le point d'entrée de **développement** est `src/index.html` : lui charge
`./main.js`, qui importe `three` par son nom de paquet. Un navigateur ne sait
pas résoudre un spécificateur nu — cette page-là ne peut donc pas être publiée
telle quelle, elle doit passer par Vite. C'est la seule page du dépôt dans ce
cas.

> **Après toute modification du code**, lancez `npm run build:single` : sans
> quoi la page publiée reste sur la version précédente. Les fichiers générés
> portent un en-tête `PAGE GENEREE — ne pas editer a la main`.

Si malgré tout une page ne démarre pas, elle ne reste plus bloquée sur le rond
de chargement : un garde-fou — script classique, donc exécuté même quand le
module échoue — affiche l'erreur, sa cause probable et la marche à suivre. Il
reconnaît l'import non résolu sans dépendre du libellé traduit par le
navigateur (il regarde quel script la page charge), distingue un script
manquant d'une ressource secondaire absente, laisse un diagnostic précis
remplacer un diagnostic générique, et se déclenche au bout de 9 s si rien
n'est remonté.

---|---|
| **Page autonome** (la plus simple) | `docs/index.html` est un fichier unique de 542 ko contenant tout, three.js compris. Ouvrez-le en double-clic, déposez-le sur n'importe quel hébergeur, envoyez-le par mail. Aucune dépendance, aucun serveur. |
| **GitHub Pages depuis `/docs`** | Settings → Pages → Source : *Deploy from a branch*, dossier `/docs`. Rien d'autre à faire, `docs/` est versionné. |
| **GitHub Pages via Actions** | Settings → Pages → Source : *GitHub Actions*. Le workflow `.github/workflows/pages.yml` construit et publie `dist/` à chaque push. |

Après toute modification du code, régénérez la page autonome avec
`npm run build:single` (ou `npm run build:all` pour les deux sorties).

Si quelque chose échoue malgré tout, la page ne reste plus bloquée sur le rond
de chargement : un garde-fou (script classique, indépendant du module) affiche
l'erreur, sa cause probable et la marche à suivre — import non résolu, fichier
404, WebGL indisponible, ou absence de démarrage au bout de 9 s.

---

## Ce que fait l'application

| Fonction | Détail |
|---|---|
| Séquence de tir | Curseur de phase 0→100 %, lecture animée, boucle, 4 préréglages (Tube / Tir / Sortie / Vol), indicateur de dégagement de bouche |
| Vue éclatée | Séparation continue des sous-ensembles (tête, soute, énergie, avionique, ogive, bras, tube) |
| Coupe longitudinale | Plan de coupe temps réel (`localClippingEnabled`), balayage de −55 à +55 mm |
| Repères cotés | 6 étiquettes 2D ancrées aux pièces, elles suivent l'éclatement et l'animation |
| Options | Internes, tube lanceur, filaire, rotation des rotors, rotation automatique |
| Export | Capture PNG à la résolution de l'écran |
| Vue mécanisme | Isole une articulation, suit la pièce pendant le tir, repères dédiés, état du verrou en direct |
| Raccourcis | `Espace` lecture/pause · `E` vue éclatée · `M` vue mécanisme · `R` recadrage caméra |

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

## Cinématique — le dépliage est piloté par la sortie de tube

Un unique paramètre `t ∈ [0,1]` décrit l'état complet du système, de façon
**déterministe** : on peut scruter la séquence dans les deux sens sans dérive.

Mais les bras ne suivent **pas** une simple fenêtre temporelle : ils sont
asservis au **dégagement de bouche**, noté `clear` et exprimé en longueurs de
bras, recalculé à chaque image à partir des positions animées du projectile et
du lanceur :

```
clear = ( y_axe_articulation − y_bouche ) / longueur_de_bras
```

La géométrie impose une ouverture **claquante**, pas progressive :

* Un point du bras situé à la distance `s` de l'axe passe au rayon
  `r = r_axe + s·sin θ`. Tant qu'il est dans le tube, il faut `r ≤ 16 mm`,
  d'où `θ ≤ asin((16 − 8,5) / 78) ≈ **5,5°**`. Un bras encore engagé est donc
  mécaniquement bloqué contre le fût.
* Le bras ne peut atteindre un angle utile qu'une fois **intégralement sorti**,
  c'est-à-dire `clear ≥ 1`. Le ressort le déploie alors d'un coup, avec un
  léger dépassement avant verrouillage en butée.

L'indicateur « Dégagement de bouche » du panneau affiche cette valeur en temps
réel : elle passe au vert à `1,00 L`, exactement à l'instant où les bras se
libèrent. Déplacer le curseur de phase, changer la vitesse ou masquer le tube
ne change rien à ce couplage.

| Phase | Déclencheur | Effet |
|---|---|---|
| Tir | `t` 0 → 0,62 | Vitesse quasi constante (sur 20 cm la décélération gravitaire est négligeable), roulis de stabilisation acquis dans le tube puis amorti |
| Libération des bras | `clear` ≥ 1,00 | Butée mécanique à 5,5° tant que `clear < 1` |
| Ouverture des bras | `clear` 1,00 → 1,72 | 4 × 90° avec dépassement de ressort ; paires opposées décalées de 0,07 L |
| Dépliage des pales | `clear` 1,80 → 2,45 | 8 pales, 90° chacune |
| Montée en régime | `t` 0,58 → 0,90 | Rampe de régime puis flottement de tenue de vol |

La rotation des rotors est affichée à 1,2 % du régime réel : à 24 000 tr/min et
60 Hz, une pale ferait 6,7 tours par image et deviendrait illisible (aliasing
temporel).

## Mécanisme de déploiement

Le dépliage n'est pas une animation posée sur un modèle figé : la chaîne
mécanique est modélisée pièce à pièce et animée par la même variable.
Le bouton **Vue mécanisme** (ou `M`) isole le train de commande — les autres
bras, le carénage, les cloisons, l'épine et les modules sont effacés, les joues
de chape passent en fantôme — et la caméra suit la pièce pendant tout le tir.

L'architecture est une **bielle-manivelle synchronisée**, transposée du
mécanisme d'empennage retardateur type *Snakeye* : un seul poussoir axial
attaque les quatre bras par quatre biellettes.

### Chaîne de commande

| Pièce | Définition |
|---|---|
| Moyeu cruciforme | 7075, quatre chapes à deux joues Ø 10 × 1,4, ceinturant l'épine, centre ouvert |
| Axes | Ø 1,5 inox, un par bras, retenus par circlips |
| Manivelle | 4,7 mm venue de matière sur le pied de bras, calée à 157,5° de l'axe du fuseau |
| Biellette jumelée | deux flasques 0,9 mm, entraxe 7,5 mm, tourillons aux deux bouts (× 4) |
| Poussoir | tige Ø 3,4 sur l'axe du drone, étoile à quatre manetons à r = 3 mm |
| Ressort de commande | compression Ø fil 0,9 · Ø moyen 6 · 7 spires, libre 15 mm |
| Butée | épaulement usiné dans la chape + pastille élastomère |
| Verrou | cran à ressort tombant dans la gorge du poussoir |

Trois conséquences qui justifient le changement d'architecture :

1. **Synchronisation mécanique.** Les quatre bras sont liés au même poussoir :
   ils ne *peuvent pas* s'ouvrir en désordre. Un bras qui coince bloque le
   poussoir, donc tous les autres — le défaut se voit au sol au lieu de
   produire une configuration dissymétrique en vol. Le décalage entre paires
   opposées de la version précédente a donc disparu, et c'est voulu.
2. **Un seul ressort** au lieu de quatre, logé dans l'épine — le volume qui
   était déjà vide.
3. **Un seul verrou** au lieu de quatre doigts : le poussoir bloqué, aucun bras
   ne peut se replier.

### Cinématique — résolue, pas approchée

La contrainte de bielle est résolue en **forme fermée** à chaque image
(`src/model/linkage.js`), donc la biellette a toujours exactement son entraxe
nominal, quelle que soit la position du curseur :

```
ψ = θ + φ
C = a·(cos ψ, −sin ψ)          maneton de manivelle
B = (rodPin − hingeR, s)       maneton d'étoile
s = −a·sin ψ − √(L² − (a·cos ψ − bu)²)
```

Le panneau affiche en direct la course du poussoir et l'angle de transmission.
Valeurs mesurées sur l'application, conformes au dimensionnement :

| Ouverture | Course | Transmission |
|---|---|---|
| 3° (replié, en butée sur le carénage) | 0,00 mm | 53° |
| 59° | 4,37 mm | 88° |
| 94° (verrouillé) | **7,06 mm** | 54° |

Aucun point mort sur toute la course — le mécanisme ne peut pas se coincer en
position intermédiaire.

### Dimensionnement — les chiffres sont vérifiables

```
inertie d'un bras autour de l'axe   I = m_mot·L² + m_bras·L²/3 ≈ 5,4e-5 kg·m²
ouverture 90° en 80 ms              α = 2θ/t²                  ≈ 490 rad/s²
couple requis par bras              C = I·α                    ≈ 26 mN·m
énergie à fournir (4 bras)          4 × ½·I·ω²                 ≈ 165 mJ
raideur du ressort                  k = G·d⁴/(8·D³·n)          ≈ 4,3 N/mm
effort bras replié (flèche 8,57)    F = k·x                    ≈ 37 N
précharge bras déployé (flèche 1,52)                           ≈ 6,5 N
énergie restituée                   ½k(8,57² − 1,52²)          ≈ 152 mJ
longueur solide 7 × 0,9 = 6,3 mm < 6,4 mm comprimé  → ne talonne pas
énergie encaissée par butée         E = ½·I·ω²                 ≈ 41 mJ → élastomère
```

Le bras replié n'est pas à 90° : le ressort le pousse en permanence contre la
face interne du carénage, donc il repose **ouvert de 3,3°** —
`sin θ = (16 − 8,5 − 3)/78`. C'est la seule ouverture possible tant qu'il est
engagé, et c'est la valeur qu'affiche le panneau en configuration stockée.

### Charnières de pales

Deux vis épaulées Ø 1,5 déportées de `hubR` de part et d'autre du moyeu : les
pales s'ouvrent **en ciseaux**, chacune dans son sens, et viennent porter contre
une butée usinée dans la platine. Aucun ressort — la force centrifuge suffit :

```
pale de 0,35 g, cg à 25 mm     F = m·ω²·r
à  3 000 tr/min                F ≈ 0,9 N   (déjà 260× le poids de la pale)
à 20 000 tr/min                F ≈ 38 N    (plaquage rigide contre la butée)
```

Repliées, les deux pales sont parallèles et rangées vers l'axe d'articulation :
c'est ce qui permet au train bras + rotor de tenir dans la longueur du bras.

## Optimisations

* **Rendu à la demande** — la boucle ne dessine que si la scène est marquée
  « sale », si une animation tourne ou si la caméra bouge. Au repos, le GPU est
  à 0 %.
* **Fusion de géométrie** — chaque sous-ensemble statique (épine, carénage,
  les 4 chapes complètes, soute, tête, tube, cartes) est fusionné en une seule
  `BufferGeometry` via `mergeGeometries`. ~90 draw calls et 25 k triangles pour
  l'ensemble, mécanisme compris ; la vue mécanisme retombe à ~12 draw calls.
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
index.html                 page AUTONOME générée (publiée) — ne pas éditer
docs/index.html            copie de la précédente, pour Pages en mode /docs
src/
├── index.html             point d'entrée de développement (source)
├── config.js              cotes, ancrages axiaux, séquence, fiche technique
├── model/linkage.js       cinématique de la tringlerie, résolue en forme fermée
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
│   ├── mechview.js        vue d'inspection du mécanisme (cadrage + isolement)
│   └── labels.js          repères 2D projetés à la main
└── main.js                composition

scripts/build-single.mjs   génère docs/index.html (page autonome tout-en-un)
.github/workflows/pages.yml publication GitHub Pages
```

## Pistes d'extension

* Remplacer une pièce procédurale par un `.glb` : charger avec `GLTFLoader` et
  substituer le mesh dans `Drone._buildBody()` — le rig et l'éclaté sont
  indépendants de la provenance de la géométrie.
* Mesures interactives : ajouter un `Raycaster` sur `drone.root` et coter entre
  deux points cliqués.
* Étude d'encombrement : animer `D.armLen` / `D.bladeLen` et vérifier en direct
  la contrainte de rayon 17,8 mm.

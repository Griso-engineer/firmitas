# Firmitas — vérification des éléments acier (Tracés)

**En ligne : https://griso-engineer.github.io/firmitas/**

*Firmitas* : la solidité, premier des trois principes de Vitruve (firmitas, utilitas, venustas).

Application web statique de vérification des poutres et barres en acier selon NF EN 1990 et
NF EN 1993-1-1 avec annexe nationale française : classification, résistance des sections,
flambement, déversement, flexion composée (annexe B), flèches et fréquence propre.

Reprise et contre-vérification du classeur « Predim_poutre acier_v3.xlsm » (même principe :
prédimensionnement d'une travée) ; les anomalies relevées et corrigées sont listées dans l'onglet *Méthode*.

## Fonctions

- **Sections** : ~900 profils (IPE, IPE A/O, IPE 750, IPN, HE AA/A/B/M, HE lourds, HL, HD, UB, UC,
  SHS/RHS finis à chaud ou formés à froid, CHS), PRS soudés et tubes sur mesure. Les caractéristiques
  sont **calculées depuis les dimensions** (congés inclus) et recoupées avec les catalogues.
- **Acier** S235 à S460, f<sub>y</sub> selon l'épaisseur (NF EN 10025 ou tableau 3.1).
- **Sollicitations** : travée appuyée, appuyée–encastrée, bi-encastrée ou console ; charges réparties
  et ponctuelles dans les deux plans, poids propre, effort normal ; ou sollicitations de calcul saisies.
- **Vérifications** : § 5.5, 6.2.3 à 6.2.10, 6.3.1 à 6.3.3 ; M<sub>cr</sub> à 3 facteurs ; ELS (AN tableau 1).
- **Éclisse boulonnée** (onglet *Éclisse*) : couvre-joints de semelles, chacun simple ou dédoublé
  (plat extérieur + 2 plats intérieurs), et plats d'âme ; boulons ordinaires (cat. A) ou précontraints
  (cat. B ou C) ; torseur ELU complet N, V_y, V_z, M_x, M_y, M_z ; schémas de répartition entre les plats et
  d'efforts par boulon (par composante ou résultante) ; NF EN 1993-1-8 (cisaillement, glissement, pression
  diamétrale par pli, joints longs, rupture en bloc, fourrures β_p) et vérification des plats ; torseurs multiples
  avec enveloppe ; vues cotées (élévation, plans, coupe) et 3D ; vue 3D du torseur avec exemple de convention ;
  carte des taux par pièce ; raideur S_j,ini (méthode des composantes) et classification, M_j,Rd.
- **Plat soudé** (onglet *Plat soudé*) : extrémité de poutre en I boulonnée sur un plat soudé à la poutre support
  (support et soudure hors vérification) ; boulons sous V excentré et N, pression diamétrale plat et âme, cisaillement
  brut et net, rupture en bloc, flexion du plat, traction ; recommandations de ductilité du guide SCI P358.
- **Platines d'about** (onglet *Platines*) : profils I/H (méthode des composantes § 6.2 : tronçons en T, âme tendue,
  semelle comprimée, M_j,Rd, interaction N–M) et tubes RHS/SHS/CHS (tractions élastiques par boulon, tronçon en T et
  paroi) ; cisaillement + traction, poinçonnement, soudures (méthode simplifiée).
- **Hypothèses communes aux assemblages** (révision après relecture externe) : f<sub>u</sub> minimal de la norme de
  produit selon l'épaisseur (NF EN 10025-2 : 470 MPa pour S355 jusqu'à 100 mm) ; trous normaux, surdimensionnés ou
  oblongs (d<sub>0</sub> EN 1090-2, k<sub>s</sub> et réduction 0,8 / 0,6 de la pression diamétrale) ; pinces, entraxes
  et encombrements traités comme des **vérifications bloquantes** (comptées dans le taux si violées) ; données nulles
  ou négatives refusées. Éclisse : partage des plans de cisaillement au prorata des aires des plats (plan le plus
  chargé déterminant), part d'inertie de l'âme limitée à la partie droite h − 2t<sub>f</sub> − 2r. Plat soudé :
  V<sub>pl</sub>/1,27 (SCI P358), ductilité 0,5·d (S275) / 0,42·d (S355), pinces de l'âme mesurées aux semelles.
  Platines : α de la figure 6.11 calculé (forme analytique), soudures avec la pièce la plus faible, V<sub>y</sub> dans les cordons de semelles, tubes par platine rigide avec contact
  en compression seule sous la paroi du tube, largeur tributaire au pied du cordon pour les CHS. Recoupement avec
  SCI P358 (ex. 1), Dlubal KB 001497 et Structville (section G de tests.html).
- Vues 3D par tampon de profondeur (`js/r3d.js`) : parties cachées exactes, boulons complets.
- **Fiche NDC** (PDF, Word) et **projets** (localStorage, export / import .json).

## Lancer en local

`index.html` s'ouvre par double-clic. Ou :

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

`tests.html` compare le moteur au classeur d'origine et à des calculs manuels, et recoupe la bibliothèque.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/sections.js` | Dimensions des profils (extraites du classeur, complétées et corrigées) |
| `js/geom.js` | Caractéristiques géométriques calculées |
| `js/data.js` | Aciers, familles, coefficients |
| `js/ec3.js` | Moteur de calcul (fonction pure `FirmitasEC3.compute`) |
| `js/store.js` | État par défaut, projets |
| `js/report.js` | Fiche NDC |
| `js/app.js` | Interface |
| `js/eclisse-calc.js` | Moteur de l'éclisse (`FirmitasSpliceCalc.compute`) |
| `js/eclisse.js` | Interface, schémas et fiche NDC de l'éclisse |
| `js/eclisse-draw.js` | Vues cotées, 3D axonométrique, torseur 3D, carte des taux |
| `js/r3d.js` | Rendu 3D à tampon de profondeur (boîtes, prismes) |
| `js/platsoude-calc.js`, `js/platsoude.js` | Attache par plat soudé : moteur, interface, dessins, NDC |
| `js/platines-calc.js`, `js/platines.js` | Platines d'about : moteur, interface, dessins, NDC |
| `js/xl-ref.js` | Valeurs tabulées du classeur, pour `tests.html` uniquement |

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
| `js/xl-ref.js` | Valeurs tabulées du classeur, pour `tests.html` uniquement |

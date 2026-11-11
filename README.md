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
| `js/xl-ref.js` | Valeurs tabulées du classeur, pour `tests.html` uniquement |

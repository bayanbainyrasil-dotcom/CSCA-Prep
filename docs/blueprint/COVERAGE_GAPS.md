# Known blueprint coverage gaps — Physics

**Status: an engineering finding, recorded so it is not lost. Not a syllabus
claim.** Three areas the audit of 2026-09-03 asked to be verified explicitly
rather than inferred turn out not to be present in the blueprint seed at all.
That makes them a **coverage** gap, not only a **provenance** gap: no amount of
reviewing the 105 existing cells will confirm a requirement that has no cell.

These cells are **not authored here.** Authoring them is a content decision that
must follow a confirmation against a dated official source, which is Workstream 4.
Each is pre-flagged in the provenance worksheet as a cell that has to be *added*,
not merely *checked*.

All evidence below was run against `functions/src/blueprint-seed.ts` at commit
`83e12f6`, on a tree with 105 cells (46 Mathematics, 59 Physics), all `draft`.

---

## Gap 1 — Diffraction has no cell at all

```
$ grep -c -i "diffract" functions/src/blueprint-seed.ts
0
```

The word does not occur. No cell, no micro-skill, no source reference mentions
diffraction — single slit, double slit, grating or otherwise.

## Gap 2 — Interference is bundled, not a physical-optics cell

```
$ grep -n -i "interferen" functions/src/blueprint-seed.ts
2112:    microSkill: "Recognise reflection, refraction, interference and standing waves",
```

One occurrence, inside `phys-waves-wave-behaviour`:

```
id: "phys-waves-wave-behaviour"
topic: "Waves"
skill: "Describe wave behaviour"
microSkill: "Recognise reflection, refraction, interference and standing waves"
difficultyLevels: [3]
questionTypes: ["concept-recognition", "graph-reading"]
minimumItems: 3
```

Four distinct behaviours share one cell with a `minimumItems` of 3, so the cell
can be marked covered without a single interference item existing. Physical
optics — path difference, fringe spacing, coherence — has no representation
beyond that one word.

The two Optics cells are geometric optics only:

```
$ node -e "…filter cells by topic Optics/Waves/Thermodynamics…"
phys-waves-wave-equation           | Waves          | Apply v = f lambda
phys-waves-wave-behaviour          | Waves          | Recognise reflection, refraction, interference and standing waves
phys-thermodynamics-heat-transfer  | Thermodynamics | Compute heat transfer with specific heat capacity
phys-thermodynamics-gas-laws       | Thermodynamics | Apply the ideal gas relation
phys-thermodynamics-first-law      | Thermodynamics | Apply the first law of thermodynamics
phys-optics-reflection-refraction  | Optics         | Apply the laws of reflection and refraction
phys-optics-lens-mirror            | Optics         | Apply the lens and mirror relation
```

## Gap 3 — Molecular kinetic theory matches no cell

```
$ grep -n -iE "kinetic theory|rms speed|root mean square|mean kinetic energy|Boltzmann|molecular speed" \
    functions/src/blueprint-seed.ts | wc -l
0
```

Two cells look adjacent and are not:

- `phys-thermodynamics-gas-laws` — "Apply the ideal gas relation". The macroscopic
  equation of state, not the molecular model behind it.
- `phys-energy-energy-forms` — "Identify kinetic and potential energy in a
  situation". Mechanical kinetic energy of a body, unrelated to the kinetic
  theory of gases.

Nothing covers mean molecular kinetic energy proportional to temperature, rms
speed, or the microscopic derivation of pressure.

---

## Consequence for the coverage number

`0/105` today understates the problem in one specific way: it counts progress
against a denominator that is itself unconfirmed. If these three requirements
belong in the CSCA syllabus, the real denominator is at least 108, and a future
`105/105` would still not be complete coverage.

Until Workstream 4 records a human confirmation against a dated source, the app
presents blueprint coverage as **draft**, and this file is the reason the
denominator is not to be trusted either.

## What Workstream 4 must do with this

Three pre-flagged rows in the provenance worksheet, each requiring an explicit
yes/no against current official CSCA materials rather than inference:

| Candidate cell | Question for the owner |
| --- | --- |
| Physical optics — interference | Does the syllabus require interference as an examinable outcome in its own right (path difference, fringe spacing)? If yes, `phys-waves-wave-behaviour` must be split. |
| Physical optics — diffraction | Does the syllabus require diffraction at all? Nothing in the blueprint currently claims it does. |
| Kinetic theory of gases | Does the syllabus require the molecular model (mean kinetic energy, rms speed), or only the macroscopic gas laws already covered by `phys-thermodynamics-gas-laws`? |

A "no" is as valuable as a "yes" and must be recorded with the same source and
date: it converts an unknown into a deliberate exclusion.

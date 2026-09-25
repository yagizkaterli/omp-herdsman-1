# OMP Herdsman

An OMP-native port of Pi Herdsman for asynchronous agents and Herdr-backed orchestration.

> **Status: incomplete development snapshot.** This repository preserves existing port work. It is **not** a ready-to-install plugin, supported release, or proof of full compatibility with stock OMP.

## Purpose and intended functionality

- Owned background assignments with explicit identities and result delivery.
- Nested delegation, continuation, steering, questions and cancellation.
- Agent definitions, status/layout controls and a human management surface.
- Chief and peer supervision across independent leads, without silently transferring ownership.

## What is here today

The snapshot contains the orchestration extension, Herdr/OMP launch and session adapters, native session-projection work, scoped trust handling, supporting documentation and tests. It is more than a README, but it is not a verified working integration.

Focused development checks do not establish complete integration readiness. A combined post-change build and full OMP end-to-end validation are still outstanding. No compiled binaries, credentials, or ready-made release are included.

## Manifesto

- Ownership and exact session identity must determine who can control an agent.
- Surface ambiguous state and failures; never guess that a worker completed successfully.
- Keep project trust and tool permissions explicit; do not equate trust with YOLO mode.
- Use real OMP workers and lifecycle semantics, not Pi workers relabeled as OMP.

## Repository layout

- `extension/`: orchestration, definitions, runtime and Herdr integration.
- `docs/`: retained upstream and in-progress port documentation.
- Tests and scripts: development material retained with the snapshot.

## Host dependency

The shared host changes are preserved once in [OMP Atelier’s host-integration snapshot](https://github.com/Battlelamb/omp-atelier/tree/92952fe76aacea121e1a01dfe62c61d35f39e7c4/host-integration). They target OMP `v18.3.1`; see its base metadata before continuing development.

The package manifest retains `workspace:*` dependencies from development inside the custom OMP source tree. This is not currently a standalone npm installation. Do not replace a working OMP installation with this snapshot. Retained upstream documents and changelogs may describe Pi behavior; they are not an installation guide for this port. Upstream release automation has intentionally not been copied into these repositories.

## Work still required

- Finish and validate host entry-rendering and remaining session/SDK contracts.
- Verify worker startup, continuation, ownership, questions, retirement and cleanup end to end in OMP.
- Verify chief/peer behavior and complete dependency, test and documentation migration.

Further implementation and release work is deliberately deferred; this publication preserves the work rather than claiming it finished.

## Upstream and licensing

Based on [boadij/pi-herdsman](https://github.com/boadij/pi-herdsman) at [`c827b0bea1742753f19eed63efa66b48ba90c42c`](https://github.com/boadij/pi-herdsman/tree/c827b0bea1742753f19eed63efa66b48ba90c42c).

The existing Apache-2.0 license and upstream attribution are preserved in [LICENSE](LICENSE). This is an independently maintained adaptation, not an official upstream release. Shared OMP host changes retain OMP’s MIT license.

Related projects: [OMP Atelier](https://github.com/Battlelamb/omp-atelier), [OMP Herdsman](https://github.com/Battlelamb/omp-herdsman), [OMP Model Router](https://github.com/Battlelamb/omp-model-router).

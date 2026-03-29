# ADR 0004: CLI Setup And Hub Deploy

- Status: Accepted
- Date: 2026-03-30

## Context

Spexor is intended for small teams. Even when a shared results hub exists, adoption will stall if every repository needs hand-written setup, separate infrastructure glue, or provider-specific deployment steps.

The project already exposes a `spexor` CLI for local development. That CLI is the natural place to put low-friction repository bootstrap and shared-hub deployment automation.

## Decision

Extend the `spexor` CLI with:

1. `spexor setup` to bootstrap a repository with default config and starter specs.
2. `spexor hub deploy cloudflare` to scaffold and deploy a Cloudflare Worker + D1 shared results hub.
3. `spexor hub deploy aws` to scaffold and deploy an AWS CDK stack for a Lambda + S3 shared results hub.

The CLI owns repository-local scaffolding and command orchestration. Provider runtimes remain separate from the local Spexor app.

## Consequences

- Small teams can bootstrap and deploy with one command per provider.
- Provider-specific IaC is generated into the consuming repository instead of being hidden behind opaque remote tooling.
- Cloudflare remains the lowest-friction default because it can host both API and query index at low fixed cost.
- AWS support optimizes for cost and simplicity over rich query features by storing shared run events in S3 and querying by scenario prefix.

<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Security Policy

actlint is a security tool, so its own security posture is part of the product. We take vulnerability reports
seriously and hold ourselves to the standard we ask of the servers we lint.

## Supported versions

actlint is pre-release (v0.x). Until v1.0, security fixes are applied to the latest published minor line only.
Once v1.0 ships, this section will name the supported versions explicitly.

| Version | Supported |
|---|---|
| latest v0.x | ✅ |
| older v0.x | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull
requests.**

Instead, use **[GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
("Report a vulnerability" under the repository's **Security** tab), or email **security@formael.com**.

Please include:

- a description of the vulnerability and its impact;
- steps to reproduce, or a proof of concept;
- affected version(s) and environment;
- any suggested remediation.

## Response targets

| Stage | Target |
|---|---|
| Acknowledgement of your report | within **3 business days** |
| Initial assessment & severity triage | within **7 business days** |
| Fix or mitigation plan communicated | within **30 days**, severity-dependent |

We will keep you informed throughout, credit you in the advisory if you wish, and coordinate a disclosure
timeline with you. We ask that you give us a reasonable window to remediate before any public disclosure.

## Scope

This policy covers the code in this repository and the artifacts published from it. actlint performs **no
network activity except the ingestion you explicitly request**, contains **no telemetry**, and **never calls
the tools it inspects** — properties we intend to keep verifiable.

# Security policy

## Scope

PawPal is an alpha reference project. The local showcase binds to loopback and
does not implement accounts, remote access, or cloud storage. Protocol v1 does not
provide authentication, encryption, or cryptographic integrity and must not be
exposed as an untrusted network interface.

The production controls that are intentionally outside the reference build are
listed in [docs/security-update-design.md](docs/security-update-design.md).

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could put a device, network,
or user's data at risk. Use the repository host's private vulnerability-reporting
feature or contact the maintainer through a private channel listed on their profile.

Include the affected version, reproduction steps, expected impact, and any known
mitigation. Please allow a reasonable period for investigation before disclosure.

## Supported versions

Only the latest public release receives security fixes during the alpha phase.

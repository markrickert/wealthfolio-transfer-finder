# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-09-28

### Fixed

- Scans skipped the newest 500 deposit/withdrawal/transfer activities because pagination started at page 1 instead of 0
- Approving a pair that needs a cash leg reclassified failed with "Asset updates need either asset_id or symbol"
- Scan progress bar is weighted by how long each stage takes, so it no longer jumps near the end while loading and then crawls through matching

## [0.1.1] - 2026-09-23

### Added

- Transfer pair scanning workflow with review-first approvals
- Detection of unlinked transfer-typed legs (`TRANSFER_OUT`/`TRANSFER_IN`)
- Heuristic matching for untyped transfer-like pairs (`WITHDRAWAL`/`DEPOSIT`)
- Reclassify-then-link flow for pairs that need type correction
- Persistent dismissed-pair storage to prevent re-surfacing dismissed matches
- Privacy modes for hiding or disguising displayed values

### Changed

- Metadata now reflects active development (`0.1.0`)
- Project naming/description aligned to "Transfer Finder"

### Fixed

- Unpaired transfer-leg detection now handles `getTransferPair` returning `null` for unlinked activities, matching the merged host API
- Matching and scan orchestration test coverage for pair merging and candidate behavior

### Security

- No security changes in this cycle

### Dependency

- Requires Wealthfolio 3.9.0+ for the addon transfer-linking API merged in [PR #1307](https://github.com/wealthfolio/wealthfolio/pull/1307)

## [0.1.0] - 2026-07-13

### Initial

- Initial active-development release of transfer finder addon
- Route and sidebar integration for transfer review UI
- Scan pipeline for transfer candidate detection and linking

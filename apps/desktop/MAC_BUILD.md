# HotelOps Desktop V1 macOS Build

This project builds macOS packages in GitHub Actions. The Windows V1 installer stays on the existing Windows scripts.

## Build from GitHub

1. Push the repository to GitHub.
2. Open Actions.
3. Run `Build macOS Desktop` manually, or push to `main`, `master`, or a `v*` tag.
4. Download the workflow artifacts:
   - `HotelOps-Mac-V1-arm64`
   - `HotelOps-Mac-V1-x64`

Each artifact contains the generated `.dmg` and `.zip` files for that CPU architecture.

## Local macOS build

Run these commands on a Mac:

```bash
npm ci
npm run dist:mac:arm64 --workspace @hotel-ops/desktop
npm run dist:mac:x64 --workspace @hotel-ops/desktop
```

## Signing note

The current workflow creates unsigned test builds by setting `CSC_IDENTITY_AUTO_DISCOVERY=false`.

For public distribution, add Apple Developer signing and notarization later. Until that is configured, macOS may show a Gatekeeper warning when the app is opened on another computer.

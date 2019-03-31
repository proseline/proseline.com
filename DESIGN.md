# Proseline Design

## Systems

- clients, or browsers running proseline.com
- iceservers.proseline.com
- Twilio ICE servers
- paid.proseline.com
- signalhub.proseline.com

## Clients

### `proseline` Database

#### `user` Store

- `identity`
  - `secretKey`
  - `publicKey`
- `intro`
  - `name`
  - `device`
- `subscription`
  - `email`

#### `projects` Store

- `$discoveryKey`
  - `discoveryKey`
  - `deleted` (boolean)
  - `replicationKey`
  - `title`
  - `writeSeed`
  - `writeKeyPair`:
    - `secretKey`
    - `publicKey`

### Per-Project Database

named by `discoveryKey`

##### `identities` Store

- `default`
  - `$publicKey`
- `$publicKey`
  - `publicKey`
  - `secretKey`

#### `logs` Store

- `$publicKey:$index`
  - `added` (ISO 8601)
  - `authorization`
  - `digest`
  - `local` (boolean)
  - `message`
  - `publicKey`
  - `signature`

# The Design of Proseline

Proseline is a system for editing documents by taking turns.  It brings the commit-based approach of Git to prose writing, in the web browser.

## Vocabulary

They unit of organization in Proseline is the Project.

Various actors can take part in a Project:

- Writers can add Drafts, make Notes to Drafts, make Replies to other Notes, move named Markers from Draft to Draft, and identify themselves as the authors of Logs.

- Readers can read the Drafts, Notes, Replies, and Markers of the Project, but can't add any of their own.

- Distributors can replicate data about Projects, but can't read them.

Writers interact with Proseline through Clients, or instances of [proseline.com](https://proseline.com) running in their web browsers.  On creating a Project or joining a Project by Invitation from another, a Writer's Client creates an append-only Log for their contributions to that Project.  If the Writer joins the project on multiple devices, such as on their laptop and on their phone, the Client on each device creates its own Log for the project.

Readers and Writers can use Account Servers, like [paid.proseline.com](https://paid.proseline.com), to invite all of their devices Clients' to all of their projects. [paid.proseline.com](https://paid.proseline.com) also acts as a Distributor, joining each Project and replicating its data, without being able to read those data.

## Entries

All Project data takes the form of an entry to an append-only log.  There are just a few entry types.

## Cryptography

### Per Project

- a <dfn>project replication key</dfn> for encrypting all replication traffic for the project with libsodium's `crytpto_stream_*`

- a <dfn>project discovery key</dfn>, derived from the replication key with libsodium's `crypto_generichash`, for finding other Clients participating in the Project without revealing the project replication encryption key

- a <dfn>project read key</dfn> for encrypting and decrypting all Log entry message bodies with libsodium's `crypto_secretbox_*`.

- a <dfn>project write key</dfn> for signing all Log entry message bodies with libsodium's `crypto_sign_detached_*`.

- one or more Logs of signed, encrypted, indexed, and hash-linked entries

### Per Log

- a key pair for signing all log entries

### Per Client

- a signing key pair for signing requests to associate a Client with an Account and some Log entries

### Per Account

- an e-mail address

- a password used to derived keys to encrypt and decrypt project discovery keys, project read keys, and project write keys sent to the Account Server

## Message Format

All Clients replicate Project data in the form of log entries wrapped in envelopes.

### Outer Envelope

Format: JSON-encoded

Contents:
- project discovery key
- log public key
- log entry index (zero or greater)
- inner envelope encryption nonce
- inner envelop

Outer Envelopes contain only the data Distributors with the project replication key need to replicate Project data to other Clients.

### Inner Envelope

Format: Object keys sorted, JSON-encoded, encrypted with project read key, then Base64-encoded

Contents:
- signature with log key
- signature with project write key
- `crypto_generichash` digest of prior log entry, for entries after the first
- (optional) signature with client key

Inner Envelopes contain signatures showing authorization to write to the Project and to the Log.

### Entry

Format: Object keys sorted, then JSON-encoded

Entries contain the data that Clients need to display Projects.  Entries must conform to one of a set of schemas:

- <dfn>Drafts</dfn> contain document text, optionally linked to one or more parent drafts.

- <dfn>Notes</dfn> add comments to a specific range of text within a Draft.

- <dfn>Replies</dfn> add comments to Notes and other Replies.

- <dfn>Corrections</dfn> correct the text of Notes and Replies.

- <dfn>Markers</dfn> move named markers from draft to draft over time.

- <dfn>Introductions</dfn> self-identify the person and device writing to a Log.

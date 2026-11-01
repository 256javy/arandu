-- Adults own accounts; kids are pseudonymous learner profiles under an account.
CREATE TABLE account (
    id            uuid PRIMARY KEY,
    email         text        NOT NULL UNIQUE,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Opaque bearer tokens; only their SHA-256 is stored.
CREATE TABLE session (
    token_hash text PRIMARY KEY,
    account_id uuid        NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);

-- Learners created before accounts existed stay orphaned and unreachable.
ALTER TABLE learner ADD COLUMN account_id uuid REFERENCES account (id) ON DELETE CASCADE;
CREATE INDEX learner_account_idx ON learner (account_id);

ALTER TABLE evidence DROP CONSTRAINT evidence_learner_id_fkey;
ALTER TABLE evidence ADD CONSTRAINT evidence_learner_id_fkey
    FOREIGN KEY (learner_id) REFERENCES learner (id) ON DELETE CASCADE;

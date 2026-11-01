-- The kid's own words (already scrubbed of personal data) behind an LLM-judged explanation.
ALTER TABLE evidence ADD COLUMN quote varchar(280);

-- Cached weekly family summary; regenerated when newer evidence arrives or it gets old.
CREATE TABLE spotlight (
    learner_id        uuid PRIMARY KEY REFERENCES learner (id) ON DELETE CASCADE,
    text              text        NOT NULL,
    last_evidence_at  timestamptz NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

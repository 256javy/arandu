CREATE TABLE learner (
    id         uuid PRIMARY KEY,
    nickname   text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evidence (
    id              uuid PRIMARY KEY,
    learner_id      uuid        NOT NULL REFERENCES learner (id),
    skill           text        NOT NULL,
    ok              boolean     NOT NULL,
    confidence      text        NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    source_exercise text,
    detail          text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_learner_idx ON evidence (learner_id, created_at);

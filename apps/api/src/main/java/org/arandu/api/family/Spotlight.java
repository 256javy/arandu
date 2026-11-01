package org.arandu.api.family;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Cached weekly summary for the family view; deleted with the learner by cascade. */
@Entity
@Table(name = "spotlight")
public class Spotlight {

    @Id
    @Column(name = "learner_id")
    private UUID learnerId;

    @Column(nullable = false)
    private String text;

    /** Newest evidence the summary was built from; newer evidence makes it stale. */
    @Column(name = "last_evidence_at", nullable = false)
    private Instant lastEvidenceAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Spotlight() {
    }

    public Spotlight(UUID learnerId, String text, Instant lastEvidenceAt, Instant createdAt) {
        this.learnerId = learnerId;
        this.text = text;
        this.lastEvidenceAt = lastEvidenceAt;
        this.createdAt = createdAt;
    }

    public String getText() {
        return text;
    }

    public Instant getLastEvidenceAt() {
        return lastEvidenceAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

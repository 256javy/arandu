package org.arandu.api.learner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "evidence")
public class Evidence {

    @Id
    private UUID id;

    @Column(name = "learner_id", nullable = false)
    private UUID learnerId;

    @Column(nullable = false)
    private String skill;

    @Column(nullable = false)
    private boolean ok;

    @Column(nullable = false)
    private String confidence;

    @Column(name = "source_exercise")
    private String sourceExercise;

    private String detail;

    public static final int QUOTE_MAX = 280;

    private String quote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Evidence() {
    }

    public Evidence(UUID learnerId, String skill, boolean ok, String confidence, String sourceExercise, String detail) {
        this(learnerId, skill, ok, confidence, sourceExercise, detail, null);
    }

    /** {@code quote} is the kid's scrubbed text for open-ended exercises; clipped to {@value #QUOTE_MAX} chars. */
    public Evidence(UUID learnerId, String skill, boolean ok, String confidence, String sourceExercise, String detail,
                    String quote) {
        this.quote = quote == null || quote.isBlank() ? null
                : quote.strip().length() > QUOTE_MAX ? quote.strip().substring(0, QUOTE_MAX - 1) + "…" : quote.strip();
        this.id = UUID.randomUUID();
        this.learnerId = learnerId;
        this.skill = skill;
        this.ok = ok;
        this.confidence = confidence;
        this.sourceExercise = sourceExercise;
        this.detail = detail;
        this.createdAt = Instant.now();
    }

    public String getSkill() {
        return skill;
    }

    public boolean isOk() {
        return ok;
    }

    public String getConfidence() {
        return confidence;
    }

    public String getSourceExercise() {
        return sourceExercise;
    }

    public String getDetail() {
        return detail;
    }

    public String getQuote() {
        return quote;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

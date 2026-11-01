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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Evidence() {
    }

    public Evidence(UUID learnerId, String skill, boolean ok, String confidence, String sourceExercise, String detail) {
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

    public String getDetail() {
        return detail;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

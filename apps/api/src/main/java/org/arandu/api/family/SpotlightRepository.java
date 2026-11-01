package org.arandu.api.family;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SpotlightRepository extends JpaRepository<Spotlight, UUID> {

    /** Insert or replace, so two concurrent generations for the same learner never clash on the key. */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO spotlight (learner_id, text, last_evidence_at, created_at)
            VALUES (:learnerId, :text, :lastEvidenceAt, :createdAt)
            ON CONFLICT (learner_id) DO UPDATE SET text = EXCLUDED.text,
                last_evidence_at = EXCLUDED.last_evidence_at, created_at = EXCLUDED.created_at""",
            nativeQuery = true)
    void upsert(@Param("learnerId") UUID learnerId, @Param("text") String text,
                @Param("lastEvidenceAt") Instant lastEvidenceAt, @Param("createdAt") Instant createdAt);
}

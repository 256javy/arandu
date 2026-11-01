package org.arandu.api.learner;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvidenceRepository extends JpaRepository<Evidence, UUID> {

    List<Evidence> findByLearnerIdOrderByCreatedAtAsc(UUID learnerId);
}

package org.arandu.api.learner;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearnerRepository extends JpaRepository<Learner, UUID> {
}

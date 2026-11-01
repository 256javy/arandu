package org.arandu.api.family;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpotlightRepository extends JpaRepository<Spotlight, UUID> {
}

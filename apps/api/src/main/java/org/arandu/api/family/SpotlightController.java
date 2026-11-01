package org.arandu.api.family;

import java.util.UUID;
import org.arandu.api.learner.LearnerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class SpotlightController {

    private static final Logger log = LoggerFactory.getLogger(SpotlightController.class);

    private final LearnerService learners;
    private final SpotlightService spotlight;

    public SpotlightController(LearnerService learners, SpotlightService spotlight) {
        this.learners = learners;
        this.spotlight = spotlight;
    }

    @GetMapping("/api/learners/{id}/spotlight")
    public SpotlightService.SpotlightView get(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable UUID id) {
        learners.requireOwned(authorization, id);
        try {
            return spotlight.spotlight(id);
        } catch (RuntimeException ex) {
            log.warn("spotlight failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "spotlight unavailable", ex);
        }
    }
}

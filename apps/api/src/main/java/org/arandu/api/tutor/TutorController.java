package org.arandu.api.tutor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.arandu.api.learner.Evidence;
import org.arandu.api.learner.EvidenceRepository;
import org.arandu.api.learner.LearnerRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tutor")
public class TutorController {

    public record EvidenceItem(@NotBlank String skill, boolean ok,
                               @NotNull @jakarta.validation.constraints.Pattern(regexp = "high|medium|low") String confidence,
                               String detail) {
    }

    public record HistoryItem(String role, String text) {
    }

    public record TurnRequest(@NotNull UUID learnerId, @NotBlank String exerciseId, String goal,
                              String stateDescription, List<@Valid EvidenceItem> evidence,
                              @NotBlank @jakarta.validation.constraints.Pattern(regexp = "submitted|stuck|message") String event,
                              String message, List<HistoryItem> history) {
    }

    public record TurnResponse(String reply) {
    }

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern PHONE = Pattern.compile("\\+?\\d[\\d\\s().-]{6,}\\d");

    private final LearnerRepository learners;
    private final EvidenceRepository evidenceRepo;
    private final TutorModel model;
    private final String systemPrompt;

    public TutorController(LearnerRepository learners, EvidenceRepository evidenceRepo, TutorModel model) {
        this.learners = learners;
        this.evidenceRepo = evidenceRepo;
        this.model = model;
        try {
            this.systemPrompt = new ClassPathResource("prompts/musi-system.md")
                    .getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String scrub(String text) {
        if (text == null) {
            return "";
        }
        return PHONE.matcher(EMAIL.matcher(text).replaceAll("[dato oculto]")).replaceAll("[dato oculto]");
    }

    @PostMapping("/turn")
    @Transactional
    public TurnResponse turn(@Valid @RequestBody TurnRequest req) {
        if (!learners.existsById(req.learnerId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "learner not found");
        }
        List<EvidenceItem> items = req.evidence() == null ? List.of() : req.evidence();
        for (EvidenceItem e : items) {
            evidenceRepo.save(new Evidence(req.learnerId(), e.skill(), e.ok(), e.confidence(),
                    req.exerciseId(), e.detail()));
        }

        List<TutorModel.Message> messages = new ArrayList<>();
        messages.add(new TutorModel.Message("system", systemPrompt));
        messages.add(new TutorModel.Message("system", context(req, items)));
        if (req.history() != null) {
            for (HistoryItem h : req.history()) {
                boolean tutor = "tutor".equals(h.role());
                messages.add(new TutorModel.Message(tutor ? "assistant" : "user",
                        tutor ? h.text() : scrub(h.text())));
            }
        }
        if (req.message() != null && !req.message().isBlank()) {
            messages.add(new TutorModel.Message("user", scrub(req.message())));
        }
        try {
            return new TurnResponse(model.complete(messages));
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "tutor model unavailable", ex);
        }
    }

    private static String context(TurnRequest req, List<EvidenceItem> items) {
        StringBuilder sb = new StringBuilder("Ejercicio: ").append(req.exerciseId());
        if (req.goal() != null) {
            sb.append("\nObjetivo: ").append(req.goal());
        }
        if (req.stateDescription() != null) {
            sb.append("\nEstado actual: ").append(req.stateDescription());
        }
        sb.append("\nEvento: ").append(req.event());
        for (EvidenceItem e : items) {
            sb.append("\nEvidencia: ").append(e.skill()).append(e.ok() ? " (bien" : " (mal")
                    .append(", confianza ").append(e.confidence()).append(")");
            if (e.detail() != null) {
                sb.append(" ").append(e.detail());
            }
        }
        return sb.toString();
    }
}

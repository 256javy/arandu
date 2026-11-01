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
import org.arandu.api.learner.LearnerService;
import org.arandu.api.planner.ExerciseCatalog;
import org.arandu.api.planner.LearnerModel;
import org.arandu.api.planner.Planner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tutor")
public class TutorController {

    private static final Logger log = LoggerFactory.getLogger(TutorController.class);

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

    /** {@code evidence} is what this turn recorded (including LLM-judged items); {@code next} is the planner's pick. */
    public record TurnResponse(String reply, List<EvidenceItem> evidence, Planner.Plan next) {
    }

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern PHONE = Pattern.compile("\\+?\\d[\\d\\s().-]{6,}\\d");

    private final LearnerService learners;
    private final EvidenceRepository evidenceRepo;
    private final TutorModel model;
    private final Assessor assessor;
    private final String systemPrompt;

    public TutorController(LearnerService learners, EvidenceRepository evidenceRepo, TutorModel model,
                           Assessor assessor) {
        this.learners = learners;
        this.evidenceRepo = evidenceRepo;
        this.model = model;
        this.assessor = assessor;
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

    static final int DETAIL_MAX = 200;

    /** Client-sent evidence detail: scrubbed, no tags or line breaks, at most {@value #DETAIL_MAX} chars. */
    static String cleanDetail(String detail) {
        if (detail == null) {
            return null;
        }
        String t = scrub(detail).replaceAll("[<>\\r\\n]+", " ").strip();
        return t.length() > DETAIL_MAX ? t.substring(0, DETAIL_MAX) : t;
    }

    @PostMapping("/turn")
    @Transactional
    public TurnResponse turn(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                             @Valid @RequestBody TurnRequest req) {
        learners.requireOwned(authorization, req.learnerId());
        ExerciseCatalog.Exercise exercise = ExerciseCatalog.find(req.exerciseId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown exercise"));

        // Only accept evidence for skills this exercise can actually demonstrate.
        List<EvidenceItem> items = new ArrayList<>();
        if (req.evidence() != null) {
            req.evidence().stream().filter(e -> exercise.skills().contains(e.skill()))
                    .map(e -> new EvidenceItem(e.skill(), e.ok(), e.confidence(), cleanDetail(e.detail())))
                    .forEach(items::add);
        }
        String kidText = scrub(req.message());
        EvidenceItem judged = null;
        if (exercise.llmJudged() && "submitted".equals(req.event()) && !kidText.isBlank()) {
            try {
                var verdict = assessor.assess(exercise.rubric(), kidText);
                if (verdict.isPresent()) {
                    judged = new EvidenceItem(exercise.skills().getFirst(), verdict.get().ok(), "medium",
                            verdict.get().detail());
                    items.add(judged);
                }
            } catch (RuntimeException ex) {
                log.warn("assessment failed for {}", exercise.id(), ex);
            }
        }

        LearnerModel before = learners.model(req.learnerId());
        for (EvidenceItem e : items) {
            // Only the judged explanation keeps the kid's (scrubbed) words, for the family view.
            evidenceRepo.save(new Evidence(req.learnerId(), e.skill(), e.ok(), e.confidence(),
                    req.exerciseId(), e.detail(), e == judged ? kidText : null));
        }

        List<TutorModel.Message> messages = new ArrayList<>();
        messages.add(new TutorModel.Message("system", systemPrompt));
        messages.add(new TutorModel.Message("system", context(req, exercise.mode(), items) + memory(before)));
        if (req.history() != null) {
            for (HistoryItem h : req.history()) {
                boolean tutor = "tutor".equals(h.role());
                messages.add(new TutorModel.Message(tutor ? "assistant" : "user",
                        tutor ? h.text() : scrub(h.text())));
            }
        }
        if (!kidText.isBlank()) {
            messages.add(new TutorModel.Message("user", kidText));
        } else {
            // Chat APIs require a user turn; the kid acted on the exercise instead of writing.
            messages.add(new TutorModel.Message("user", switch (req.event()) {
                case "stuck" -> "[Apreté «Me trabé»]";
                default -> "[Apreté «Listo»]";
            }));
        }
        String reply;
        try {
            reply = model.complete(messages);
        } catch (RuntimeException ex) {
            log.warn("tutor model failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "tutor model unavailable", ex);
        }
        return new TurnResponse(reply, items, Planner.next(learners.model(req.learnerId())));
    }

    static String context(TurnRequest req, ExerciseCatalog.Mode mode, List<EvidenceItem> items) {
        StringBuilder sb = new StringBuilder("Ejercicio: ").append(req.exerciseId());
        sb.append("\nTipo: ").append(mode == ExerciseCatalog.Mode.EXPLAIN
                ? "explicar (el chico escribe su respuesta)"
                : "manipulable (el chico toca y mueve; no puede escribir)");
        if (req.goal() != null) {
            sb.append("\nObjetivo: ").append(req.goal());
        }
        if (req.stateDescription() != null) {
            // The web describes the state with percentages and decimals; Musi must not read them out.
            sb.append("\nEstado actual (números internos, no los digas): ").append(req.stateDescription());
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

    /** What the kid demonstrated in earlier sessions, so Musi can connect to it. */
    static String memory(LearnerModel model) {
        StringBuilder sb = new StringBuilder();
        for (LearnerModel.SkillState s : model.skills()) {
            if (s.attempts() == 0) {
                continue;
            }
            sb.append(sb.isEmpty() ? "\nMemoria de sesiones anteriores:" : "")
                    .append("\n- ").append(Planner.label(s.skill())).append(": ")
                    .append(s.successes()).append(" de ").append(s.attempts()).append(" bien")
                    .append(", último intento en ").append(s.lastExercise())
                    .append(s.successes() > 0 ? " (lo podés usar como puente)" : "");
        }
        return sb.toString();
    }
}

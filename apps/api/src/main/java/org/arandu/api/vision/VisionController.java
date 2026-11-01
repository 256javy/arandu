package org.arandu.api.vision;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.arandu.api.learner.Learner;
import org.arandu.api.learner.LearnerService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * "Photo of the real world": segments the portions of food in a kid's photo with SAM 3.1. The photo
 * lives only in memory for the duration of the request: it is never written to disk, logged or
 * stored at Meta ({@code store=false}). Only the encoded masks go back to the browser.
 */
@RestController
@RequestMapping("/api/vision")
public class VisionController {

    public static final long MAX_BYTES = 4L * 1024 * 1024;

    /** Closed list of hints, each mapped to the noun phrase that worked best in the measurements. */
    static final Map<String, String> PROMPTS = Map.of(
            "pizza", "pizza slice",
            "chocolate", "piece of chocolate",
            "cake", "cake slice");
    static final String DEFAULT_PROMPT = "slice";
    static final String FALLBACK_PROMPT = "piece of food";

    private final LearnerService learners;
    private final SamClient sam;
    private final HourlyRateLimiter limiter;

    public VisionController(LearnerService learners, SamClient sam, HourlyRateLimiter limiter) {
        this.learners = learners;
        this.sam = sam;
        this.limiter = limiter;
    }

    @PostMapping(path = "/portions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SamOutput.Portions portions(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestParam UUID learnerId,
            @RequestParam(required = false) String hint,
            @RequestParam("image") MultipartFile image) {
        Learner learner = learners.requireOwned(authorization, learnerId);
        if (hint != null && !hint.isBlank() && !PROMPTS.containsKey(hint)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown hint");
        }
        if (image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "empty image");
        }
        if (image.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "image larger than 4 MB");
        }
        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unreadable image");
        }
        String mediaType = sniff(bytes);
        if (mediaType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "only jpeg, png or webp");
        }
        if (!limiter.tryEnter(learner.getAccountId())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "a photo is already being analyzed");
        }
        try {
            if (!limiter.tryAcquire(learner.getAccountId())) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many photos, try later");
            }
            return segment(bytes, mediaType, hint);
        } finally {
            limiter.exit(learner.getAccountId());
        }
    }

    private SamOutput.Portions segment(byte[] bytes, String mediaType, String hint) {
        try {
            String prompt = hint == null || hint.isBlank() ? DEFAULT_PROMPT : PROMPTS.get(hint);
            SamOutput.Portions out = SamOutput.parse(sam.segment(bytes, mediaType, prompt), prompt);
            if (out.portions().isEmpty() && (hint == null || hint.isBlank())) {
                out = SamOutput.parse(sam.segment(bytes, mediaType, FALLBACK_PROMPT), FALLBACK_PROMPT);
            }
            return out;
        } catch (SamClient.SamUnavailableException | NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "segmentation unavailable");
        }
    }

    /** Trusts the magic bytes, not the client's Content-Type. */
    static String sniff(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (b.length >= 8 && (b[0] & 0xff) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}

package org.arandu.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import org.arandu.api.vision.HourlyRateLimiter;
import org.arandu.api.vision.SamClient;
import org.arandu.api.vision.SamOutput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "arandu.vision.photos-per-hour=3")
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class VisionPortionsTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @MockitoBean
    SamClient sam;

    /** A minimal JPEG header followed by a marker that must never show up in the logs. */
    static final String SECRET = "KID-PHOTO-PIXELS-7f3a";
    static final byte[] JPEG = concat(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0},
            SECRET.getBytes(StandardCharsets.US_ASCII));

    static byte[] concat(byte[] a, byte[] b) {
        byte[] out = Arrays.copyOf(a, a.length + b.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    private String samText() throws Exception {
        JsonNode d = json.readTree(new ClassPathResource("sam/pizza-slice-response.json").getInputStream());
        StringBuilder t = new StringBuilder();
        for (JsonNode o : d.get("output")) {
            for (JsonNode c : o.get("content")) {
                t.append(c.get("text").asString());
            }
        }
        return t.toString();
    }

    private String[] signupWithLearner() throws Exception {
        String email = "parent-" + UUID.randomUUID() + "@example.com";
        String body = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"secreto123\"}".formatted(email)))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + json.readTree(body).get("token").asString();
        String learner = mvc.perform(post("/api/learners").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Sofi\"}"))
                .andReturn().getResponse().getContentAsString();
        return new String[] {auth, json.readTree(learner).get("id").asString()};
    }

    private static MockMultipartFile image(byte[] bytes) {
        return new MockMultipartFile("image", "photo.jpg", "image/jpeg", bytes);
    }

    @Test
    void returnsEncodedPortionsWithoutLoggingThePhoto(CapturedOutput output) throws Exception {
        String[] a = signupWithLearner();
        when(sam.segment(any(), eq("image/jpeg"), eq("pizza slice"))).thenReturn(samText());

        mvc.perform(multipart("/api/vision/portions").file(image(JPEG))
                        .param("learnerId", a[1]).param("hint", "pizza").header("Authorization", a[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.width").value(1280))
                .andExpect(jsonPath("$.height").value(853))
                .andExpect(jsonPath("$.prompt").value("pizza slice"))
                .andExpect(jsonPath("$.portions.length()").value(8))
                .andExpect(jsonPath("$.portions[0].box[0]").value(651))
                .andExpect(jsonPath("$.portions[0].mask.width").value(360))
                .andExpect(jsonPath("$.portions[0].mask.height").value(269))
                .andExpect(jsonPath("$.portions[0].mask.encoding").value("one_bit"))
                .andExpect(jsonPath("$.portions[0].mask.payload").value(org.hamcrest.Matchers.startsWith("!")));

        assertThat(output.getAll()).doesNotContain(SECRET)
                .doesNotContain(Base64.getEncoder().encodeToString(JPEG).substring(0, 16));
    }

    @Test
    void fallsBackToAGenericPromptWhenNothingIsFound() throws Exception {
        String[] a = signupWithLearner();
        when(sam.segment(any(), anyString(), eq("slice"))).thenReturn("no matches");
        when(sam.segment(any(), anyString(), eq("piece of food"))).thenReturn("");

        mvc.perform(multipart("/api/vision/portions").file(image(JPEG))
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prompt").value("piece of food"))
                .andExpect(jsonPath("$.portions.length()").value(0));
    }

    @Test
    void rejectsBadInputBeforeCallingSam() throws Exception {
        String[] a = signupWithLearner();
        String[] other = signupWithLearner();

        mvc.perform(multipart("/api/vision/portions").file(image(JPEG)).param("learnerId", a[1]))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/vision/portions").file(image(JPEG))
                        .param("learnerId", other[1]).header("Authorization", a[0]))
                .andExpect(status().isNotFound());
        mvc.perform(multipart("/api/vision/portions").file(image("GIF89a....".getBytes()))
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart("/api/vision/portions").file(image(JPEG)).param("hint", "person")
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isBadRequest());
        byte[] big = Arrays.copyOf(JPEG, 4 * 1024 * 1024 + 1);
        mvc.perform(multipart("/api/vision/portions").file(image(big))
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isContentTooLarge());

        verify(sam, never()).segment(any(), anyString(), anyString());
    }

    @Test
    void ratesLimitsPerAccount() throws Exception {
        String[] a = signupWithLearner();
        when(sam.segment(any(), anyString(), anyString())).thenReturn(samText());
        for (int i = 0; i < 3; i++) {
            mvc.perform(multipart("/api/vision/portions").file(image(JPEG)).param("hint", "pizza")
                            .param("learnerId", a[1]).header("Authorization", a[0]))
                    .andExpect(status().isOk());
        }
        mvc.perform(multipart("/api/vision/portions").file(image(JPEG)).param("hint", "pizza")
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void samFailureIsABadGateway() throws Exception {
        String[] a = signupWithLearner();
        when(sam.segment(any(), anyString(), anyString())).thenThrow(new SamClient.SamUnavailableException("x"));
        mvc.perform(multipart("/api/vision/portions").file(image(JPEG)).param("hint", "cake")
                        .param("learnerId", a[1]).header("Authorization", a[0]))
                .andExpect(status().isBadGateway());
    }

    @Test
    void limiterWindowSlides() {
        Instant t0 = Instant.parse("2026-11-01T10:00:00Z");
        Clock[] clock = {Clock.fixed(t0, ZoneOffset.UTC)};
        HourlyRateLimiter l = new HourlyRateLimiter(2, new Clock() {
            public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId z) { return this; }
            public Instant instant() { return clock[0].instant(); }
        });
        UUID acc = UUID.randomUUID();
        assertThat(l.tryAcquire(acc)).isTrue();
        assertThat(l.tryAcquire(acc)).isTrue();
        assertThat(l.tryAcquire(acc)).isFalse();
        clock[0] = Clock.fixed(t0.plusSeconds(3601), ZoneOffset.UTC);
        assertThat(l.tryAcquire(acc)).isTrue();
    }

    @Test
    void parserReadsAllRecordsWithMarker() throws Exception {
        SamOutput.Portions p = SamOutput.parse(samText(), "slice");
        assertThat(p.portions()).hasSize(8);
        assertThat(p.portions()).allSatisfy(x -> assertThat(x.confidence()).isGreaterThan(0.9));
    }
}

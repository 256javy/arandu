package org.arandu.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;
import org.arandu.api.family.SpotlightRepository;
import org.arandu.api.learner.EvidenceRepository;
import org.arandu.api.tutor.TutorConfig;
import org.arandu.api.tutor.TutorModel;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SpotlightTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    EvidenceRepository evidence;

    @Autowired
    SpotlightRepository spotlights;

    @MockitoBean(name = TutorConfig.SPOTLIGHT)
    TutorModel spotlightModel;

    private String signup() throws Exception {
        String body = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"s-%s@example.com\",\"password\":\"secreto123\"}".formatted(UUID.randomUUID())))
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asString();
    }

    private String learner(String auth) throws Exception {
        String body = mvc.perform(post("/api/learners").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Sofi\"}"))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    private void explain(String auth, String id, String text) throws Exception {
        mvc.perform(post("/api/tutor/turn").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"learnerId":"%s","exerciseId":"fractions.explain-equivalence","event":"submitted",
                                 "message":"%s","history":[]}""".formatted(id, text)))
                .andExpect(status().isOk());
    }

    @Test
    void noEvidenceGivesFixedTextWithoutCallingTheModel() throws Exception {
        String auth = signup();
        String id = learner(auth);
        mvc.perform(get("/api/learners/" + id + "/spotlight").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generated").value(false))
                .andExpect(jsonPath("$.text").value(containsString("todavía no hubo práctica")));
        verify(spotlightModel, never()).complete(anyList());
    }

    @Test
    void quotesAreStoredSummaryIsCachedAndEverythingGoesWithTheProfile() throws Exception {
        when(spotlightModel.complete(anyList())).thenReturn("Tu hijo/a escribió «son la mitad».");
        String auth = signup();
        String other = signup();
        String id = learner(auth);
        explain(auth, id, "son iguales porque dos cuartos son la mitad, mi mail es a@b.com");

        mvc.perform(get("/api/learners/" + id + "/evidence").header("Authorization", auth))
                .andExpect(jsonPath("$[0].quote").value("son iguales porque dos cuartos son la mitad, mi mail es [dato oculto]"));

        mvc.perform(get("/api/learners/" + id + "/spotlight").header("Authorization", other))
                .andExpect(status().isNotFound());
        for (int i = 0; i < 2; i++) {
            mvc.perform(get("/api/learners/" + id + "/spotlight").header("Authorization", auth))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.generated").value(true))
                    .andExpect(jsonPath("$.text").value("Tu hijo/a escribió «son la mitad»."));
        }
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TutorModel.Message>> sent = ArgumentCaptor.forClass(List.class);
        verify(spotlightModel, times(1)).complete(sent.capture());
        String facts = sent.getValue().getLast().content();
        assertThat(facts).contains("«son iguales porque dos cuartos son la mitad")
                .doesNotContain("Sofi").doesNotContain("confianza").doesNotContain("@example.com");

        // New evidence invalidates the cache.
        clearInvocations(spotlightModel);
        explain(auth, id, "no se");
        mvc.perform(get("/api/learners/" + id + "/spotlight").header("Authorization", auth))
                .andExpect(status().isOk());
        verify(spotlightModel, times(1)).complete(anyList());

        UUID learnerId = UUID.fromString(id);
        assertThat(spotlights.findById(learnerId)).isPresent();
        mvc.perform(delete("/api/learners/" + id).header("Authorization", auth)).andExpect(status().isNoContent());
        assertThat(spotlights.findById(learnerId)).isEmpty();
        assertThat(evidence.findByLearnerIdOrderByCreatedAtAsc(learnerId)).isEmpty();
    }

    @Test
    void manipulableEvidenceHasNoQuote() throws Exception {
        String auth = signup();
        String id = learner(auth);
        mvc.perform(post("/api/tutor/turn").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"learnerId":"%s","exerciseId":"fractions.share-bar","event":"message","message":"hola",
                                 "evidence":[{"skill":"fraction.equal-parts","ok":true,"confidence":"high","detail":"ok"}]}"""
                                .formatted(id)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/learners/" + id + "/evidence").header("Authorization", auth))
                .andExpect(jsonPath("$[0].quote").doesNotExist())
                .andExpect(jsonPath("$[0].detail").value(not("hola")));
    }
}

package org.arandu.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TutorTurnTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String signup() throws Exception {
        String email = "parent-" + UUID.randomUUID() + "@example.com";
        String body = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"secreto123\"}".formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asString();
    }

    private String createLearner(String auth) throws Exception {
        String body = mvc.perform(post("/api/learners").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Sofi\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nickname").value("Sofi"))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    @Test
    void turnPersistsEvidenceAndRepliesWithMock() throws Exception {
        String auth = signup();
        String id = createLearner(auth);

        String turn = """
                {"learnerId":"%s","exerciseId":"fractions.share-bar","goal":"split the bar",
                 "stateDescription":"bar cut in unequal parts",
                 "evidence":[{"skill":"fraction.equal-parts","ok":false,"confidence":"high","detail":"unequal"},
                             {"skill":"fraction.equivalence","ok":true,"confidence":"high","detail":"forged"}],
                 "event":"message","message":"mi mail es a@b.com",
                 "history":[{"role":"tutor","text":"hola"}]}
                """.formatted(id);
        mvc.perform(post("/api/tutor/turn").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(turn))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value(containsString("?")))
                .andExpect(jsonPath("$.evidence.length()").value(1))
                .andExpect(jsonPath("$.next.exerciseId").value("fractions.share-bar"));

        mvc.perform(get("/api/learners/" + id + "/mastery").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].skill").value("fraction.equal-parts"))
                .andExpect(jsonPath("$[0].attempts").value(1))
                .andExpect(jsonPath("$[0].successes").value(0))
                .andExpect(jsonPath("$[0].status").value("practicing"))
                .andExpect(jsonPath("$[0].lastDetail").value("unequal"))
                .andExpect(jsonPath("$[3].attempts").value(0));
    }

    @Test
    void explanationIsJudgedWithMediumConfidence() throws Exception {
        String auth = signup();
        String id = createLearner(auth);
        String turn = """
                {"learnerId":"%s","exerciseId":"fractions.explain-equivalence","event":"submitted",
                 "message":"No, son iguales porque dos cuartos son la mitad","history":[]}
                """.formatted(id);
        mvc.perform(post("/api/tutor/turn").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(turn))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence[0].skill").value("fraction.equivalence"))
                .andExpect(jsonPath("$.evidence[0].ok").value(true))
                .andExpect(jsonPath("$.evidence[0].confidence").value("medium"));
    }

    @Test
    void learnersAreScopedToTheirAccountAndCanBeDeleted() throws Exception {
        String owner = signup();
        String other = signup();
        String id = createLearner(owner);

        mvc.perform(get("/api/learners/" + id + "/mastery")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/learners/" + id + "/mastery").header("Authorization", other))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/me").header("Authorization", owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.learners[0].id").value(id));

        mvc.perform(delete("/api/learners/" + id).header("Authorization", owner))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", owner))
                .andExpect(jsonPath("$.learners.length()").value(0));
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        String email = "p-" + UUID.randomUUID() + "@example.com";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"secreto123\"}".formatted(email)))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"otracosa1\"}".formatted(email.toUpperCase())))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"secreto123\"}".formatted(email.toUpperCase())))
                .andExpect(status().isOk());
    }
}

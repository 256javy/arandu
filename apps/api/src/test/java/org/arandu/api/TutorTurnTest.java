package org.arandu.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TutorTurnTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void turnPersistsEvidenceAndRepliesWithMock() throws Exception {
        String body = mvc.perform(post("/api/learners").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"Sofi\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nickname").value("Sofi"))
                .andReturn().getResponse().getContentAsString();
        JsonNode learner = json.readTree(body);
        String id = learner.get("id").asString();

        String turn = """
                {"learnerId":"%s","exerciseId":"fractions.share-bar","goal":"split the bar",
                 "stateDescription":"bar cut in unequal parts",
                 "evidence":[{"skill":"fraction.equal-parts","ok":false,"confidence":"high","detail":"unequal"}],
                 "event":"message","message":"mi mail es a@b.com",
                 "history":[{"role":"tutor","text":"hola"}]}
                """.formatted(id);
        mvc.perform(post("/api/tutor/turn").contentType(MediaType.APPLICATION_JSON).content(turn))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value(containsString("?")));

        mvc.perform(get("/api/learners/" + id + "/mastery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].skill").value("fraction.equal-parts"))
                .andExpect(jsonPath("$[0].attempts").value(1))
                .andExpect(jsonPath("$[0].successes").value(0))
                .andExpect(jsonPath("$[0].mastery").value(0.0))
                .andExpect(jsonPath("$[0].lastDetail").value("unequal"));
    }
}

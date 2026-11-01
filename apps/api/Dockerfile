FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B -DskipTests package && cp target/*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /app.jar /tmp/app.jar
# Extracted layout + an AOT cache from a training run cut JVM cold start (the host scales to zero).
# The training run only refreshes the context, so it must not touch the database.
RUN java -Djarmode=tools -jar /tmp/app.jar extract --destination /app && rm /tmp/app.jar \
 && java -XX:AOTCacheOutput=/app/app.aot -Dspring.context.exit=onRefresh \
      -Dspring.flyway.enabled=false -Dspring.jpa.hibernate.ddl-auto=none \
      -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
      -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
      -jar /app/app.jar \
 && chown -R app /app
USER app
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-XX:AOTCache=/app/app.aot", "-XX:MaxRAMPercentage=75", "-XX:TieredStopAtLevel=1", "-jar", "/app/app.jar"]

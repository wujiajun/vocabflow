FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
# The wrapper script fetches Maven itself; .mvn holds only that download and is not in Git, so a fresh
# clone has no such folder to copy.
COPY mvnw pom.xml ./
COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S vocabflow && adduser -S vocabflow -G vocabflow
COPY --from=build /app/target/*.jar /app/app.jar
USER vocabflow
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

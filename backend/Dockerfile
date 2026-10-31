FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S vocabflow && adduser -S vocabflow -G vocabflow
COPY --from=build /app/target/*.jar /app/app.jar
USER vocabflow
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

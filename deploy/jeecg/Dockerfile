FROM eclipse-temurin:8-jre-jammy

WORKDIR /app

COPY jeecg-system-start-3.5.3.jar /app/jeecg-system-start-3.5.3.jar
COPY application-docker.yml /app/config/application-docker.yml

EXPOSE 9100

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/jeecg-system-start-3.5.3.jar", "--spring.profiles.active=docker", "--spring.config.additional-location=file:/app/config/"]

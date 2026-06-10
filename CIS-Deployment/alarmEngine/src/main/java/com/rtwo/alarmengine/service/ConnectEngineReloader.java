package com.rtwo.alarmengine.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

@Service
public class ConnectEngineReloader {

    private static final Logger log = LoggerFactory.getLogger(ConnectEngineReloader.class);

    private final String containerName;
    private final String dockerSocket;

    public ConnectEngineReloader(
            @Value("${connect.engine.container:CIS-Deployment-connect-engine}") String containerName,
            @Value("${connect.engine.docker-socket:/var/run/docker.sock}") String dockerSocket) {
        this.containerName = containerName;
        this.dockerSocket = dockerSocket;
    }

    public boolean restartNow() {
        if (!java.nio.file.Files.exists(java.nio.file.Path.of(dockerSocket))) {
            log.debug("Docker socket not available — skip Connect Engine restart");
            return false;
        }
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                    "--unix-socket", dockerSocket,
                    "-X", "POST",
                    "http://localhost/v1.43/containers/" + containerName + "/restart?t=5"
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("Connect Engine restart timed out");
                return false;
            }
            String output = readOutput(process);
            if (process.exitValue() == 0) {
                log.info("Connect Engine container {} restarted", containerName);
                return true;
            }
            log.warn("Connect Engine restart failed (exit={}, output={})", process.exitValue(), output);
            return false;
        } catch (Exception e) {
            log.warn("Connect Engine restart skipped: {}", e.getMessage());
            return false;
        }
    }

    private String readOutput(Process process) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString().trim();
        }
    }
}

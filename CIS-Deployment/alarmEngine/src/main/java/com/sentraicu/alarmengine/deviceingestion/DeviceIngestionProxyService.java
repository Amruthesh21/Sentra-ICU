package com.sentraicu.alarmengine.deviceingestion;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

@Service
public class DeviceIngestionProxyService {

    private static final Logger log = LoggerFactory.getLogger(DeviceIngestionProxyService.class);
    private static final String PREFIX = "/api/device-ingestion";
    private static final Set<String> ALLOWED_METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");

    private final DeviceIngestionGatewayResolver resolver;
    private final RestClient restClient;

    public DeviceIngestionProxyService(DeviceIngestionGatewayResolver resolver, RestClient deviceIngestionRestClient) {
        this.resolver = resolver;
        this.restClient = deviceIngestionRestClient;
    }

    public ResponseEntity<byte[]> forward(HttpServletRequest request, byte[] body) {
        String method = request.getMethod() == null ? "GET" : request.getMethod().toUpperCase(Locale.ROOT);
        if (!ALLOWED_METHODS.contains(method)) {
            throw new DeviceIngestionProxyException(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed");
        }

        String origin = resolver.resolve(request);
        String suffix = remainingPath(request.getRequestURI());
        String query = request.getQueryString();
        URI target = URI.create(origin + suffix + (query == null || query.isBlank() ? "" : "?" + query));
        if (!target.toString().startsWith(origin)) {
            throw new DeviceIngestionProxyException(HttpStatus.BAD_REQUEST, "Invalid device-ingestion path");
        }

        try {
            RestClient.RequestBodySpec spec = restClient.method(HttpMethod.valueOf(method))
                    .uri(target)
                    .headers(headers -> {
                        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
                        if (authorization != null && !authorization.isBlank()) {
                            headers.set(HttpHeaders.AUTHORIZATION, authorization);
                        }
                        String accept = request.getHeader(HttpHeaders.ACCEPT);
                        if (accept != null) headers.set(HttpHeaders.ACCEPT, accept);
                        if (body != null && body.length > 0 && request.getContentType() != null) {
                            headers.set(HttpHeaders.CONTENT_TYPE, request.getContentType());
                        }
                    });
            if (body != null && body.length > 0) {
                spec.body(body);
            }
            return spec.exchange((req, response) -> {
                byte[] bytes = response.getBody() == null ? new byte[0] : response.getBody().readAllBytes();
                HttpHeaders out = new HttpHeaders();
                MediaType contentType = response.getHeaders().getContentType();
                if (contentType != null) out.setContentType(contentType);
                return ResponseEntity.status(response.getStatusCode()).headers(out).body(bytes);
            });
        } catch (DeviceIngestionProxyException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.warn("Hospital device gateway unreachable at {}: {}", origin, e.getMessage());
            throw new DeviceIngestionProxyException(
                    HttpStatus.BAD_GATEWAY,
                    "Hospital device gateway is unreachable. Check the site VPN and the gateway URL.",
                    e);
        } catch (Exception e) {
            log.warn("Hospital device gateway proxy failed for {}: {}", origin, e.getMessage());
            throw new DeviceIngestionProxyException(
                    HttpStatus.BAD_GATEWAY,
                    "Hospital device gateway request failed: " + e.getMessage(),
                    e);
        }
    }

    static String remainingPath(String requestUri) {
        if (requestUri == null || requestUri.isBlank()) return "/";
        int idx = requestUri.indexOf(PREFIX);
        String path = idx < 0 ? requestUri : requestUri.substring(idx + PREFIX.length());
        if (path.isEmpty()) return "/";
        if (!path.startsWith("/")) return "/" + path;
        return path;
    }
}

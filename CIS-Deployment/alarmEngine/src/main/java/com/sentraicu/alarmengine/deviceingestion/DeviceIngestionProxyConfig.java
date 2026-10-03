package com.sentraicu.alarmengine.deviceingestion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class DeviceIngestionProxyConfig {

    @Bean
    RestClient deviceIngestionRestClient(DeviceIngestionProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(Math.max(500, properties.getConnectTimeoutMs())));
        factory.setReadTimeout(Duration.ofMillis(Math.max(1000, properties.getReadTimeoutMs())));
        return RestClient.builder().requestFactory(factory).build();
    }
}

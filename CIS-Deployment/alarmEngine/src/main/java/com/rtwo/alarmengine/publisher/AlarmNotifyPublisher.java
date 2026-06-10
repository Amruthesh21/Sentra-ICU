package com.rtwo.alarmengine.publisher;

import com.rtwo.alarmengine.dto.AlarmEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AlarmNotifyPublisher {

    private static final Logger log = LoggerFactory.getLogger(AlarmNotifyPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final String notifyQueue;

    public AlarmNotifyPublisher(RabbitTemplate rabbitTemplate,
                                @Value("${alarm.rabbitmq.notify-queue}") String notifyQueue) {
        this.rabbitTemplate = rabbitTemplate;
        this.notifyQueue = notifyQueue;
    }

    public void publish(AlarmEvent event) {
        rabbitTemplate.convertAndSend(notifyQueue, event);
        log.info("Published alarm: bed={} param={} value={} severity={}",
                event.getBedId(), event.getParamName(), event.getCurrentValue(), event.getSeverity());
    }
}

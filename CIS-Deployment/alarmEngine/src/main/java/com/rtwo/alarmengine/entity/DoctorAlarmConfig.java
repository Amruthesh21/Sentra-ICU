package com.rtwo.alarmengine.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "doctorAlarmConfig")
public class DoctorAlarmConfig {

    @Id
    private String id;
    private String doctorId;
    private String bedId;
    private String patientMRN;
    private String patientName;
    private List<AlarmThreshold> alarms = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public String getBedId() {
        return bedId;
    }

    public void setBedId(String bedId) {
        this.bedId = bedId;
    }

    public String getPatientMRN() {
        return patientMRN;
    }

    public void setPatientMRN(String patientMRN) {
        this.patientMRN = patientMRN;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public List<AlarmThreshold> getAlarms() {
        return alarms;
    }

    public void setAlarms(List<AlarmThreshold> alarms) {
        this.alarms = alarms;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static class AlarmThreshold {
        private String paramName;
        private Double highThreshold;
        private Double lowThreshold;
        private Boolean enabled;

        public String getParamName() {
            return paramName;
        }

        public void setParamName(String paramName) {
            this.paramName = paramName;
        }

        public Double getHighThreshold() {
            return highThreshold;
        }

        public void setHighThreshold(Double highThreshold) {
            this.highThreshold = highThreshold;
        }

        public Double getLowThreshold() {
            return lowThreshold;
        }

        public void setLowThreshold(Double lowThreshold) {
            this.lowThreshold = lowThreshold;
        }

        public Boolean getEnabled() {
            return enabled;
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = enabled;
        }
    }
}

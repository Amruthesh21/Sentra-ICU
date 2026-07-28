package com.rtwo.alarmengine.hub.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "hub_patient_visits")
public class HubPatientVisitEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID patientId;

    @Column(nullable = false)
    private int visitNumber;

    private String admissionType;
    private String admissionSource;
    private String referringPhysician;

    private String attendingPhysician;

    private String primaryNurse;

    @Column(columnDefinition = "text")
    private String primaryDiagnosis;

    @Column(columnDefinition = "text")
    private String provisionalDiagnosis;

    @Column(columnDefinition = "text")
    private String allergyHistory;

    @Column(columnDefinition = "text")
    private String pastMedicalHistory;

    @Column(columnDefinition = "text")
    private String familyHistory;

    @Column(columnDefinition = "text")
    private String systemicExamination;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> comorbidities;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> isolationFlags;

    @Column(nullable = false)
    private Instant admittedAt;

    private Instant dischargedAt;

    @Column(columnDefinition = "text")
    private String dischargeReason;

    @Column(columnDefinition = "text")
    private String dischargeDestination;

    @Column(columnDefinition = "text")
    private String followUpPlan;

    @Column(nullable = false)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> clinicalSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> consent;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> deviceMapping;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = "ACTIVE";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public int getVisitNumber() { return visitNumber; }
    public void setVisitNumber(int visitNumber) { this.visitNumber = visitNumber; }
    public String getAdmissionType() { return admissionType; }
    public void setAdmissionType(String admissionType) { this.admissionType = admissionType; }
    public String getAdmissionSource() { return admissionSource; }
    public void setAdmissionSource(String admissionSource) { this.admissionSource = admissionSource; }
    public String getReferringPhysician() { return referringPhysician; }
    public void setReferringPhysician(String referringPhysician) { this.referringPhysician = referringPhysician; }
    public String getAttendingPhysician() { return attendingPhysician; }
    public void setAttendingPhysician(String attendingPhysician) { this.attendingPhysician = attendingPhysician; }
    public String getPrimaryNurse() { return primaryNurse; }
    public void setPrimaryNurse(String primaryNurse) { this.primaryNurse = primaryNurse; }
    public String getPrimaryDiagnosis() { return primaryDiagnosis; }
    public void setPrimaryDiagnosis(String primaryDiagnosis) { this.primaryDiagnosis = primaryDiagnosis; }
    public String getProvisionalDiagnosis() { return provisionalDiagnosis; }
    public void setProvisionalDiagnosis(String provisionalDiagnosis) { this.provisionalDiagnosis = provisionalDiagnosis; }
    public String getAllergyHistory() { return allergyHistory; }
    public void setAllergyHistory(String allergyHistory) { this.allergyHistory = allergyHistory; }
    public String getPastMedicalHistory() { return pastMedicalHistory; }
    public void setPastMedicalHistory(String pastMedicalHistory) { this.pastMedicalHistory = pastMedicalHistory; }
    public String getFamilyHistory() { return familyHistory; }
    public void setFamilyHistory(String familyHistory) { this.familyHistory = familyHistory; }
    public String getSystemicExamination() { return systemicExamination; }
    public void setSystemicExamination(String systemicExamination) { this.systemicExamination = systemicExamination; }
    public List<String> getComorbidities() { return comorbidities; }
    public void setComorbidities(List<String> comorbidities) { this.comorbidities = comorbidities; }
    public Map<String, Object> getIsolationFlags() { return isolationFlags; }
    public void setIsolationFlags(Map<String, Object> isolationFlags) { this.isolationFlags = isolationFlags; }
    public Instant getAdmittedAt() { return admittedAt; }
    public void setAdmittedAt(Instant admittedAt) { this.admittedAt = admittedAt; }
    public Instant getDischargedAt() { return dischargedAt; }
    public void setDischargedAt(Instant dischargedAt) { this.dischargedAt = dischargedAt; }
    public String getDischargeReason() { return dischargeReason; }
    public void setDischargeReason(String dischargeReason) { this.dischargeReason = dischargeReason; }
    public String getDischargeDestination() { return dischargeDestination; }
    public void setDischargeDestination(String dischargeDestination) { this.dischargeDestination = dischargeDestination; }
    public String getFollowUpPlan() { return followUpPlan; }
    public void setFollowUpPlan(String followUpPlan) { this.followUpPlan = followUpPlan; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Map<String, Object> getClinicalSnapshot() { return clinicalSnapshot; }
    public void setClinicalSnapshot(Map<String, Object> clinicalSnapshot) { this.clinicalSnapshot = clinicalSnapshot; }
    public Map<String, Object> getConsent() { return consent; }
    public void setConsent(Map<String, Object> consent) { this.consent = consent; }
    public Map<String, Object> getDeviceMapping() { return deviceMapping; }
    public void setDeviceMapping(Map<String, Object> deviceMapping) { this.deviceMapping = deviceMapping; }
    public Instant getCreatedAt() { return createdAt; }
}

package com.rtwo.alarmengine.dto;

import com.rtwo.alarmengine.entity.DoctorAlarmConfig;

import java.util.ArrayList;
import java.util.List;

public class AlarmConfigRequest {

    private String doctorId;
    private String bedId;
    private String patientMRN;
    private String patientName;
    private List<DoctorAlarmConfig.AlarmThreshold> alarms = new ArrayList<>();

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

    public List<DoctorAlarmConfig.AlarmThreshold> getAlarms() {
        return alarms;
    }

    public void setAlarms(List<DoctorAlarmConfig.AlarmThreshold> alarms) {
        this.alarms = alarms;
    }
}

package com.rtwo.alarmengine.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceDataMessage {

    private String bedId;
    private String deviceType;
    private String timestamp;
    private List<VitalAttribute> primaryAttributes;
    private List<VitalAttribute> secondaryAttributes;

    public String getBedId() {
        return bedId;
    }

    public void setBedId(String bedId) {
        this.bedId = bedId;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
        this.deviceType = deviceType;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public List<VitalAttribute> getPrimaryAttributes() {
        return primaryAttributes;
    }

    public void setPrimaryAttributes(List<VitalAttribute> primaryAttributes) {
        this.primaryAttributes = primaryAttributes;
    }

    public List<VitalAttribute> getSecondaryAttributes() {
        return secondaryAttributes;
    }

    public void setSecondaryAttributes(List<VitalAttribute> secondaryAttributes) {
        this.secondaryAttributes = secondaryAttributes;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class VitalAttribute {
        @JsonAlias("name")
        private String paramName;
        private Object value;
        private String unit;

        public String getParamName() {
            return paramName;
        }

        public void setParamName(String paramName) {
            this.paramName = paramName;
        }

        public void setName(String name) {
            this.paramName = name;
        }

        public Double getValue() {
            if (value == null) {
                return null;
            }
            if (value instanceof Number number) {
                return number.doubleValue();
            }
            String text = value.toString().trim();
            if (text.isEmpty() || "--".equals(text)) {
                return null;
            }
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        public void setValue(Object value) {
            this.value = value;
        }

        public String getUnit() {
            return unit;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }
    }
}

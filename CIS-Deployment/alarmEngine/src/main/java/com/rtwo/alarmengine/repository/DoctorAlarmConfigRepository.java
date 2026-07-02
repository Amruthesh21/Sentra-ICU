package com.rtwo.alarmengine.repository;

import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DoctorAlarmConfigRepository extends MongoRepository<DoctorAlarmConfig, String> {

    List<DoctorAlarmConfig> findByDoctorId(String doctorId);

    Optional<DoctorAlarmConfig> findByDoctorIdAndBedId(String doctorId, String bedId);

    List<DoctorAlarmConfig> findByBedId(String bedId);

    List<DoctorAlarmConfig> findByBedIdIn(Collection<String> bedIds);

    void deleteByDoctorIdAndBedId(String doctorId, String bedId);
}

db.deviceConfigEntity.updateOne(
  { _id: 'BplElisa600' },
  {
    $set: {
      _id: 'BplElisa600',
      deviceType: 'ventilator',
      deviceName: 'BplElisa600',
      attributes: [
        { _id: 'RR', name: 'Resp.Rate', description: 'Respiratory Rate', color: 'cyan', group: 'primary', enabled: true },
        { _id: 'PEEP', name: 'PEEP', description: 'PEEP', color: 'orange', group: 'primary', enabled: true },
        { _id: 'MV', name: 'MV', description: 'Minute Volume', color: 'limegreen', group: 'primary', enabled: true },
        { _id: 'Peak', name: 'Peak', description: 'Peak Pressure', color: 'gold', group: 'primary', enabled: true },
        { _id: 'VT', name: 'VT', description: 'Tidal Volume', color: 'yellow', group: 'primary', enabled: true },
        { _id: 'FiO2', name: 'FiO2', description: 'FiO2', color: 'lightcoral', group: 'primary', enabled: true },
      ],
      alerts: [{ enabled: true, alert: 'High airway pressure' }],
      customAlerts: [{}],
      _class: 'com.rtwo.med.device.connect.mongo.dal.entities.DeviceConfigEntity',
    },
  },
  { upsert: true }
);
print('BplElisa600 config ok');

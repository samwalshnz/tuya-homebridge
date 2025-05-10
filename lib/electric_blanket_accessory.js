const BaseAccessory = require('./base_accessory');

let Accessory;
let Service;
let Characteristic;

class ElectricBlanketAccessory extends BaseAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    ({ Accessory, Characteristic, Service } = platform.api.hap);
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Accessory.Categories.SWITCH,
      Service.Switch
    );

    this.statusArr = deviceConfig.status ? deviceConfig.status : [];
    this.functionArr = deviceConfig.functions ? deviceConfig.functions : [];

    this.refreshAccessoryServiceIfNeed(this.statusArr, false);
  }

  refreshAccessoryServiceIfNeed(statusArr, isRefresh) {
    this.isRefresh = isRefresh;
    for (var statusMap of statusArr) {
      if (statusMap.code === 'switch') {
        this.switchMap = statusMap;
        this.normalAsync(Characteristic.On, this.switchMap.value);
      }

      if (statusMap.code === 'level_1') {
        this.level1Map = statusMap;
        const hbLevel1Value = this.tuyaParamToHomeBridge(Characteristic.Brightness, this.level1Map.value);
        this.normalAsync(Characteristic.Brightness, hbLevel1Value);
      }

      if (statusMap.code === 'level_2') {
        this.level2Map = statusMap;
        const hbLevel2Value = this.tuyaParamToHomeBridge(Characteristic.Brightness, this.level2Map.value);
        this.normalAsync(Characteristic.Brightness, hbLevel2Value);
      }

      if (statusMap.code === 'countdown_set_1') {
        this.countdownSet1Map = statusMap;
        const hbCountdownSet1Value = this.tuyaParamToHomeBridge(Characteristic.RemainingDuration, this.countdownSet1Map.value);
        this.normalAsync(Characteristic.RemainingDuration, hbCountdownSet1Value);
      }

      if (statusMap.code === 'countdown_set_2') {
        this.countdownSet2Map = statusMap;
        const hbCountdownSet2Value = this.tuyaParamToHomeBridge(Characteristic.RemainingDuration, this.countdownSet2Map.value);
        this.normalAsync(Characteristic.RemainingDuration, hbCountdownSet2Value);
      }
    }
  }

  normalAsync(name, hbValue) {
    this.setCachedState(name, hbValue);
    if (this.isRefresh) {
      this.service
        .getCharacteristic(name)
        .updateValue(hbValue);
    } else {
      this.getAccessoryCharacteristic(name);
    }
  }

  getAccessoryCharacteristic(name) {
    this.service.getCharacteristic(name)
      .on('get', callback => {
        if (this.hasValidCache()) {
          callback(null, this.getCachedState(name));
        }
      })
      .on('set', (value, callback) => {
        var param = this.getSendParam(name, value);
        this.platform.tuyaOpenApi.sendCommand(this.deviceId, param).then(() => {
          this.setCachedState(name, value);
          callback();
        }).catch((error) => {
          this.log.error('[SET][%s] Characteristic Error: %s', this.homebridgeAccessory.displayName, error);
          this.invalidateCache();
          callback(error);
        });
      });
  }

  getSendParam(name, hbValue) {
    var code;
    var value;
    switch (name) {
      case Characteristic.On:
        const isOn = hbValue ? true : false;
        code = "switch";
        value = isOn;
        break;
      case Characteristic.Brightness:
        code = this.level1Map.code;
        value = hbValue;
        break;
      case Characteristic.RemainingDuration:
        code = this.countdownSet1Map.code;
        value = hbValue;
        break;
      default:
        break;
    }
    return {
      "commands": [
        {
          "code": code,
          "value": value
        }
      ]
    };
  }

  tuyaParamToHomeBridge(name, param) {
    switch (name) {
      case Characteristic.Brightness:
        let level;
        if (param === "level_1") {
          level = 1;
        } else if (param === "level_2") {
          level = 2;
        } else {
          level = 0;
        }
        return level;
      case Characteristic.RemainingDuration:
        let duration;
        if (param === "1h") {
          duration = 3600;
        } else if (param === "2h") {
          duration = 7200;
        } else {
          duration = 0;
        }
        return duration;
    }
  }

  updateState(data) {
    this.refreshAccessoryServiceIfNeed(data.status, true);
  }
}

module.exports = ElectricBlanketAccessory;

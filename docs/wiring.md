# Wiring

These are project defaults, not universal ESP32-S3 pin assignments. Verify the labels printed on the exact board before applying power.

## ST7789 240×240 SPI display

| Display pin | ESP32-S3 default | Purpose |
| --- | ---: | --- |
| VCC | 3V3 | Display power |
| GND | GND | Ground |
| SCL / SCK | GPIO12 | SPI clock |
| SDA / MOSI | GPIO11 | SPI data from ESP32 |
| RES / RST | GPIO14 | Display reset |
| DC | GPIO9 | Data/command select |
| CS | GPIO10 | Chip select |
| BLK / BL | 3V3 | Backlight always on for milestone one |

Some ST7789 modules omit `CS`. If so, connect the module's documented fixed-CS arrangement and adjust the driver configuration rather than guessing.

## TTP223 touch sensor

| TTP223 pin | ESP32-S3 default |
| --- | ---: |
| VCC | 3V3 |
| GND | GND |
| OUT | GPIO4 |

The default firmware expects `HIGH` while touched. Change `kTouchActiveHigh` in `hardware_config.h` if the module is configured for the opposite behavior.

## MPU6050

| MPU6050 pin | ESP32-S3 default |
| --- | ---: |
| VCC | 3V3 |
| GND | GND |
| SDA | GPIO8 |
| SCL | GPIO18 |
| AD0 | GND |

With `AD0` connected to ground, the expected I2C address is `0x68`.

## Raspberry Pi connection

For the first version, connect the Raspberry Pi to the ESP32-S3 with a normal USB data cable. Do not connect an additional UART until the USB version works.

Typical Linux device names include:

```text
/dev/ttyACM0
/dev/ttyUSB0
```

Use `ls /dev/ttyACM* /dev/ttyUSB*` before and after connecting the board to identify the correct device.

## Power sequence

1. Check for shorts between 3V3 and GND with power disconnected.
2. Connect only the ESP32-S3 by USB and confirm it enumerates.
3. Disconnect USB, add the display, reconnect, and run the display test.
4. Repeat separately for touch and MPU6050.
5. Combine modules only after each one passes independently.


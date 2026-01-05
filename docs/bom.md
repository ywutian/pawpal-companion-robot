# Bill of materials

Buy modules by electrical specification rather than listing title alone. Marketplace photos and pin labels often vary between sellers.

## Required for milestone one

| Item | Minimum specification | Quantity | Notes |
| --- | --- | ---: | --- |
| ESP32-S3 development board | ESP32-S3, USB data connection, exposed GPIO | 1 | Project defaults target DevKitC-1 |
| TFT display | ST7789, 240×240, 3.3 V logic, SPI | 1 | Confirm whether the module exposes CS and BL pins |
| Touch module | TTP223 digital capacitive touch | 1 | 3.3 V operation preferred |
| IMU module | MPU6050, I2C, address selectable by AD0 | 1 | Common GY-521 board is suitable |
| Breadboard | Full or half size | 1 | Use for the first powered build |
| Jumper wires | Male-to-male | 1 set | Keep SPI and I2C wires short |
| USB cable | Data-capable USB cable for the ESP32 board | 1 | Charge-only cables will not support flashing |

## Optional after the first gates pass

| Item | Minimum specification | Purpose |
| --- | --- | --- |
| Raspberry Pi 4 or 5 | Linux and USB host | Higher-level workflows and future perception |
| MAX98357A | I2S mono amplifier | Sound effects and future voice output |
| Speaker | 4–8 Ω, matched to the amplifier | Audio output |
| 3D-printed enclosure | Openings for display, touch, and USB | Physical presentation |
| Logic analyzer | At least four digital channels | Debug SPI, I2C, and timing |

## Do not buy yet

- Motors, motor drivers, high-current batteries, and charging boards are outside milestone one.
- A camera and microphone should wait until the display, touch, IMU, and serial workflow are stable.
- Do not select a battery system until enclosure, runtime, charging, protection, and thermal requirements are defined.


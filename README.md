# Home Assistant YAML generator for Valetudo devices

This script helps generate YAML for Valetudo robots. It would automate process described in 
[home assistanr integration guide](https://valetudo.cloud/pages/integrations/home-assistant-integration.html)

## Usage:

Create `config.yaml` with following contents:

```yml
# MQTT server URL and options
# see https://www.npmjs.com/package/mqtt#client for details
mqtt_url: mqtt://mqtt.server.name:1883
mqtt_options:
    clean: true
    connectTimeout: 4000
    username: xxxxxx
    password: xxxxxx
    reconnectPeriod: 1000

# List of valetudo device IDs
vacuums:
    - vacuum-kitchen
    - vacuum-basement
```

Initialize node environment and install pacjages:

```bash
npm install
```

Run the script:

```bash
node valetudo-hassio-yamlgen.js
```

You will receive following files:

- `valetudo.yaml` complete package file ready for copying to hassio `packages` directory
- `dashboard.yaml` UI dashboard file, can be copy-pasted into a section YAML
- also a set of `<vaccum-id>.yaml` files if you just want a card

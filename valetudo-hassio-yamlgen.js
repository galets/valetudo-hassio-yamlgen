const mqtt = require('mqtt');
const fs = require('fs');
const yaml = require('js-yaml');

const configFileContents = fs.readFileSync("config.yaml", 'utf8');
const config = yaml.load(configFileContents);

async function mqttRead(topic) {
    const connectUrl = config.mqtt_url;

    const client = mqtt.connect(connectUrl, config.mqtt_options);

    await client.subscribe(topic);

    return new Promise((resolve, reject) => {
        client.on('message', (topic, message) => {
            client.end();
            resolve(message.toString());
        });

        client.on('error', (err) => {
            console.error(`MQTT error: ${err}`);
            reject(err);
        });
    });
}

function yamlSave(filename, data) {
    const yamlStr = yaml.dump(data);
    fs.writeFileSync(filename, yamlStr, 'utf8');
};

function guessIcon(name) {
    if (name.match(/bar/ig)) return 'mdi:glass-cocktail';
    if (name.match(/bath/ig)) return 'mdi:shower';
    if (name.match(/bed/ig)) return 'mdi:bed-empty';
    if (name.match(/closet/ig)) return 'mdi:wardrobe';
    if (name.match(/game/ig)) return 'mdi:gamepad';
    if (name.match(/hall/ig)) return 'mdi:foot-print';
    if (name.match(/kitchen/ig)) return 'mdi:silverware-fork-knife';
    if (name.match(/laundry/ig)) return 'mdi:washing-machine';
    if (name.match(/living/ig)) return 'mdi:sofa';
    if (name.match(/office/ig)) return 'mdi:laptop';
    return 'mdi:door';
}

function sanitize(name) {
    return name.replace(/-/g, "_");
}

async function main() {

    let result = {
        group: {
        },
        input_boolean: {
        },
        homeassistant: {
            customize: {}
        },
        script: {
        }
    }

    const vacuums = config.vacuums;
    const dashboard = {
        "title": "Valetudo Robots",
        "path": "valetudo-robots",
        "type": "sections",
        "max_columns": vacuums.length,
        "sections": [],
        "icon": "mdi:robot-vacuum",
        "cards": []
    };


    for (let vacuum_id of vacuums) {

        const rooms = JSON.parse(await mqttRead(`valetudo/${vacuum_id}/MapData/segments`));
        const config = JSON.parse(await mqttRead(`homeassistant/vacuum/${vacuum_id}/${vacuum_id}_vacuum/config`))

        const group_name = sanitize(`vacuum_${vacuum_id}_rooms`);
        result.group[group_name] = {
            name: `Vacuum Rooms ${config.device.name}`,
            entities: [],
        }

        for (let id in rooms) {
            const value = rooms[id];
            const input = sanitize(`vacuum_${vacuum_id}_${value}`);
            result.input_boolean[input] = {
                name: value,
                icon: guessIcon(value)
            };
            result.homeassistant.customize[`input_boolean.${input}`] = { room_id: id };
            result.group[group_name].entities.push(`input_boolean.${input}`);
        }

        const script_prefix = sanitize(`vacuum_clean_${vacuum_id}_segments`);
        result.script[script_prefix] = {
            "sequence": [
                {
                    "action": "script.turn_on",
                    "target": {
                        "entity_id": `script.${script_prefix}_message`
                    },
                    "data": {
                        "variables": {
                            "segments": `{{expand("group.${group_name}") | selectattr("state","eq","on") | map(attribute="attributes.room_id") | list | to_json}}`
                        }
                    }
                }
            ],
            "mode": "single",
            "alias": script_prefix,
            "icon": "mdi:arrow-right"
        };

        result.script[`${script_prefix}_message`] = {
            "alias": `${script_prefix}_message`,
            "sequence": [
                {
                    "action": "mqtt.publish",
                    "data": {
                        "topic": `valetudo/${vacuum_id}/MapSegmentationCapability/clean/set`,
                        "payload": '{"segment_ids": {{segments}}}'
                    }
                }
            ],
            "mode": "single"
        };

        const card = {
            "type": "vertical-stack",
            "cards": [
                {
                    "type": "custom:auto-entities",
                    "card": {
                        "type": "entities",
                        "state_color": true,
                        "title": `Clean Rooms (${config.device.name})`
                    },
                    "filter": {
                        "include": [
                            {
                                "group": `group.${group_name}`
                            }
                        ],
                        "exclude": []
                    },
                    "show_empty": true,
                    "sort": {
                        "method": "friendly_name",
                        "reverse": false,
                        "numeric": false
                    }
                },
                {
                    "type": "custom:button-card",
                    "tap_action": {
                        "action": "call-service",
                        "service": `script.${script_prefix}`,
                        "confirmation": true,
                        "service_data": {},
                        "target": {}
                    },
                    "lock": {
                        "enabled": `[[[return states['group.${group_name}'].state !== 'on' || states['vacuum.valetudo_${sanitize(vacuum_id)}'].state !== 'docked']]]`,
                        "exemptions": []
                    },
                    "entity": `script.${script_prefix}`,
                    "name": "Start cleaning selected segments",
                    "show_state": false,
                    "show_icon": false
                }
            ]
        };

        yamlSave(`card-${vacuum_id}.yaml`, card);

        dashboard.sections.push({
            "type": "grid",
            "cards": [
                {
                    "type": "custom:valetudo-map-card",
                    "vacuum": `valetudo_${sanitize(vacuum_id)}`,
                    "title": config.device.name
                },
                card
            ]
        });

    }

    yamlSave("valetudo.yaml", result);
    yamlSave("dashboard.yaml", dashboard);
}

main();

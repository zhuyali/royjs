
import Events from './events';
import {isPlainObject} from './utils';

const process = {
    get(options) {
        const { target, events } = options;
        return function getValue(path, slient = false) {
            if (!path) {
                return;
            }
            const field = path.split('.');
            let val, key;
            if (field.length) {
                key = field[0];
                // lists[1].name
                if (key.indexOf('[') >= 0) {
                    key = key.match(/(.*)\[(.*)\]/);
                    if (key) {
                        try {
                            val = target[key[1]][key[2]];
                        } catch (e) {
                            throw new Error(`state ${key[1]} is undefined!`);
                        }
                    }
                } else {
                    val = target[field[0]];
                }
                if (val) {
                    for (let i = 1; i < field.length; i++) {
                        val = val[field[i]];
                        /* eslint-disable */
                        if (val == null) {
                            break;
                        }
                    }
                }
            }
            if (!slient) {
                events.trigger('get', {
                    key: path
                });
            }
            return val;
        }
    },
    set(options) {
        const { events, target, parent } = options;
        const _set = function (object, path, value) {
            var keyNames = path.split('.'),
                keyName = keyNames[0],
                oldObject = object;

            object = object[keyName];
            if (typeof object == 'undefined') {
                object = observable({});
                object.on('get', (args) => {
                    const currentKey = `${keyName}.${args.key}`;
                    parent.trigger('get', {
                        key: currentKey
                    });
                });
                object.on('change', (args) => {
                    const currentKey = `${keyName}.${args.key}`;
                    parent.trigger('change', { ...args,
                        ...{
                            key: currentKey
                        }
                    });
                });
                oldObject[keyName] = object;
            }
            if (isPlainObject(object)) {
                keyNames.splice(0, 1);
                return object.set(keyNames.join('.'), value);
            }
        }
        return function setValue(path, value, config) {
            if (isPlainObject(path)) {
                Object.keys(path).forEach(key => {
                    let val = path[key];
                    setValue(key, val, value);
                });
                return;
            }
            let nested, getValue = process.get(options), currentValue = getValue(path, true);
            if (isPlainObject(value)) {
                value = observable(value);
                value.on('get', (args) => {
                    const currentKey = `${path}.${args.key}`;
                    parent.trigger('get', {
                        key: currentKey
                    });
                });
                value.on('change', (args) => {
                    const currentKey = `${path}.${args.key}`;
                    parent.trigger('change', { ...args,
                        ...{
                            key: currentKey
                        }
                    });
                });
            }
            if (path.indexOf('.') > 0) {
                nested = true;
            }
            if (nested) {
                _set(target, path, value);
            } else if (path.indexOf('[') >= 0) {
                let key = path.match(/(.*)\[(.*)\]/);
                if (key) {
                    target[key[1]].splice(key[2], 1, value);
                    return;
                } else {
                    throw new Error('Not right key' + path);
                }
            } else {
                target[path] = value;
            }
            if ((currentValue !== value || config.forceUpdate)) {
                events.trigger('change', {
                    key: path
                });
            }
        }
    },
    on(options) {
        return function on(...args) {
            const {events} = options;
            return events.on.apply(events, args);
        }
    },
    off(options) {
        return function off(...args) {
            const {events} = options;
            return events.off.apply(events, args);
        }
    },
    trigger(options) {
        return function trigger(...args) {
            const {events} = options;
            return events.trigger.apply(events, args);
        }
    }
};

const observable = function observable(object) {
    const proxy = function proxy(object, parent) {
        const events = new Events();
        const handler = {
            get(target, key) {
                if (process[key]) {
                    return process[key]({
                        target,
                        key,
                        events,
                        parent
                    });
                }
                const getValue = process.get({
                    target,
                    key,
                    events,
                    parent
                });
                if (key in target) {
                    return getValue(key);
                }
            },
            set(target, key, value) {
                return process.set({
                    target,
                    events,
                    parent
                })(key, value);
            }
        };
        return new Proxy(object, handler);
    };
    const ret = proxy(object);
    for (let key in object) {
        if (typeof object[key] === 'object') {
            object[key] = proxy(object[key], ret);
            object[key].on('get', function(args) {
                const currentKey = `${key}.${args.key}`;
                ret.trigger('get', {
                    key: currentKey
                });
            });
            object[key].on('change', function(args) {
                const currentKey = `${key}.${args.key}`;
                ret.trigger('change', { ...args,
                    ...{
                        key: currentKey
                    }
                });
            });
        }
    }
    return ret;
};

export default observable;
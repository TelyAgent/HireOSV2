// Child process for #116: registers each background poll the way Nest does, makes every database call fail, fires
// the registered timer callbacks and waits. Under Node's default policy an escaped rejection ends this process
// with a non-zero code; exiting 0 means every failure was caught at the poll boundary.
const dist = process.argv[2];
const { InterviewHandoffDispatcherService } = require(`${dist}/decisions/interview-handoff-dispatcher.service`);
const { DiscoveryService } = require(`${dist}/discovery/discovery.service`);
const { ImportsService } = require(`${dist}/intake/imports.service`);
const { ProfilesService } = require(`${dist}/profiles/profiles.service`);

const down = () => Promise.reject(new Error("Can't reach database server at db:5432"));
const db = new Proxy({}, { get: () => new Proxy({}, { get: () => down }) });
const callbacks = [];
globalThis.setInterval = (fn) => { callbacks.push(fn); return { unref() {} }; };
const quiet = { error() {}, warn() {}, log() {} };
const services = [
  new InterviewHandoffDispatcherService(db, { get: (_k, d) => d }),
  new DiscoveryService(db, {}),
  new ImportsService(db, {}, {}, {}),
  new ProfilesService(db, {}, {}, {}),
];
for (const s of services) { if (s.logger) Object.assign(s.logger, quiet); s.onModuleInit(); }
for (let round = 0; round < 3; round++) for (const fn of callbacks) fn();
setTimeout(() => { console.log(`ok ${callbacks.length}`); process.exit(0); }, 300);
